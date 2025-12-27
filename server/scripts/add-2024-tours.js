/**
 * 2024 Yılına 2000 Rastgele Dağılımlı Tur Ekleme Scripti
 * 
 * Özellikler:
 * - Tarihlere eşit olmayan rastgele dağılım (bazı günler daha yoğun)
 * - Güzergahlara eşit olmayan rastgele dağılım
 * - Sezonsal yoğunluk varyasyonu
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');

// Konfigürasyon
const CONFIG = {
    totalTours: 2000,
    year: 2024,
    priceMin: 45000,
    priceMax: 85000,
    passengerMin: 15,
    passengerMax: 45
};

// Güzergah bilgileri (id -> süre gün)
const ROUTES = {
    1: { name: 'Muğla', days: 2, weight: 0.35 },           // %35 ağırlık
    2: { name: 'İzmir – Efes', days: 2, weight: 0.15 },   // %15 ağırlık
    3: { name: 'Kapadokya', days: 3, weight: 0.30 },      // %30 ağırlık
    4: { name: 'İstanbul', days: 2, weight: 0.20 }        // %20 ağırlık
};

// Aylık ağırlıklar (sezon bazlı dengesiz dağılım)
const MONTH_WEIGHTS = {
    1: 0.03,   // Ocak - düşük sezon
    2: 0.03,   // Şubat - düşük sezon
    3: 0.05,   // Mart - yükseliş
    4: 0.12,   // Nisan - yüksek sezon başlangıç
    5: 0.14,   // Mayıs - pik sezon
    6: 0.13,   // Haziran - yüksek sezon
    7: 0.11,   // Temmuz - yaz tatili
    8: 0.12,   // Ağustos - yaz tatili
    9: 0.10,   // Eylül - yüksek sezon
    10: 0.08,  // Ekim - düşüş
    11: 0.05,  // Kasım - düşük sezon
    12: 0.04   // Aralık - düşük sezon
};

// Haftanın günü ağırlıkları (0=Pazar)
const DAY_WEIGHTS = {
    0: 0.08,   // Pazar
    1: 0.12,   // Pazartesi
    2: 0.14,   // Salı
    3: 0.16,   // Çarşamba - en yoğun
    4: 0.18,   // Perşembe - en yoğun
    5: 0.20,   // Cuma - en yoğun
    6: 0.12    // Cumartesi
};

/**
 * Ağırlıklı rastgele seçim
 */
function weightedRandom(weights) {
    const entries = Object.entries(weights);
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (const [key, weight] of entries) {
        random -= weight;
        if (random <= 0) {
            return parseInt(key);
        }
    }
    return parseInt(entries[entries.length - 1][0]);
}

/**
 * Belirli ay için gün sayısını döndür
 */
function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

/**
 * Rastgele tarih üret (ağırlıklı)
 */
function generateRandomDate() {
    // Önce ayı seç
    const month = weightedRandom(MONTH_WEIGHTS);
    const daysInMonth = getDaysInMonth(CONFIG.year, month);

    // Rastgele gün (1-son gün)
    let day = Math.floor(Math.random() * daysInMonth) + 1;

    // Tarih oluştur ve haftanın gününe göre ağırlıklı kabul/ret
    let date = new Date(CONFIG.year, month - 1, day);
    const dayOfWeek = date.getDay();

    // Haftanın günü ağırlığına göre kabul et veya yeniden dene
    const acceptance = DAY_WEIGHTS[dayOfWeek] / 0.20; // En yüksek ağırlığa normalize
    if (Math.random() > acceptance) {
        // %50 şansla yeniden dene
        if (Math.random() < 0.5) {
            return generateRandomDate();
        }
    }

    // Rastgele saat (07:00 - 14:00)
    const hour = 7 + Math.floor(Math.random() * 8);
    const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45

    date.setHours(hour, minute, 0, 0);
    return date;
}

/**
 * Rastgele güzergah seç
 */
function selectRoute() {
    const weights = {};
    for (const [id, route] of Object.entries(ROUTES)) {
        weights[id] = route.weight;
    }
    return weightedRandom(weights);
}

/**
 * Bitiş tarihini hesapla
 */
function calculateEndDate(startDate, routeId) {
    const duration = ROUTES[routeId].days;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + duration);
    endDate.setHours(17 + Math.floor(Math.random() * 3), 0, 0, 0); // 17:00-19:00
    return endDate;
}

/**
 * Rastgele fiyat üret
 */
function generatePrice() {
    return Math.floor(Math.random() * (CONFIG.priceMax - CONFIG.priceMin + 1)) + CONFIG.priceMin;
}

/**
 * Rastgele yolcu sayısı üret
 */
