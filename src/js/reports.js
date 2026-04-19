// ============================================
// REPORTS PAGE JAVASCRIPT
// src/js/reports.js
// ============================================

'use strict';

// ---- State ----
let salesData       = { transactions: [], summary: {}, chartData: [] };
let stockData       = { products: [], summary: {}, categories: [] };
let cashierData     = { cashierStats: [], dailyChart: [] };
let plData          = { summary: {}, expensesByCategory: [], salesByCategory: [] };

let salesCurrentPage  = 1;
const ROWS_PER_PAGE   = 25;

let salesChartInstance   = null;
let expenseChartInstance = null;
let cashierChartInstance = null;

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  const ok = initializePageLayout('laporan');
  if (!ok) return;

  setupTabHandlers();
  setupFilterHandlers();
  setupExportHandlers();
  setupPaginationHandlers();
  loadUserDropdowns();

  // Load laporan penjualan by default
  filterSalesReport();
  // Load stok auto (tidak perlu filter tanggal)
  filterStockReport();
});

// ============================================
// TAB HANDLERS
// ============================================

function setupTabHandlers() {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-tab') === tabName)
  );
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ============================================
// PERIOD → DATE RANGE HELPER
// ============================================

function getDateRangeFromPeriod(period) {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];

  switch (period) {
    case 'today':
      return { start: fmt(today), end: fmt(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case '7days': {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start: fmt(s), end: fmt(today) };
    }
    case '30days': {
      const s = new Date(today); s.setDate(s.getDate() - 29);
      return { start: fmt(s), end: fmt(today) };
    }
    case 'this_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(s), end: fmt(today) };
    }
    default:
      return { start: null, end: null };
  }
}

// ============================================
// LOAD USER DROPDOWNS
// ============================================

async function loadUserDropdowns() {
  try {
    const res = await window.api.reports.getUsers();
    if (!res.success) return;

    ['salesUserFilter', 'cashierUserFilter'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      res.users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.full_name + ' (' + u.role + ')';
        sel.appendChild(opt);
      });
    });
  } catch (e) {
    console.error('loadUserDropdowns error:', e);
  }
}

// ============================================
// FILTER HANDLERS — PERIOD CHANGE
// ============================================

function setupFilterHandlers() {
  // Sales period toggle custom range
  document.getElementById('salesPeriod').addEventListener('change', function () {
    document.getElementById('salesCustomRange').classList.toggle('hidden', this.value !== 'custom');
  });

  // P&L period toggle
  document.getElementById('plPeriod').addEventListener('change', function () {
    document.getElementById('plCustomRange').classList.toggle('hidden', this.value !== 'custom');
  });

  // Cashier period toggle
  document.getElementById('cashierPeriod').addEventListener('change', function () {
    document.getElementById('cashierCustomRange').classList.toggle('hidden', this.value !== 'custom');
  });

  // Filter buttons
  document.getElementById('btnFilterSales').addEventListener('click', filterSalesReport);
  document.getElementById('btnFilterPL').addEventListener('click', filterPLReport);
  document.getElementById('btnFilterStock').addEventListener('click', filterStockReport);
  document.getElementById('btnFilterCashier').addEventListener('click', filterCashierReport);
}

// ============================================
// SALES REPORT
// ============================================

async function filterSalesReport() {
  const period = document.getElementById('salesPeriod').value;
  let startDate, endDate;

  if (period === 'custom') {
    startDate = document.getElementById('salesStartDate').value;
    endDate   = document.getElementById('salesEndDate').value;
    if (!startDate || !endDate) {
      Toast.warning('Pilih tanggal mulai dan akhir terlebih dahulu');
      return;
    }
  } else {
    ({ start: startDate, end: endDate } = getDateRangeFromPeriod(period));
  }

  const filters = {
    startDate,
    endDate,
    userId:        document.getElementById('salesUserFilter').value || null,
    paymentMethod: document.getElementById('salesPaymentFilter').value || null
  };

  showLoading('Memuat laporan penjualan...');
  try {
    const res = await window.api.reports.getSalesReport(filters);
    if (!res.success) {
      Toast.error(res.message || 'Gagal memuat laporan');
      return;
    }
    salesData = res;
    salesCurrentPage = 1;
    renderSalesSummary(res.summary);
    renderSalesChart(res.chartData);
    renderSalesTable();
  } catch (e) {
    console.error('filterSalesReport error:', e);
    Toast.error('Terjadi kesalahan saat memuat laporan penjualan');
  } finally {
    hideLoading();
  }
}

