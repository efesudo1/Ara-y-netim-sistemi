/**
 * Araç Model - Veritabanı işlemleri
 */

const { query, callProcedure } = require('../config/db');

class Arac {
    constructor(data) {
        this.id = data.id;
        this.plaka = data.plaka;
        this.kapasite = data.kapasite;
        this.marka = data.marka;
        this.model = data.model;
        this.satinAlmaYili = data.satin_alma_yili;
        this.durum = data.durum;
        this.olusturmaTarihi = data.olusturma_tarihi;
    }

    // Tüm araçları getir
    static async getAll() {
        const results = await query('SELECT * FROM araclar ORDER BY id');
        return results.map(row => new Arac(row));
    }

    // ID'ye göre araç getir
    static async getById(id) {
        const results = await query('SELECT * FROM araclar WHERE id = ?', [id]);
        if (results.length === 0) return null;
        return new Arac(results[0]);
    }

    // Aktif araçları getir
    static async getActive() {
        const results = await query('SELECT * FROM araclar WHERE durum = ?', ['aktif']);
        return results.map(row => new Arac(row));
    }

    // Toplam araç sayısı
    static async count() {
        const [result] = await query('SELECT COUNT(*) as total FROM araclar');
        return result.total;
    }

    // Belirli tarih aralığında müsait araçları getir
    static async getAvailable(startDate, endDate) {
        const sql = `
            SELECT a.* FROM araclar a
            WHERE a.durum = 'aktif'
            AND a.id NOT IN (
                SELECT DISTINCT arac_id FROM turlar
                WHERE arac_id IS NOT NULL
                AND (? < bitis_tarihi AND ? > baslangic_tarihi)
            )
        `;
        const results = await query(sql, [startDate, endDate]);
        return results.map(row => new Arac(row));
    }
}

module.exports = Arac;