function generatePassengerCount() {
    return Math.floor(Math.random() * (CONFIG.passengerMax - CONFIG.passengerMin + 1)) + CONFIG.passengerMin;
}

/**
 * MySQL tarih formatına çevir
 */
function formatMySQLDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Ana fonksiyon
 */
async function main() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     2024 YILI RASTGELE TUR EKLEYİCİ                            ║');
    console.log('║     2000 Tur - Dengesiz Dağılım                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    let connection;

    try {
        // Veritabanına bağlan
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'kds_arac_yonetim'
        });

        console.log('✓ Veritabanına bağlandı');

        // Mevcut 2024 tur sayısını kontrol et
        const [existing] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM turlar 
            WHERE YEAR(baslangic_tarihi) = ?
        `, [CONFIG.year]);

        console.log(`ℹ Mevcut 2024 turu sayısı: ${existing[0].count}`);

        // Araç listesini al
        const [vehicles] = await connection.execute('SELECT id FROM araclar WHERE durum = "aktif" LIMIT 70');
        const vehicleIds = vehicles.map(v => v.id);
        console.log(`ℹ Aktif araç sayısı: ${vehicleIds.length}`);

        if (vehicleIds.length === 0) {
            throw new Error('Aktif araç bulunamadı! Önce veritabanı seed işlemini çalıştırın.');
        }

        // Turları oluştur
        console.log('\n→ 2000 rastgele tur oluşturuluyor...\n');

        const tours = [];
        const routeStats = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const monthStats = {};

        for (let i = 0; i < CONFIG.totalTours; i++) {
            const startDate = generateRandomDate();
            const routeId = selectRoute();
            const endDate = calculateEndDate(startDate, routeId);

            // Rastgele araç seç veya dış kiralama (%15 dış kiralama)
            let vehicleId = null;
            let disAracMi = 0;

            if (Math.random() > 0.15) {
                vehicleId = vehicleIds[Math.floor(Math.random() * vehicleIds.length)];
            } else {
                disAracMi = 1;
            }

            const price = generatePrice();
            const passengers = generatePassengerCount();

            tours.push([
                routeId,
                vehicleId,
                formatMySQLDate(startDate),
                formatMySQLDate(endDate),
                passengers,
                price,
                disAracMi
            ]);

            // İstatistikler
            routeStats[routeId]++;
            const monthKey = startDate.getMonth() + 1;
            monthStats[monthKey] = (monthStats[monthKey] || 0) + 1;

            // İlerleme göster
            if ((i + 1) % 500 === 0) {
                console.log(`   → ${i + 1} tur oluşturuldu...`);
            }
        }

        // Batch INSERT
        console.log('\n→ Veritabanına ekleniyor...');

        const batchSize = 500;
        for (let i = 0; i < tours.length; i += batchSize) {
            const batch = tours.slice(i, i + batchSize);
            await connection.query(`
                INSERT INTO turlar 
                (guzergah_id, arac_id, baslangic_tarihi, bitis_tarihi, yolcu_sayisi, fiyat_tl, dis_arac_mi)
                VALUES ?
            `, [batch]);
            console.log(`   → ${Math.min(i + batchSize, tours.length)} / ${tours.length} kayıt eklendi`);
        }

        // Sonuç özeti
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                      SONUÇ ÖZETİ                               ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');

        console.log('\n📊 GÜZERGAH DAĞILIMI:');
        console.log('─'.repeat(40));
        for (const [id, count] of Object.entries(routeStats)) {
            const percent = ((count / CONFIG.totalTours) * 100).toFixed(1);
            const bar = '█'.repeat(Math.floor(percent / 2));
            console.log(`  ${ROUTES[id].name.padEnd(20)} : ${count.toString().padStart(4)} (%${percent.padStart(5)}) ${bar}`);
        }

        console.log('\n📅 AYLIK DAĞILIM:');
        console.log('─'.repeat(50));
        const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        for (let m = 1; m <= 12; m++) {
            const count = monthStats[m] || 0;
            const percent = ((count / CONFIG.totalTours) * 100).toFixed(1);
            const bar = '█'.repeat(Math.floor(count / 20));
            console.log(`  ${monthNames[m - 1]} : ${count.toString().padStart(4)} (%${percent.padStart(5)}) ${bar}`);
        }

        // Son durum
        const [finalCount] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM turlar 
            WHERE YEAR(baslangic_tarihi) = ?
        `, [CONFIG.year]);

        console.log('\n✅ İŞLEM TAMAMLANDI!');
        console.log(`   → ${CONFIG.totalTours} yeni tur eklendi`);
        console.log(`   → Toplam 2024 turu: ${finalCount[0].count}`);

    } catch (error) {
        console.error('\n❌ HATA:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

main();