function renderSalesSummary(summary) {
  document.getElementById('salesTotalAmount').textContent
    = formatCurrency(summary?.total_sales || 0);
  document.getElementById('salesTotalTransactions').textContent
    = (summary?.total_transactions || 0).toLocaleString('id-ID');
  document.getElementById('salesAvgTransaction').textContent
    = formatCurrency(summary?.avg_per_transaction || 0);
  document.getElementById('salesTotalItems').textContent
    = (summary?.total_items_sold || 0).toLocaleString('id-ID');
}

function renderSalesChart(chartData) {
  const ctx = document.getElementById('salesLineChart').getContext('2d');
  if (salesChartInstance) salesChartInstance.destroy();

  const labels = chartData.map(d => formatDateShort(d.date));
  const values = chartData.map(d => d.total);

  salesChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        data: values,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52,152,219,0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3498db',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => 'Rp ' + ctx.parsed.y.toLocaleString('id-ID')
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'rb'
          }
        }
      }
    }
  });
}

function renderSalesTable() {
  const tbody    = document.getElementById('salesTableBody');
  const allRows  = salesData.transactions || [];
  const total    = allRows.length;
  const totalPages = Math.ceil(total / ROWS_PER_PAGE) || 1;
  const start    = (salesCurrentPage - 1) * ROWS_PER_PAGE;
  const rows     = allRows.slice(start, start + ROWS_PER_PAGE);

  document.getElementById('salesTableInfo').textContent
    = `${total.toLocaleString('id-ID')} transaksi`;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Tidak ada data transaksi</td></tr>';
    document.getElementById('salesPagination').style.display = 'none';
    return;
  }

  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>${formatDateTime(t.transaction_date)}</td>
      <td><strong>${escapeHtml(t.transaction_code)}</strong></td>
      <td>${escapeHtml(t.kasir_name || '-')}</td>
      <td>${escapeHtml(t.customer_name || '-')}</td>
      <td class="td-center">${t.item_count || 0} item (${t.total_qty || 0} qty)</td>
      <td><strong>${formatCurrency(t.total_amount)}</strong></td>
      <td><span class="badge badge-payment">${formatPaymentMethod(t.payment_method)}</span></td>
    </tr>
  `).join('');

  // Pagination
  const pag = document.getElementById('salesPagination');
  pag.style.display = totalPages > 1 ? 'flex' : 'none';
  document.getElementById('salesPageInfo').textContent
    = `Halaman ${salesCurrentPage} / ${totalPages}`;
  document.getElementById('salesPrevPage').disabled = salesCurrentPage <= 1;
  document.getElementById('salesNextPage').disabled = salesCurrentPage >= totalPages;
}

function setupPaginationHandlers() {
  document.getElementById('salesPrevPage').addEventListener('click', () => {
    if (salesCurrentPage > 1) { salesCurrentPage--; renderSalesTable(); }
  });
  document.getElementById('salesNextPage').addEventListener('click', () => {
    const total = salesData.transactions?.length || 0;
    const totalPages = Math.ceil(total / ROWS_PER_PAGE);
    if (salesCurrentPage < totalPages) { salesCurrentPage++; renderSalesTable(); }
  });
}

// ============================================
// PROFIT & LOSS REPORT
// ============================================

async function filterPLReport() {
  const period = document.getElementById('plPeriod').value;
  let startDate, endDate;

  if (period === 'custom') {
    startDate = document.getElementById('plStartDate').value;
    endDate   = document.getElementById('plEndDate').value;
    if (!startDate || !endDate) {
      Toast.warning('Pilih tanggal mulai dan akhir terlebih dahulu');
      return;
    }
  } else {
    ({ start: startDate, end: endDate } = getDateRangeFromPeriod(period));
  }

  showLoading('Menghitung laba rugi...');
  try {
    const res = await window.api.reports.getProfitLossReport({ startDate, endDate });
    if (!res.success) {
      Toast.error(res.message || 'Gagal memuat laporan laba rugi');
      return;
    }
    plData = res;
    renderPLSummary(res.summary);
    renderPLCategoryTable(res.salesByCategory);
    renderExpensePieChart(res.expensesByCategory);
  } catch (e) {
    console.error('filterPLReport error:', e);
    Toast.error('Terjadi kesalahan saat memuat laporan laba rugi');
  } finally {
    hideLoading();
  }
}

function renderPLSummary(summary) {
  document.getElementById('plRevenue').textContent    = formatCurrency(summary.revenue || 0);
  document.getElementById('plCOGS').textContent       = formatCurrency(summary.cogs || 0);
  document.getElementById('plGrossProfit').textContent = formatCurrency(summary.grossProfit || 0);
  document.getElementById('plExpenses').textContent   = formatCurrency(summary.totalExpenses || 0);

  const net     = summary.netProfit || 0;
  const netEl   = document.getElementById('plNetProfit');
  const netCard = document.getElementById('plNetCard');
  netEl.textContent = formatCurrency(net);
  netCard.classList.remove('pl-net-positive', 'pl-net-negative');
  netCard.classList.add(net >= 0 ? 'pl-net-positive' : 'pl-net-negative');
}

function renderPLCategoryTable(categories) {
  const tbody = document.getElementById('plCategoryBody');
  if (!categories || !categories.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data</td></tr>';
    return;
  }

  tbody.innerHTML = categories.map(cat => {
    const margin = cat.revenue > 0 ? ((cat.gross_profit / cat.revenue) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escapeHtml(cat.category_name)}</strong></td>
        <td>${formatCurrency(cat.revenue)}</td>
        <td>${formatCurrency(cat.cogs)}</td>
        <td class="${cat.gross_profit >= 0 ? 'text-success' : 'text-danger'}">
          <strong>${formatCurrency(cat.gross_profit)}</strong>
        </td>
        <td>
          <span class="badge ${margin >= 20 ? 'badge-success' : margin >= 10 ? 'badge-warning' : 'badge-danger'}">
            ${margin}%
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderExpensePieChart(expenseCategories) {
  const ctx = document.getElementById('expensePieChart').getContext('2d');
  if (expenseChartInstance) expenseChartInstance.destroy();

  if (!expenseCategories || !expenseCategories.length) {
    document.getElementById('expensePieLegend').innerHTML
      = '<p class="text-center text-muted text-sm">Tidak ada data pengeluaran</p>';
    return;
  }

  const PALETTE = [
    '#3498db','#e74c3c','#2ecc71','#f39c12','#9b59b6',
    '#1abc9c','#e67e22','#34495e','#e91e63','#00bcd4'
  ];

  const labels = expenseCategories.map(e => e.category);
  const values = expenseCategories.map(e => e.total);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  expenseChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ctx.label + ': ' + formatCurrency(ctx.parsed)
          }
        }
      }
    }
  });

  // Custom legend
  const total = values.reduce((a, b) => a + b, 0);
  document.getElementById('expensePieLegend').innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]};"></span>
      <span class="legend-label">${escapeHtml(label)}</span>
      <span class="legend-value">${formatCurrency(values[i])}</span>
      <span class="legend-pct">(${total > 0 ? ((values[i]/total)*100).toFixed(1) : 0}%)</span>
    </div>
  `).join('');
}

