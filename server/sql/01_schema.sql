-- ============================================================
-- KDS ARAÇ YÖNETİM SİSTEMİ - VERİTABANI ŞEMASI
-- Charset: utf8mb4 | Collation: utf8mb4_turkish_ci
-- ============================================================

-- Veritabanı oluşturma
CREATE DATABASE IF NOT EXISTS kds_arac_yonetim
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_turkish_ci;

USE kds_arac_yonetim;

-- ============================================================
-- TABLO: admin_kullanicilar (Tek admin kullanıcı)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_kullanicilar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kullanici_adi VARCHAR(50) NOT NULL UNIQUE COLLATE utf8mb4_turkish_ci,
    sifre_hash VARCHAR(255) NOT NULL COLLATE utf8mb4_turkish_ci,
    ad_soyad VARCHAR(100) COLLATE utf8mb4_turkish_ci,
    email VARCHAR(100) COLLATE utf8mb4_turkish_ci,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    son_giris_tarihi DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ============================================================
-- TABLO: guzergahlar (4 sabit güzergah)
-- ============================================================
CREATE TABLE IF NOT EXISTS guzergahlar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guzergah_adi VARCHAR(100) NOT NULL COLLATE utf8mb4_turkish_ci,
    aciklama TEXT COLLATE utf8mb4_turkish_ci,
    sure_gun INT DEFAULT 2 COMMENT 'Ortalama tur süresi (gün)',
    aktif TINYINT(1) DEFAULT 1,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ============================================================
-- TABLO: araclar (250 araç)
-- ============================================================
CREATE TABLE IF NOT EXISTS araclar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plaka VARCHAR(15) NOT NULL UNIQUE COLLATE utf8mb4_turkish_ci,
    kapasite INT NOT NULL DEFAULT 10 COMMENT 'Yolcu kapasitesi',
    marka VARCHAR(50) COLLATE utf8mb4_turkish_ci,
    model VARCHAR(50) COLLATE utf8mb4_turkish_ci,
    satin_alma_yili INT,
    durum ENUM('aktif', 'pasif', 'bakimda') DEFAULT 'aktif' COLLATE utf8mb4_turkish_ci,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;

-- ============================================================
-- TABLO: turlar (Ana tur kayıtları)
-- ============================================================
CREATE TABLE IF NOT EXISTS turlar (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guzergah_id INT NOT NULL,
    arac_id INT NOT NULL,
    baslangic_tarihi DATETIME NOT NULL,
    bitis_tarihi DATETIME NOT NULL,
    yolcu_sayisi INT NOT NULL DEFAULT 5,
    fiyat_tl DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
    notlar TEXT COLLATE utf8mb4_turkish_ci,
    olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_turlar_guzergah 
        FOREIGN KEY (guzergah_id) REFERENCES guzergahlar(id) 
        ON DELETE RESTRICT ON UPDATE CASCADE,
    
    CONSTRAINT fk_turlar_arac 
        FOREIGN KEY (arac_id) REFERENCES araclar(id) 
        ON DELETE SET NULL ON UPDATE CASCADE,
        
    CONSTRAINT chk_tarih_sirasi 
        CHECK (bitis_tarihi > baslangic_tarihi),
        
    CONSTRAINT chk_yolcu_araligi 
        CHECK (yolcu_sayisi BETWEEN 1 AND 50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;


-- ============================================================
-- İNDEKSLER (Performans için kritik)
-- ============================================================

-- Tur tarih sorguları için
CREATE INDEX idx_turlar_baslangic ON turlar(baslangic_tarihi);
CREATE INDEX idx_turlar_bitis ON turlar(bitis_tarihi);

-- Araç çakışma kontrolü için (en kritik indeks)
CREATE INDEX idx_turlar_arac_tarih ON turlar(arac_id, baslangic_tarihi, bitis_tarihi);

-- Güzergah bazlı sorgular için
CREATE INDEX idx_turlar_guzergah_tarih ON turlar(guzergah_id, baslangic_tarihi);

-- ============================================================
-- VERİTABANI OLUŞTURMA TAMAMLANDI
-- ============================================================
