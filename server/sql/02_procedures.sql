-- ============================================================
-- KDS ARAÇ YÖNETİM SİSTEMİ - SAKLI YORDAMLAR (STORED PROCEDURES)
-- ============================================================

USE kds_arac_yonetim;

DELIMITER //

-- ============================================================
-- 1. sp_tur_olustur: Çakışma kontrolü ile tur ekleme
-- ============================================================
DROP PROCEDURE IF EXISTS sp_tur_olustur//

CREATE PROCEDURE sp_tur_olustur(
    IN p_guzergah_id INT,
    IN p_arac_id INT,
    IN p_baslangic DATETIME,
    IN p_bitis DATETIME,
    IN p_yolcu_sayisi INT,
    IN p_fiyat_tl DECIMAL(12,2)
)
BEGIN
    DECLARE v_cakisma_sayisi INT DEFAULT 0;
    
    -- Tarih kontrolü
    IF p_bitis <= p_baslangic THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Hata: Bitiş tarihi başlangıç tarihinden sonra olmalıdır.';
    END IF;
    
    -- Yolcu sayısı kontrolü
    IF p_yolcu_sayisi < 1 OR p_yolcu_sayisi > 50 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Hata: Yolcu sayısı 1-50 arasında olmalıdır.';
    END IF;
    
    -- Araç belirtilmişse çakışma kontrolü yap
    IF p_arac_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_cakisma_sayisi
        FROM turlar
        WHERE arac_id = p_arac_id
          AND (p_baslangic < bitis_tarihi AND p_bitis > baslangic_tarihi);
        
        IF v_cakisma_sayisi > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Hata: Bu araç seçilen tarih aralığında başka bir turda kullanılmaktadır.';
        END IF;
    END IF;
    
    -- Tur ekle
    INSERT INTO turlar (guzergah_id, arac_id, baslangic_tarihi, bitis_tarihi, yolcu_sayisi, fiyat_tl, dis_arac_mi)
    VALUES (p_guzergah_id, p_arac_id, p_baslangic, p_bitis, p_yolcu_sayisi, p_fiyat_tl, IF(p_arac_id IS NULL, 1, 0));
    
    SELECT LAST_INSERT_ID() AS tur_id, 'Tur başarıyla oluşturuldu' AS mesaj;
END//

-- ============================================================
-- 2. sp_temel_veri_yukle: Güzergah, araç ve admin seed
-- ============================================================
DROP PROCEDURE IF EXISTS sp_temel_veri_yukle//

