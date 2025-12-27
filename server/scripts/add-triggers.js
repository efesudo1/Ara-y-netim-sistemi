/**
 * Migration Script - Add Triggers for Tour Logging
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function addTriggers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kds_arac_yonetim',
        multipleStatements: true
    });

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     TRIGGER EKLEME MİGRASYONU                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    try {
        // 1. Log tablosu oluştur
        console.log('📋 Log tablosu oluşturuluyor...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS tur_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                islem_tipi ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL COMMENT 'Yapılan işlem türü',
                tur_id INT NOT NULL COMMENT 'İşlem yapılan tur ID',
                eski_degerler JSON COMMENT 'UPDATE/DELETE için eski değerler',
                yeni_degerler JSON COMMENT 'INSERT/UPDATE için yeni değerler',
                islem_zamani DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'İşlem zamanı',
                islem_yapan VARCHAR(100) DEFAULT 'system' COMMENT 'İşlemi yapan kullanıcı/sistem'
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci
        `);
        console.log('   ✅ tur_log tablosu oluşturuldu');

        // 2. INSERT Trigger
        console.log('');
        console.log('⚙️  Trigger\'lar oluşturuluyor...');

        await connection.query('DROP TRIGGER IF EXISTS trg_tur_insert');
        await connection.query(`
            CREATE TRIGGER trg_tur_insert
            AFTER INSERT ON turlar
            FOR EACH ROW
            BEGIN
                INSERT INTO tur_log (islem_tipi, tur_id, yeni_degerler, islem_yapan)
                VALUES (
                    'INSERT',
                    NEW.id,
                    JSON_OBJECT(
                        'guzergah_id', NEW.guzergah_id,
                        'arac_id', NEW.arac_id,
                        'baslangic_tarihi', NEW.baslangic_tarihi,
                        'bitis_tarihi', NEW.bitis_tarihi,
                        'yolcu_sayisi', NEW.yolcu_sayisi,
                        'fiyat_tl', NEW.fiyat_tl
                    ),
                    'system'
                );
            END
        `);
        console.log('   ✅ trg_tur_insert (Tur ekleme trigger)');

        // 3. UPDATE Trigger
        await connection.query('DROP TRIGGER IF EXISTS trg_tur_update');
        await connection.query(`
            CREATE TRIGGER trg_tur_update
            AFTER UPDATE ON turlar
            FOR EACH ROW
            BEGIN
                INSERT INTO tur_log (islem_tipi, tur_id, eski_degerler, yeni_degerler, islem_yapan)
                VALUES (
                    'UPDATE',
                    NEW.id,
                    JSON_OBJECT(
                        'guzergah_id', OLD.guzergah_id,
                        'arac_id', OLD.arac_id,
                        'baslangic_tarihi', OLD.baslangic_tarihi,
                        'bitis_tarihi', OLD.bitis_tarihi,
                        'yolcu_sayisi', OLD.yolcu_sayisi,
                        'fiyat_tl', OLD.fiyat_tl
                    ),
                    JSON_OBJECT(
                        'guzergah_id', NEW.guzergah_id,
                        'arac_id', NEW.arac_id,
                        'baslangic_tarihi', NEW.baslangic_tarihi,
                        'bitis_tarihi', NEW.bitis_tarihi,
                        'yolcu_sayisi', NEW.yolcu_sayisi,
                        'fiyat_tl', NEW.fiyat_tl
                    ),
                    'system'
                );
            END
        `);
        console.log('   ✅ trg_tur_update (Tur güncelleme trigger)');

        // 4. DELETE Trigger
        await connection.query('DROP TRIGGER IF EXISTS trg_tur_delete');
        await connection.query(`
            CREATE TRIGGER trg_tur_delete
            BEFORE DELETE ON turlar
            FOR EACH ROW
            BEGIN
                INSERT INTO tur_log (islem_tipi, tur_id, eski_degerler, islem_yapan)
                VALUES (
                    'DELETE',
                    OLD.id,
                    JSON_OBJECT(
                        'guzergah_id', OLD.guzergah_id,
                        'arac_id', OLD.arac_id,
                        'baslangic_tarihi', OLD.baslangic_tarihi,
                        'bitis_tarihi', OLD.bitis_tarihi,
                        'yolcu_sayisi', OLD.yolcu_sayisi,
                        'fiyat_tl', OLD.fiyat_tl
                    ),
                    'system'
                );
            END
        `);
        console.log('   ✅ trg_tur_delete (Tur silme trigger)');

        // 5. Doğrulama
        console.log('');
        console.log('🔍 Doğrulama...');

        const [triggers] = await connection.query(`
            SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE 
            FROM information_schema.TRIGGERS 
            WHERE TRIGGER_SCHEMA = 'kds_arac_yonetim'
        `);

        console.log(`   📊 Toplam ${triggers.length} trigger bulundu:`);
        triggers.forEach(t => {
            console.log(`      - ${t.TRIGGER_NAME} (${t.EVENT_MANIPULATION} on ${t.EVENT_OBJECT_TABLE})`);
        });

        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║  ✅ TRIGGER EKLEME TAMAMLANDI!                             ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await connection.end();
    }
}

addTriggers();
