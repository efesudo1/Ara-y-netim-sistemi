/**
 * Admin Route tanımlamaları
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { seedTokenMiddleware } = require('../middlewares/auth.middleware');

// POST /api/admin/seed - Veritabanı seed (dev ortamında veya token ile)
router.post('/seed', seedTokenMiddleware, adminController.seedDatabase);

// GET /api/admin/db-status - Veritabanı durumu
router.get('/db-status', adminController.getDatabaseStatus);

// POST /api/admin/test-overlap - Çakışma kontrolü testi
router.post('/test-overlap', adminController.testOverlapCheck);

// GET /api/admin/tour-distribution - Aylık tur dağılımı
router.get('/tour-distribution', adminController.getTourDistribution);

module.exports = router;