CREATE PROCEDURE sp_temel_veri_yukle()
BEGIN
    DECLARE v_i INT DEFAULT 1;
    DECLARE v_plaka VARCHAR(15);
    DECLARE v_kapasite INT;
    DECLARE v_yil INT;
    DECLARE v_markalar VARCHAR(255) DEFAULT 'Mercedes,MAN,Temsa,Otokar,Neoplan';
    DECLARE v_marka VARCHAR(50);
    
    -- Mevcut verileri temizle (sıralı cascade için)
    SET FOREIGN_KEY_CHECKS = 0;
    TRUNCATE TABLE dis_kiralamalar;
    TRUNCATE TABLE turlar;
    TRUNCATE TABLE araclar;
    TRUNCATE TABLE guzergahlar;
    TRUNCATE TABLE admin_kullanicilar;
    SET FOREIGN_KEY_CHECKS = 1;
    
    -- Admin kullanıcı ekle (şifre: Admin123!)
    -- bcrypt hash: $2a$10$... (Node.js tarafında hash'lenir, burada plaintext bırakıyoruz)
    INSERT INTO admin_kullanicilar (kullanici_adi, sifre_hash, ad_soyad, email)
    VALUES ('admin', '$2a$10$8K1p/a0dL1LXMc0RqD0BQOQn5Qz5z5z5z5z5z5z5z5z5z5z5z5z5z', 'Sistem Yöneticisi', 'admin@kds.com');
    
    -- 4 Güzergah ekle
    INSERT INTO guzergahlar (guzergah_adi, aciklama, sure_gun) VALUES
    ('Muğla', 'Muğla ve çevresi kültür turu', 2),
    ('İzmir – Efes Antik Kenti', 'İzmir Efes ve antik kentler turu', 2),
    ('Kapadokya', 'Kapadokya balon ve doğa turu', 3),
    ('İstanbul', 'İstanbul tarihi yarımada turu', 2);
    
    -- 70 Araç ekle
    WHILE v_i <= 70 DO
        -- Plaka üret (34 XXX 001 - 34 XXX 250 formatı)
        SET v_plaka = CONCAT(
            ELT(1 + FLOOR(RAND() * 5), '34', '35', '06', '16', '07'), -- İl kodu
            ' ',
            CHAR(65 + FLOOR(RAND() * 26)), -- Random harf
            CHAR(65 + FLOOR(RAND() * 26)),
            CHAR(65 + FLOOR(RAND() * 26)),
            ' ',
            LPAD(v_i, 3, '0')
        );
        
        -- Kapasite (10-50 arası)
        SET v_kapasite = 10 + FLOOR(RAND() * 41);
        
        -- Satın alma yılı (2015-2023 arası)
        SET v_yil = 2015 + FLOOR(RAND() * 9);
        
        -- Marka seç
        SET v_marka = ELT(1 + FLOOR(RAND() * 5), 'Mercedes', 'MAN', 'Temsa', 'Otokar', 'Neoplan');
        
        INSERT INTO araclar (plaka, kapasite, marka, model, satin_alma_yili, durum)
        VALUES (v_plaka, v_kapasite, v_marka, CONCAT(v_marka, ' Travego'), v_yil, 'aktif');
        
        SET v_i = v_i + 1;
    END WHILE;
    
    SELECT 
        (SELECT COUNT(*) FROM admin_kullanicilar) AS admin_sayisi,
        (SELECT COUNT(*) FROM guzergahlar) AS guzergah_sayisi,
        (SELECT COUNT(*) FROM araclar) AS arac_sayisi,
        'Temel veriler başarıyla yüklendi' AS mesaj;
END//

-- ============================================================
-- 3. sp_turlari_olustur: Tarih aralığında tur üretimi
-- ============================================================
DROP PROCEDURE IF EXISTS sp_turlari_olustur//

CREATE PROCEDURE sp_turlari_olustur(
    IN p_baslangic_tarih DATE,
    IN p_bitis_tarih DATE
)
BEGIN
    DECLARE v_current_date DATE;
    DECLARE v_current_month INT;
    DECLARE v_current_year INT;
    DECLARE v_target_tours INT;
    DECLARE v_tour_count INT DEFAULT 0;
    DECLARE v_tours_this_month INT DEFAULT 0;
    DECLARE v_last_month INT DEFAULT 0;
    DECLARE v_last_year INT DEFAULT 0;
    
    DECLARE v_route_id INT;
    DECLARE v_vehicle_id INT;
    DECLARE v_tour_start DATETIME;
    DECLARE v_tour_end DATETIME;
    DECLARE v_duration_days INT;
    DECLARE v_pax INT;
    DECLARE v_start_hour INT;
    DECLARE v_is_external TINYINT DEFAULT 0;
    
    DECLARE v_available_vehicle_id INT DEFAULT NULL;
    DECLARE v_attempt INT;
    DECLARE v_max_attempts INT DEFAULT 50;
    
    -- Mevcut turları temizle
    SET FOREIGN_KEY_CHECKS = 0;
    TRUNCATE TABLE dis_kiralamalar;
    TRUNCATE TABLE turlar;
    SET FOREIGN_KEY_CHECKS = 1;
    
    SET v_current_date = p_baslangic_tarih;
    
    -- Her gün için döngü
    WHILE v_current_date <= p_bitis_tarih DO
        SET v_current_month = MONTH(v_current_date);
        SET v_current_year = YEAR(v_current_date);
        
        -- Yeni ay başladıysa hedef tur sayısını belirle
        IF v_current_month != v_last_month OR v_current_year != v_last_year THEN
            SET v_tours_this_month = 0;
            
            -- Yoğun sezon: 4,5,6,9,10 ayları ~250, diğerleri ~100
            IF v_current_month IN (4, 5, 6, 9, 10) THEN
                SET v_target_tours = 240 + FLOOR(RAND() * 21); -- 240-260 arası
            ELSE
                SET v_target_tours = 90 + FLOOR(RAND() * 21); -- 90-110 arası
            END IF;
            
            SET v_last_month = v_current_month;
            SET v_last_year = v_current_year;
        END IF;
        
        -- Bu ayın hedefine ulaşana kadar tur ekle
        -- Günlük tur sayısı = hedef / aydaki gün sayısı (yaklaşık)
        WHILE v_tours_this_month < v_target_tours AND v_current_date <= p_bitis_tarih DO
            -- Günde ortalama 3-8 tur başlat
            IF RAND() < (v_target_tours / 30.0 / 5.0) THEN
                
                -- Random güzergah seç (1-4)
                SET v_route_id = 1 + FLOOR(RAND() * 4);
                
                -- Tur süresi (2-3 gün)
                SET v_duration_days = 2 + FLOOR(RAND() * 2);
                
                -- Başlangıç saati (08:00 - 18:00)
                SET v_start_hour = 8 + FLOOR(RAND() * 11);
                
                -- Tur başlangıç ve bitiş zamanları
                SET v_tour_start = ADDTIME(v_current_date, SEC_TO_TIME(v_start_hour * 3600 + FLOOR(RAND() * 3600)));
                SET v_tour_end = DATE_ADD(v_tour_start, INTERVAL v_duration_days DAY);
                SET v_tour_end = ADDTIME(DATE(v_tour_end), SEC_TO_TIME((8 + FLOOR(RAND() * 10)) * 3600));
                
                -- Yolcu sayısı (5-10)
                SET v_pax = 5 + FLOOR(RAND() * 6);
                
                -- Uygun araç bul
                SET v_available_vehicle_id = NULL;
                SET v_attempt = 0;
                SET v_is_external = 0;
                
                WHILE v_available_vehicle_id IS NULL AND v_attempt < v_max_attempts DO
                    -- Random bir araç seç
                    SELECT id INTO v_available_vehicle_id
                    FROM araclar
                    WHERE durum = 'aktif'
                      AND id NOT IN (
                          SELECT DISTINCT arac_id 
                          FROM turlar 
                          WHERE arac_id IS NOT NULL
                            AND (v_tour_start < bitis_tarihi AND v_tour_end > baslangic_tarihi)
                      )
                    ORDER BY RAND()
                    LIMIT 1;
                    
                    SET v_attempt = v_attempt + 1;
                END WHILE;
                
                -- Uygun araç bulunamadıysa dış kiralama olarak işaretle
                IF v_available_vehicle_id IS NULL THEN
                    SET v_is_external = 1;
                END IF;
                
                -- Turu ekle
                INSERT INTO turlar (guzergah_id, arac_id, baslangic_tarihi, bitis_tarihi, yolcu_sayisi, fiyat_tl, dis_arac_mi)
                VALUES (v_route_id, v_available_vehicle_id, v_tour_start, v_tour_end, v_pax, 60000.00, v_is_external);
                
                -- Dış kiralama ise kayıt ekle
                IF v_is_external = 1 THEN
                    INSERT INTO dis_kiralamalar (tur_id, kiralama_firmasi, gunluk_ucret, toplam_ucret, aciklama)
                    VALUES (LAST_INSERT_ID(), 'Dış Kiralama Firması', 5000.00, 5000.00 * v_duration_days, 'Filo yetersizliği nedeniyle dış kiralama');
                END IF;
                
                SET v_tours_this_month = v_tours_this_month + 1;
                SET v_tour_count = v_tour_count + 1;
            END IF;
            
            -- Ay sonu kontrolü
            IF DAY(v_current_date) >= DAY(LAST_DAY(v_current_date)) THEN
                -- Ay sonu, döngüden çık
                SET v_tours_this_month = v_target_tours;
            ELSE
                -- Bir sonraki güne geç (aynı ay içinde kalarak)
                SET v_current_date = DATE_ADD(v_current_date, INTERVAL 1 DAY);
                IF MONTH(v_current_date) != v_current_month THEN
                    SET v_current_date = DATE_SUB(v_current_date, INTERVAL 1 DAY);
                    SET v_tours_this_month = v_target_tours;
                END IF;
            END IF;
        END WHILE;
        
        -- Bir sonraki güne geç
        SET v_current_date = DATE_ADD(v_current_date, INTERVAL 1 DAY);
    END WHILE;
    
    SELECT 
        v_tour_count AS toplam_tur_sayisi,
        (SELECT COUNT(*) FROM turlar WHERE dis_arac_mi = 1) AS dis_kiralama_sayisi,
        'Turlar başarıyla oluşturuldu' AS mesaj;
END//

-- ============================================================
-- 4. sp_rapor_tur_yogunluk: Tur hacmi raporu
-- ============================================================
DROP PROCEDURE IF EXISTS sp_rapor_tur_yogunluk//

CREATE PROCEDURE sp_rapor_tur_yogunluk(
    IN p_baslangic DATE,
    IN p_bitis DATE,
    IN p_gruplama VARCHAR(10) -- 'day', 'week', 'month', 'year'
)
BEGIN
    IF p_gruplama = 'day' THEN
        SELECT 
            DATE(baslangic_tarihi) AS tarih,
            COUNT(*) AS tur_sayisi,
            SUM(fiyat_tl) AS toplam_gelir,
            COUNT(CASE WHEN dis_arac_mi = 1 THEN 1 END) AS dis_kiralama_sayisi
        FROM turlar
        WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY DATE(baslangic_tarihi)
        ORDER BY tarih;
        
    ELSEIF p_gruplama = 'week' THEN
        SELECT 
            YEAR(baslangic_tarihi) AS yil,
            WEEK(baslangic_tarihi, 1) AS hafta,
            MIN(DATE(baslangic_tarihi)) AS hafta_baslangic,
            COUNT(*) AS tur_sayisi,
            SUM(fiyat_tl) AS toplam_gelir,
            COUNT(CASE WHEN dis_arac_mi = 1 THEN 1 END) AS dis_kiralama_sayisi
        FROM turlar
        WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY YEAR(baslangic_tarihi), WEEK(baslangic_tarihi, 1)
        ORDER BY yil, hafta;
        
    ELSEIF p_gruplama = 'month' THEN
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
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Geçersiz gruplama parametresi. Kullanılabilir değerler: day, week, month, year';
    END IF;
END//

-- ============================================================
-- 5. sp_rapor_guzergah_hacim: Güzergah bazlı rapor
-- ============================================================
DROP PROCEDURE IF EXISTS sp_rapor_guzergah_hacim//

CREATE PROCEDURE sp_rapor_guzergah_hacim(
    IN p_baslangic DATE,
    IN p_bitis DATE,
    IN p_gruplama VARCHAR(10)
)
BEGIN
    IF p_gruplama = 'day' THEN
        SELECT 
            g.guzergah_adi,
            DATE(t.baslangic_tarihi) AS tarih,
            COUNT(*) AS tur_sayisi,
            SUM(t.fiyat_tl) AS toplam_gelir
        FROM turlar t
        JOIN guzergahlar g ON t.guzergah_id = g.id
        WHERE DATE(t.baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY g.id, g.guzergah_adi, DATE(t.baslangic_tarihi)
        ORDER BY tarih, g.guzergah_adi;
        
    ELSEIF p_gruplama = 'week' THEN
        SELECT 
            g.guzergah_adi,
            YEAR(t.baslangic_tarihi) AS yil,
            WEEK(t.baslangic_tarihi, 1) AS hafta,
            COUNT(*) AS tur_sayisi,
            SUM(t.fiyat_tl) AS toplam_gelir
        FROM turlar t
        JOIN guzergahlar g ON t.guzergah_id = g.id
        WHERE DATE(t.baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY g.id, g.guzergah_adi, YEAR(t.baslangic_tarihi), WEEK(t.baslangic_tarihi, 1)
        ORDER BY yil, hafta, g.guzergah_adi;
        
    ELSEIF p_gruplama = 'month' THEN
        SELECT 
            g.guzergah_adi,
            YEAR(t.baslangic_tarihi) AS yil,
            MONTH(t.baslangic_tarihi) AS ay,
            DATE_FORMAT(t.baslangic_tarihi, '%Y-%m') AS ay_yil,
            COUNT(*) AS tur_sayisi,
            SUM(t.fiyat_tl) AS toplam_gelir
        FROM turlar t
        JOIN guzergahlar g ON t.guzergah_id = g.id
        WHERE DATE(t.baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY g.id, g.guzergah_adi, YEAR(t.baslangic_tarihi), MONTH(t.baslangic_tarihi)
        ORDER BY yil, ay, g.guzergah_adi;
        
    ELSEIF p_gruplama = 'year' THEN
        SELECT 
            g.guzergah_adi,
            YEAR(t.baslangic_tarihi) AS yil,
            COUNT(*) AS tur_sayisi,
            SUM(t.fiyat_tl) AS toplam_gelir
        FROM turlar t
        JOIN guzergahlar g ON t.guzergah_id = g.id
        WHERE DATE(t.baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY g.id, g.guzergah_adi, YEAR(t.baslangic_tarihi)
        ORDER BY yil, g.guzergah_adi;
        
    ELSE
        -- Gruplama olmadan toplam
        SELECT 
            g.guzergah_adi,
            COUNT(*) AS tur_sayisi,
            SUM(t.fiyat_tl) AS toplam_gelir,
            AVG(t.yolcu_sayisi) AS ortalama_yolcu
        FROM turlar t
        JOIN guzergahlar g ON t.guzergah_id = g.id
        WHERE DATE(t.baslangic_tarihi) BETWEEN p_baslangic AND p_bitis
        GROUP BY g.id, g.guzergah_adi
        ORDER BY tur_sayisi DESC;
    END IF;
END//

-- ============================================================
-- 6. sp_rapor_filo_eszamanlilik: Peak concurrent araç hesaplama
-- ============================================================
DROP PROCEDURE IF EXISTS sp_rapor_filo_eszamanlilik//

CREATE PROCEDURE sp_rapor_filo_eszamanlilik(
    IN p_baslangic DATE,
    IN p_bitis DATE
)
BEGIN
    DECLARE v_max_concurrent INT DEFAULT 0;
    DECLARE v_current_concurrent INT DEFAULT 0;
    DECLARE v_event_time DATETIME;
    DECLARE v_event_type INT;
    DECLARE v_done INT DEFAULT 0;
    
    -- Event cursor (sweep line algoritması)
    DECLARE event_cursor CURSOR FOR
        SELECT event_time, event_type FROM (
            -- Tur başlangıçları (+1)
            SELECT baslangic_tarihi AS event_time, 1 AS event_type
            FROM turlar
            WHERE DATE(baslangic_tarihi) <= p_bitis AND DATE(bitis_tarihi) >= p_baslangic
            
            UNION ALL
            
            -- Tur bitişleri (-1)
            SELECT bitis_tarihi AS event_time, -1 AS event_type
            FROM turlar
            WHERE DATE(baslangic_tarihi) <= p_bitis AND DATE(bitis_tarihi) >= p_baslangic
        ) events
        ORDER BY event_time, event_type DESC; -- Bitiş önce işlensin (aynı anda başlayıp biten durumlar için)
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
    
    -- Geçici tablo ile peak hesaplama
    DROP TEMPORARY TABLE IF EXISTS tmp_peak_result;
    CREATE TEMPORARY TABLE tmp_peak_result (
        max_concurrent INT
    );
    
    OPEN event_cursor;
    
    read_loop: LOOP
        FETCH event_cursor INTO v_event_time, v_event_type;
        IF v_done THEN
            LEAVE read_loop;
        END IF;
        
        SET v_current_concurrent = v_current_concurrent + v_event_type;
        
        IF v_current_concurrent > v_max_concurrent THEN
            SET v_max_concurrent = v_current_concurrent;
        END IF;
    END LOOP;
    
    CLOSE event_cursor;
    
    -- Sonuçları döndür
    SELECT 
        (SELECT COUNT(*) FROM turlar 
         WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis) AS toplam_tur_sayisi,
        (SELECT COUNT(*) FROM turlar 
         WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis AND dis_arac_mi = 1) AS dis_kiralama_sayisi,
        (SELECT COUNT(DISTINCT arac_id) FROM turlar 
         WHERE DATE(baslangic_tarihi) BETWEEN p_baslangic AND p_bitis AND arac_id IS NOT NULL) AS benzersiz_arac_sayisi,
        v_max_concurrent AS peak_eszamanli_arac,
        70 AS filo_kapasitesi,
        CASE 
            WHEN v_max_concurrent > 70 THEN v_max_concurrent - 70 
            ELSE 0 
        END AS arac_yetersizligi,
        CASE 
            WHEN v_max_concurrent < 70 THEN 70 - v_max_concurrent 
            ELSE 0 
        END AS arac_fazlaligi;
END//

-- ============================================================
-- 7. sp_rapor_aylik_filo_denge: Aylık shortage/surplus analizi
-- ============================================================
DROP PROCEDURE IF EXISTS sp_rapor_aylik_filo_denge//

CREATE PROCEDURE sp_rapor_aylik_filo_denge(
    IN p_yil INT
)
BEGIN
    DECLARE v_ay INT DEFAULT 1;
    DECLARE v_ay_baslangic DATE;
    DECLARE v_ay_bitis DATE;
    DECLARE v_max_concurrent INT;
    DECLARE v_current_concurrent INT;
    DECLARE v_event_time DATETIME;
    DECLARE v_event_type INT;
    DECLARE v_done INT;
    
    DECLARE event_cursor CURSOR FOR
        SELECT event_time, event_type FROM (
            SELECT baslangic_tarihi AS event_time, 1 AS event_type
            FROM turlar
            WHERE baslangic_tarihi <= v_ay_bitis AND bitis_tarihi >= v_ay_baslangic
            
            UNION ALL
            
            SELECT bitis_tarihi AS event_time, -1 AS event_type
            FROM turlar
            WHERE baslangic_tarihi <= v_ay_bitis AND bitis_tarihi >= v_ay_baslangic
        ) events
        ORDER BY event_time, event_type DESC;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;
    
    -- Sonuç tablosu
    DROP TEMPORARY TABLE IF EXISTS tmp_aylik_denge;
    CREATE TEMPORARY TABLE tmp_aylik_denge (
        ay INT,
        ay_adi VARCHAR(20),
        tur_sayisi INT,
        dis_kiralama_sayisi INT,
        peak_eszamanli_arac INT,
        filo_kapasitesi INT DEFAULT 70,
        arac_yetersizligi INT,
        arac_fazlaligi INT,
        durum VARCHAR(20)
    );
    
    -- Her ay için hesapla
    WHILE v_ay <= 12 DO
        SET v_ay_baslangic = CONCAT(p_yil, '-', LPAD(v_ay, 2, '0'), '-01');
        SET v_ay_bitis = LAST_DAY(v_ay_baslangic);
        SET v_max_concurrent = 0;
        SET v_current_concurrent = 0;
        SET v_done = 0;
        
        -- Peak hesapla (sweep line)
        BEGIN
            DECLARE v_inner_done INT DEFAULT 0;
            DECLARE inner_cursor CURSOR FOR
                SELECT event_time, event_type FROM (
                    SELECT baslangic_tarihi AS event_time, 1 AS event_type
                    FROM turlar
                    WHERE baslangic_tarihi <= v_ay_bitis AND bitis_tarihi >= v_ay_baslangic
                    
                    UNION ALL
                    
                    SELECT bitis_tarihi AS event_time, -1 AS event_type
                    FROM turlar
                    WHERE baslangic_tarihi <= v_ay_bitis AND bitis_tarihi >= v_ay_baslangic
                ) events
                ORDER BY event_time, event_type DESC;
            
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_inner_done = 1;
            
            OPEN inner_cursor;
            
            inner_loop: LOOP
                FETCH inner_cursor INTO v_event_time, v_event_type;
                IF v_inner_done THEN
                    LEAVE inner_loop;
                END IF;
                
                SET v_current_concurrent = v_current_concurrent + v_event_type;
                
                IF v_current_concurrent > v_max_concurrent THEN
                    SET v_max_concurrent = v_current_concurrent;
                END IF;
            END LOOP;
            
            CLOSE inner_cursor;
        END;
        
        -- Sonucu kaydet
        INSERT INTO tmp_aylik_denge (ay, ay_adi, tur_sayisi, dis_kiralama_sayisi, peak_eszamanli_arac, arac_yetersizligi, arac_fazlaligi, durum)
        SELECT 
            v_ay,
            ELT(v_ay, 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'),
            (SELECT COUNT(*) FROM turlar WHERE YEAR(baslangic_tarihi) = p_yil AND MONTH(baslangic_tarihi) = v_ay),
            (SELECT COUNT(*) FROM turlar WHERE YEAR(baslangic_tarihi) = p_yil AND MONTH(baslangic_tarihi) = v_ay AND dis_arac_mi = 1),
            v_max_concurrent,
            CASE WHEN v_max_concurrent > 70 THEN v_max_concurrent - 70 ELSE 0 END,
            CASE WHEN v_max_concurrent < 70 THEN 70 - v_max_concurrent ELSE 0 END,
            CASE 
                WHEN v_max_concurrent > 70 THEN 'YETERSİZ'
                WHEN v_max_concurrent < 50 THEN 'FAZLA'
                ELSE 'NORMAL'
            END;
        
        SET v_ay = v_ay + 1;
        SET v_current_concurrent = 0;
    END WHILE;
    
    -- Sonuçları döndür
    SELECT * FROM tmp_aylik_denge ORDER BY ay;
    
    DROP TEMPORARY TABLE IF EXISTS tmp_aylik_denge;
END//

-- ============================================================
-- 8. sp_yonetici_oneri: Yönetici için öneri paneli
-- ============================================================
DROP PROCEDURE IF EXISTS sp_yonetici_oneri//

CREATE PROCEDURE sp_yonetici_oneri(
    IN p_yil INT
)
BEGIN
    DECLARE v_avg_peak_high_season DECIMAL(10,2);
    DECLARE v_max_peak_high_season INT;
    DECLARE v_avg_peak_low_season DECIMAL(10,2);
    DECLARE v_min_peak_low_season INT;
    
    -- Yoğun sezon (4,5,6,9,10) peak ortalaması
    SELECT 
        AVG(peak_eszamanli_arac),
        MAX(peak_eszamanli_arac)
    INTO v_avg_peak_high_season, v_max_peak_high_season
    FROM (
        SELECT 
            MONTH(baslangic_tarihi) as ay,
            COUNT(*) as peak_eszamanli_arac
        FROM turlar
        WHERE YEAR(baslangic_tarihi) = p_yil 
          AND MONTH(baslangic_tarihi) IN (4,5,6,9,10)
        GROUP BY DATE(baslangic_tarihi)
    ) daily_peaks;
    
    -- Düşük sezon minimum
    SELECT 
        AVG(peak_eszamanli_arac),
        MIN(peak_eszamanli_arac)
    INTO v_avg_peak_low_season, v_min_peak_low_season
    FROM (
        SELECT 
            MONTH(baslangic_tarihi) as ay,
            COUNT(*) as peak_eszamanli_arac
        FROM turlar
        WHERE YEAR(baslangic_tarihi) = p_yil 
          AND MONTH(baslangic_tarihi) NOT IN (4,5,6,9,10)
        GROUP BY DATE(baslangic_tarihi)
    ) daily_peaks;
    
    SELECT 
        p_yil AS analiz_yili,
        COALESCE(v_max_peak_high_season, 0) AS yogun_sezon_max_peak,
        COALESCE(ROUND(v_avg_peak_high_season, 0), 0) AS yogun_sezon_ort_peak,
        COALESCE(v_min_peak_low_season, 0) AS dusuk_sezon_min_peak,
        COALESCE(ROUND(v_avg_peak_low_season, 0), 0) AS dusuk_sezon_ort_peak,
        70 AS mevcut_filo,
        CASE 
            WHEN COALESCE(v_max_peak_high_season, 0) > 70 
            THEN CONCAT('Yoğun sezonda ', (COALESCE(v_max_peak_high_season, 0) - 70), ' adet ek araç kiralanması veya filoya eklenmesi önerilir.')
            ELSE 'Mevcut filo yoğun sezon için yeterli görünmektedir.'
        END AS yogun_sezon_onerisi,
        CASE 
            WHEN COALESCE(v_min_peak_low_season, 70) < 40 
            THEN CONCAT('Düşük sezonda ', (70 - COALESCE(v_min_peak_low_season, 0)), ' araç kiraya verilebilir veya satışa çıkarılabilir.')
            WHEN COALESCE(v_min_peak_low_season, 70) < 55
            THEN CONCAT('Düşük sezonda ', (70 - COALESCE(v_min_peak_low_season, 0)), ' araç geçici olarak kısa süreli kiralamaya açılabilir.')
            ELSE 'Düşük sezonda filo kullanımı makul seviyededir.'
        END AS dusuk_sezon_onerisi,
        (SELECT COUNT(*) FROM turlar WHERE YEAR(baslangic_tarihi) = p_yil AND dis_arac_mi = 1) AS toplam_dis_kiralama,
        (SELECT SUM(toplam_ucret) FROM dis_kiralamalar dk 
         JOIN turlar t ON dk.tur_id = t.id 
         WHERE YEAR(t.baslangic_tarihi) = p_yil) AS dis_kiralama_maliyeti;
END//

DELIMITER ;

-- ============================================================
-- SAKLI YORDAMLAR TAMAMLANDI
-- ============================================================
