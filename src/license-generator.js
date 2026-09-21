const crypto = require('crypto');

class LicenseGenerator {
  constructor() {
    this.secret = process.env.LICENSE_SECRET || 'CotizadorPro_License_Secret_2024';
  }

  generateLicense(ownerName, expirationDays = 365) {
    const licenseId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      id: licenseId,
      owner: ownerName,
      created: createdAt,
      expires: expiresAt,
      features: ['pdf', 'history', 'clients', 'reports'],
      maxUsers: 1
    };

    const signature = this.signPayload(payload);
    const licenseKey = Buffer.from(JSON.stringify({ payload, signature })).toString('base64');

    return {
      licenseKey,
      payload,
      signature
    };
  }

  signPayload(payload) {
    return crypto
      .createHmac('sha256', this.secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  validateLicense(licenseKey) {
    try {
      const decoded = JSON.parse(Buffer.from(licenseKey, 'base64').toString());
      const { payload, signature } = decoded;

      const expectedSignature = this.signPayload(payload);
      if (signature !== expectedSignature) {
        return { valid: false, error: 'Licencia invalida o manipulada' };
      }

      if (new Date(payload.expires) < new Date()) {
        return { valid: false, error: 'Licencia expirada' };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, error: 'Formato de licencia invalido' };
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const ownerName = args[0] || 'Cliente Ejemplo';
  const days = parseInt(args[1]) || 365;

  const gen = new LicenseGenerator();
  const license = gen.generateLicense(ownerName, days);

  console.log('\n=== GENERADOR DE LICENCIAS CotizadorPro ===\n');
  console.log(`Propietario: ${ownerName}`);
  console.log(`Expira en: ${days} dias`);
  console.log(`ID: ${license.payload.id}`);
  console.log(`Creada: ${license.payload.created}`);
  console.log(`Expira: ${license.payload.expires}`);
  console.log(`Caracteristicas: ${license.payload.features.join(', ')}`);
  console.log(`\nClave de Licencia:\n${license.licenseKey}\n`);
}

module.exports = new LicenseGenerator();
