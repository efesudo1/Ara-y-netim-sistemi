# KDS Araç Yönetim Sistemi

Türkiye'deki 4 tur güzergahı ve 250 araçlık filo üzerinden **tur yoğunluğu + araç yeterlilik/yetersizlik + araç fazlalığı** analizleri üreten Karar Destek Sistemi.

## 🚀 Hızlı Başlangıç

### Gereksinimler

- **Node.js** (v16 veya üstü)
- **XAMPP** (MySQL 8.0 veya üstü)

### 1. XAMPP MySQL Başlatın

1. XAMPP Control Panel'i açın
2. MySQL servisini "Start" ile başlatın
3. Apache servisini başlatın (phpMyAdmin için)

### 2. Veritabanı Oluşturun

**phpMyAdmin** üzerinden veya **MySQL komut satırı** ile:

```sql
-- Veritabanını oluştur
CREATE DATABASE IF NOT EXISTS kds_arac_yonetim
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_turkish_ci;
```

### 3. SQL Dosyalarını Çalıştırın

Sırasıyla aşağıdaki dosyaları çalıştırın:

```bash
# phpMyAdmin'de "Import" sekmesinden veya komut satırından:

mysql -u root -p kds_arac_yonetim < server/sql/01_schema.sql
mysql -u root -p kds_arac_yonetim < server/sql/02_procedures.sql
mysql -u root -p kds_arac_yonetim < server/sql/03_seed.sql
```

**veya** phpMyAdmin'de:
1. `kds_arac_yonetim` veritabanını seçin
2. "Import" sekmesine gidin
3. Sırasıyla her SQL dosyasını yükleyin

### 4. Node.js Kurulumu

```bash
# Proje dizinine gidin
cd "kds araç yönetim sistemi"

# Bağımlılıkları yükleyin
npm install

# Sunucuyu başlatın
npm run dev
```

### 5. Uygulamayı Açın

Tarayıcınızda: **http://localhost:3000**

---

## 🔐 Admin Giriş Bilgileri

| Alan | Değer |
|------|-------|
| **Kullanıcı Adı** | `admin` |
| **Şifre** | `Admin123!` |

---

## 📁 Proje Yapısı

```
kds araç yönetim sistemi/
├── server/
│   ├── app.js                 # Express ana uygulama
│   ├── config/
│   │   ├── db.js             # MySQL bağlantısı
│   │   └── env.example       # Örnek .env dosyası
│   ├── routes/
│   │   ├── auth.routes.js    # Login/logout
│   │   ├── analytics.routes.js  # Dashboard API
│   │   └── admin.routes.js   # Seed endpoint
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── analytics.controller.js
│   │   └── admin.controller.js
│   ├── middlewares/
│   │   └── auth.middleware.js  # JWT doğrulama
│   ├── sql/
│   │   ├── 01_schema.sql     # Tablo yapıları
│   │   ├── 02_procedures.sql # Stored procedures
│   │   └── 03_seed.sql       # Veri seed
│   ├── views/
│   │   ├── login.ejs
│   │   ├── dashboard.ejs
│   │   └── error.ejs
│   └── public/
│       ├── css/style.css
│       └── js/dashboard.js
├── .env                       # Environment değişkenleri
├── package.json
└── README.md
```

---

## 🗄️ Veritabanı Tabloları

| Tablo | Açıklama |
|-------|----------|
| `admin_kullanicilar` | Tek admin kullanıcı |
| `guzergahlar` | 4 sabit güzergah |
| `araclar` | 250 araç |
| `turlar` | Tur kayıtları (2022-2025) |

---

## 📊 API Endpoints

### Auth
- `POST /auth/login` - Admin girişi

### Analytics (JWT korumalı)
- `GET /api/analytics/summary` - Dashboard özet
- `GET /api/analytics/tour-volume?from=&to=&group=` - Tur yoğunluğu
- `GET /api/analytics/route-volume?from=&to=&group=` - Güzergah hacmi
- `GET /api/analytics/fleet-concurrency?from=&to=` - Filo eşzamanlılık
- `GET /api/analytics/monthly-fleet-balance?year=` - Aylık denge
- `GET /api/analytics/recommendations?year=` - Yönetici önerileri

### Admin
- `POST /api/admin/seed` - Veri seed (dev ortamı)
- `GET /api/admin/db-status` - DB durumu

---

## 📈 Stored Procedures

| Prosedür | Açıklama |
|----------|----------|
| `sp_tur_olustur` | Çakışma kontrolü ile tur ekleme |
| `sp_temel_veri_yukle` | Temel veri seed |
| `sp_turlari_olustur` | Tur üretimi (sezon kuralları ile) |
| `sp_rapor_tur_yogunluk` | Tur hacmi raporu |
| `sp_rapor_guzergah_hacim` | Güzergah bazlı analiz |
| `sp_rapor_filo_eszamanlilik` | Peak concurrent hesaplama |
| `sp_rapor_aylik_filo_denge` | Aylık shortage/surplus |
| `sp_yonetici_oneri` | Yönetici öneri paneli |

---

## ✅ Kabul Testleri

Aşağıdaki sorguları çalıştırarak sistemin doğru kurulduğunu doğrulayın:

```sql
-- 1. Charset kontrolü
SHOW VARIABLES LIKE 'character_set_database';
-- Beklenen: utf8mb4

-- 2. Tablo sayıları
SELECT 'Güzergahlar' as tablo, COUNT(*) as sayi FROM guzergahlar
UNION ALL SELECT 'Araçlar', COUNT(*) FROM araclar
UNION ALL SELECT 'Turlar', COUNT(*) FROM turlar;
-- Beklenen: 4, 250, binlerce tur

-- 3. Yoğun sezon kontrolü (ayda ~250 tur)
SELECT YEAR(baslangic_tarihi) yil, MONTH(baslangic_tarihi) ay, COUNT(*) tur_sayisi
FROM turlar
WHERE MONTH(baslangic_tarihi) IN (4,5,6,9,10)
GROUP BY yil, ay
ORDER BY yil, ay;

-- 4. Çakışma testi (hata vermeli)
-- Önce mevcut bir turu bulun, sonra aynı araç ile çakışan tarihte tur oluşturmayı deneyin
```

---

## 🛠️ Sorun Giderme

### MySQL Bağlantı Hatası
- XAMPP MySQL servisinin çalıştığından emin olun
- `.env` dosyasındaki ayarları kontrol edin

### Seed Çalışmıyor
1. Veritabanının oluşturulduğundan emin olun
2. SQL dosyalarını doğru sırada çalıştırın
3. API üzerinden seed: `POST /api/admin/seed`

### Grafikler Yüklenmiyor
- Tarayıcı konsolunda hata kontrolü (F12)
- API endpoint'lerinin çalıştığını doğrulayın

---

## 📝 Lisans

MIT License

---

**Geliştirici:** KDS Team
