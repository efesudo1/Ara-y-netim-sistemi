/**
 * KDS Araç Yönetim Sistemi - Admin Controller
 * Seed ve yönetim endpoint'leri
 */

const { callProcedure, query, pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

/**
 * Veritabanı seed işlemi
 * POST /api/admin/seed
 */
async function seedDatabase(req, res) {
    try {
        console.log('📦 Seed işlemi başlatılıyor...');

        // 1. Temel verileri yükle
        console.log('  → Temel veriler yükleniyor...');
        const baseResult = await callProcedure('sp_temel_veri_yukle', []);
        console.log('  ✓ Temel veriler yüklendi');

        // 2. Turları oluştur
        console.log('  → Turlar oluşturuluyor (bu biraz sürebilir)...');
        const tourResult = await callProcedure('sp_turlari_olustur', ['2022-04-10', '2025-11-10']);
        console.log('  ✓ Turlar oluşturuldu');

        // 3. Admin şifresini güncelle (bcrypt hash)
        console.log('  → Admin şifresi güncelleniyor...');
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        await query(
            'UPDATE admin_kullanicilar SET sifre_hash = ? WHERE kullanici_adi = ?',
            [hashedPassword, 'admin']
        );
        console.log('  ✓ Admin şifresi güncellendi');

        // 4. İstatistikleri al
        const [stats] = await query(`
            SELECT 
                (SELECT COUNT(*) FROM guzergahlar) as guzergah_sayisi,
                (SELECT COUNT(*) FROM araclar) as arac_sayisi,
                (SELECT COUNT(*) FROM turlar) as tur_sayisi,
                (SELECT COUNT(*) FROM admin_kullanicilar) as admin_sayisi
        `);

        console.log('✅ Seed işlemi tamamlandı');

        res.json({
            success: true,
            message: 'Veritabanı seed işlemi başarıyla tamamlandı.',
            data: {
                guzergahSayisi: stats.guzergah_sayisi,
                aracSayisi: stats.arac_sayisi,
                turSayisi: stats.tur_sayisi,
                adminSayisi: stats.admin_sayisi
            },
            credentials: {
                username: 'admin',
                password: 'Admin123!'
            }
        });

    } catch (error) {
        console.error('❌ Seed hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Seed işlemi sırasında hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Veritabanı durumu
 * GET /api/admin/db-status
 */
async function getDatabaseStatus(req, res) {
    try {
        const [stats] = await query(`
            SELECT 
                (SELECT COUNT(*) FROM guzergahlar) as guzergah_sayisi,
                (SELECT COUNT(*) FROM araclar) as arac_sayisi,
                (SELECT COUNT(*) FROM turlar) as tur_sayisi,
                (SELECT COUNT(*) FROM admin_kullanicilar) as admin_sayisi,
                (SELECT MIN(baslangic_tarihi) FROM turlar) as ilk_tur_tarihi,
                (SELECT MAX(bitis_tarihi) FROM turlar) as son_tur_tarihi
        `);

        res.json({
            success: true,
            data: {
                guzergahSayisi: stats.guzergah_sayisi,
                aracSayisi: stats.arac_sayisi,
                turSayisi: stats.tur_sayisi,
                adminSayisi: stats.admin_sayisi,
                ilkTurTarihi: stats.ilk_tur_tarihi,
                sonTurTarihi: stats.son_tur_tarihi,
                seedGerekli: stats.tur_sayisi === 0
            }
        });

    } catch (error) {
        console.error('DB durum hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Veritabanı durumu alınamadı.',
            error: error.message
        });
    }
}

/**
 * Çakışma kontrolü testi
 * POST /api/admin/test-overlap
 */
async function testOverlapCheck(req, res) {
    try {
        const { routeId, vehicleId, startDate, endDate, paxCount, priceTl } = req.body;

        // sp_tur_olustur çağır - çakışma varsa hata verecek
        const result = await callProcedure('sp_tur_olustur', [
            routeId || 1,
            vehicleId,
            startDate,
            endDate,
            paxCount || 5,
            priceTl || 5000
        ]);

        res.json({
            success: true,
            message: 'Tur başarıyla oluşturuldu (çakışma yok)',
            data: result
        });

    } catch (error) {
        // SQLSTATE 45000 = çakışma hatası
        if (error.message.includes('başka bir turda kullanılmaktadır')) {
            return res.status(409).json({
                success: false,
                message: 'Çakışma tespit edildi!',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Test sırasında hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Aylık tur dağılımı kontrolü
 * GET /api/admin/tour-distribution
 */
async function getTourDistribution(req, res) {
    try {
        const distribution = await query(`
            SELECT 
                YEAR(baslangic_tarihi) AS yil,
                MONTH(baslangic_tarihi) AS ay,
                COUNT(*) AS tur_sayisi,
                CASE 
                    WHEN MONTH(baslangic_tarihi) IN (4,5,6,9,10) THEN 'YOĞUN'
                    ELSE 'NORMAL'
                END AS sezon_tipi
            FROM turlar
            GROUP BY YEAR(baslangic_tarihi), MONTH(baslangic_tarihi)
            ORDER BY yil, ay
        `);

        // Sezon bazında ortalamalar
        const [averages] = await query(`
            SELECT 
                AVG(CASE WHEN MONTH(baslangic_tarihi) IN (4,5,6,9,10) THEN cnt END) as yogun_ortalama,
                AVG(CASE WHEN MONTH(baslangic_tarihi) NOT IN (4,5,6,9,10) THEN cnt END) as normal_ortalama
            FROM (
                SELECT MONTH(baslangic_tarihi) as ay, COUNT(*) as cnt
                FROM turlar
                GROUP BY YEAR(baslangic_tarihi), MONTH(baslangic_tarihi)
            ) monthly
        `);

        res.json({
            success: true,
            data: {
                distribution,
                averages: {
                    yogunSezonOrtalama: Math.round(averages.yogun_ortalama || 0),
                    normalSezonOrtalama: Math.round(averages.normal_ortalama || 0)
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Dağılım verisi alınamadı.',
            error: error.message
        });
    }
}

module.exports = {
    seedDatabase,
    getDatabaseStatus,
    testOverlapCheck,
    getTourDistribution
};
