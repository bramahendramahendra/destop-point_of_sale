// ============================================
// DASHBOARD PAGE JAVASCRIPT
// src/js/dashboard.js
// ============================================

'use strict';

// ---- Chart instances ----
let chartSalesTrend    = null;
let chartTopCategories = null;
let chartTopProducts   = null;
let chartPaymentMethods = null;

// ---- State ----
let currentPeriod    = 'today';
let trendMode        = 'value';   // 'value' | 'count'
let productMode      = 'qty';     // 'qty'   | 'value'

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const ok = initializePageLayout('dashboard');
  if (!ok) return;

  // Welcome name
  const user = getCurrentUser();
  const nameEl = document.getElementById('welcomeName');
  if (nameEl && user) nameEl.textContent = user.full_name || user.username;

  // Date display
  const dateEl = document.getElementById('dashboardDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Hide owner-only quick actions for kasir
  if (user && user.role === 'kasir') {
    ['qaFinance', 'qaReports', 'qaSettings'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  // Load stats
  await loadDashboardStats();

  // Setup grafik
  setupPeriodFilter();
  setupTrendToggle();
  setupProductToggle();
  await loadAllCharts();

  // Notifikasi stok otomatis
  if (window.StockAlert) {
    setTimeout(() => window.StockAlert.check(), 800);
  }

  // Stok menipis card click → ke laporan stok
  document.getElementById('statLowStockCard')?.addEventListener('click', () => {
    if (user && (user.role === 'owner' || user.role === 'admin')) {
      window.location.href = 'reports.html';
    }
  });

  setupKeyboardShortcuts();
});

// ============================================
// LOAD STATS (existing)
// ============================================

async function loadDashboardStats() {
  try {
    const res = await window.api.dashboard.getStats();
    if (!res.success) return;

    const s = res.stats;

    setStatValue('statTodaySales',        formatCurrency(s.today_sales));
    setStatValue('statTodayTransactions', s.today_transactions.toLocaleString('id-ID'));
    setStatValue('statTotalProducts',     s.total_products.toLocaleString('id-ID'));
    setStatValue('statMonthSales',        formatCurrency(s.month_sales));
    setStatValue('statTotalUsers',        s.total_users.toLocaleString('id-ID'));

    const lowTotal = (s.low_stock || 0) + (s.empty_stock || 0);
    setStatValue('statLowStock', lowTotal.toLocaleString('id-ID'));

    const labelEl = document.getElementById('statLowStockLabel');
    const cardEl  = document.getElementById('statLowStockCard');
    if (labelEl) {
      if (s.empty_stock > 0) {
        labelEl.textContent = `${s.empty_stock} habis, ${s.low_stock} menipis`;
      } else {
        labelEl.textContent = 'Produk perlu restock';
      }
    }
    if (cardEl && s.empty_stock > 0) {
      cardEl.style.borderLeft = '4px solid #e74c3c';
    }

  } catch (err) {
    console.error('loadDashboardStats error:', err);
  }
}

function setStatValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ============================================
// PERIOD FILTER
// ============================================

function setupPeriodFilter() {
  document.querySelectorAll('.cpb-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.cpb-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      await loadAllCharts();
    });
  });
}

// ============================================
// TREND TOGGLE
// ============================================

function setupTrendToggle() {
  document.getElementById('trendToggleValue')?.addEventListener('click', async (e) => {
    setToggleActive('trendToggleValue', 'trendToggleCount');
    trendMode = 'value';
    await loadChartSalesTrend();
  });
  document.getElementById('trendToggleCount')?.addEventListener('click', async (e) => {
    setToggleActive('trendToggleCount', 'trendToggleValue');
    trendMode = 'count';
    await loadChartSalesTrend();
  });
}

// ============================================
// PRODUCT MODE TOGGLE
// ============================================

function setupProductToggle() {
  document.getElementById('prodToggleQty')?.addEventListener('click', async () => {
    setToggleActive('prodToggleQty', 'prodToggleValue');
    productMode = 'qty';
    await loadChartTopProducts();
  });
  document.getElementById('prodToggleValue')?.addEventListener('click', async () => {
    setToggleActive('prodToggleValue', 'prodToggleQty');
    productMode = 'value';
    await loadChartTopProducts();
  });
}