// ============================================
// STOCK REPORT
// ============================================

async function filterStockReport() {
  const filters = {
    categoryId:  document.getElementById('stockCategoryFilter')?.value || null,
    stockStatus: document.getElementById('stockStatusFilter')?.value || null
  };

  showLoading('Memuat laporan stok...');
  try {
    const res = await window.api.reports.getStockReport(filters);
    if (!res.success) {
      Toast.error(res.message || 'Gagal memuat laporan stok');
      return;
    }
    stockData = res;
    renderStockCategoryFilter(res.categories);
    renderStockSummary(res.summary);
    renderStockTable(res.products);
  } catch (e) {
    console.error('filterStockReport error:', e);
    Toast.error('Terjadi kesalahan saat memuat laporan stok');
  } finally {
    hideLoading();
  }
}

function renderStockCategoryFilter(categories) {
  const sel = document.getElementById('stockCategoryFilter');
  const currentVal = sel.value;
  // Keep first option, rebuild rest
  while (sel.options.length > 1) sel.remove(1);
  (categories || []).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    sel.appendChild(opt);
  });
  sel.value = currentVal;
}

function renderStockSummary(summary) {
  document.getElementById('stockTotalSKU').textContent
    = (summary?.total_sku || 0).toLocaleString('id-ID');
  document.getElementById('stockInventoryValue').textContent
    = formatCurrency(summary?.total_inventory_value || 0);
  document.getElementById('stockActiveProducts').textContent
    = (summary?.active_products || 0).toLocaleString('id-ID');
  document.getElementById('stockLowCount').textContent
    = (summary?.low_stock_count || 0).toLocaleString('id-ID');

  const alertBox  = document.getElementById('stockAlertBox');
  const alertText = document.getElementById('stockAlertText');
  const low   = summary?.low_stock_count || 0;
  const empty = summary?.empty_stock_count || 0;

  if (low > 0 || empty > 0) {
    alertText.textContent = ` ${low} produk stok menipis, ${empty} produk stok habis. Segera lakukan restock!`;
    alertBox.style.display = 'block';
  } else {
    alertBox.style.display = 'none';
  }
}

