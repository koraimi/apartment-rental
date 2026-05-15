require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ HELMET CONFIGURATION (Safe for file uploads) ============
app.use(helmet({
  // Disable CSP for now (can be enabled later with proper config)
  contentSecurityPolicy: false,
  // Allow cross-origin embedding
  crossOriginEmbedderPolicy: false,
  // Allow cross-origin resource sharing
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Allow iframes (for future use)
  frameguard: { action: "sameorigin" },
}));

// ============ CORS CONFIGURATION ============
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL || 'https://yourdomain.onrender.com', 'http://localhost:3000']
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// ============ BODY PARSERS ============
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ STATIC FILES ============
// Uploads folder must be served first
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ============ ROUTES ============
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// ============ ADMIN HTML FILES ============
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});
app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/login.html'));
});
app.get('/admin/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/dashboard.html'));
});
app.get('/admin/apartment-form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/apartment-form.html'));
});
app.get('/admin/payments.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/payments.html'));
});
app.get('/admin/listing-requests.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/listing-requests.html'));
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads: http://localhost:${PORT}/uploads/`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin/login.html`);
  console.log(`🛡️ Helmet security headers enabled (CSP disabled for file uploads)`);
});