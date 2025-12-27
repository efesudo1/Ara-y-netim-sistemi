/**
 * KDS Araç Yönetim Sistemi - Veritabanı Kurulum Scripti
 * XAMPP MySQL için otomatik veritabanı oluşturma ve seed
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'kds_arac_yonetim';

async function setup() {
    let connection;

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     KDS VERİTABANI KURULUM SCRİPTİ                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    try {
        // 1. MySQL'e bağlan (veritabanı olmadan)
        console.log('📡 MySQL\'e bağlanılıyor...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('   ✅ MySQL bağlantısı başarılı');

        // 2. Veritabanını oluştur veya sıfırla
        console.log('');
        console.log('📦 Veritabanı hazırlanıyor...');

        // Önce mevcut veritabanını sil (temiz kurulum için)
        await connection.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);

        await connection.query(`
            CREATE DATABASE ${DB_NAME}
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_turkish_ci
        `);
        console.log(`   ✅ Veritabanı "${DB_NAME}" oluşturuldu (utf8mb4_turkish_ci)`);

        // 3. Veritabanını seç
        await connection.query(`USE ${DB_NAME}`);

        // 4. Tabloları oluştur
        console.log('');
        console.log('📋 Tablolar oluşturuluyor...');

        // admin_kullanicilar
        await connection.query(`
            CREATE TABLE admin_kullanicilar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kullanici_adi VARCHAR(50) NOT NULL UNIQUE,
                sifre_hash VARCHAR(255) NOT NULL,
                ad_soyad VARCHAR(100),
                email VARCHAR(100),
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                son_giris_tarihi DATETIME NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci
        `);
        console.log('   ✅ admin_kullanicilar');

        // guzergahlar
        await connection.query(`
            CREATE TABLE guzergahlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guzergah_adi VARCHAR(100) NOT NULL,
                aciklama TEXT,
                sure_gun INT DEFAULT 2,
                aktif TINYINT(1) DEFAULT 1,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci
        `);
        console.log('   ✅ guzergahlar');

        // araclar
        await connection.query(`
            CREATE TABLE araclar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                plaka VARCHAR(15) NOT NULL UNIQUE,
                kapasite INT NOT NULL DEFAULT 10,
                marka VARCHAR(50),
                model VARCHAR(50),
                satin_alma_yili INT,
                durum ENUM('aktif', 'pasif', 'bakimda') DEFAULT 'aktif',
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci
        `);
        console.log('   ✅ araclar');

        // turlar
        await connection.query(`
            CREATE TABLE turlar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guzergah_id INT NOT NULL,
                arac_id INT NULL,
                baslangic_tarihi DATETIME NOT NULL,
                bitis_tarihi DATETIME NOT NULL,
                yolcu_sayisi INT NOT NULL DEFAULT 5,
                fiyat_tl DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
                notlar TEXT,
                olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_turlar_guzergah FOREIGN KEY (guzergah_id) REFERENCES guzergahlar(id),
                CONSTRAINT fk_turlar_arac FOREIGN KEY (arac_id) REFERENCES araclar(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci
        `);
        console.log('   ✅ turlar');

        // tur_log (trigger log tablosu)
        await connection.query(`
            CREATE TABLE tur_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                islem_tipi ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
                tur_id INT NOT NULL,
                eski_degerler JSON,
                yeni_degerler JSON,
                islem_zamani DATETIME DEFAULT CURRENT_TIMESTAMP,
                islem_yapan VARCHAR(100) DEFAULT 'system'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci
        `);
        console.log('   ✅ tur_log');

        // İndeksler
        await connection.query(`CREATE INDEX idx_turlar_baslangic ON turlar(baslangic_tarihi)`);
        await connection.query(`CREATE INDEX idx_turlar_bitis ON turlar(bitis_tarihi)`);
        await connection.query(`CREATE INDEX idx_turlar_arac_tarih ON turlar(arac_id, baslangic_tarihi, bitis_tarihi)`);
        await connection.query(`CREATE INDEX idx_turlar_guzergah_tarih ON turlar(guzergah_id, baslangic_tarihi)`);
        console.log('   ✅ İndeksler');

        // 5. Stored Procedures
        console.log('');
        console.log('⚙️  Stored Procedure\'ler oluşturuluyor...');

        // Prosedürleri SQL dosyasından oku ve çalıştır
        const proceduresPath = path.join(__dirname, 'sql', '02_procedures.sql');
        const proceduresSql = fs.readFileSync(proceduresPath, 'utf8');

        // Her prosedürü ayrı ayrı çalıştır
        await createProcedures(connection, proceduresSql);
        console.log('   ✅ Stored Procedure\'ler oluşturuldu');

        // 6. Temel verileri yükle
        console.log('');
        console.log('🌱 Veriler yükleniyor...');

        // Admin ekle
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        await connection.query(`
            INSERT INTO admin_kullanicilar (kullanici_adi, sifre_hash, ad_soyad, email)
            VALUES ('admin', ?, 'Sistem Yöneticisi', 'admin@kds.com')
        `, [hashedPassword]);
        console.log('   ✅ Admin kullanıcı eklendi');

        // Güzergahlar ekle
        await connection.query(`
            INSERT INTO guzergahlar (guzergah_adi, aciklama, sure_gun) VALUES
            ('Muğla', 'Muğla ve çevresi kültür turu', 2),
            ('İzmir – Efes Antik Kenti', 'İzmir Efes ve antik kentler turu', 2),
            ('Kapadokya', 'Kapadokya balon ve doğa turu', 3),
            ('İstanbul', 'İstanbul tarihi yarımada turu', 2)
        `);
        console.log('   ✅ 4 güzergah eklendi');

        // 40 Araç ekle
        console.log('   → 40 araç ekleniyor...');
        for (let i = 1; i <= 40; i++) {
            const ilKodu = ['34', '35', '06', '16', '07'][Math.floor(Math.random() * 5)];
            const harfler = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                String.fromCharCode(65 + Math.floor(Math.random() * 26));
            const plaka = `${ilKodu} ${harfler} ${String(i).padStart(3, '0')}`;
            const kapasite = 10 + Math.floor(Math.random() * 41);
            const yil = 2015 + Math.floor(Math.random() * 9);
            const markalar = ['Mercedes', 'MAN', 'Temsa', 'Otokar', 'Neoplan'];
            const marka = markalar[Math.floor(Math.random() * 5)];

            await connection.query(`
                INSERT INTO araclar (plaka, kapasite, marka, model, satin_alma_yili, durum)
                VALUES (?, ?, ?, ?, ?, 'aktif')
            `, [plaka, kapasite, marka, `${marka} Travego`, yil]);
        }
        console.log('   ✅ 40 araç eklendi');

        // Turları oluştur
        console.log('   → Turlar oluşturuluyor (bu birkaç dakika sürebilir)...');
        await createTours(connection);
        console.log('   ✅ Turlar oluşturuldu');

        // 7. Doğrulama
        console.log('');
        console.log('🔍 Doğrulama...');

        const [routes] = await connection.query('SELECT COUNT(*) as cnt FROM guzergahlar');
        const [vehicles] = await connection.query('SELECT COUNT(*) as cnt FROM araclar');
        const [tours] = await connection.query('SELECT COUNT(*) as cnt FROM turlar');

        console.log(`   📍 Güzergahlar: ${routes[0].cnt}`);
        console.log(`   🚌 Araçlar: ${vehicles[0].cnt}`);
        console.log(`   📅 Turlar: ${tours[0].cnt}`);

        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║  ✅ KURULUM TAMAMLANDI!                                    ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log('║                                                            ║');
        console.log('║  Sunucuyu başlatmak için: npm run dev                      ║');
        console.log('║                                                            ║');
        console.log('║  Admin Giriş:                                              ║');
        console.log('║    Kullanıcı: admin                                        ║');
        console.log('║    Şifre: Admin123!                                        ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ HATA:', error.message);
        console.error('');

        if (error.code === 'ECONNREFUSED') {
            console.error('💡 ÇÖZÜM: XAMPP MySQL servisinin çalıştığından emin olun.');
            console.error('   XAMPP Control Panel → MySQL → Start');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 ÇÖZÜM: .env dosyasındaki DB_USER ve DB_PASSWORD değerlerini kontrol edin.');
        }

        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

/**
 * Prosedürleri oluştur
 */
