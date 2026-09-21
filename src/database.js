const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'data', 'cotizador.db');
    this.ready = this.initDatabase();
  }

  async initDatabase() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON');
    this.createTables();
    this.save();
    return true;
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  runQuery(sql, params = []) {
    this.db.run(sql, params);
  }

  getOne(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const values = stmt.get();
      stmt.free();
      const row = {};
      cols.forEach((col, i) => { row[col] = values[i]; });
      return row;
    }
    stmt.free();
    return null;
  }

  getAll(sql, params = []) {
    const results = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      const cols = stmt.getColumnNames();
      const values = stmt.get();
      const row = {};
      cols.forEach((col, i) => { row[col] = values[i]; });
      results.push(row);
    }
    stmt.free();
    return results;
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        business_name TEXT,
        business_address TEXT,
        business_phone TEXT,
        business_email TEXT,
        business_rfc TEXT,
        logo_path TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        rfc TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        quote_number TEXT UNIQUE NOT NULL,
        title TEXT,
        status TEXT DEFAULT 'pending',
        subtotal REAL DEFAULT 0,
        tax_rate REAL DEFAULT 16.0,
        tax_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        notes TEXT,
        valid_until DATETIME,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS quote_items (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL DEFAULT 1,
        unit_price REAL DEFAULT 0,
        total REAL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `);
  }

  createUser(userData) {
    const id = crypto.randomUUID();
    const hashedPassword = bcrypt.hashSync(userData.password, 10);

    this.runQuery(`
      INSERT INTO users (id, username, password, business_name, business_address, business_phone, business_email, business_rfc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userData.username, hashedPassword, userData.business_name, userData.business_address || '', userData.business_phone || '', userData.business_email || '', userData.business_rfc || '']);

    this.save();
    return id;
  }

  authenticateUser(username, password) {
    const user = this.getOne('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return null;

    if (bcrypt.compareSync(password, user.password)) {
      delete user.password;
      return user;
    }
    return null;
  }

  createClient(userId, clientData) {
    const id = crypto.randomUUID();

    this.runQuery(`
      INSERT INTO clients (id, user_id, name, company, email, phone, address, rfc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, clientData.name, clientData.company || '', clientData.email || '', clientData.phone || '', clientData.address || '', clientData.rfc || '']);

    this.save();
    return id;
  }

  getClients(userId) {
    return this.getAll('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  updateClient(clientId, clientData) {
    this.runQuery(`
      UPDATE clients SET name=?, company=?, email=?, phone=?, address=?, rfc=?
      WHERE id=?
    `, [clientData.name, clientData.company || '', clientData.email || '', clientData.phone || '', clientData.address || '', clientData.rfc || '', clientId]);

    this.save();
  }

  deleteClient(clientId) {
    this.runQuery('DELETE FROM clients WHERE id = ?', [clientId]);
    this.save();
  }

  createQuote(userId, quoteData) {
    const id = crypto.randomUUID();
    const quoteNumber = this.generateQuoteNumber(userId);

    const subtotal = quoteData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = subtotal * (quoteData.tax_rate / 100);
    const total = subtotal + taxAmount - (quoteData.discount || 0);

    this.runQuery(`
      INSERT INTO quotes (id, user_id, client_id, quote_number, title, notes, valid_until, subtotal, tax_rate, tax_amount, discount, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, quoteData.client_id, quoteNumber, quoteData.title || '', quoteData.notes || '', quoteData.valid_until || '', subtotal, quoteData.tax_rate || 16.0, taxAmount, quoteData.discount || 0, total]);

    if (quoteData.items && quoteData.items.length > 0) {
      quoteData.items.forEach(item => {
        const itemTotal = item.quantity * item.unit_price;
        this.runQuery(`
          INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [crypto.randomUUID(), id, item.description, item.quantity, item.unit_price, itemTotal]);
      });
    }

    this.save();
    return { id, quoteNumber, total };
  }

  generateQuoteNumber(userId) {
    const lastQuote = this.getOne(`
      SELECT quote_number FROM quotes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `, [userId]);

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    if (!lastQuote) {
      return `COT-${year}${month}-0001`;
    }

    const lastNum = parseInt(lastQuote.quote_number.split('-').pop());
    const newNum = (lastNum + 1).toString().padStart(4, '0');
    return `COT-${year}${month}-${newNum}`;
  }

  getQuotes(userId) {
    return this.getAll(`
      SELECT q.*, c.name as client_name, c.company as client_company
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      WHERE q.user_id = ?
      ORDER BY q.created_at DESC
    `, [userId]);
  }

  getQuoteById(quoteId) {
    const quote = this.getOne(`
      SELECT q.*, c.name as client_name, c.company as client_company, c.email as client_email, c.phone as client_phone, c.address as client_address, c.rfc as client_rfc
      FROM quotes q
      JOIN clients c ON q.client_id = c.id
      WHERE q.id = ?
    `, [quoteId]);

    if (quote) {
      quote.items = this.getAll('SELECT * FROM quote_items WHERE quote_id = ?', [quoteId]);
    }

    return quote;
  }

  updateQuoteStatus(quoteId, status) {
    this.runQuery("UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, quoteId]);
    this.save();
  }

  logAudit(userId, action, details, ipAddress) {
    this.runQuery(`
      INSERT INTO audit_log (id, user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `, [crypto.randomUUID(), userId, action, details, ipAddress || '']);
    this.save();
  }

  getUser(userId) {
    const user = this.getOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (user) delete user.password;
    return user;
  }

  updateUser(userId, userData) {
    this.runQuery(`
      UPDATE users SET business_name=?, business_address=?, business_phone=?, business_email=?, business_rfc=?, updated_at=datetime('now')
      WHERE id=?
    `, [userData.business_name || '', userData.business_address || '', userData.business_phone || '', userData.business_email || '', userData.business_rfc || '', userId]);
    this.save();
  }

  getDashboardStats(userId) {
    const totalQuotes = this.getOne('SELECT COUNT(*) as count FROM quotes WHERE user_id = ?', [userId]).count;
    const pendingQuotes = this.getOne("SELECT COUNT(*) as count FROM quotes WHERE user_id = ? AND status = 'pending'", [userId]).count;
    const acceptedQuotes = this.getOne("SELECT COUNT(*) as count FROM quotes WHERE user_id = ? AND status = 'accepted'", [userId]).count;
    const totalRevenue = this.getOne("SELECT COALESCE(SUM(total), 0) as total FROM quotes WHERE user_id = ? AND status = 'accepted'", [userId]).total;
    const totalClients = this.getOne('SELECT COUNT(*) as count FROM clients WHERE user_id = ?', [userId]).count;

    return {
      totalQuotes,
      pendingQuotes,
      acceptedQuotes,
      totalRevenue,
      totalClients
    };
  }

  close() {
    this.save();
    this.db.close();
  }
}

const instance = new DatabaseManager();
module.exports = instance;
