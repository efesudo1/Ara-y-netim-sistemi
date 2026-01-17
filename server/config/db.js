/**
 * Veritabanı bağlantı yönetimi
 * MySQL connection pool ve yardımcı fonksiyonlar
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Bağlantı havuzu oluştur
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kds_arac_yonetim',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Bağlantı testi
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL veritabanına başarıyla bağlanıldı');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL bağlantı hatası:', error.message);
        return false;
    }
}

// Stored Procedure çağırma yardımcı fonksiyonu
async function callProcedure(procedureName, params = []) {
    try {
        const placeholders = params.map(() => '?').join(', ');
        const query = `CALL ${procedureName}(${placeholders})`;
        const [results] = await pool.execute(query, params);
        // SP genellikle ilk result set'i döndürür
        return results[0] || results;
    } catch (error) {
        console.error(`SP Hatası (${procedureName}):`, error.message);
        throw error;
    }
}

// Query çalıştırma
async function query(sql, params = []) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Query Hatası:', error.message);
        throw error;
    }
}

module.exports = {
    pool,
    testConnection,
    callProcedure,
    query
};
