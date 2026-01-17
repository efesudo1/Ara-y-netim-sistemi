/**
 * Güzergah Model - Veritabanı işlemleri
 */

const { query } = require('../config/db');

class Guzergah {
    constructor(data) {
        this.id = data.id;
        this.guzergahAdi = data.guzergah_adi;
        this.aciklama = data.aciklama;
        this.sureGun = data.sure_gun;
        this.aktif = data.aktif;
        this.olusturmaTarihi = data.olusturma_tarihi;
    }

    // Tüm güzergahları getir
    static async getAll() {
        const results = await query('SELECT * FROM guzergahlar ORDER BY id');
        return results.map(row => new Guzergah(row));
    }

    // ID'ye göre güzergah getir
    static async getById(id) {
        const results = await query('SELECT * FROM guzergahlar WHERE id = ?', [id]);
        if (results.length === 0) return null;
        return new Guzergah(results[0]);
    }

    // Aktif güzergahları getir
    static async getActive() {
        const results = await query('SELECT * FROM guzergahlar WHERE aktif = 1');
        return results.map(row => new Guzergah(row));
    }

    // Güzergah bazlı tur istatistikleri
    static async getStats(startDate, endDate) {
        const sql = `
            SELECT 
                g.id,
                g.guzergah_adi,
                COUNT(t.id) as tur_sayisi,
                SUM(t.fiyat_tl) as toplam_gelir,
                AVG(t.yolcu_sayisi) as ortalama_yolcu
            FROM guzergahlar g
            LEFT JOIN turlar t ON g.id = t.guzergah_id
                AND DATE(t.baslangic_tarihi) BETWEEN ? AND ?
            GROUP BY g.id, g.guzergah_adi
            ORDER BY tur_sayisi DESC
        `;
        return await query(sql, [startDate, endDate]);
    }
}

module.exports = Guzergah;