function setToggleActive(activeId, inactiveId) {
  document.getElementById(activeId)?.classList.add('active');
  document.getElementById(inactiveId)?.classList.remove('active');
}

// ============================================
// LOAD ALL CHARTS
// ============================================

async function loadAllCharts() {
  await Promise.all([
    loadChartSalesTrend(),
    loadChartTopCategories(),
    loadChartTopProducts(),
    loadChartPaymentMethods(),
    loadSummaryExtra()
  ]);
}

// ============================================
// GRAFIK 1 — TREND PENJUALAN
// ============================================

async function loadChartSalesTrend() {
  try {
    const res = await window.api.dashboard.getSalesTrend(currentPeriod);
    if (!res.success) return;

    const { labels, currentTotals, previousTotals, currentCounts } = res;

    const displayLabels = labels.map(d => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });

    const isSingle = labels.length === 1;

    const dataCurrent  = trendMode === 'value' ? currentTotals  : currentCounts;
    const dataPrevious = trendMode === 'value' ? previousTotals : previousTotals.map((_, i) => {
      // Untuk count mode, gunakan estimasi (data prev count tidak tersimpan terpisah — fallback)
      return 0;
    });

    const labelCurrent  = 'Periode Ini';
    const labelPrevious = 'Periode Sebelumnya';

    const datasets = [
      {
        label: labelCurrent,
        data: dataCurrent,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52,152,219,0.12)',
        borderWidth: 2.5,
        pointRadius: isSingle ? 5 : 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35
      }
    ];

    if (trendMode === 'value') {
      datasets.push({
        label: labelPrevious,
        data: dataPrevious,
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231,76,60,0.07)',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: isSingle ? 5 : 2,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.35
      });
    }

    const canvas = document.getElementById('chartSalesTrend');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartSalesTrend) { chartSalesTrend.destroy(); chartSalesTrend = null; }

    chartSalesTrend = new Chart(ctx, {
      type: 'line',
      data: { labels: displayLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 16 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw;
                if (trendMode === 'value') return ` ${ctx.dataset.label}: ${formatCurrency(v)}`;
                return ` ${ctx.dataset.label}: ${v.toLocaleString('id-ID')} transaksi`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (v) => trendMode === 'value' ? formatCurrencyShort(v) : v
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('loadChartSalesTrend error:', err);
  }
}

// ============================================
// GRAFIK 2 — TOP KATEGORI (DONUT)
// ============================================

async function loadChartTopCategories() {
  try {
    const res = await window.api.dashboard.getTopCategories(currentPeriod);
    if (!res.success) return;

    const rows = res.rows || [];
    const labels = rows.map(r => r.category || 'Tanpa Kategori');
    const data   = rows.map(r => r.total);
    const colors = ['#3498db','#2ecc71','#e74c3c','#f39c12','#9b59b6'];

    const canvas = document.getElementById('chartTopCategories');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartTopCategories) { chartTopCategories.destroy(); chartTopCategories = null; }

    if (rows.length === 0) {
      renderEmptyChart(ctx, canvas, 'Belum ada data');
      return;
    }

    chartTopCategories = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, rows.length),
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 14, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('loadChartTopCategories error:', err);
  }
}

// ============================================
// GRAFIK 3 — TOP PRODUK (HORIZONTAL BAR)
// ============================================

async function loadChartTopProducts() {
  try {
    const res = await window.api.dashboard.getTopProducts(currentPeriod, productMode);
    if (!res.success) return;

    const rows = res.rows || [];
    const labels = rows.map(r => truncateLabel(r.product, 22));
    const data   = productMode === 'value' ? rows.map(r => r.total) : rows.map(r => r.qty);

    const canvas = document.getElementById('chartTopProducts');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartTopProducts) { chartTopProducts.destroy(); chartTopProducts = null; }

    if (rows.length === 0) {
      renderEmptyChart(ctx, canvas, 'Belum ada data');
      return;
    }

    chartTopProducts = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: productMode === 'value' ? 'Nilai Penjualan' : 'Qty Terjual',
          data,
          backgroundColor: 'rgba(52,152,219,0.75)',
          borderColor: '#2980b9',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw;
                return productMode === 'value'
                  ? ` ${formatCurrency(v)}`
                  : ` ${v.toLocaleString('id-ID')} pcs`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { size: 10 },
              callback: (v) => productMode === 'value' ? formatCurrencyShort(v) : v
            }
          },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  } catch (err) {
    console.error('loadChartTopProducts error:', err);
  }
}

