/**
 * KDS Araç Yönetim Sistemi - Auth Routes
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// POST /auth/login - Admin girişi
router.post('/login', authController.login);

// POST /auth/logout - Çıkış
router.post('/logout', authController.logout);

// GET /auth/me - Mevcut kullanıcı (korumalı)
router.get('/me', authMiddleware, authController.me);

module.exports = router;