function renderStockTable(products) {
  const tbody = document.getElementById('stockTableBody');
  document.getElementById('stockTableInfo').textContent
    = `${(products || []).length.toLocaleString('id-ID')} produk`;

  if (!products || !products.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Tidak ada data produk</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const statusClass = p.stock_status === 'empty' ? 'badge-danger'
      : p.stock_status === 'low' ? 'badge-warning' : 'badge-success';
    const statusText  = p.stock_status === 'empty' ? 'Habis'
      : p.stock_status === 'low' ? 'Menipis' : 'Aman';
    const rowClass    = p.stock_status === 'empty' ? 'row-danger'
      : p.stock_status === 'low' ? 'row-warning' : '';

    return `
      <tr class="${rowClass}">
        <td><code>${escapeHtml(p.barcode)}</code></td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td><span class="badge badge-category">${escapeHtml(p.category_name)}</span></td>
        <td class="td-center-bold ${p.stock_status === 'empty' ? 'text-danger' : p.stock_status === 'low' ? 'text-warning' : 'text-success'}">
          ${p.stock} ${escapeHtml(p.unit || '')}
        </td>
        <td class="td-center">${p.min_stock}</td>
        <td class="td-center"><span class="badge ${statusClass}">${statusText}</span></td>
        <td>${formatCurrency(p.purchase_price)}</td>
        <td><strong>${formatCurrency(p.inventory_value)}</strong></td>
      </tr>
    `;
  }).join('');
}

// ============================================
// CASHIER REPORT
// ============================================

