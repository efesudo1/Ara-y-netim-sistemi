/**
 * KDS Araç Yönetim Sistemi - Ana Uygulama
 * Express + EJS + MySQL
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { testConnection } = require('./config/db');

// Routes
const authRoutes = require('./routes/auth.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');

// Middleware
const { authMiddleware, optionalAuth } = require('./middlewares/auth.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CORS (geliştirme için)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});




app.get('/', optionalAuth, (req, res) => {
    if (req.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// Login sayfası
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Dashboard sayfası (korumalı)
app.get('/dashboard', authMiddleware, (req, res) => {
    res.render('dashboard', {
        user: req.user,
        fleetCapacity: process.env.FLEET_CAPACITY || 250,
        tourPrice: process.env.TOUR_PRICE_TL || 5000
    });
});

// Logout
app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login');
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'Sayfa bulunamadı',
        error: { status: 404 }
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Sunucu hatası:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Sunucu hatası',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});



async function startServer() {
    // Veritabanı bağlantısını test et
    const dbConnected = await testConnection();

    if (!dbConnected) {
        console.error('⚠️  MySQL bağlantısı kurulamadı. XAMPP MySQL servisinin çalıştığından emin olun.');
        console.error('⚠️  Veritabanı oluşturmak için SQL dosyalarını çalıştırın:');
        console.error('    1. server/sql/01_schema.sql');
        console.error('    2. server/sql/02_procedures.sql');
        console.error('    3. server/sql/03_seed.sql');
    }

    app.listen(PORT, () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║         KDS ARAÇ YÖNETİM SİSTEMİ                          ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  🚀 Sunucu çalışıyor: http://localhost:${PORT}               ║`);
        console.log('║  📊 Dashboard: http://localhost:' + PORT + '/dashboard            ║');
        console.log('║                                                            ║');
        console.log('║  👤 Admin Giriş:                                           ║');
        console.log('║     Kullanıcı: admin                                       ║');
        console.log('║     Şifre: Admin123!                                       ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    });
}

startServer();