// ============================================
// GRAFIK 4 — METODE PEMBAYARAN (DONUT)
// ============================================

async function loadChartPaymentMethods() {
  try {
    const res = await window.api.dashboard.getPaymentMethods(currentPeriod);
    if (!res.success) return;

    const rows = res.rows || [];
    const labels = rows.map(r => formatPaymentMethod(r.payment_method));
    const data   = rows.map(r => r.total);
    const colors = ['#27ae60','#3498db','#e67e22','#9b59b6','#e74c3c','#1abc9c'];

    const canvas = document.getElementById('chartPaymentMethods');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (chartPaymentMethods) { chartPaymentMethods.destroy(); chartPaymentMethods = null; }

    if (rows.length === 0) {
      renderEmptyChart(ctx, canvas, 'Belum ada transaksi');
      return;
    }

    chartPaymentMethods = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, rows.length),
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 14, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const row = rows[ctx.dataIndex];
                return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${row.count} trx)`;
              }
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('loadChartPaymentMethods error:', err);
  }
}

// ============================================
// SUMMARY EXTRA
// ============================================

async function loadSummaryExtra() {
  try {
    const res = await window.api.dashboard.getSummaryExtra(currentPeriod);
    if (!res.success) return;

    const { highest, peakHour, avg } = res;

    // Transaksi tertinggi
    if (highest) {
      setStatValue('secHighestAmount', formatCurrency(highest.total_amount));
      setStatValue('secHighestCode', highest.transaction_code || '—');
    } else {
      setStatValue('secHighestAmount', 'Rp 0');
      setStatValue('secHighestCode', 'Belum ada transaksi');
    }

    // Peak hour
    if (peakHour) {
      const h = parseInt(peakHour.hour, 10);
      setStatValue('secPeakHour', `Pukul ${String(h).padStart(2,'0')}:00 – ${String(h+1).padStart(2,'0')}:00`);
      setStatValue('secPeakCount', `${peakHour.count} transaksi`);
    } else {
      setStatValue('secPeakHour', '—');
      setStatValue('secPeakCount', '0 transaksi');
    }

    // Rata-rata
    if (avg) {
      setStatValue('secAvgAmount', formatCurrency(Math.round(avg.avg_amount)));
      setStatValue('secTotalCount', `dari ${(avg.total_count || 0).toLocaleString('id-ID')} transaksi`);
    } else {
      setStatValue('secAvgAmount', 'Rp 0');
      setStatValue('secTotalCount', 'dari 0 transaksi');
    }

  } catch (err) {
    console.error('loadSummaryExtra error:', err);
  }
}

// ============================================
// HELPERS
// ============================================

function formatCurrencyShort(v) {
  if (v >= 1_000_000) return 'Rp ' + (v / 1_000_000).toFixed(1) + 'jt';
  if (v >= 1_000)     return 'Rp ' + (v / 1_000).toFixed(0) + 'rb';
  return 'Rp ' + v;
}

function truncateLabel(str, max) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function formatPaymentMethod(method) {
  const map = {
    cash: 'Tunai', debit: 'Debit', credit: 'Kredit',
    transfer: 'Transfer', qris: 'QRIS', ewallet: 'E-Wallet'
  };
  return map[(method || '').toLowerCase()] || (method || 'Lainnya');
}

function renderEmptyChart(ctx, canvas, text) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.fillStyle = '#bdc3c7';
  ctx.font = '13px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function setupKeyboardShortcuts() {
  if (!window.api?.shortcuts) return;
  window.api.shortcuts.onNavigate((channel) => {
    handleShortcutNavigation(channel);
  });
}

function handleShortcutNavigation(channel) {
  const user = getCurrentUser();
  const MAP = {
    'shortcut:kasir':        'kasir.html',
    'shortcut:products':     'products.html',
    'shortcut:transactions': 'transactions.html',
    'shortcut:finance':      'finance.html',
    'shortcut:reports':      'reports.html',
    'shortcut:users':        'users.html',
    'shortcut:settings':     'settings.html'
  };

  const target = MAP[channel];
  if (!target) return;

  if (['reports.html', 'settings.html', 'users.html', 'finance.html'].includes(target)) {
    if (user && user.role === 'kasir') return;
  }

  window.location.href = target;
}