async function filterCashierReport() {
  const period = document.getElementById('cashierPeriod').value;
  let startDate, endDate;

  if (period === 'custom') {
    startDate = document.getElementById('cashierStartDate').value;
    endDate   = document.getElementById('cashierEndDate').value;
    if (!startDate || !endDate) {
      Toast.warning('Pilih tanggal mulai dan akhir terlebih dahulu');
      return;
    }
  } else {
    ({ start: startDate, end: endDate } = getDateRangeFromPeriod(period));
  }

  const filters = {
    startDate,
    endDate,
    userId: document.getElementById('cashierUserFilter').value || null
  };

  showLoading('Memuat laporan kasir...');
  try {
    const res = await window.api.reports.getCashierReport(filters);
    if (!res.success) {
      Toast.error(res.message || 'Gagal memuat laporan kasir');
      return;
    }
    cashierData = res;
    renderCashierCards(res.cashierStats);
    renderCashierBarChart(res.cashierStats);
    renderCashierRankTable(res.cashierStats);
    await loadCashierShiftBreakdown(
      filters.startDate, filters.endDate, filters.userId
    );
  } catch (e) {
    console.error('filterCashierReport error:', e);
    Toast.error('Terjadi kesalahan saat memuat laporan kasir');
  } finally {
    hideLoading();
  }
}

function renderCashierCards(stats) {
  const container = document.getElementById('cashierCardsContainer');
  const filtered  = (stats || []).filter(s => s.total_transactions > 0);

  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state empty-state-full">
        <div class="empty-icon">👤</div>
        <p>Tidak ada data transaksi untuk periode ini</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(s => `
    <div class="cashier-stat-card">
      <div class="cashier-stat-avatar">${s.full_name.charAt(0).toUpperCase()}</div>
      <div class="cashier-stat-name">${escapeHtml(s.full_name)}</div>
      <div class="cashier-stat-role">
        <span class="badge badge-${s.role}">${s.role}</span>
      </div>
      <div class="cashier-stat-row">
        <span>Transaksi</span>
        <strong>${s.total_transactions.toLocaleString('id-ID')}</strong>
      </div>
      <div class="cashier-stat-row">
        <span>Total Penjualan</span>
        <strong class="text-primary">${formatCurrency(s.total_sales)}</strong>
      </div>
      <div class="cashier-stat-row">
        <span>Rata-rata</span>
        <strong>${formatCurrency(s.avg_per_transaction)}</strong>
      </div>
    </div>
  `).join('');
}

function renderCashierBarChart(stats) {
  const ctx = document.getElementById('cashierBarChart').getContext('2d');
  if (cashierChartInstance) cashierChartInstance.destroy();

  const filtered = (stats || []).filter(s => s.total_transactions > 0);
  if (!filtered.length) return;

  const COLORS = ['#3498db','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c'];

  cashierChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: filtered.map(s => s.full_name),
      datasets: [{
        label: 'Total Penjualan (Rp)',
        data: filtered.map(s => s.total_sales),
        backgroundColor: filtered.map((_, i) => COLORS[i % COLORS.length]),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => 'Rp ' + ctx.parsed.x.toLocaleString('id-ID')
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'rb' }
        }
      }
    }
  });
}

function renderCashierRankTable(stats) {
  const tbody   = document.getElementById('cashierRankBody');
  const sorted  = [...(stats || [])].filter(s => s.total_transactions > 0)
    .sort((a, b) => b.total_sales - a.total_sales);

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Tidak ada data</td></tr>';
    return;
  }

  const BADGES = ['🥇', '🥈', '🥉'];

  tbody.innerHTML = sorted.map((s, i) => `
    <tr class="${i < 3 ? ['rank-1','rank-2','rank-3'][i] : ''}">
      <td class="rank-badge-cell">${BADGES[i] || (i + 1)}</td>
      <td><strong>${escapeHtml(s.full_name)}</strong><br>
          <small class="text-muted">${escapeHtml(s.username)}</small></td>
      <td class="td-center-bold">${s.total_transactions.toLocaleString('id-ID')}</td>
      <td><strong class="text-primary">${formatCurrency(s.total_sales)}</strong></td>
      <td>${formatCurrency(s.avg_per_transaction)}</td>
      <td class="td-center">
        ${i === 0 ? '<span class="badge badge-gold">Gold 🏆</span>'
          : i === 1 ? '<span class="badge badge-silver">Silver</span>'
          : i === 2 ? '<span class="badge badge-bronze">Bronze</span>'
          : '<span class="badge badge-secondary">#' + (i + 1) + '</span>'}
      </td>
    </tr>
  `).join('');
}

