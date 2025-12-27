/**
 * KDS Araç Yönetim Sistemi - Analytics Controller
 * Dashboard rapor endpoint'leri
 */

const { callProcedure, query } = require('../config/db');

/**
 * Tur yoğunluğu raporu
 * GET /api/analytics/tour-volume?from=&to=&group=
 */
async function getTourVolume(req, res) {
    try {
        const { from, to, group = 'month' } = req.query;

        // Validasyon
        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'from ve to parametreleri gereklidir.'
            });
        }

        // Stored procedure çağır
        const results = await callProcedure('sp_rapor_tur_yogunluk', [from, to, group]);

        res.json({
            success: true,
            data: results,
            meta: {
                from,
                to,
                group,
                tourPrice: parseInt(process.env.TOUR_PRICE_TL) || 5000
            }
        });

    } catch (error) {
        console.error('Tur yoğunluğu rapor hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Rapor alınırken hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Güzergah bazlı hacim raporu
 * GET /api/analytics/route-volume?from=&to=&group=
 */
async function getRouteVolume(req, res) {
    try {
        const { from, to, group = 'month' } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'from ve to parametreleri gereklidir.'
            });
        }

        const results = await callProcedure('sp_rapor_guzergah_hacim', [from, to, group]);

        res.json({
            success: true,
            data: results,
            meta: { from, to, group }
        });

    } catch (error) {
        console.error('Güzergah hacim rapor hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Rapor alınırken hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Filo eşzamanlılık raporu (Peak concurrent)
 * GET /api/analytics/fleet-concurrency?from=&to=
 */
async function getFleetConcurrency(req, res) {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'from ve to parametreleri gereklidir.'
            });
        }

        const results = await callProcedure('sp_rapor_filo_eszamanlilik', [from, to]);

        // SP tek satır döndürür
        const data = Array.isArray(results) ? results[0] : results;

        res.json({
            success: true,
            data: data,
            meta: { from, to, fleetCapacity: parseInt(process.env.FLEET_CAPACITY) || 70 }
        });

    } catch (error) {
        console.error('Filo eşzamanlılık rapor hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Rapor alınırken hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Aylık filo dengesi raporu (shortage/surplus)
 * GET /api/analytics/monthly-fleet-balance?year=
 */
async function getMonthlyFleetBalance(req, res) {
    try {
        const { year } = req.query;

        if (!year) {
            return res.status(400).json({
                success: false,
                message: 'year parametresi gereklidir.'
            });
        }

        const results = await callProcedure('sp_rapor_aylik_filo_denge', [parseInt(year)]);

        // Yetersiz ve fazla ayları ayır
        const shortageMonths = results.filter(r => r.arac_yetersizligi > 0);
        const surplusMonths = results.filter(r => r.arac_fazlaligi > 50); // 50'den fazla boşta araç

        res.json({
            success: true,
            data: {
                allMonths: results,
                shortageMonths,
                surplusMonths
            },
            meta: { year: parseInt(year), fleetCapacity: parseInt(process.env.FLEET_CAPACITY) || 70 }
        });

    } catch (error) {
        console.error('Aylık filo denge rapor hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Rapor alınırken hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Yönetici öneri raporu
 * GET /api/analytics/recommendations?year=
 */
async function getRecommendations(req, res) {
    try {
        const { year } = req.query;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const results = await callProcedure('sp_yonetici_oneri', [targetYear]);

        // SP tek satır döndürür
        const data = Array.isArray(results) ? results[0] : results;

        res.json({
            success: true,
            data: data,
            meta: { year: targetYear }
        });

    } catch (error) {
        console.error('Öneri rapor hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Rapor alınırken hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Dashboard özet verileri
 * GET /api/analytics/summary?from=&to=
 */
async function getDashboardSummary(req, res) {
    try {
        const { from, to } = req.query;

        // Varsayılan: son 3 yıl
        const defaultTo = new Date().toISOString().split('T')[0];
        const defaultFrom = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const fromDate = from || defaultFrom;
        const toDate = to || defaultTo;

        // Temel istatistikler
        const [totalStats] = await query(`
            SELECT 
                COUNT(*) as toplam_tur,
                SUM(fiyat_tl) as toplam_gelir,
                AVG(yolcu_sayisi) as ortalama_yolcu
            FROM turlar
            WHERE DATE(baslangic_tarihi) BETWEEN ? AND ?
        `, [fromDate, toDate]);

        // Güzergah dağılımı
        const routeStats = await query(`
            SELECT 
                g.guzergah_adi,
                COUNT(*) as tur_sayisi,
                SUM(t.fiyat_tl) as toplam_gelir
            FROM turlar t
            JOIN guzergahlar g ON t.guzergah_id = g.id
            WHERE DATE(t.baslangic_tarihi) BETWEEN ? AND ?
            GROUP BY g.id, g.guzergah_adi
            ORDER BY tur_sayisi DESC
        `, [fromDate, toDate]);

        // Fleet durumu
        let fleetData = null;
        try {
            const fleetResults = await callProcedure('sp_rapor_filo_eszamanlilik', [fromDate, toDate]);
            fleetData = Array.isArray(fleetResults) ? fleetResults[0] : fleetResults;
        } catch (e) {
            console.error('Fleet SP hatası:', e.message);
        }

        res.json({
            success: true,
            data: {
                summary: {
                    toplamTur: totalStats?.toplam_tur || 0,
                    toplamGelir: totalStats?.toplam_gelir || 0,
                    ortalamaYolcu: Math.round(totalStats?.ortalama_yolcu || 0)
                },
                routeStats,
                fleetData
            },
            meta: {
                from: fromDate,
                to: toDate,
                tourPrice: parseInt(process.env.TOUR_PRICE_TL) || 5000,
                fleetCapacity: parseInt(process.env.FLEET_CAPACITY) || 70
            }
        });

    } catch (error) {
        console.error('Dashboard özet hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Özet verileri alınırken hata oluştu.',
            error: error.message
        });
    }
}

/**
 * Günlük tur verileri (Takvim için)
 * GET /api/analytics/daily-tours?from=&to=&routeId=
 */
async function getDailyTours(req, res) {
    try {
        const { from, to, routeId } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'from ve to parametreleri gereklidir.'
            });
        }

        let sql = `
            SELECT 
                DATE(baslangic_tarihi) as tarih,
                COUNT(*) as tur_sayisi
            FROM turlar
            WHERE DATE(baslangic_tarihi) BETWEEN ? AND ?
        `;

        const params = [from, to];

        if (routeId) {
            sql += ' AND guzergah_id = ?';
            params.push(routeId);
        }

        sql += ' GROUP BY DATE(baslangic_tarihi) ORDER BY tarih';

        const results = await query(sql, params);

        res.json({
            success: true,
            data: results,
            meta: { from, to, routeId: routeId || null }
        });

    } catch (error) {
        console.error('Günlük tur verileri hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Günlük tur verileri alınırken hata oluştu.',
            error: error.message
        });
    }
}

module.exports = {
    getTourVolume,
    getRouteVolume,
    getFleetConcurrency,
    getMonthlyFleetBalance,
    getRecommendations,
    getDashboardSummary,
    getDailyTours
};
