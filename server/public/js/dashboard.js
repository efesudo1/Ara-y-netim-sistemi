/**
 * KDS Araç Yönetim Sistemi - Dashboard JavaScript
 * Chart.js grafikleri ve API çağrıları
 */

// Global chart instances
let tourVolumeChart = null;
let fleetBalanceChart = null;
let routeDistributionChart = null;
let dailyDistributionChart = null;
let fleetUtilizationChart = null;
let tourVehicleCompareChart = null;

// API base URL
const API_BASE = '/api';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Para formatı (TL)
 */
function formatCurrency(value) {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

/**
 * Sayı formatı
 */
function formatNumber(value) {
    if (!value && value !== 0) return '-';
    return new Intl.NumberFormat('tr-TR').format(value);
}

/**
 * API çağrısı
 */
async function fetchAPI(endpoint, params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const url = `${API_BASE}${endpoint}${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Hatası (${endpoint}):`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Tarih filtrelerini al
 */
function getFilters() {
    return {
        from: document.getElementById('filter-from').value,
        to: document.getElementById('filter-to').value,
        group: document.getElementById('filter-group').value
    };
}

/**
 * Hızlı filtre uygula
 */
function applyQuickFilter() {
    const select = document.getElementById('quick-select');
    const value = select.value;
    const fromInput = document.getElementById('filter-from');
    const toInput = document.getElementById('filter-to');

    const today = new Date();

    switch (value) {
        case 'last3years':
            fromInput.value = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate())
                .toISOString().split('T')[0];
            toInput.value = today.toISOString().split('T')[0];
            break;
        case '2024':
            fromInput.value = '2024-01-01';
            toInput.value = '2024-12-31';
            break;
        case '2023':
            fromInput.value = '2023-01-01';
            toInput.value = '2023-12-31';
            break;
        case 'high-season':
            fromInput.value = '2024-04-01';
            toInput.value = '2024-10-31';
            break;
    }

    if (value) {
        loadDashboardData();
    }
}

/**
 * Belirli bölüme scroll
 */
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================================
// DATA LOADING FUNCTIONS
// ============================================================

/**
 * Ana dashboard verilerini yükle
 */
async function loadDashboardData() {
    const filters = getFilters();

    // Paralel API çağrıları
    const [summaryRes, volumeRes, balanceRes] = await Promise.all([
        fetchAPI('/analytics/summary', { from: filters.from, to: filters.to }),
        fetchAPI('/analytics/tour-volume', filters),
        fetchAPI('/analytics/monthly-fleet-balance', { year: new Date(filters.to).getFullYear() })
    ]);

    // KPI kartlarını güncelle
    updateKPICards(summaryRes);

    // Güzergah istatistiklerini güncelle
    updateRouteStats(summaryRes);

    // Grafikleri güncelle
    updateTourVolumeChart(volumeRes);
    updateFleetBalanceChart(balanceRes);

    // Tabloları güncelle
    updateFleetTables(balanceRes);

    // Güzergah dağılım grafiğini yükle
    loadRouteDistribution();
}

/**
 * Güzergah dağılım grafiğini yükle
 */
async function loadRouteDistribution() {
    const periodSelect = document.getElementById('route-chart-period');
    if (!periodSelect) return;

    const period = periodSelect.value;

    // Tarih aralığını belirle
    let from, to;
    switch (period) {
        case 'all':
            from = '2022-01-01';
            to = '2025-12-31';
            break;
        case '2025':
            from = '2025-01-01';
            to = '2025-12-31';
            break;
        case '2024':
            from = '2024-01-01';
            to = '2024-12-31';
            break;
        case '2023':
            from = '2023-01-01';
            to = '2023-12-31';
            break;
        case '2022':
            from = '2022-01-01';
            to = '2022-12-31';
            break;
        case 'high-season':
            from = '2024-04-01';
            to = '2024-10-31';
            break;
        case 'low-season':
            from = '2024-01-01';
            to = '2024-03-31';
            break;
        default:
            from = '2024-01-01';
            to = '2024-12-31';
    }

    const response = await fetchAPI('/analytics/route-volume', { from, to, group: 'total' });

    if (!response.success || !response.data) return;

    renderRouteDistributionChart(response.data);
}

/**
 * Güzergah dağılım grafiğini render et
 */
function renderRouteDistributionChart(data) {
    const ctx = document.getElementById('routeDistributionChart');
    const legendContainer = document.getElementById('route-chart-legend');

    if (!ctx || !legendContainer) return;

    // Mevcut grafiği yok et
    if (routeDistributionChart) {
        routeDistributionChart.destroy();
    }

    // Renk paleti
    const colors = [
        'rgba(0, 217, 255, 0.85)',
        'rgba(124, 58, 237, 0.85)',
        'rgba(16, 185, 129, 0.85)',
        'rgba(245, 158, 11, 0.85)'
    ];

    const borderColors = [
        'rgba(0, 217, 255, 1)',
        'rgba(124, 58, 237, 1)',
        'rgba(16, 185, 129, 1)',
        'rgba(245, 158, 11, 1)'
    ];

    const labels = data.map(d => d.guzergah_adi);
    const values = data.map(d => d.tur_sayisi);
    const total = values.reduce((a, b) => a + b, 0);

    // Grafik oluştur
    routeDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '55%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 14,
                    callbacks: {
                        label: function (context) {
                            const value = context.raw;
                            const percent = ((value / total) * 100).toFixed(1);
                            return `${formatNumber(value)} tur (${percent}%)`;
                        }
                    }
                }
            }
        }
    });

    // Custom legend oluştur
    legendContainer.innerHTML = data.map((route, index) => {
        const percent = ((route.tur_sayisi / total) * 100).toFixed(1);
        return `
            <div class="route-legend-item">
                <div class="route-legend-color" style="background: ${colors[index]}"></div>
                <div class="route-legend-info">
                    <span class="route-legend-name">${route.guzergah_adi}</span>
                    <div class="route-legend-stats">
                        <span class="route-legend-count">${formatNumber(route.tur_sayisi)} tur</span>
                        <span class="route-legend-percent">${percent}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * KPI kartlarını güncelle
 */
function updateKPICards(response) {
    if (!response.success) return;

    const { summary, fleetData } = response.data;

    // Toplam Tur
    document.getElementById('kpi-total-tours').textContent = formatNumber(summary.toplamTur);

    // Toplam Gelir
    document.getElementById('kpi-total-revenue').textContent = formatCurrency(summary.toplamGelir);

    // Peak Araç
    const peakVehicles = fleetData?.peak_eszamanli_arac || '-';
    document.getElementById('kpi-peak-vehicles').textContent = formatNumber(peakVehicles);

    // Filo Durumu
    const fleetStatusEl = document.getElementById('kpi-fleet-status');
    const fleetLabelEl = document.getElementById('kpi-fleet-label');
    const fleetIconEl = document.getElementById('kpi-fleet-status-icon');

    if (fleetData) {
        if (fleetData.arac_yetersizligi > 0) {
            fleetStatusEl.textContent = `-${fleetData.arac_yetersizligi}`;
            fleetLabelEl.textContent = 'Araç Yetersizliği';
            fleetIconEl.textContent = '⚠️';
            fleetIconEl.className = 'kpi-icon red';
        } else if (fleetData.arac_fazlaligi > 50) {
            fleetStatusEl.textContent = `+${fleetData.arac_fazlaligi}`;
            fleetLabelEl.textContent = 'Boşta Araç';
            fleetIconEl.textContent = '✅';
            fleetIconEl.className = 'kpi-icon green';
        } else {
            fleetStatusEl.textContent = 'Normal';
            fleetLabelEl.textContent = 'Filo Dengeli';
            fleetIconEl.textContent = '📊';
            fleetIconEl.className = 'kpi-icon blue';
        }
    }
}

/**
 * Güzergah istatistiklerini güncelle
 */
function updateRouteStats(response) {
    const container = document.getElementById('route-stats');

    if (!response.success || !response.data.routeStats) {
        container.innerHTML = '<div class="route-card">Veri yüklenemedi</div>';
        return;
    }

    const stats = response.data.routeStats;

    container.innerHTML = stats.map(route => `
        <div class="route-card">
            <div class="route-name">${route.guzergah_adi}</div>
            <div class="route-stats">
                <div class="route-stat">
                    <span class="label">Tur Sayısı</span>
                    <span class="value">${formatNumber(route.tur_sayisi)}</span>
                </div>
                <div class="route-stat">
                    <span class="label">Gelir</span>
                    <span class="value">${formatCurrency(route.toplam_gelir)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Tur yoğunluğu grafiğini güncelle
 */
function updateTourVolumeChart(response) {
    const ctx = document.getElementById('tourVolumeChart').getContext('2d');

    // Mevcut grafiği yok et
    if (tourVolumeChart) {
        tourVolumeChart.destroy();
    }

    if (!response.success || !response.data) {
        return;
    }

    const data = response.data;
    const group = response.meta?.group || 'month';

    // Label formatı
    let labels;
    if (group === 'month') {
        labels = data.map(d => d.ay_yil || `${d.yil}-${String(d.ay).padStart(2, '0')}`);
    } else if (group === 'year') {
        labels = data.map(d => String(d.yil));
    } else if (group === 'week') {
        labels = data.map(d => `${d.yil} H${d.hafta}`);
    } else {
        labels = data.map(d => d.tarih);
    }

    const tourCounts = data.map(d => d.tur_sayisi);

    tourVolumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tur Sayısı',
                data: tourCounts,
                backgroundColor: 'rgba(0, 217, 255, 0.6)',
                borderColor: 'rgba(0, 217, 255, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.9)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        afterBody: function (context) {
                            const index = context[0].dataIndex;
                            const item = data[index];
                            return [
                                '',
                                `Gelir: ${formatCurrency(item.toplam_gelir)}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * Filo denge grafiğini güncelle
 */
function updateFleetBalanceChart(response) {
    const ctx = document.getElementById('fleetBalanceChart').getContext('2d');

    if (fleetBalanceChart) {
        fleetBalanceChart.destroy();
    }

    if (!response.success || !response.data?.allMonths) {
        return;
    }

    const data = response.data.allMonths;
    const labels = data.map(d => d.ay_adi);
    const peakValues = data.map(d => d.peak_eszamanli_arac);

    // API'den gelen filo kapasitesini kullan, yoksa varsayılan 40
    const fleetCapacity = response.meta?.fleetCapacity || data[0]?.filo_kapasitesi || 40;

    // Y eksen max değerini dinamik hesapla
    const maxPeak = Math.max(...peakValues, fleetCapacity);
    const yAxisMax = Math.ceil(maxPeak * 1.2 / 10) * 10; // %20 margin, 10'a yuvarla

    fleetBalanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Peak Araç İhtiyacı',
                    data: peakValues,
                    borderColor: 'rgba(0, 217, 255, 1)',
                    backgroundColor: 'rgba(0, 217, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: `Filo Kapasitesi (${fleetCapacity})`,
                    data: Array(12).fill(fleetCapacity),
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.9)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        afterBody: function (context) {
                            const index = context[0].dataIndex;
                            const item = data[index];
                            const status = item.arac_yetersizligi > 0
                                ? `⚠️ Eksik: ${item.arac_yetersizligi}`
                                : `✅ Fazla: ${item.arac_fazlaligi}`;
                            return ['', status];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)'
                    },
                    suggestedMin: 0,
                    suggestedMax: yAxisMax
                }
            }
        }
    });
}

/**
 * Filo tablolarını güncelle
 */
function updateFleetTables(response) {
    const shortageTable = document.querySelector('#shortage-table tbody');
    const surplusTable = document.querySelector('#surplus-table tbody');
    const shortageSubtitle = document.getElementById('shortage-subtitle');
    const surplusSubtitle = document.getElementById('surplus-subtitle');
    const legendFleetCapacity = document.getElementById('legend-fleet-capacity');

    if (!response.success || !response.data) {
        shortageTable.innerHTML = '<tr><td colspan="6" class="loading">Veri yüklenemedi</td></tr>';
        surplusTable.innerHTML = '<tr><td colspan="6" class="loading">Veri yüklenemedi</td></tr>';
        return;
    }

    const allMonths = response.data.allMonths || [];
    const fleetCapacity = response.meta?.fleetCapacity || allMonths[0]?.filo_kapasitesi || 40;

    // Legend'i güncelle
    if (legendFleetCapacity) {
        legendFleetCapacity.textContent = fleetCapacity;
    }

    // Subtitle'ları güncelle
    if (shortageSubtitle) {
        shortageSubtitle.textContent = `Günlük ort. tur sayısı ${fleetCapacity} araç kapasitesini aşan dönemler`;
    }
    if (surplusSubtitle) {
        surplusSubtitle.textContent = `Günlük ort. tur sayısı ${fleetCapacity} araç kapasitesinin altında kalan dönemler`;
    }

    // Yetersizlik olan aylar (günlük ortalama > filo kapasitesi)
    const shortageMonths = allMonths.filter(m => m.arac_yetersizligi > 0 || m.peak_eszamanli_arac > fleetCapacity);

    // Fazlalık olan aylar (günlük ortalama < filo kapasitesinin %60'ı)
    const surplusMonths = allMonths.filter(m => m.arac_fazlaligi > 0 && m.peak_eszamanli_arac < fleetCapacity * 0.6);

    // Yetersizlik tablosu
    if (shortageMonths && shortageMonths.length > 0) {
        shortageTable.innerHTML = shortageMonths.map(m => {
            const dailyAvg = Math.round(m.peak_eszamanli_arac) || Math.round(m.tur_sayisi / (m.aktif_gun || 30));
            const dailyShortage = Math.round(Math.max(0, dailyAvg - fleetCapacity));
            return `
            <tr>
                <td><strong>${m.ay_adi}</strong></td>
                <td>${formatNumber(m.tur_sayisi)}</td>
                <td><strong>${dailyAvg}</strong> tur/gün</td>
                <td>${fleetCapacity}</td>
                <td style="color: var(--accent-red); font-weight: bold;">-${dailyShortage}/gün</td>
            </tr>
        `}).join('');
    } else {
        shortageTable.innerHTML = `
            <tr>
                <td colspan="6" class="loading" style="color: var(--accent-green);">
                    ✅ Tüm aylarda filo kapasitesi (${fleetCapacity} araç) yeterli
                </td>
            </tr>`;
    }

    // Fazlalık tablosu
    if (surplusMonths && surplusMonths.length > 0) {
        surplusTable.innerHTML = surplusMonths.map(m => {
            const dailyAvg = Math.round(m.peak_eszamanli_arac) || Math.round(m.tur_sayisi / (m.aktif_gun || 30));
            const used = dailyAvg;
            const idle = Math.round(Math.max(0, fleetCapacity - used));
            return `
            <tr>
                <td><strong>${m.ay_adi}</strong></td>
                <td>${formatNumber(m.tur_sayisi)}</td>
                <td><strong>${dailyAvg}</strong> tur/gün</td>
                <td>${fleetCapacity}</td>
                <td>${used} araç</td>
                <td style="color: var(--accent-green); font-weight: bold;">+${idle} boşta</td>
            </tr>
        `}).join('');
    } else {
        surplusTable.innerHTML = `
            <tr>
                <td colspan="6" class="loading" style="color: var(--accent-orange);">
                    ⚠️ Tüm aylarda filo aktif kullanımda (${fleetCapacity} araç)
                </td>
            </tr>`;
    }
}

/**
 * Öneri panelini yükle - En fazla eksik/fazla araç olan ayları göster
 */
async function loadRecommendations() {
    const year = document.getElementById('recommendation-year').value;
    const container = document.getElementById('recommendation-content');

    container.innerHTML = '<div class="loading">Yükleniyor...</div>';

    // Aylık filo denge verilerini al
    const response = await fetchAPI('/analytics/monthly-fleet-balance', { year });

    if (!response.success || !response.data?.allMonths) {
        container.innerHTML = '<div class="loading">Veri yüklenemedi</div>';
        return;
    }

    const months = response.data.allMonths;
    const fleetCapacity = response.meta?.fleetCapacity || 40;

    // En fazla araç eksik olan ay (en yüksek yetersizlik)
    const shortageMonths = months.filter(m => m.arac_yetersizligi > 0);
    const maxShortageMonth = shortageMonths.length > 0
        ? shortageMonths.reduce((max, m) => m.arac_yetersizligi > max.arac_yetersizligi ? m : max)
        : null;

    // En fazla araç fazlalığı olan ay (en yüksek fazlalık)
    const surplusMonths = months.filter(m => m.arac_fazlaligi > 0);
    const maxSurplusMonth = surplusMonths.length > 0
        ? surplusMonths.reduce((max, m) => m.arac_fazlaligi > max.arac_fazlaligi ? m : max)
        : null;

    // Toplam istatistikler
    const totalShortage = shortageMonths.reduce((sum, m) => sum + m.arac_yetersizligi, 0);
    const totalSurplus = surplusMonths.reduce((sum, m) => sum + m.arac_fazlaligi, 0);

    container.innerHTML = `
        <div class="recommendation-grid">
            <div class="recommendation-stat">
                <div class="stat-label">Filo Kapasitesi</div>
                <div class="stat-value">${fleetCapacity} araç</div>
            </div>
            <div class="recommendation-stat">
                <div class="stat-label">Araç Eksik Ay Sayısı</div>
                <div class="stat-value" style="color: var(--accent-red);">${shortageMonths.length} ay</div>
            </div>
            <div class="recommendation-stat">
                <div class="stat-label">Araç Fazlası Ay Sayısı</div>
                <div class="stat-value" style="color: var(--accent-green);">${surplusMonths.length} ay</div>
            </div>
        </div>
        
        <div class="recommendation-boxes">
            <div class="recommendation-box high-season">
                <h4>⚠️ En Fazla Araç Eksik Ay</h4>
                ${maxShortageMonth
            ? `<p><strong>${maxShortageMonth.ay_adi}</strong> - Peak: ${maxShortageMonth.peak_eszamanli_arac} araç</p>
                       <p class="shortage-value">-${maxShortageMonth.arac_yetersizligi} araç eksik</p>
                       <p class="stat-detail">${maxShortageMonth.tur_sayisi} tur yapıldı</p>`
            : '<p style="color: var(--accent-green);">✅ Tüm aylarda filo yeterli</p>'
        }
            </div>
            <div class="recommendation-box low-season">
                <h4>✅ En Fazla Araç Fazlası Ay</h4>
                ${maxSurplusMonth
            ? `<p><strong>${maxSurplusMonth.ay_adi}</strong> - Peak: ${maxSurplusMonth.peak_eszamanli_arac} araç</p>
                       <p class="surplus-value">+${maxSurplusMonth.arac_fazlaligi} araç boşta</p>
                       <p class="stat-detail">${maxSurplusMonth.tur_sayisi} tur yapıldı</p>`
            : '<p style="color: var(--accent-orange);">⚠️ Tüm aylarda filo aktif kullanımda</p>'
        }
            </div>
        </div>
    `;
}

// ============================================================
// COST ANALYSIS FUNCTIONS
// ============================================================

// Cost analysis chart instances
let costComparisonChart = null;
let monthlyCostChart = null;

// Cost parameters
const TOUR_PRICE = 5000;  // TL per tour
const RENTAL_COST = 2500;  // TL per vehicle per day

/**
 * Maliyet analizini yükle
 */
async function loadCostAnalysis() {
    const yearSelect = document.getElementById('cost-analysis-year');
    if (!yearSelect) return;

    const period = yearSelect.value;

    // Tarih aralığını belirle
    let from, to;
    switch (period) {
        case 'all':
            from = '2022-01-01';
            to = '2025-12-31';
            break;
        case '2025':
            from = '2025-01-01';
            to = '2025-12-31';
            break;
        case '2024':
            from = '2024-01-01';
            to = '2024-12-31';
            break;
        case '2023':
            from = '2023-01-01';
            to = '2023-12-31';
            break;
        case '2022':
            from = '2022-01-01';
            to = '2022-12-31';
            break;
        default:
            from = '2024-01-01';
            to = '2024-12-31';
    }

    // Günlük tur verilerini al
    const response = await fetchAPI('/analytics/daily-tours', { from, to });

    if (!response.success || !response.data) return;

    // Maliyet hesaplamalarını yap
    const analysis = calculateCostAnalysis(response.data);

    // UI'ı güncelle
    updateCostAnalysisUI(analysis);
}

/**
 * Maliyet analizini hesapla
 */
function calculateCostAnalysis(dailyData) {
    let totalCancelledTours = 0;
    let totalRentalDays = 0;
    const monthlyData = {};

    dailyData.forEach(day => {
        const dateStr = typeof day.tarih === 'string'
            ? day.tarih.split('T')[0]
            : new Date(day.tarih).toISOString().split('T')[0];

        const tourCount = day.tur_sayisi || 0;
        const shortage = Math.max(0, tourCount - FLEET_CAPACITY);

        if (shortage > 0) {
            totalCancelledTours += shortage;
            totalRentalDays += shortage;

            // Aylık verileri topla
            const month = dateStr.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { cancelledTours: 0, rentalDays: 0 };
            }
            monthlyData[month].cancelledTours += shortage;
            monthlyData[month].rentalDays += shortage;
        }
    });

    // Senaryo hesaplamaları
    const scenarioA = {
        cancelledTours: totalCancelledTours,
        revenueLoss: totalCancelledTours * TOUR_PRICE
    };

    const scenarioB = {
        rentalDays: totalRentalDays,
        rentalCost: totalRentalDays * RENTAL_COST
    };

    // Fark hesaplama
    const savingsWithRental = scenarioA.revenueLoss - scenarioB.rentalCost;

    // Aylık karşılaştırma
    const monthlyComparison = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
            month,
            revenueLoss: data.cancelledTours * TOUR_PRICE,
            rentalCost: data.rentalDays * RENTAL_COST
        }));

    return {
        scenarioA,
        scenarioB,
        savingsWithRental,
        monthlyComparison
    };
}

/**
 * Maliyet analizi UI'ını güncelle
 */
function updateCostAnalysisUI(analysis) {
    // Senaryo A istatistikleri
    document.getElementById('scenario-a-tours').textContent =
        formatNumber(analysis.scenarioA.cancelledTours);
    document.getElementById('scenario-a-loss').textContent =
        formatCurrency(analysis.scenarioA.revenueLoss);

    // Senaryo B istatistikleri
    document.getElementById('scenario-b-rentals').textContent =
        formatNumber(analysis.scenarioB.rentalDays);
    document.getElementById('scenario-b-cost').textContent =
        formatCurrency(analysis.scenarioB.rentalCost);

    // Karşılaştırma sonucu
    const resultContainer = document.getElementById('cost-comparison-result');
    const savings = analysis.savingsWithRental;
    const isProfit = savings > 0;

    resultContainer.innerHTML = `
        <div class="result-title">Araç Kiralama ile Kazanç/Kayıp</div>
        <div class="result-value ${isProfit ? 'profit' : 'loss'}">
            ${isProfit ? '+' : ''}${formatCurrency(savings)}
        </div>
        <div class="result-recommendation">
            ${isProfit
            ? `✅ Araç kiralamak ${formatCurrency(savings)} daha kârlı!`
            : `⚠️ Turlardan feragat etmek ${formatCurrency(Math.abs(savings))} daha az maliyetli.`
        }
        </div>
    `;

    // Grafikleri render et
    renderCostComparisonChart(analysis);
    renderMonthlyCostChart(analysis.monthlyComparison);
}

/**
 * Maliyet karşılaştırma grafiğini render et
 */
function renderCostComparisonChart(analysis) {
    const ctx = document.getElementById('costComparisonChart');
    if (!ctx) return;

    if (costComparisonChart) {
        costComparisonChart.destroy();
    }

    costComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Turlardan Feragat', 'Araç Kiralama'],
            datasets: [{
                label: 'Maliyet',
                data: [analysis.scenarioA.revenueLoss, analysis.scenarioB.rentalCost],
                backgroundColor: [
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(16, 185, 129, 0.7)'
                ],
                borderColor: [
                    'rgba(239, 68, 68, 1)',
                    'rgba(16, 185, 129, 1)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    callbacks: {
                        label: function (context) {
                            return formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            weight: 600
                        }
                    }
                }
            }
        }
    });
}

/**
 * Aylık maliyet karşılaştırma grafiğini render et
 */
function renderMonthlyCostChart(monthlyData) {
    const ctx = document.getElementById('monthlyCostChart');
    if (!ctx) return;

    if (monthlyCostChart) {
        monthlyCostChart.destroy();
    }

    const labels = monthlyData.map(d => {
        const [year, month] = d.month.split('-');
        return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    });

    monthlyCostChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Gelir Kaybı (Feragat)',
                    data: monthlyData.map(d => d.revenueLoss),
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Kiralama Maliyeti',
                    data: monthlyData.map(d => d.rentalCost),
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.5)',
                        callback: function (value) {
                            return formatCurrency(value);
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// ============================================================
// CALENDAR FUNCTIONS
// ============================================================

// Calendar state
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let calendarData = {};
let selectedCalendarDate = null;
const FLEET_CAPACITY = 40;

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/**
 * Takvim ayını değiştir
 */
function changeCalendarMonth(delta) {
    calendarMonth += delta;

    if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
        document.getElementById('calendar-year').value = calendarYear;
    } else if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
        document.getElementById('calendar-year').value = calendarYear;
    }

    loadCalendarData();
}

/**
 * Takvim verilerini yükle
 */
async function loadCalendarData() {
    const yearSelect = document.getElementById('calendar-year');
    const routeSelect = document.getElementById('calendar-route');

    if (yearSelect) {
        calendarYear = parseInt(yearSelect.value);
    }

    const routeId = routeSelect ? routeSelect.value : '';

    // Ay label'ını güncelle
    const monthLabel = document.getElementById('calendar-month-label');
    if (monthLabel) {
        monthLabel.textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;
    }

    // Ayın ilk ve son gününü hesapla
    const year = calendarYear;
    const month = calendarMonth + 1; // 1-indexed for formatting
    const lastDayOfMonth = new Date(year, calendarMonth + 1, 0).getDate();

    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // API'den günlük tur verilerini al
    const params = { from, to };
    if (routeId) {
        params.routeId = routeId;
    }

    const result = await fetchAPI('/analytics/daily-tours', params);

    if (result.success && result.data) {
        calendarData = {};
        result.data.forEach(d => {
            // Tarih formatını düzelt (YYYY-MM-DD)
            const dateStr = typeof d.tarih === 'string'
                ? d.tarih.split('T')[0]
                : new Date(d.tarih).toISOString().split('T')[0];
            calendarData[dateStr] = d;
        });
    } else {
        calendarData = {};
    }

    renderCalendar();
}

/**
 * Takvimi render et
 */
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    // Başlıklar
    let html = DAY_NAMES.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    // Ayın ilk günü ve toplam gün sayısı
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // Haftanın hangi gününde başlıyor (0=Pazar, 1=Pazartesi...)
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1; // Pazartesi başlangıç için düzelt

    // Boş günler
    for (let i = 0; i < startDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // Günler
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = calendarData[dateStr] || { tur_sayisi: 0 };
        const tourCount = dayData.tur_sayisi || 0;

        // Durum belirleme
        let statusClass = '';
        let statusLabel = '';

        if (tourCount > FLEET_CAPACITY) {
            statusClass = 'shortage';
            statusLabel = `-${tourCount - FLEET_CAPACITY}`;
        } else if (tourCount > 0 && tourCount < FLEET_CAPACITY * 0.6) {
            statusClass = 'surplus';
            statusLabel = `+${FLEET_CAPACITY - tourCount}`;
        } else if (tourCount > 0) {
            statusClass = 'normal';
        }

        const isSelected = selectedCalendarDate === dateStr ? 'selected' : '';

        html += `
            <div class="calendar-day ${statusClass} ${isSelected}" 
                 onclick="selectCalendarDay('${dateStr}')" 
                 data-date="${dateStr}">
                <span class="day-number">${day}</span>
                <span class="day-tours">${tourCount > 0 ? tourCount + ' tur' : '-'}</span>
                ${statusLabel ? `<span class="day-status ${statusClass}">${statusLabel}</span>` : ''}
            </div>
        `;
    }

    grid.innerHTML = html;
}

/**
 * Takvimde gün seç
 */
function selectCalendarDay(dateStr) {
    selectedCalendarDate = dateStr;

    // Önceki seçimi kaldır
    document.querySelectorAll('.calendar-day.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Yeni seçimi işaretle
    const dayEl = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (dayEl) {
        dayEl.classList.add('selected');
    }

    // Bilgi panelini güncelle
    updateDayInfoPanel(dateStr);
}

/**
 * Gün bilgi panelini güncelle
 */
function updateDayInfoPanel(dateStr) {
    const dateLabel = document.getElementById('calendar-selected-date');
    const infoContent = document.getElementById('calendar-day-info');

    const date = new Date(dateStr);
    const dayName = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][date.getDay()];
    dateLabel.textContent = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}, ${dayName}`;

    const dayData = calendarData[dateStr] || { tur_sayisi: 0 };
    const tourCount = dayData.tur_sayisi || 0;

    let difference = tourCount - FLEET_CAPACITY;
    let statusClass = '';
    let statusText = '';

    if (difference > 0) {
        statusClass = 'shortage';
        statusText = `${difference} araç eksik`;
    } else if (difference < -FLEET_CAPACITY * 0.4) {
        statusClass = 'surplus';
        statusText = `${Math.abs(difference)} araç boşta`;
    } else {
        statusClass = 'normal';
        statusText = 'Filo dengeli';
    }

    infoContent.innerHTML = `
        <div class="info-stat">
            <span class="label">📅 Toplam Tur</span>
            <span class="value">${tourCount}</span>
        </div>
        <div class="info-stat">
            <span class="label">🚌 Filo Kapasitesi</span>
            <span class="value">${FLEET_CAPACITY} araç</span>
        </div>
        <div class="info-stat">
            <span class="label">📊 İhtiyaç</span>
            <span class="value">${tourCount} araç</span>
        </div>
        <div class="info-stat">
            <span class="label">⚖️ Fark</span>
            <span class="value ${statusClass}">${difference > 0 ? '+' + difference : difference}</span>
        </div>
        <div class="info-stat">
            <span class="label">📋 Durum</span>
            <span class="value ${statusClass}">${statusText}</span>
        </div>
    `;
}

// ============================================================
// FLEET COMPARISON FUNCTIONS
// ============================================================

/**
 * Filo karşılaştırma filtre değişikliği
 */
function loadFleetComparison() {
    const comparisonType = document.getElementById('fleet-comparison-type')?.value || 'monthly';
    const yearFilter = document.getElementById('fleet-year-filter');
    const customDates = document.getElementById('fleet-custom-dates');

    // Filtreleri göster/gizle
    if (comparisonType === 'custom') {
        if (yearFilter) yearFilter.style.display = 'none';
        if (customDates) customDates.style.display = 'flex';
    } else {
        if (yearFilter) yearFilter.style.display = 'flex';
        if (customDates) customDates.style.display = 'none';
    }

    // Grafikler için tarih aralığını belirle
    let from, to;
    if (comparisonType === 'custom') {
        from = document.getElementById('fleet-from')?.value || '2024-01-01';
        to = document.getElementById('fleet-to')?.value || '2024-12-31';
    } else {
        const year = document.getElementById('fleet-year')?.value || '2024';
        from = `${year}-01-01`;
        to = `${year}-12-31`;
    }

    // Tüm filo grafiklerini yükle
    loadFleetCharts(from, to, comparisonType);
}

/**
 * Filo grafiklerini yükle
 */
async function loadFleetCharts(from, to, comparisonType) {
    const year = new Date(from).getFullYear();

    // Paralel API çağrıları
    const [balanceRes, dailyRes] = await Promise.all([
        fetchAPI('/analytics/monthly-fleet-balance', { year }),
        fetchAPI('/analytics/daily-tours', { from, to })
    ]);

    // Grafikleri güncelle
    updateFleetBalanceChart(balanceRes);
    updateDailyDistributionChart(dailyRes);
    updateFleetUtilizationChart(balanceRes);
    updateTourVehicleCompareChart(balanceRes);
}

/**
 * Günlük dağılım grafiği (hafta içi/sonu)
 */
function updateDailyDistributionChart(response) {
    const ctx = document.getElementById('dailyDistributionChart');
    if (!ctx) return;

    if (dailyDistributionChart) {
        dailyDistributionChart.destroy();
    }

    if (!response.success || !response.data) return;

    // Günleri haftanın günlerine göre grupla
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    response.data.forEach(day => {
        const date = new Date(day.tarih);
        const dayOfWeek = date.getDay();
        dayCounts[dayOfWeek]++;
        dayTotals[dayOfWeek] += day.tur_sayisi || 0;
    });

    const averages = dayTotals.map((total, i) => dayCounts[i] > 0 ? Math.round(total / dayCounts[i]) : 0);

    dailyDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [{
                label: 'Ortalama Tur/Gün',
                data: averages,
                backgroundColor: [
                    'rgba(245, 158, 11, 0.7)',  // Pazar
                    'rgba(0, 217, 255, 0.7)',   // Pazartesi
                    'rgba(0, 217, 255, 0.7)',   // Salı
                    'rgba(0, 217, 255, 0.7)',   // Çarşamba
                    'rgba(0, 217, 255, 0.7)',   // Perşembe
                    'rgba(0, 217, 255, 0.7)',   // Cuma
                    'rgba(245, 158, 11, 0.7)'   // Cumartesi
                ],
                borderColor: [
                    'rgba(245, 158, 11, 1)',
                    'rgba(0, 217, 255, 1)',
                    'rgba(0, 217, 255, 1)',
                    'rgba(0, 217, 255, 1)',
                    'rgba(0, 217, 255, 1)',
                    'rgba(0, 217, 255, 1)',
                    'rgba(245, 158, 11, 1)'
                ],
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.9)',
                    titleColor: '#fff',
                    bodyColor: 'rgba(255, 255, 255, 0.8)'
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' }, beginAtZero: true }
            }
        }
    });
}

/**
 * Filo kullanım oranı grafiği
 */
function updateFleetUtilizationChart(response) {
    const ctx = document.getElementById('fleetUtilizationChart');
    if (!ctx) return;

    if (fleetUtilizationChart) {
        fleetUtilizationChart.destroy();
    }

    if (!response.success || !response.data?.allMonths) return;

    const data = response.data.allMonths;
    const fleetCapacity = response.meta?.fleetCapacity || 40;
    const labels = data.map(d => d.ay_adi);
    const utilization = data.map(d => Math.min(100, Math.round((d.peak_eszamanli_arac / fleetCapacity) * 100)));

    fleetUtilizationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Kullanım Oranı (%)',
                data: utilization,
                borderColor: 'rgba(124, 58, 237, 1)',
                backgroundColor: 'rgba(124, 58, 237, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }, {
                label: '100% Kapasite',
                data: Array(12).fill(100),
                borderColor: 'rgba(239, 68, 68, 0.5)',
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.9)',
                    callbacks: {
                        label: ctx => `${ctx.parsed.y}% kullanım`
                    }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' }, min: 0, max: 150 }
            }
        }
    });
}

