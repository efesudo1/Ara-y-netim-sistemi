/**
 * Migration Script - Remove dis_arac_mi references from stored procedures
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kds_arac_yonetim',
        multipleStatements: true
    });

    console.log('🔄 Stored procedure\'leri güncelleniyor...');

    try {
        // sp_rapor_aylik_filo_denge
        await connection.query('DROP PROCEDURE IF EXISTS sp_rapor_aylik_filo_denge');
        await connection.query(`
            CREATE PROCEDURE sp_rapor_aylik_filo_denge(IN p_yil INT)
            BEGIN
                SELECT 
                    MONTH(baslangic_tarihi) AS ay,
                    ELT(MONTH(baslangic_tarihi), 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık') AS ay_adi,
                    COUNT(*) AS tur_sayisi,
                    COUNT(DISTINCT DATE(baslangic_tarihi)) AS aktif_gun,
                    ROUND(COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi)), 1) AS peak_eszamanli_arac,
                    40 AS filo_kapasitesi,
                    CASE WHEN COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi)) > 40 
                         THEN ROUND(COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi)) - 40) ELSE 0 END AS arac_yetersizligi,
                    CASE WHEN COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi)) < 40 
                         THEN ROUND(40 - COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi))) ELSE 0 END AS arac_fazlaligi,
                    CASE 
                        WHEN COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi)) > 40 THEN 'YETERSİZ'
                        WHEN COUNT(*) / COUNT(DISTINCT DATE(baslangic_tarihi)) < 25 THEN 'FAZLA'
                        ELSE 'NORMAL'
                    END AS durum
                FROM turlar
                WHERE YEAR(baslangic_tarihi) = p_yil
                GROUP BY MONTH(baslangic_tarihi)
                ORDER BY ay;
            END
        `);
        console.log('  ✅ sp_rapor_aylik_filo_denge');

        // sp_rapor_filo_eszamanlilik
        await connection.query('DROP PROCEDURE IF EXISTS sp_rapor_filo_eszamanlilik');
        await connection.query(`
            CREATE PROCEDURE sp_rapor_filo_eszamanlilik(IN p_baslangic DATE, IN p_bitis DATE)
            BEGIN
                DECLARE v_max_concurrent INT DEFAULT 0;
                
                SELECT MAX(concurrent_count) INTO v_max_concurrent
                FROM (
                    SELECT DATE(baslangic_tarihi) as gun, COUNT(*) as concurrent_count
                    FROM turlar
                    WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                    GROUP BY DATE(baslangic_tarihi)
                ) daily_counts;
                
                SELECT 
                    (SELECT COUNT(*) FROM turlar WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis) AS toplam_tur_sayisi,
                    (SELECT COUNT(DISTINCT arac_id) FROM turlar WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis AND arac_id IS NOT NULL) AS benzersiz_arac_sayisi,
                    COALESCE(v_max_concurrent, 0) AS peak_eszamanli_arac,
                    40 AS filo_kapasitesi,
                    CASE WHEN COALESCE(v_max_concurrent, 0) > 40 THEN COALESCE(v_max_concurrent, 0) - 40 ELSE 0 END AS arac_yetersizligi,
                    CASE WHEN COALESCE(v_max_concurrent, 0) < 40 THEN 40 - COALESCE(v_max_concurrent, 0) ELSE 0 END AS arac_fazlaligi;
            END
        `);
        console.log('  ✅ sp_rapor_filo_eszamanlilik');

        // sp_rapor_tur_yogunluk
        await connection.query('DROP PROCEDURE IF EXISTS sp_rapor_tur_yogunluk');
        await connection.query(`
            CREATE PROCEDURE sp_rapor_tur_yogunluk(IN p_baslangic DATE, IN p_bitis DATE, IN p_gruplama VARCHAR(10))
            BEGIN
                IF p_gruplama = 'month' THEN
                    SELECT 
                        YEAR(baslangic_tarihi) AS yil,
                        MONTH(baslangic_tarihi) AS ay,
                        DATE_FORMAT(baslangic_tarihi, '%Y-%m') AS ay_yil,
                        COUNT(*) AS tur_sayisi,
                        SUM(fiyat_tl) AS toplam_gelir
                    FROM turlar
                    WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                    GROUP BY YEAR(baslangic_tarihi), MONTH(baslangic_tarihi)
                    ORDER BY yil, ay;
                ELSEIF p_gruplama = 'year' THEN
                    SELECT 
                        YEAR(baslangic_tarihi) AS yil,
                        COUNT(*) AS tur_sayisi,
                        SUM(fiyat_tl) AS toplam_gelir
                    FROM turlar
                    WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                    GROUP BY YEAR(baslangic_tarihi)
                    ORDER BY yil;
                ELSE
                    SELECT 
                        YEAR(baslangic_tarihi) AS yil,
                        WEEK(baslangic_tarihi, 1) AS hafta,
                        COUNT(*) AS tur_sayisi,
                        SUM(fiyat_tl) AS toplam_gelir
                    FROM turlar
                    WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                    GROUP BY YEAR(baslangic_tarihi), WEEK(baslangic_tarihi, 1)
                    ORDER BY yil, hafta;
                END IF;
            END
        `);
        console.log('  ✅ sp_rapor_tur_yogunluk');

        // sp_yonetici_oneri
        await connection.query('DROP PROCEDURE IF EXISTS sp_yonetici_oneri');
        await connection.query(`
            CREATE PROCEDURE sp_yonetici_oneri(IN p_yil INT)
            BEGIN
                DECLARE v_avg_high DECIMAL(10,2) DEFAULT 0;
                DECLARE v_avg_low DECIMAL(10,2) DEFAULT 0;
                
                SELECT AVG(daily_count) INTO v_avg_high
                FROM (
                    SELECT COUNT(*) as daily_count FROM turlar
                    WHERE YEAR(baslangic_tarihi) = p_yil AND MONTH(baslangic_tarihi) IN (4,5,6,9,10)
                    GROUP BY DATE(baslangic_tarihi)
                ) t;
                
                SELECT AVG(daily_count) INTO v_avg_low
                FROM (
                    SELECT COUNT(*) as daily_count FROM turlar
                    WHERE YEAR(baslangic_tarihi) = p_yil AND MONTH(baslangic_tarihi) NOT IN (4,5,6,9,10)
                    GROUP BY DATE(baslangic_tarihi)
                ) t;
                
                SELECT 
                    p_yil AS analiz_yili,
                    ROUND(COALESCE(v_avg_high, 0)) AS yogun_sezon_max_peak,
                    ROUND(COALESCE(v_avg_high, 0)) AS yogun_sezon_ort_peak,
                    ROUND(COALESCE(v_avg_low, 0)) AS dusuk_sezon_min_peak,
                    ROUND(COALESCE(v_avg_low, 0)) AS dusuk_sezon_ort_peak,
                    40 AS mevcut_filo,
                    CASE 
                        WHEN COALESCE(v_avg_high, 0) > 40 
                        THEN CONCAT('Yoğun sezonda ', ROUND(COALESCE(v_avg_high, 0) - 40), ' adet ek araç önerilir.')
                        ELSE 'Mevcut filo yoğun sezon için yeterli.'
                    END AS yogun_sezon_onerisi,
                    CASE 
                        WHEN COALESCE(v_avg_low, 0) < 20 
                        THEN CONCAT('Düşük sezonda ', ROUND(40 - COALESCE(v_avg_low, 0)), ' araç kiraya verilebilir.')
                        ELSE 'Düşük sezonda filo kullanımı makul.'
                    END AS dusuk_sezon_onerisi;
            END
        `);
        console.log('  ✅ sp_yonetici_oneri');

        console.log('');
        console.log('✅ Migration tamamlandı!');

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
