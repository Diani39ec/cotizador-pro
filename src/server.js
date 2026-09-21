require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');
const pdfGenerator = require('./pdf-generator');
const licenseGenerator = require('./license-generator');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones, intente de nuevo en 15 minutos' }
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login, intente de nuevo en 15 minutos' }
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalido o expirado' });
  }
};

// Input validation helper
const validateInput = (data, requiredFields) => {
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      return { valid: false, error: `El campo ${field} es requerido` };
    }
  }
  return { valid: true };
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
};

// ===== AUTH ROUTES =====
app.post('/api/auth/register', authLimiter, (req, res) => {
  try {
    const { username, password, business_name, business_address, business_phone, business_email, business_rfc } = req.body;

    const validation = validateInput(req.body, ['username', 'password', 'business_name']);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existingUser = db.getOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }

    const userId = db.createUser({
      username: sanitizeString(username),
      password,
      business_name: sanitizeString(business_name),
      business_address: sanitizeString(business_address || ''),
      business_phone: sanitizeString(business_phone || ''),
      business_email: sanitizeString(business_email || ''),
      business_rfc: sanitizeString(business_rfc || '')
    });

    const token = jwt.sign({ id: userId, username }, process.env.JWT_SECRET, { expiresIn: '24h' });

    db.logAudit(userId, 'register', 'Nuevo usuario registrado', req.ip);

    res.json({ token, user: { id: userId, username, business_name } });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { username, password } = req.body;

    const validation = validateInput(req.body, ['username', 'password']);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const user = db.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });

    db.logAudit(user.id, 'login', 'Inicio de sesion exitoso', req.ip);

    res.json({ token, user });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ===== CLIENT ROUTES =====
app.get('/api/clients', authenticateToken, (req, res) => {
  try {
    const clients = db.getClients(req.user.id);
    res.json(clients);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({ error: 'Error obteniendo clientes' });
  }
});

app.post('/api/clients', authenticateToken, (req, res) => {
  try {
    const validation = validateInput(req.body, ['name']);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const clientId = db.createClient(req.user.id, {
      name: sanitizeString(req.body.name),
      company: sanitizeString(req.body.company || ''),
      email: sanitizeString(req.body.email || ''),
      phone: sanitizeString(req.body.phone || ''),
      address: sanitizeString(req.body.address || ''),
      rfc: sanitizeString(req.body.rfc || '')
    });

    db.logAudit(req.user.id, 'create_client', `Cliente creado: ${req.body.name}`, req.ip);

    res.json({ id: clientId, message: 'Cliente creado exitosamente' });
  } catch (error) {
    console.error('Error creando cliente:', error);
    res.status(500).json({ error: 'Error creando cliente' });
  }
});

