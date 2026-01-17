/**
 * Admin Kullanıcı Model - Veritabanı işlemleri
 */

const { query } = require('../config/db');
const bcrypt = require('bcryptjs');

class AdminKullanici {
    constructor(data) {
        this.id = data.id;
        this.kullaniciAdi = data.kullanici_adi;
        this.sifreHash = data.sifre_hash;
        this.adSoyad = data.ad_soyad;
        this.email = data.email;
        this.olusturmaTarihi = data.olusturma_tarihi;
        this.sonGirisTarihi = data.son_giris_tarihi;
    }

    // Kullanıcı adına göre bul
    static async findByUsername(username) {
        const results = await query(
            'SELECT * FROM admin_kullanicilar WHERE kullanici_adi = ?',
            [username]
        );
        if (results.length === 0) return null;
        return new AdminKullanici(results[0]);
    }

    // ID'ye göre bul
    static async findById(id) {
        const results = await query(
            'SELECT * FROM admin_kullanicilar WHERE id = ?',
            [id]
        );
        if (results.length === 0) return null;
        return new AdminKullanici(results[0]);
    }

    // Şifre doğrulama
    async verifyPassword(password) {
        try {
            return await bcrypt.compare(password, this.sifreHash);
        } catch (e) {
            return false;
        }
    }

    // Son giriş tarihini güncelle
    async updateLastLogin() {
        await query(
            'UPDATE admin_kullanicilar SET son_giris_tarihi = NOW() WHERE id = ?',
            [this.id]
        );
    }

    // Şifre güncelle
    async updatePassword(newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await query(
            'UPDATE admin_kullanicilar SET sifre_hash = ? WHERE id = ?',
            [hashedPassword, this.id]
        );
    }
}

module.exports = AdminKullanici;
