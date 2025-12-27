/**
 * KDS Araç Yönetim Sistemi - Health Controller
 * Sistem sağlık kontrolleri
 */

const { pool, query } = require('../config/db');

/**
 * Veritabanı bağlantı kontrolü
 * GET /api/health/db
 */
async function checkDatabase(req, res) {
    const startTime = Date.now();

    try {
        // Basit SELECT 1 testi
        const [rows] = await pool.execute('SELECT 1 as ok');

        // Tablo sayılarını kontrol et
        const tableCheck = await query(`
            SELECT 
                (SELECT COUNT(*) FROM guzergahlar) as guzergah_sayisi,
                (SELECT COUNT(*) FROM araclar) as arac_sayisi,
                (SELECT COUNT(*) FROM turlar) as tur_sayisi,
                (SELECT COUNT(*) FROM admin_kullanicilar) as admin_sayisi
        `);

        const responseTime = Date.now() - startTime;

        res.json({
            status: 'ok',
            db: true,
            time: new Date().toISOString(),
            responseMs: responseTime,
            tables: tableCheck[0] || tableCheck,
            seedRequired: (tableCheck[0]?.tur_sayisi || tableCheck?.tur_sayisi || 0) === 0
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;

        res.status(503).json({
            status: 'error',
            db: false,
            time: new Date().toISOString(),
            responseMs: responseTime,
            error: error.message,
            hint: 'XAMPP MySQL servisinin çalıştığından ve veritabanının oluşturulduğundan emin olun.'
        });
    }
}

/**
 * Charset/Collation kontrolü
 * GET /api/health/charset
 */
async function checkCharset(req, res) {
    try {
        // Veritabanı charset
        const [dbCharset] = await pool.execute(`
            SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME 
            FROM information_schema.SCHEMATA 
            WHERE SCHEMA_NAME = ?
        `, [process.env.DB_NAME || 'kds_arac_yonetim']);

        // Tablo collation'ları
        const [tableCollations] = await pool.execute(`
            SELECT TABLE_NAME, TABLE_COLLATION 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ?
        `, [process.env.DB_NAME || 'kds_arac_yonetim']);

        const isCorrect = dbCharset[0]?.DEFAULT_COLLATION_NAME === 'utf8mb4_turkish_ci';

        res.json({
            status: isCorrect ? 'ok' : 'warning',
            database: dbCharset[0],
            tables: tableCollations,
            expected: 'utf8mb4_turkish_ci'
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
}

/**
 * Stored Procedure kontrolü
 * GET /api/health/procedures
 */
async function checkProcedures(req, res) {
    try {
        const [procedures] = await pool.execute(`
            SELECT ROUTINE_NAME, ROUTINE_TYPE, CREATED 
            FROM information_schema.ROUTINES 
            WHERE ROUTINE_SCHEMA = ?
            ORDER BY ROUTINE_NAME
        `, [process.env.DB_NAME || 'kds_arac_yonetim']);

        const expectedProcedures = [
            'sp_temel_veri_yukle',
            'sp_turlari_olustur',
            'sp_tur_olustur',
            'sp_rapor_tur_yogunluk',
            'sp_rapor_guzergah_hacim',
            'sp_rapor_filo_eszamanlilik',
            'sp_rapor_aylik_filo_denge',
            'sp_yonetici_oneri'
        ];

        const foundNames = procedures.map(p => p.ROUTINE_NAME);
        const missing = expectedProcedures.filter(p => !foundNames.includes(p));

        res.json({
            status: missing.length === 0 ? 'ok' : 'warning',
            found: procedures,
            expected: expectedProcedures,
            missing: missing
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
}

/**
 * Genel sistem sağlık kontrolü
 * GET /api/health
 */
async function healthCheck(req, res) {
    const checks = {
        server: true,
        database: false,
        tables: false,
        procedures: false
    };

    try {
        // DB bağlantı
        await pool.execute('SELECT 1');
        checks.database = true;

        // Tablolar
        const [tables] = await pool.execute(`
            SELECT COUNT(*) as cnt FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = ?
        `, [process.env.DB_NAME || 'kds_arac_yonetim']);
        checks.tables = tables[0].cnt >= 5;

        // Prosedürler
        const [procs] = await pool.execute(`
            SELECT COUNT(*) as cnt FROM information_schema.ROUTINES 
            WHERE ROUTINE_SCHEMA = ?
        `, [process.env.DB_NAME || 'kds_arac_yonetim']);
        checks.procedures = procs[0].cnt >= 8;

    } catch (error) {
        // Error handled, checks remain false
    }

    const allOk = Object.values(checks).every(v => v);

    res.status(allOk ? 200 : 503).json({
        status: allOk ? 'healthy' : 'unhealthy',
        time: new Date().toISOString(),
        checks
    });
}

module.exports = {
    checkDatabase,
    checkCharset,
    checkProcedures,
    healthCheck
};
