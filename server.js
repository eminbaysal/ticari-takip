require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const path = require('path');

const requireAuth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const firmalarRoutes = require('./routes/firmalar');
const hizmetlerRoutes = require('./routes/hizmetler');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB bağlantısı başarılı.'))
  .catch(err => {
    console.error('MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'gizli-anahtar',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 saat
}));

// Statik dosyalar (login sayfası için auth gerekmez)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Auth rotaları (korumasız)
app.use('/api/auth', authRoutes);

// Login sayfası
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ana sayfa - korumalı
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Firma detay sayfası - korumalı
app.get('/firma/:id', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'firma.html'));
});

// Korumalı API rotaları
app.use('/api/firmalar', requireAuth, firmalarRoutes);
app.use('/api/hizmetler', requireAuth, hizmetlerRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Sayfa bulunamadı.' });
});

// Global hata yakalayıcı
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
