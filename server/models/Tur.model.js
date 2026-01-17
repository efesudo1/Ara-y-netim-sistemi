/**
 * Tur Model - Veritabanı işlemleri
 */

const { query, callProcedure } = require('../config/db');

class Tur {
    constructor(data) {
        this.id = data.id;
        this.guzergahId = data.guzergah_id;
        this.aracId = data.arac_id;
        this.baslangicTarihi = data.baslangic_tarihi;
        this.bitisTarihi = data.bitis_tarihi;
        this.yolcuSayisi = data.yolcu_sayisi;
        this.fiyatTl = data.fiyat_tl;
        this.notlar = data.notlar;
        this.disAracMi = data.dis_arac_mi;
        this.olusturmaTarihi = data.olusturma_tarihi;
    }

    // Yeni tur oluştur (iş kuralları dahil)
    static async create(turData) {
        const result = await callProcedure('sp_tur_olustur', [
            turData.guzergahId,
            turData.aracId,
            turData.baslangicTarihi,
            turData.bitisTarihi,
            turData.yolcuSayisi,
            turData.fiyatTl
        ]);
        return result;
    }

    // Tüm turları getir
    static async getAll(limit = 100) {
        const results = await query('SELECT * FROM turlar ORDER BY baslangic_tarihi DESC LIMIT ?', [limit]);
        return results.map(row => new Tur(row));
    }

    // ID'ye göre tur getir
    static async getById(id) {
        const results = await query('SELECT * FROM turlar WHERE id = ?', [id]);
        if (results.length === 0) return null;
        return new Tur(results[0]);
    }

    // Tarih aralığına göre turları getir
    static async getByDateRange(startDate, endDate) {
        const sql = `
            SELECT * FROM turlar 
            WHERE DATE(baslangic_tarihi) BETWEEN ? AND ?
            ORDER BY baslangic_tarihi
        `;
        const results = await query(sql, [startDate, endDate]);
        return results.map(row => new Tur(row));
    }

    // Güzergaha göre turları getir
    static async getByRoute(guzergahId) {
        const results = await query('SELECT * FROM turlar WHERE guzergah_id = ?', [guzergahId]);
        return results.map(row => new Tur(row));
    }

    // Toplam tur sayısı
    static async count() {
        const [result] = await query('SELECT COUNT(*) as total FROM turlar');
        return result.total;
    }

    // Tur yoğunluğu raporu
    static async getVolumeReport(startDate, endDate, groupBy) {
        return await callProcedure('sp_rapor_tur_yogunluk', [startDate, endDate, groupBy]);
    }

    // Filo eşzamanlılık raporu
    static async getConcurrencyReport(startDate, endDate) {
        return await callProcedure('sp_rapor_filo_eszamanlilik', [startDate, endDate]);
    }
}

module.exports = Tur;
