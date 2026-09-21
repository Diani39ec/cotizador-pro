class CotizadorApp {
  constructor() {
    this.token = localStorage.getItem('token');
    this.currentSection = 'dashboard';
    this.clients = [];
    this.quotes = [];
    this.init();
  }

  init() {
    if (this.token) {
      this.showApp();
      this.loadDashboard();
    } else {
      this.showAuth();
    }
    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('loginForm')?.addEventListener('submit', (e) => this.handleLogin(e));
    document.getElementById('registerForm')?.addEventListener('submit', (e) => this.handleRegister(e));

    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.navigateTo(item.dataset.section));
    });

    document.getElementById('clientForm')?.addEventListener('submit', (e) => this.handleSaveClient(e));
    document.getElementById('quoteForm')?.addEventListener('submit', (e) => this.handleSaveQuote(e));
    document.getElementById('profileForm')?.addEventListener('submit', (e) => this.handleSaveProfile(e));

    document.getElementById('addItemBtn')?.addEventListener('click', () => this.addQuoteItem());
    document.getElementById('quoteClient')?.addEventListener('change', () => this.updateQuoteTotals());

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeAllModals();
      });
    });

    document.getElementById('searchQuotes')?.addEventListener('input', (e) => this.filterQuotes(e.target.value));
    document.getElementById('searchClients')?.addEventListener('input', (e) => this.filterClients(e.target.value));
  }

  // ===== API Calls =====
  async apiCall(endpoint, method = 'GET', body = null) {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      }
    };
    if (body) config.body = JSON.stringify(body);

    try {
      const response = await fetch(`/api${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la peticion');
      }

      return data;
    } catch (error) {
      this.showToast(error.message, 'error');
      throw error;
    }
  }

  // ===== Auth =====
  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const data = await this.apiCall('/auth/login', 'POST', { username, password });
      this.token = data.token;
      localStorage.setItem('token', data.token);
      this.showApp();
      this.loadDashboard();
      this.showToast('Sesion iniciada exitosamente', 'success');
    } catch (error) {
      // Error handled in apiCall
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const formData = {
      username: document.getElementById('regUsername').value,
      password: document.getElementById('regPassword').value,
      business_name: document.getElementById('regBusinessName').value,
      business_address: document.getElementById('regBusinessAddress').value,
      business_phone: document.getElementById('regBusinessPhone').value,
      business_email: document.getElementById('regBusinessEmail').value,
      business_rfc: document.getElementById('regBusinessRFC').value
    };

    try {
      const data = await this.apiCall('/auth/register', 'POST', formData);
      this.token = data.token;
      localStorage.setItem('token', data.token);
      this.showApp();
      this.loadDashboard();
      this.showToast('Cuenta creada exitosamente', 'success');
    } catch (error) {
      // Error handled in apiCall
    }
  }

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Form`).style.display = 'block';
  }

  // ===== Navigation =====
  showAuth() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appLayout').style.display = 'none';
  }

  showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appLayout').style.display = 'block';
  }

  navigateTo(section) {
    this.currentSection = section;
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${section}`)?.classList.add('active');

    switch (section) {
      case 'dashboard': this.loadDashboard(); break;
      case 'clients': this.loadClients(); break;
      case 'quotes': this.loadQuotes(); break;
      case 'profile': this.loadProfile(); break;
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    this.showAuth();
    this.showToast('Sesion cerrada', 'info');
  }

  // ===== Dashboard =====
  async loadDashboard() {
    try {
      const stats = await this.apiCall('/dashboard');
      document.getElementById('statTotalQuotes').textContent = stats.totalQuotes;
      document.getElementById('statPendingQuotes').textContent = stats.pendingQuotes;
      document.getElementById('statAcceptedQuotes').textContent = stats.acceptedQuotes;
      document.getElementById('statTotalRevenue').textContent = `$${stats.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
      document.getElementById('statTotalClients').textContent = stats.totalClients;
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  }

  // ===== Clients =====
  async loadClients() {
    try {
      this.clients = await this.apiCall('/clients');
      this.renderClientsTable(this.clients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }

  renderClientsTable(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;

    if (clients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="icon">&#128100;</div>
              <h3>No hay clientes registrados</h3>
              <p>Agrega tu primer cliente para comenzar</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = clients.map(client => `
      <tr>
        <td><strong>${this.escapeHtml(client.name)}</strong></td>
        <td>${this.escapeHtml(client.company || '-')}</td>
        <td>${this.escapeHtml(client.email || '-')}</td>
        <td>${this.escapeHtml(client.phone || '-')}</td>
        <td>${this.escapeHtml(client.rfc || '-')}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" onclick="app.editClient('${client.id}')" title="Editar">&#9998;</button>
            <button class="btn-icon danger" onclick="app.deleteClient('${client.id}')" title="Eliminar">&#128465;</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  filterClients(query) {
    const filtered = this.clients.filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(query.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(query.toLowerCase()))
    );
    this.renderClientsTable(filtered);
  }

  openClientModal(client = null) {
    const modal = document.getElementById('clientModal');
    const title = document.getElementById('clientModalTitle');
    const form = document.getElementById('clientForm');

    form.reset();
    if (client) {
      title.textContent = 'Editar Cliente';
      document.getElementById('clientId').value = client.id;
      document.getElementById('clientName').value = client.name;
      document.getElementById('clientCompany').value = client.company || '';
      document.getElementById('clientEmail').value = client.email || '';
      document.getElementById('clientPhone').value = client.phone || '';
      document.getElementById('clientAddress').value = client.address || '';
      document.getElementById('clientRFC').value = client.rfc || '';
    } else {
      title.textContent = 'Nuevo Cliente';
      document.getElementById('clientId').value = '';
    }

    modal.classList.add('active');
  }

  async editClient(id) {
    const client = this.clients.find(c => c.id === id);
    if (client) this.openClientModal(client);
  }

  async handleSaveClient(e) {
    e.preventDefault();
    const id = document.getElementById('clientId').value;
    const data = {
      name: document.getElementById('clientName').value,
      company: document.getElementById('clientCompany').value,
      email: document.getElementById('clientEmail').value,
      phone: document.getElementById('clientPhone').value,
      address: document.getElementById('clientAddress').value,
      rfc: document.getElementById('clientRFC').value
    };

    try {
      if (id) {
        await this.apiCall(`/clients/${id}`, 'PUT', data);
        this.showToast('Cliente actualizado exitosamente', 'success');
      } else {
        await this.apiCall('/clients', 'POST', data);
        this.showToast('Cliente creado exitosamente', 'success');
      }
      this.closeAllModals();
      this.loadClients();
    } catch (error) {
      // Error handled in apiCall
    }
  }

  async deleteClient(id) {
    if (!confirm('¿Estas seguro de eliminar este cliente?')) return;

    try {
      await this.apiCall(`/clients/${id}`, 'DELETE');
      this.showToast('Cliente eliminado exitosamente', 'success');
      this.loadClients();
    } catch (error) {
      // Error handled in apiCall
    }
  }

  // ===== Quotes =====
  async loadQuotes() {
    try {
      this.quotes = await this.apiCall('/quotes');
      await this.loadClients();
      this.populateClientDropdown();
      this.renderQuotesTable(this.quotes);
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
  }

  renderQuotesTable(quotes) {
    const tbody = document.getElementById('quotesTableBody');
    if (!tbody) return;

    if (quotes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="icon">&#128196;</div>
              <h3>No hay cotizaciones</h3>
              <p>Crea tu primera cotizacion para comenzar</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = quotes.map(quote => `
      <tr>
        <td><strong>${this.escapeHtml(quote.quote_number)}</strong></td>
        <td>${this.escapeHtml(quote.client_name)}${quote.client_company ? `<br><small>${this.escapeHtml(quote.client_company)}</small>` : ''}</td>
        <td>${quote.title ? this.escapeHtml(quote.title) : '-'}</td>
        <td>$${quote.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td>${new Date(quote.created_at).toLocaleDateString('es-MX')}</td>
        <td><span class="status-badge ${quote.status}">${this.getStatusLabel(quote.status)}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" onclick="app.viewQuote('${quote.id}')" title="Ver">&#128065;</button>
            <button class="btn-icon" onclick="app.downloadPDF('${quote.id}')" title="PDF">&#128196;</button>
            <button class="btn-icon" onclick="app.changeQuoteStatus('${quote.id}')" title="Cambiar estado">&#9881;</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  filterQuotes(query) {
    const filtered = this.quotes.filter(q =>
      q.quote_number.toLowerCase().includes(query.toLowerCase()) ||
      q.client_name.toLowerCase().includes(query.toLowerCase()) ||
      (q.title && q.title.toLowerCase().includes(query.toLowerCase()))
    );
    this.renderQuotesTable(filtered);
  }

  populateClientDropdown() {
    const select = document.getElementById('quoteClient');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar cliente...</option>';
    this.clients.forEach(client => {
      select.innerHTML += `<option value="${client.id}">${this.escapeHtml(client.name)}${client.company ? ` (${this.escapeHtml(client.company)})` : ''}</option>`;
    });
  }

  openQuoteModal() {
    const form = document.getElementById('quoteForm');
    form.reset();
    document.getElementById('quoteItems').innerHTML = '';
    document.getElementById('quoteSubtotal').textContent = '$0.00';
    document.getElementById('quoteTax').textContent = '$0.00';
    document.getElementById('quoteTotal').textContent = '$0.00';
    this.addQuoteItem();

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    document.getElementById('quoteValidUntil').value = validUntil.toISOString().split('T')[0];

    document.getElementById('quoteModal').classList.add('active');
  }

  addQuoteItem() {
    const container = document.getElementById('quoteItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'quote-item fade-in';
    itemDiv.innerHTML = `
      <div class="form-group">
        <label>Concepto</label>
        <input type="text" class="item-description" required placeholder="Descripcion del producto/servicio">
      </div>
      <div class="form-group">
        <label>Cantidad</label>
        <input type="number" class="item-quantity" value="1" min="0.01" step="0.01" required onchange="app.updateQuoteTotals()">
      </div>
      <div class="form-group">
        <label>Precio Unitario</label>
        <input type="number" class="item-price" value="0" min="0" step="0.01" required onchange="app.updateQuoteTotals()">
      </div>
      <div class="quote-item-actions">
        <button type="button" class="btn-icon danger" onclick="this.closest('.quote-item').remove(); app.updateQuoteTotals();" title="Eliminar">&#128465;</button>
      </div>
    `;
    container.appendChild(itemDiv);
    this.updateQuoteTotals();
  }

  updateQuoteTotals() {
    const items = document.querySelectorAll('.quote-item');
    let subtotal = 0;

    items.forEach(item => {
      const qty = parseFloat(item.querySelector('.item-quantity')?.value) || 0;
      const price = parseFloat(item.querySelector('.item-price')?.value) || 0;
      subtotal += qty * price;
    });

    const taxRate = parseFloat(document.getElementById('quoteTaxRate')?.value) || 16;
    const discount = parseFloat(document.getElementById('quoteDiscount')?.value) || 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax - discount;

    document.getElementById('quoteSubtotal').textContent = `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    document.getElementById('quoteTax').textContent = `$${tax.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    document.getElementById('quoteTotal').textContent = `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  }

  async handleSaveQuote(e) {
    e.preventDefault();
    const items = [];
    document.querySelectorAll('.quote-item').forEach(itemDiv => {
      items.push({
        description: itemDiv.querySelector('.item-description').value,
        quantity: parseFloat(itemDiv.querySelector('.item-quantity').value),
        unit_price: parseFloat(itemDiv.querySelector('.item-price').value)
      });
    });

    const data = {
      client_id: document.getElementById('quoteClient').value,
      title: document.getElementById('quoteTitle').value,
      notes: document.getElementById('quoteNotes').value,
      tax_rate: parseFloat(document.getElementById('quoteTaxRate').value) || 16,
      discount: parseFloat(document.getElementById('quoteDiscount').value) || 0,
      valid_until: document.getElementById('quoteValidUntil').value || null,
      items
    };

    if (!data.client_id) {
      this.showToast('Selecciona un cliente', 'error');
      return;
    }

    if (items.length === 0) {
      this.showToast('Agrega al menos un concepto', 'error');
      return;
    }

    try {
      await this.apiCall('/quotes', 'POST', data);
      this.showToast('Cotizacion creada exitosamente', 'success');
      this.closeAllModals();
      this.loadQuotes();
    } catch (error) {
      // Error handled in apiCall
    }
  }

  async viewQuote(id) {
    try {
      const quote = await this.apiCall(`/quotes/${id}`);
      this.renderQuoteDetail(quote);
      document.getElementById('quoteDetailModal').classList.add('active');
    } catch (error) {
      console.error('Error viewing quote:', error);
    }
  }

  renderQuoteDetail(quote) {
    const content = document.getElementById('quoteDetailContent');
    content.innerHTML = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div>
          <h3 style="color: var(--primary); margin-bottom: 10px;">Datos del Negocio</h3>
          <p><strong>Folio:</strong> ${this.escapeHtml(quote.quote_number)}</p>
          <p><strong>Fecha:</strong> ${new Date(quote.created_at).toLocaleDateString('es-MX')}</p>
          <p><strong>Valido hasta:</strong> ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-MX') : 'N/A'}</p>
          <p><strong>Estado:</strong> <span class="status-badge ${quote.status}">${this.getStatusLabel(quote.status)}</span></p>
        </div>
        <div>
          <h3 style="color: var(--primary); margin-bottom: 10px;">Datos del Cliente</h3>
          <p><strong>Nombre:</strong> ${this.escapeHtml(quote.client_name)}</p>
          ${quote.client_company ? `<p><strong>Empresa:</strong> ${this.escapeHtml(quote.client_company)}</p>` : ''}
          ${quote.client_email ? `<p><strong>Email:</strong> ${this.escapeHtml(quote.client_email)}</p>` : ''}
          ${quote.client_phone ? `<p><strong>Tel:</strong> ${this.escapeHtml(quote.client_phone)}</p>` : ''}
          ${quote.client_rfc ? `<p><strong>RFC:</strong> ${this.escapeHtml(quote.client_rfc)}</p>` : ''}
        </div>
      </div>
      ${quote.title ? `<h3 style="color: var(--primary); margin-bottom: 10px;">${this.escapeHtml(quote.title)}</h3>` : ''}
      <table style="width:100%; margin-bottom: 20px;">
        <thead>
          <tr>
            <th>Concepto</th>
            <th style="text-align:center">Cant.</th>
            <th style="text-align:right">P. Unitario</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${quote.items.map(item => `
            <tr>
              <td>${this.escapeHtml(item.description)}</td>
              <td style="text-align:center">${item.quantity}</td>
              <td style="text-align:right">$${item.unit_price.toFixed(2)}</td>
              <td style="text-align:right">$${item.total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="text-align:right; margin-bottom: 20px;">
        <p>Subtotal: <strong>$${quote.subtotal.toFixed(2)}</strong></p>
        <p>IVA (${quote.tax_rate}%): <strong>$${quote.tax_amount.toFixed(2)}</strong></p>
        ${quote.discount > 0 ? `<p>Descuento: <strong>-$${quote.discount.toFixed(2)}</strong></p>` : ''}
        <p style="font-size:18px; color: var(--primary);">TOTAL: <strong>$${quote.total.toFixed(2)}</strong></p>
      </div>
      ${quote.notes ? `<div style="background: #fffbeb; padding: 12px; border-radius: 8px;"><strong>Notas:</strong> ${this.escapeHtml(quote.notes)}</div>` : ''}
    `;
  }

  async downloadPDF(id) {
    try {
      const response = await fetch(`/api/quotes/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      if (!response.ok) throw new Error('Error generando PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.showToast('PDF descargado exitosamente', 'success');
    } catch (error) {
      this.showToast('Error al descargar PDF', 'error');
    }
  }

  async changeQuoteStatus(id) {
    const quote = this.quotes.find(q => q.id === id);
    if (!quote) return;

    const statuses = ['pending', 'accepted', 'rejected', 'expired'];
    const currentIndex = statuses.indexOf(quote.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    if (confirm(`Cambiar estado a "${this.getStatusLabel(nextStatus)}"?`)) {
      try {
        await this.apiCall(`/quotes/${id}/status`, 'PUT', { status: nextStatus });
        this.showToast('Estado actualizado', 'success');
        this.loadQuotes();
      } catch (error) {
        // Error handled in apiCall
      }
    }
  }

  // ===== Profile =====
  async loadProfile() {
    try {
      const profile = await this.apiCall('/profile');
      document.getElementById('profileBusinessName').value = profile.business_name || '';
      document.getElementById('profileBusinessAddress').value = profile.business_address || '';
      document.getElementById('profileBusinessPhone').value = profile.business_phone || '';
      document.getElementById('profileBusinessEmail').value = profile.business_email || '';
      document.getElementById('profileBusinessRFC').value = profile.business_rfc || '';
      document.getElementById('profileUsername').textContent = profile.username;
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  async handleSaveProfile(e) {
    e.preventDefault();
    const data = {
      business_name: document.getElementById('profileBusinessName').value,
      business_address: document.getElementById('profileBusinessAddress').value,
      business_phone: document.getElementById('profileBusinessPhone').value,
      business_email: document.getElementById('profileBusinessEmail').value,
      business_rfc: document.getElementById('profileBusinessRFC').value
    };

    try {
      await this.apiCall('/profile', 'PUT', data);
      this.showToast('Perfil actualizado exitosamente', 'success');
    } catch (error) {
      // Error handled in apiCall
    }
  }

  // ===== Helpers =====
  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
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

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

const app = new CotizadorApp();