// ============================================
// CASHIER SHIFT BREAKDOWN
// ============================================

async function loadCashierShiftBreakdown(startDate, endDate, userId) {
  const container = document.getElementById('cashierShiftBreakdown');
  if (!container) return;

  try {
    const result = await window.api.shifts.getSummary({ startDate, endDate });
    if (!result.success || !result.summary.length) {
      container.innerHTML = '';
      return;
    }

    // Also get cash history for this user/period to match
    const cashResult = await window.api.cashDrawer.getHistory({
      startDate, endDate,
      userId: userId || null
    });

    const sessions = cashResult.success ? cashResult.history : [];

    // Group sessions by shift
    const byShift = {};
    sessions.forEach(s => {
      const key = s.shift_id || 0;
      if (!byShift[key]) {
        byShift[key] = {
          shift_name: s.shift_name || 'Tanpa Shift',
          shift_start: s.shift_start || '',
          shift_end: s.shift_end || '',
          sessions: 0,
          total_cash_sales: 0,
          total_expenses: 0,
          total_difference: 0
        };
      }
      byShift[key].sessions++;
      byShift[key].total_cash_sales += s.total_cash_sales || 0;
      byShift[key].total_expenses += s.total_expenses || 0;
      byShift[key].total_difference += (s.difference || 0);
    });

    const rows = Object.values(byShift);
    if (!rows.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="report-section">
        <h3 class="section-title">Breakdown Per Shift</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Shift</th>
                <th>Jam</th>
                <th>Sesi Kas</th>
                <th>Penjualan Cash</th>
                <th>Pengeluaran</th>
                <th>Selisih Kas</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><strong>${escapeHtml(r.shift_name)}</strong></td>
                  <td>${r.shift_start ? `${r.shift_start} - ${r.shift_end}` : '-'}</td>
                  <td>${r.sessions}</td>
                  <td class="text-success">${formatCurrency(r.total_cash_sales)}</td>
                  <td class="text-danger">${formatCurrency(r.total_expenses)}</td>
                  <td class="${r.total_difference === 0 ? 'text-success' : r.total_difference > 0 ? 'text-warning' : 'text-danger'}">
                    ${formatCurrency(r.total_difference)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('loadCashierShiftBreakdown error:', error);
  }
}

// ============================================
// EXPORT HANDLERS
// ============================================

function setupExportHandlers() {
  document.getElementById('btnExportSalesPDF').addEventListener('click', exportSalesPDF);
  document.getElementById('btnExportSalesExcel').addEventListener('click', exportSalesExcel);
  document.getElementById('btnPrintSales').addEventListener('click', printSalesReport);
  document.getElementById('btnExportPLPDF').addEventListener('click', exportPLPDF);
  document.getElementById('btnExportStockExcel').addEventListener('click', exportStockExcel);
  document.getElementById('btnExportCashierPDF').addEventListener('click', exportCashierPDF);
}

// ---- Export Sales PDF ----
function exportSalesPDF() {
  if (!salesData.transactions?.length) {
    Toast.warning('Tidak ada data untuk di-export');
    return;
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const storeName = 'LAPORAN PENJUALAN';

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(storeName, 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Dicetak: ' + formatDateTime(new Date().toISOString()), 14, 26);

    const s = salesData.summary;
    doc.text(`Total: ${formatCurrency(s.total_sales || 0)}  |  Transaksi: ${s.total_transactions || 0}  |  Avg: ${formatCurrency(s.avg_per_transaction || 0)}`, 14, 33);

    const headers = [['Tanggal', 'Kode', 'Kasir', 'Customer', 'Items', 'Total', 'Metode']];
    const rows = salesData.transactions.map(t => [
      formatDateTime(t.transaction_date),
      t.transaction_code,
      t.kasir_name || '-',
      t.customer_name || '-',
      (t.item_count || 0) + ' item',
      formatCurrency(t.total_amount),
      formatPaymentMethod(t.payment_method)
    ]);

    doc.autoTable({
      head: headers,
      body: rows,
      startY: 38,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [52, 152, 219] }
    });

    doc.save('laporan-penjualan-' + new Date().toISOString().split('T')[0] + '.pdf');
    Toast.success('Export PDF berhasil');
  } catch (e) {
    console.error('exportSalesPDF error:', e);
    Toast.error('Gagal export PDF. Pastikan library jsPDF tersedia.');
  }
}

// ---- Export Sales Excel ----
function exportSalesExcel() {
  if (!salesData.transactions?.length) {
    Toast.warning('Tidak ada data untuk di-export');
    return;
  }
  try {
    const { utils, writeFile } = window.XLSX;
    const s = salesData.summary;

    const summaryRows = [
      ['LAPORAN PENJUALAN'],
      ['Dicetak', formatDateTime(new Date().toISOString())],
      [],
      ['Total Penjualan', formatCurrency(s.total_sales || 0)],
      ['Jumlah Transaksi', s.total_transactions || 0],
      ['Rata-rata / Transaksi', formatCurrency(s.avg_per_transaction || 0)],
      ['Total Item Terjual', s.total_items_sold || 0],
      []
    ];

    const headers = ['Tanggal', 'Kode Transaksi', 'Kasir', 'Customer', 'Item Count', 'Total', 'Metode Bayar'];
    const dataRows = salesData.transactions.map(t => [
      formatDateTime(t.transaction_date),
      t.transaction_code,
      t.kasir_name || '-',
      t.customer_name || '-',
      t.item_count || 0,
      t.total_amount,
      formatPaymentMethod(t.payment_method)
    ]);

    const ws = utils.aoa_to_sheet([...summaryRows, headers, ...dataRows]);
    ws['!cols'] = [18, 20, 18, 18, 12, 16, 14].map(w => ({ wch: w }));

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Laporan Penjualan');
    writeFile(wb, 'laporan-penjualan-' + new Date().toISOString().split('T')[0] + '.xlsx');
    Toast.success('Export Excel berhasil');
  } catch (e) {
    console.error('exportSalesExcel error:', e);
    Toast.error('Gagal export Excel. Pastikan library XLSX tersedia.');
  }
}

// ---- Print Sales ----
function printSalesReport() {
  if (!salesData.transactions?.length) {
    Toast.warning('Tidak ada data untuk di-print');
    return;
  }
  window.print();
}

// ---- Export P&L PDF ----
function exportPLPDF() {
  if (!plData.summary?.revenue && plData.summary?.revenue !== 0) {
    Toast.warning('Muat laporan terlebih dahulu sebelum export');
    return;
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN LABA RUGI', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Dicetak: ' + formatDateTime(new Date().toISOString()), 14, 26);

    const s = plData.summary;
    const summaryData = [
      ['Pendapatan (Revenue)', formatCurrency(s.revenue || 0)],
      ['HPP / COGS', formatCurrency(s.cogs || 0)],
      ['Laba Kotor', formatCurrency(s.grossProfit || 0)],
      ['Total Pengeluaran', formatCurrency(s.totalExpenses || 0)],
      ['Laba Bersih', formatCurrency(s.netProfit || 0)]
    ];

    doc.autoTable({
      head: [['Keterangan', 'Jumlah']],
      body: summaryData,
      startY: 32,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [46, 204, 113] },
      bodyStyles: { fontStyle: 'normal' },
      didParseCell: (data) => {
        if (data.row.index === 4 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = s.netProfit >= 0 ? [212, 237, 218] : [248, 215, 218];
        }
      }
    });

    if (plData.salesByCategory?.length) {
      doc.autoTable({
        head: [['Kategori', 'Pendapatan', 'HPP', 'Laba Kotor', 'Margin']],
        body: plData.salesByCategory.map(c => {
          const margin = c.revenue > 0 ? ((c.gross_profit / c.revenue) * 100).toFixed(1) + '%' : '0%';
          return [c.category_name, formatCurrency(c.revenue), formatCurrency(c.cogs), formatCurrency(c.gross_profit), margin];
        }),
        startY: doc.lastAutoTable.finalY + 10,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [52, 152, 219] }
      });
    }

    doc.save('laporan-laba-rugi-' + new Date().toISOString().split('T')[0] + '.pdf');
    Toast.success('Export PDF berhasil');
  } catch (e) {
    console.error('exportPLPDF error:', e);
    Toast.error('Gagal export PDF. Pastikan library jsPDF tersedia.');
  }
}

