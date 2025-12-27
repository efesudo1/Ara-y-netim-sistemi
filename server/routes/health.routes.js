/**
 * KDS Araç Yönetim Sistemi - Health Routes
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// GET /api/health - Genel sağlık kontrolü
router.get('/', healthController.healthCheck);

// GET /api/health/db - Veritabanı bağlantı kontrolü
router.get('/db', healthController.checkDatabase);

// GET /api/health/charset - Charset/Collation kontrolü
router.get('/charset', healthController.checkCharset);

// GET /api/health/procedures - Stored Procedure kontrolü
router.get('/procedures', healthController.checkProcedures);

module.exports = router;
