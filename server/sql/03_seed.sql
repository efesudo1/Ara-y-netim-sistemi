-- ============================================================
-- KDS ARAÇ YÖNETİM SİSTEMİ - VERİ SEED
-- ============================================================

USE kds_arac_yonetim;

-- 1. Temel verileri yükle (4 güzergah, 250 araç, 1 admin)
CALL sp_temel_veri_yukle();

-- 2. Turları oluştur (10.04.2022 - 10.11.2025)
-- Bu işlem birkaç dakika sürebilir
CALL sp_turlari_olustur('2022-04-10', '2025-11-10');

-- 3. Sonuçları kontrol et
SELECT '=== VERİ SEED SONUÇLARI ===' AS bilgi;

SELECT 'Admin Kullanıcılar' AS tablo, COUNT(*) AS kayit_sayisi FROM admin_kullanicilar
UNION ALL
SELECT 'Güzergahlar', COUNT(*) FROM guzergahlar
UNION ALL
SELECT 'Araçlar', COUNT(*) FROM araclar
UNION ALL
SELECT 'Turlar', COUNT(*) FROM turlar
UNION ALL
SELECT 'Tur Log', COUNT(*) FROM tur_log;

-- 4. Aylık tur dağılımı kontrolü
SELECT 
    YEAR(baslangic_tarihi) AS yil,
    MONTH(baslangic_tarihi) AS ay,
    COUNT(*) AS tur_sayisi,
    CASE 
        WHEN MONTH(baslangic_tarihi) IN (4,5,6,9,10) THEN 'YOĞUN SEZON'
        ELSE 'NORMAL SEZON'
    END AS sezon
FROM turlar
GROUP BY YEAR(baslangic_tarihi), MONTH(baslangic_tarihi)
ORDER BY yil, ay;

-- 5. Admin şifresini güncelle (bcrypt hash)
-- Node.js tarafında hashlenmiş şifre: Admin123!
-- Bu hash'i Node.js başlatılırken güncelleyeceğiz

SELECT 'Seed işlemi tamamlandı. Admin girişi: admin / Admin123!' AS mesaj;