// ---- Export Stock Excel ----
function exportStockExcel() {
  if (!stockData.products?.length) {
    Toast.warning('Tidak ada data untuk di-export');
    return;
  }
  try {
    const { utils, writeFile } = window.XLSX;
    const headers = ['Barcode', 'Nama Produk', 'Kategori', 'Stok', 'Min Stok', 'Status', 'Harga Beli', 'Nilai Stok', 'Satuan'];
    const rows = stockData.products.map(p => [
      p.barcode,
      p.name,
      p.category_name,
      p.stock,
      p.min_stock,
      p.stock_status === 'empty' ? 'Habis' : p.stock_status === 'low' ? 'Menipis' : 'Aman',
      p.purchase_price,
      p.inventory_value,
      p.unit || 'pcs'
    ]);

    const ws = utils.aoa_to_sheet([
      ['LAPORAN STOK'],
      ['Dicetak', formatDateTime(new Date().toISOString())],
      [],
      headers,
      ...rows
    ]);
    ws['!cols'] = [14, 25, 16, 8, 10, 10, 14, 14, 8].map(w => ({ wch: w }));

    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Laporan Stok');
    writeFile(wb, 'laporan-stok-' + new Date().toISOString().split('T')[0] + '.xlsx');
    Toast.success('Export Excel berhasil');
  } catch (e) {
    console.error('exportStockExcel error:', e);
    Toast.error('Gagal export Excel. Pastikan library XLSX tersedia.');
  }
}