app.put('/api/clients/:id', authenticateToken, (req, res) => {
  try {
    const validation = validateInput(req.body, ['name']);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    db.updateClient(req.params.id, {
      name: sanitizeString(req.body.name),
      company: sanitizeString(req.body.company || ''),
      email: sanitizeString(req.body.email || ''),
      phone: sanitizeString(req.body.phone || ''),
      address: sanitizeString(req.body.address || ''),
      rfc: sanitizeString(req.body.rfc || '')
    });

    db.logAudit(req.user.id, 'update_client', `Cliente actualizado: ${req.params.id}`, req.ip);

    res.json({ message: 'Cliente actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({ error: 'Error actualizando cliente' });
  }
});

app.delete('/api/clients/:id', authenticateToken, (req, res) => {
  try {
    db.deleteClient(req.params.id);
    db.logAudit(req.user.id, 'delete_client', `Cliente eliminado: ${req.params.id}`, req.ip);
    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando cliente:', error);
    res.status(500).json({ error: 'Error eliminando cliente' });
  }
});

// ===== QUOTE ROUTES =====
app.get('/api/quotes', authenticateToken, (req, res) => {
  try {
    const quotes = db.getQuotes(req.user.id);
    res.json(quotes);
  } catch (error) {
    console.error('Error obteniendo cotizaciones:', error);
    res.status(500).json({ error: 'Error obteniendo cotizaciones' });
  }
});

app.get('/api/quotes/:id', authenticateToken, (req, res) => {
  try {
    const quote = db.getQuoteById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Cotizacion no encontrada' });
    }
    res.json(quote);
  } catch (error) {
    console.error('Error obteniendo cotizacion:', error);
    res.status(500).json({ error: 'Error obteniendo cotizacion' });
  }
});

app.post('/api/quotes', authenticateToken, (req, res) => {
  try {
    const validation = validateInput(req.body, ['client_id', 'items']);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ error: 'Debe agregar al menos un concepto' });
    }

    for (const item of req.body.items) {
      const itemValidation = validateInput(item, ['description', 'quantity', 'unit_price']);
      if (!itemValidation.valid) {
        return res.status(400).json({ error: `Concepto: ${itemValidation.error}` });
      }
    }

    const result = db.createQuote(req.user.id, {
      client_id: req.body.client_id,
      title: sanitizeString(req.body.title || ''),
      notes: sanitizeString(req.body.notes || ''),
      valid_until: req.body.valid_until || null,
      tax_rate: parseFloat(req.body.tax_rate) || 16.0,
      discount: parseFloat(req.body.discount) || 0,
      items: req.body.items.map(item => ({
        description: sanitizeString(item.description),
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0
      }))
    });

    db.logAudit(req.user.id, 'create_quote', `Cotizacion creada: ${result.quoteNumber}`, req.ip);

    res.json(result);
  } catch (error) {
    console.error('Error creando cotizacion:', error);
    res.status(500).json({ error: 'Error creando cotizacion' });
  }
});

app.put('/api/quotes/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado invalido' });
    }

    db.updateQuoteStatus(req.params.id, status);
    db.logAudit(req.user.id, 'update_quote_status', `Cotizacion ${req.params.id} cambiada a ${status}`, req.ip);

    res.json({ message: 'Estado actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando estado:', error);
    res.status(500).json({ error: 'Error actualizando estado' });
  }
});

// ===== PDF ROUTE =====
app.get('/api/quotes/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const quote = db.getQuoteById(req.params.id);
    if (!quote) {
      return res.status(404).json({ error: 'Cotizacion no encontrada' });
    }

    const businessInfo = db.getUser(req.user.id);
    const pdfPath = await pdfGenerator.generateQuotePDF(quote, businessInfo);

    db.logAudit(req.user.id, 'generate_pdf', `PDF generado: ${quote.quote_number}`, req.ip);

    res.download(pdfPath, `cotizacion_${quote.quote_number}.pdf`, (err) => {
      if (err) {
        console.error('Error descargando PDF:', err);
        res.status(500).json({ error: 'Error generando PDF' });
      }
    });
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ error: 'Error generando PDF' });
  }
});

// ===== DASHBOARD ROUTE =====
app.get('/api/dashboard', authenticateToken, (req, res) => {
  try {
    const stats = db.getDashboardStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadisticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadisticas' });
  }
});

// ===== USER PROFILE ROUTES =====
app.get('/api/profile', authenticateToken, (req, res) => {
  try {
    const user = db.getUser(req.user.id);
    res.json(user);
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
});

app.put('/api/profile', authenticateToken, (req, res) => {
  try {
    db.updateUser(req.user.id, {
      business_name: sanitizeString(req.body.business_name || ''),
      business_address: sanitizeString(req.body.business_address || ''),
      business_phone: sanitizeString(req.body.business_phone || ''),
      business_email: sanitizeString(req.body.business_email || ''),
      business_rfc: sanitizeString(req.body.business_rfc || '')
    });

    db.logAudit(req.user.id, 'update_profile', 'Perfil actualizado', req.ip);

    res.json({ message: 'Perfil actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error actualizando perfil' });
  }
});

// Serve main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`\n================================`);
  console.log(`  CotizadorPro v1.0.0`);
  console.log(`  Servidor corriendo en puerto ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`================================\n`);
});

module.exports = app;