async function createProcedures(connection, sql) {
    // Her prosedürü regex ile bul ve çalıştır
    const procRegex = /CREATE PROCEDURE\s+(\w+)\s*\([^)]*\)\s*BEGIN([\s\S]*?)END/gi;
    const dropRegex = /DROP PROCEDURE IF EXISTS\s+(\w+)/gi;

    // Önce tüm prosedürleri sil
    let match;
    while ((match = dropRegex.exec(sql)) !== null) {
        try {
            await connection.query(`DROP PROCEDURE IF EXISTS ${match[1]}`);
        } catch (e) { }
    }

    // Prosedürleri oluştur - dosyadan okuyoruz
    const procNames = [
        'sp_tur_olustur',
        'sp_temel_veri_yukle',
        'sp_turlari_olustur',
        'sp_rapor_tur_yogunluk',
        'sp_rapor_guzergah_hacim',
        'sp_rapor_filo_eszamanlilik',
        'sp_rapor_aylik_filo_denge',
        'sp_yonetici_oneri'
    ];

    // Basitleştirilmiş prosedürler - sadece raporlama için gerekli olanlar

    // sp_tur_olustur
    await connection.query(`
        CREATE PROCEDURE sp_tur_olustur(
            IN p_guzergah_id INT,
            IN p_arac_id INT,
            IN p_baslangic DATETIME,
            IN p_bitis DATETIME,
            IN p_yolcu_sayisi INT,
            IN p_fiyat_tl DECIMAL(12,2)
        )
        BEGIN
            DECLARE v_cakisma INT DEFAULT 0;
            
            IF p_arac_id IS NOT NULL THEN
                SELECT COUNT(*) INTO v_cakisma FROM turlar
                WHERE arac_id = p_arac_id
                AND (p_baslangic < bitis_tarihi AND p_bitis > baslangic_tarihi);
                
                IF v_cakisma > 0 THEN
                    SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Bu araç seçilen tarih aralığında başka bir turda kullanılmaktadır.';
                END IF;
            END IF;
            
            INSERT INTO turlar (guzergah_id, arac_id, baslangic_tarihi, bitis_tarihi, yolcu_sayisi, fiyat_tl, dis_arac_mi)
            VALUES (p_guzergah_id, p_arac_id, p_baslangic, p_bitis, p_yolcu_sayisi, p_fiyat_tl, IF(p_arac_id IS NULL, 1, 0));
            
            SELECT LAST_INSERT_ID() AS tur_id;
        END
    `);

    // sp_rapor_tur_yogunluk
    await connection.query(`
        CREATE PROCEDURE sp_rapor_tur_yogunluk(
            IN p_baslangic DATE,
            IN p_bitis DATE,
            IN p_gruplama VARCHAR(10)
        )
        BEGIN
            IF p_gruplama = 'month' THEN
                SELECT 
                    YEAR(baslangic_tarihi) AS yil,
                    MONTH(baslangic_tarihi) AS ay,
                    DATE_FORMAT(baslangic_tarihi, '%Y-%m') AS ay_yil,
                    COUNT(*) AS tur_sayisi,
                    SUM(fiyat_tl) AS toplam_gelir,
                    COUNT(CASE WHEN dis_arac_mi = 1 THEN 1 END) AS dis_kiralama_sayisi
                FROM turlar
                WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                GROUP BY YEAR(baslangic_tarihi), MONTH(baslangic_tarihi)
                ORDER BY yil, ay;
            ELSEIF p_gruplama = 'year' THEN
                SELECT 
                    YEAR(baslangic_tarihi) AS yil,
                    COUNT(*) AS tur_sayisi,
                    SUM(fiyat_tl) AS toplam_gelir,
                    COUNT(CASE WHEN dis_arac_mi = 1 THEN 1 END) AS dis_kiralama_sayisi
                FROM turlar
                WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                GROUP BY YEAR(baslangic_tarihi)
                ORDER BY yil;
            ELSE
                SELECT 
                    YEAR(baslangic_tarihi) AS yil,
                    WEEK(baslangic_tarihi, 1) AS hafta,
                    COUNT(*) AS tur_sayisi,
                    SUM(fiyat_tl) AS toplam_gelir,
                    COUNT(CASE WHEN dis_arac_mi = 1 THEN 1 END) AS dis_kiralama_sayisi
                FROM turlar
                WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
                GROUP BY YEAR(baslangic_tarihi), WEEK(baslangic_tarihi, 1)
                ORDER BY yil, hafta;
            END IF;
        END
    `);

    // sp_rapor_guzergah_hacim
    await connection.query(`
        CREATE PROCEDURE sp_rapor_guzergah_hacim(
            IN p_baslangic DATE,
            IN p_bitis DATE,
            IN p_gruplama VARCHAR(10)
        )
        BEGIN
            SELECT 
                g.guzergah_adi,
                COUNT(*) AS tur_sayisi,
                SUM(t.fiyat_tl) AS toplam_gelir
            FROM turlar t
            JOIN guzergahlar g ON t.guzergah_id = g.id
            WHERE DATE(t.baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
            GROUP BY g.id, g.guzergah_adi
            ORDER BY tur_sayisi DESC;
        END
    `);

    // sp_rapor_filo_eszamanlilik - basitleştirilmiş
    await connection.query(`
        CREATE PROCEDURE sp_rapor_filo_eszamanlilik(
            IN p_baslangic DATE,
            IN p_bitis DATE
        )
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
                (SELECT COUNT(*) FROM turlar WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis AND dis_arac_mi = 1) AS dis_kiralama_sayisi,
                (SELECT COUNT(DISTINCT arac_id) FROM turlar WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis AND arac_id IS NOT NULL) AS benzersiz_arac_sayisi,
                COALESCE(v_max_concurrent, 0) AS peak_eszamanli_arac,
                40 AS filo_kapasitesi,
                CASE WHEN COALESCE(v_max_concurrent, 0) > 40 THEN COALESCE(v_max_concurrent, 0) - 40 ELSE 0 END AS arac_yetersizligi,
                CASE WHEN COALESCE(v_max_concurrent, 0) < 40 THEN 40 - COALESCE(v_max_concurrent, 0) ELSE 0 END AS arac_fazlaligi;
        END
    `);

    // sp_rapor_aylik_filo_denge
    await connection.query(`
        CREATE PROCEDURE sp_rapor_aylik_filo_denge(
            IN p_yil INT
        )
        BEGIN
            SELECT 
                MONTH(baslangic_tarihi) AS ay,
                ELT(MONTH(baslangic_tarihi), 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık') AS ay_adi,
                COUNT(*) AS tur_sayisi,
                SUM(CASE WHEN dis_arac_mi = 1 THEN 1 ELSE 0 END) AS dis_kiralama_sayisi,
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

    // sp_yonetici_oneri
    await connection.query(`
        CREATE PROCEDURE sp_yonetici_oneri(
            IN p_yil INT
        )
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
                END AS dusuk_sezon_onerisi,
                (SELECT COUNT(*) FROM turlar WHERE YEAR(baslangic_tarihi) = p_yil AND dis_arac_mi = 1) AS toplam_dis_kiralama,
                (SELECT COALESCE(SUM(toplam_ucret), 0) FROM dis_kiralamalar dk 
                 JOIN turlar t ON dk.tur_id = t.id 
                 WHERE YEAR(t.baslangic_tarihi) = p_yil) AS dis_kiralama_maliyeti;
        END
    `);
}

/**
 * Turları oluştur
 * Yoğun aylar (4,5,6,9,10): ~1000 tur/ay (günlük 33-35)
 * Normal aylar: ~200 tur/ay (günlük 6-8)
 */
async function createTours(connection) {
    const startDate = new Date('2022-04-10');
    const endDate = new Date('2025-11-10');

    let currentDate = new Date(startDate);
    let tourCount = 0;
    let externalCount = 0;

    // Araç müsaitlik takibi - her araç için bitiş tarihi tut
    const vehicleEndDates = {};
    for (let i = 1; i <= 40; i++) {
        vehicleEndDates[i] = new Date(0);
    }

    // Batch insert için turları topla
    let tourBatch = [];
    const BATCH_SIZE = 100;

    while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const isHighSeason = [4, 5, 6, 9, 10].includes(month);

        // Günlük tur sayısı
        // Yoğun sezon: ~1500 tur/ay = 50 tur/gün
        // Normal sezon: ~200 tur/ay = 6~8 tur/gün
        const dailyTours = isHighSeason
            ? 48 + Math.floor(Math.random() * 6)  // 48-53 tur/gün (~1500/ay)
            : 6 + Math.floor(Math.random() * 4);  // 6-9 tur/gün (~200/ay)

        for (let i = 0; i < dailyTours; i++) {
            const routeId = 1 + Math.floor(Math.random() * 4);
            const durationDays = 2 + Math.floor(Math.random() * 2);
            const startHour = 6 + Math.floor(Math.random() * 14); // 06:00 - 20:00

            const tourStart = new Date(currentDate);
            tourStart.setHours(startHour, Math.floor(Math.random() * 60), 0);

            const tourEnd = new Date(tourStart);
            tourEnd.setDate(tourEnd.getDate() + durationDays);
            tourEnd.setHours(8 + Math.floor(Math.random() * 10));

            const pax = 5 + Math.floor(Math.random() * 6);

            // Uygun araç bul
            let vehicleId = null;
            for (let v = 1; v <= 40; v++) {
                if (vehicleEndDates[v] <= tourStart) {
                    vehicleId = v;
                    vehicleEndDates[v] = tourEnd;
                    break;
                }
            }

            const isExternal = vehicleId === null ? 1 : 0;
            if (isExternal) externalCount++;

            tourBatch.push([routeId, vehicleId, tourStart, tourEnd, pax, 10000, isExternal]);
            tourCount++;

            // Batch insert
            if (tourBatch.length >= BATCH_SIZE) {
                await connection.query(`
                    INSERT INTO turlar (guzergah_id, arac_id, baslangic_tarihi, bitis_tarihi, yolcu_sayisi, fiyat_tl, dis_arac_mi)
                    VALUES ?
                `, [tourBatch]);
                tourBatch = [];

                if (tourCount % 1000 === 0) {
                    process.stdout.write(`   → ${tourCount} tur oluşturuldu...\r`);
                }
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Kalan turları ekle
    if (tourBatch.length > 0) {
        await connection.query(`
            INSERT INTO turlar (guzergah_id, arac_id, baslangic_tarihi, bitis_tarihi, yolcu_sayisi, fiyat_tl, dis_arac_mi)
            VALUES ?
        `, [tourBatch]);
    }

    console.log(`   → Toplam ${tourCount} tur, ${externalCount} dış kiralama`);
}

// Scripti çalıştır
setup();