// ---- Export Cashier PDF ----
function exportCashierPDF() {
  const filtered = (cashierData.cashierStats || []).filter(s => s.total_transactions > 0);
  if (!filtered.length) {
    Toast.warning('Tidak ada data untuk di-export');
    return;
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LAPORAN PERFORMA KASIR', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Dicetak: ' + formatDateTime(new Date().toISOString()), 14, 26);

    const sorted = [...filtered].sort((a, b) => b.total_sales - a.total_sales);
    doc.autoTable({
      head: [['Rank', 'Nama Kasir', 'Username', 'Transaksi', 'Total Penjualan', 'Rata-rata']],
      body: sorted.map((s, i) => [
        i + 1,
        s.full_name,
        s.username,
        s.total_transactions,
        formatCurrency(s.total_sales),
        formatCurrency(s.avg_per_transaction)
      ]),
      startY: 32,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [155, 89, 182] }
    });

    doc.save('laporan-kasir-' + new Date().toISOString().split('T')[0] + '.pdf');
    Toast.success('Export PDF berhasil');
  } catch (e) {
    console.error('exportCashierPDF error:', e);
    Toast.error('Gagal export PDF. Pastikan library jsPDF tersedia.');
  }
}

// ============================================
// LOADING OVERLAY
// ============================================

function showLoading(text) {
  const overlay = document.getElementById('loadingOverlay');
  const label   = document.getElementById('loadingText');
  if (overlay) { overlay.style.display = 'flex'; }
  if (label)   { label.textContent = text || 'Memuat...'; }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================
// HELPER FORMATTERS (local)
// ============================================

function formatPaymentMethod(method) {
  const MAP = {
    cash: 'Cash', debit: 'Debit', credit: 'Kredit',
    transfer: 'Transfer', qris: 'QRIS'
  };
  return MAP[method] || (method || '-');
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}