/**
 * Tur sayısı vs Araç ihtiyacı grafiği
 */
function updateTourVehicleCompareChart(response) {
    const ctx = document.getElementById('tourVehicleCompareChart');
    if (!ctx) return;

    if (tourVehicleCompareChart) {
        tourVehicleCompareChart.destroy();
    }

    if (!response.success || !response.data?.allMonths) return;

    const data = response.data.allMonths;
    const fleetCapacity = response.meta?.fleetCapacity || 40;
    const labels = data.map(d => d.ay_adi);
    const tourCounts = data.map(d => d.tur_sayisi);
    const peakVehicles = data.map(d => d.peak_eszamanli_arac);

    tourVehicleCompareChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Toplam Tur',
                    data: tourCounts,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: 'Peak Araç İhtiyacı',
                    data: peakVehicles,
                    type: 'line',
                    borderColor: 'rgba(0, 217, 255, 1)',
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    pointRadius: 4,
                    yAxisID: 'y1'
                },
                {
                    label: `Filo (${fleetCapacity})`,
                    data: Array(12).fill(fleetCapacity),
                    type: 'line',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 11 } }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: 'rgba(255, 255, 255, 0.5)' } },
                y: {
                    type: 'linear',
                    position: 'left',
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(16, 185, 129, 0.8)' },
                    title: { display: true, text: 'Tur Sayısı', color: 'rgba(16, 185, 129, 0.8)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: 'rgba(0, 217, 255, 0.8)' },
                    title: { display: true, text: 'Araç Sayısı', color: 'rgba(0, 217, 255, 0.8)' }
                }
            }
        }
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

// Chart.js default ayarları
Chart.defaults.font.family = "'Segoe UI', 'Inter', sans-serif";
Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';

// Sayfa yüklendiğinde takvimi ve maliyet analizini başlat
document.addEventListener('DOMContentLoaded', function () {
    loadCalendarData();
    loadCostAnalysis();
    loadFleetComparison();
});
