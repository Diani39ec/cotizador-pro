const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateQuotePDF(quote, businessInfo) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const filename = `cotizacion_${quote.quote_number}.pdf`;
      const filepath = path.join(this.outputDir, filename);
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      this.addHeader(doc, businessInfo, quote);
      this.addClientInfo(doc, quote);
      this.addItemsTable(doc, quote);
      this.addTotals(doc, quote);
      this.addFooter(doc, businessInfo, quote);

      doc.end();

      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    });
  }

  addHeader(doc, businessInfo, quote) {
    doc.fontSize(24).font('Helvetica-Bold').text(businessInfo.business_name || 'Mi Empresa', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#666666');
    doc.text(businessInfo.business_address || '');
    doc.text(`Tel: ${businessInfo.business_phone || ''} | Email: ${businessInfo.business_email || ''}`);
    doc.text(`RFC: ${businessInfo.business_rfc || ''}`);
    doc.moveDown(1);

    doc.fillColor('#2563eb').rect(50, doc.y, 495, 1).fill();
    doc.moveDown(0.5);

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#2563eb').text('COTIZACION', { align: 'right' });
    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Folio: ${quote.quote_number}`, { align: 'right' });
    doc.text(`Fecha: ${new Date(quote.created_at).toLocaleDateString('es-MX')}`, { align: 'right' });
    doc.text(`Valido hasta: ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-MX') : 'No especificado'}`, { align: 'right' });
    doc.text(`Estado: ${this.getStatusLabel(quote.status)}`, { align: 'right' });
    doc.moveDown(1);

    if (quote.title) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333').text(quote.title);
      doc.moveDown(0.5);
    }
  }

  addClientInfo(doc, quote) {
    doc.fillColor('#f3f4f6').rect(50, doc.y, 495, 25).fill();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('  DATOS DEL CLIENTE', 50, doc.y + 6);
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica').fillColor('#333333');
    doc.text(`Cliente: ${quote.client_name}`, 50);
    if (quote.client_company) doc.text(`Empresa: ${quote.client_company}`, 50);
    if (quote.client_email) doc.text(`Email: ${quote.client_email}`, 50);
    if (quote.client_phone) doc.text(`Telefono: ${quote.client_phone}`, 50);
    if (quote.client_address) doc.text(`Direccion: ${quote.client_address}`, 50);
    if (quote.client_rfc) doc.text(`RFC: ${quote.client_rfc}`, 50);
    doc.moveDown(1);
  }

  addItemsTable(doc, quote) {
    doc.fillColor('#2563eb').rect(50, doc.y, 495, 25).fill();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Concepto', 55, doc.y + 6, { width: 220 });
    doc.text('Cant.', 280, doc.y - 13, { width: 50, align: 'center' });
    doc.text('Precio Unit.', 335, doc.y - 13, { width: 80, align: 'right' });
    doc.text('Total', 435, doc.y - 13, { width: 100, align: 'right' });
    doc.moveDown(0.8);

    let y = doc.y;
    doc.fontSize(9).font('Helvetica').fillColor('#333333');

    if (quote.items && quote.items.length > 0) {
      quote.items.forEach((item, index) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        if (index % 2 === 0) {
          doc.fillColor('#f9fafb').rect(50, y - 2, 495, 20).fill();
        }

        doc.fillColor('#333333');
        doc.text(item.description, 55, y, { width: 220 });
        doc.text(item.quantity.toString(), 280, y, { width: 50, align: 'center' });
        doc.text(`$${item.unit_price.toFixed(2)}`, 335, y, { width: 80, align: 'right' });
        doc.text(`$${item.total.toFixed(2)}`, 435, y, { width: 100, align: 'right' });
        y += 20;
      });
    } else {
      doc.text('No hay conceptos', 250, y, { align: 'center' });
      y += 20;
    }

    doc.y = y + 5;
  }

  addTotals(doc, quote) {
    const totalsX = 350;
    const totalsWidth = 195;

    doc.fillColor('#f3f4f6').rect(totalsX - 10, doc.y, totalsWidth + 10, 80).fill();
    doc.fillColor('#333333');

    doc.fontSize(10).font('Helvetica');
    doc.text('Subtotal:', totalsX, doc.y + 5, { width: 100, align: 'right' });
    doc.text(`$${quote.subtotal.toFixed(2)}`, totalsX + 100, doc.y - 13, { width: 85, align: 'right' });

    doc.text(`IVA (${quote.tax_rate}%):`, totalsX, doc.y + 5, { width: 100, align: 'right' });
    doc.text(`$${quote.tax_amount.toFixed(2)}`, totalsX + 100, doc.y - 13, { width: 85, align: 'right' });

    if (quote.discount > 0) {
      doc.text('Descuento:', totalsX, doc.y + 5, { width: 100, align: 'right' });
      doc.text(`-$${quote.discount.toFixed(2)}`, totalsX + 100, doc.y - 13, { width: 85, align: 'right' });
    }

    doc.fillColor('#2563eb').rect(totalsX - 10, doc.y + 2, totalsWidth + 10, 25).fill();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('TOTAL:', totalsX, doc.y + 6, { width: 100, align: 'right' });
    doc.text(`$${quote.total.toFixed(2)}`, totalsX + 100, doc.y - 14, { width: 85, align: 'right' });
    doc.moveDown(2);
  }

  addFooter(doc, businessInfo, quote) {
    if (quote.notes) {
      doc.fillColor('#fffbeb').rect(50, doc.y, 495, 60).fill();
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#92400e').text('Notas:', 55, doc.y + 5);
      doc.font('Helvetica').fillColor('#333333').text(quote.notes, 55, doc.y + 5, { width: 485 });
      doc.moveDown(2);
    }

    doc.moveDown(2);
    doc.fillColor('#e5e7eb').rect(50, doc.y, 495, 1).fill();
    doc.moveDown(0.5);

    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text('Este documento fue generado por CotizadorPro - Sistema Profesional de Cotizaciones', 50, doc.y, { align: 'center' });
    doc.text(`Generado el ${new Date().toLocaleString('es-MX')}`, 50, doc.y + 2, { align: 'center' });
  }

  getStatusLabel(status) {
    const labels = {
      pending: 'Pendiente',
      accepted: 'Aceptada',
      rejected: 'Rechazada',
      expired: 'Expirada'
    };
    return labels[status] || status;
  }
}

module.exports = new PDFGenerator();
