/**
 * KDS Araç Yönetim Sistemi - Analytics Routes
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

// GET /api/analytics/summary - Dashboard özet verileri
router.get('/summary', analyticsController.getDashboardSummary);

// GET /api/analytics/tour-volume - Tur yoğunluğu raporu
router.get('/tour-volume', analyticsController.getTourVolume);

// GET /api/analytics/route-volume - Güzergah bazlı hacim
router.get('/route-volume', analyticsController.getRouteVolume);

// GET /api/analytics/fleet-concurrency - Filo eşzamanlılık
router.get('/fleet-concurrency', analyticsController.getFleetConcurrency);

// GET /api/analytics/monthly-fleet-balance - Aylık filo dengesi
router.get('/monthly-fleet-balance', analyticsController.getMonthlyFleetBalance);

// GET /api/analytics/recommendations - Yönetici önerileri
router.get('/recommendations', analyticsController.getRecommendations);

// GET /api/analytics/daily-tours - Günlük tur verileri (Takvim için)
router.get('/daily-tours', analyticsController.getDailyTours);

module.exports = router;
