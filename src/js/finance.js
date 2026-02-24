// Finance Page - Kas, Pengeluaran, Pembelian
let currentUser = null;
let allExpenses = [];
let allPurchases = [];
let allCashDrawers = [];
let allProducts = [];
let purchaseItems = [];
let editingExpenseId = null;
let editingPurchaseId = null;
let currentCashDrawer = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Finance page loaded');

  // Initialize page layout
  if (!initializePageLayout('keuangan')) {
    return;
  }

  currentUser = getCurrentUser();

  // Check role - only owner and admin
  if (currentUser.role === 'kasir') {
    showToast('Anda tidak memiliki akses ke halaman ini', 'error');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
    return;
  }

  // Setup event listeners
  setupEventListeners();

  // Load initial data
  await loadDashboard();
  await loadProducts();
  await checkCurrentCashDrawer();
  
  // Populate dropdowns
  populateExpenseCategories();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Dashboard filters
  document.getElementById('btnApplyDashboardFilter').addEventListener('click', loadDashboard);

  // Cash drawer
  document.getElementById('btnApplyCashFilter').addEventListener('click', loadCashDrawerHistory);
  document.getElementById('closeOpenCashModal').addEventListener('click', closeOpenCashModal);
  document.getElementById('btnCancelOpenCash').addEventListener('click', closeOpenCashModal);
  document.getElementById('openCashForm').addEventListener('submit', handleOpenCash);
  document.getElementById('closeCloseCashModal').addEventListener('click', closeCloseCashModal);
  document.getElementById('btnCancelCloseCash').addEventListener('click', closeCloseCashModal);
  document.getElementById('closeCashForm').addEventListener('submit', handleCloseCash);
  document.getElementById('closingBalance').addEventListener('input', calculateDifference);
  document.getElementById('closeDetailCashModal').addEventListener('click', closeDetailCashModal);
  document.getElementById('btnCloseDetailCash').addEventListener('click', closeDetailCashModal);

  // Expenses
  document.getElementById('btnAddExpense').addEventListener('click', openAddExpenseModal);
  document.getElementById('btnApplyExpenseFilter').addEventListener('click', loadExpenses);
  document.getElementById('closeExpenseModal').addEventListener('click', closeExpenseModal);
  document.getElementById('btnCancelExpense').addEventListener('click', closeExpenseModal);
  document.getElementById('expenseForm').addEventListener('submit', handleExpenseFormSubmit);

  // Purchases
  document.getElementById('btnAddPurchase').addEventListener('click', openAddPurchaseModal);
  document.getElementById('btnApplyPurchaseFilter').addEventListener('click', loadPurchases);
  document.getElementById('closePurchaseModal').addEventListener('click', closePurchaseModal);
  document.getElementById('btnCancelPurchase').addEventListener('click', closePurchaseModal);
  document.getElementById('purchaseForm').addEventListener('submit', handlePurchaseFormSubmit);
  document.getElementById('btnAddPurchaseItem').addEventListener('click', openAddItemModal);
  document.getElementById('closeAddItemModal').addEventListener('click', closeAddItemModal);
  document.getElementById('btnCancelAddItem').addEventListener('click', closeAddItemModal);
  document.getElementById('addPurchaseItemForm').addEventListener('submit', handleAddPurchaseItem);
  document.getElementById('itemProduct').addEventListener('change', handleProductSelect);
  document.getElementById('itemQuantity').addEventListener('input', calculateItemSubtotal);
  document.getElementById('itemPurchasePrice').addEventListener('input', calculateItemSubtotal);
  document.getElementById('paymentStatus').addEventListener('change', handlePaymentStatusChange);
  document.getElementById('paidAmount').addEventListener('input', calculateRemainingAmount);
  document.getElementById('closePayPurchaseModal').addEventListener('click', closePayPurchaseModal);
  document.getElementById('btnCancelPay').addEventListener('click', closePayPurchaseModal);
  document.getElementById('payPurchaseForm').addEventListener('submit', handlePayPurchase);
  document.getElementById('closeDetailPurchaseModal').addEventListener('click', closeDetailPurchaseModal);
  document.getElementById('btnCloseDetailPurchase').addEventListener('click', closeDetailPurchaseModal);

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    const modals = ['openCashModal', 'closeCashModal', 'detailCashModal', 'expenseModal', 'purchaseModal', 'addPurchaseItemModal', 'payPurchaseModal', 'detailPurchaseModal'];
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

function switchTab(tabName) {
  // Update tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab content
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Load data for active tab
  if (tabName === 'dashboard') {
    loadDashboard();
  } else if (tabName === 'cash-drawer') {
    checkCurrentCashDrawer();
    loadCashDrawerHistory();
  } else if (tabName === 'expenses') {
    loadExpenses();
  } else if (tabName === 'purchases') {
    loadPurchases();
  }
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
  try {
    // Get date range
    const startDate = document.getElementById('dashboardStartDate').value;
    const endDate = document.getElementById('dashboardEndDate').value;

    // Set default to current month if empty
    if (!startDate || !endDate) {
      const monthRange = getCurrentMonthRange();
      document.getElementById('dashboardStartDate').value = monthRange.startDate;
      document.getElementById('dashboardEndDate').value = monthRange.endDate;
    }

    const filters = {
      startDate: document.getElementById('dashboardStartDate').value,
      endDate: document.getElementById('dashboardEndDate').value
    };

    const result = await window.api.finance.getDashboard(filters);

    if (result.success) {
      const dashboard = result.dashboard;

      // Update summary cards
      document.getElementById('totalSales').textContent = formatCurrency(dashboard.total_sales);
      document.getElementById('totalExpenses').textContent = formatCurrency(dashboard.total_expenses);
      document.getElementById('grossProfit').textContent = formatCurrency(dashboard.gross_profit);
      document.getElementById('netProfit').textContent = formatCurrency(dashboard.net_profit);

      // Update quick stats
      document.getElementById('totalTransactions').textContent = dashboard.total_transactions;
      document.getElementById('avgTransaction').textContent = formatCurrency(dashboard.avg_transaction);
      document.getElementById('totalCOGS').textContent = formatCurrency(dashboard.cogs);

      // Render chart
      renderSalesExpensesChart(dashboard.chart_data);
    } else {
      showToast('Gagal memuat dashboard keuangan', 'error');
    }

    // Load top products
    await loadTopProducts(filters);
  } catch (error) {
    console.error('Load dashboard error:', error);
    showToast('Terjadi kesalahan saat memuat dashboard', 'error');
  }
}

async function loadTopProducts(filters) {
  try {
    const result = await window.api.finance.getTopProducts(filters);

    if (result.success) {
      renderTopProducts(result.topProducts);
    }
  } catch (error) {
    console.error('Load top products error:', error);
  }
}

function renderTopProducts(products) {
  const container = document.getElementById('topProductsList');

  if (products.length === 0) {
    container.innerHTML = '<p class="text-center">Tidak ada data</p>';
    return;
  }

  container.innerHTML = products.map((product, index) => `
    <div class="top-product-item">
      <div class="top-product-rank">${index + 1}</div>
      <div class="top-product-info">
        <strong>${escapeHtml(product.product_name)}</strong>
        <div class="top-product-stats">
          <span>Terjual: ${product.total_quantity}</span>
          <span>•</span>
          <span>Omzet: ${formatCurrency(product.total_sales)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderSalesExpensesChart(data) {
  // Simple canvas-based chart (you can use Chart.js library if needed)
  const canvas = document.getElementById('salesExpensesChart');
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!data || data.length === 0) {
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Tidak ada data untuk ditampilkan', canvas.width / 2, canvas.height / 2);
    return;
  }

  // For now, just display text
  ctx.fillStyle = '#2c3e50';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Data ${data.length} hari`, canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillText('Chart akan ditampilkan di sini', canvas.width / 2, canvas.height / 2 + 10);
}

// ============================================
// CASH DRAWER
// ============================================

async function checkCurrentCashDrawer() {
  try {
    const result = await window.api.cashDrawer.getCurrent();

    if (result.success) {
      currentCashDrawer = result.cashDrawer;
      renderCashStatus(currentCashDrawer);
    } else {
      showToast('Gagal memuat status kas', 'error');
    }
  } catch (error) {
    console.error('Check current cash drawer error:', error);
    renderCashStatus(null);
  }
}

function renderCashStatus(cashDrawer) {
  const container = document.getElementById('cashStatusContent');

  if (!cashDrawer) {
    // Kas belum dibuka
    container.innerHTML = `
      <div class="cash-status-closed">
        <p class="status-message">Kas belum dibuka hari ini</p>
        <button class="btn btn-success btn-large" onclick="openOpenCashModal()">
          🔓 Buka Kas
        </button>
      </div>
    `;
  } else {
    // Kas sudah dibuka
    const openTime = new Date(cashDrawer.open_time);
    container.innerHTML = `
      <div class="cash-status-open">
        <div class="status-badge badge-success">● KAS TERBUKA</div>
        <div class="cash-info-grid">
          <div class="cash-info-item">
            <span class="label">Kasir:</span>
            <strong>${escapeHtml(currentUser.full_name)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Waktu Buka:</span>
            <strong>${formatTimeOnly(cashDrawer.open_time)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Saldo Awal:</span>
            <strong>${formatCurrency(cashDrawer.opening_balance)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Penjualan Cash:</span>
            <strong>${formatCurrency(cashDrawer.total_cash_sales)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Pengeluaran:</span>
            <strong>${formatCurrency(cashDrawer.total_expenses)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Expected Balance:</span>
            <strong class="text-success">${formatCurrency(cashDrawer.opening_balance + cashDrawer.total_cash_sales - cashDrawer.total_expenses)}</strong>
          </div>
        </div>
        ${cashDrawer.notes ? `<p class="cash-notes">Catatan: ${escapeHtml(cashDrawer.notes)}</p>` : ''}
        <button class="btn btn-danger btn-large" onclick="openCloseCashModal(${cashDrawer.id})">
          🔒 Tutup Kas
        </button>
      </div>
    `;
  }
}

async function loadCashDrawerHistory() {
  try {
    const filters = {
      startDate: document.getElementById('cashFilterStartDate').value,
      endDate: document.getElementById('cashFilterEndDate').value
    };

    // Set default to last 30 days if empty
    if (!filters.startDate || !filters.endDate) {
      const range = getLastNDaysRange(30);
      document.getElementById('cashFilterStartDate').value = range.startDate;
      document.getElementById('cashFilterEndDate').value = range.endDate;
      filters.startDate = range.startDate;
      filters.endDate = range.endDate;
    }

    const result = await window.api.cashDrawer.getHistory(filters);

    if (result.success) {
      allCashDrawers = result.history;
      renderCashDrawerTable(allCashDrawers);
    } else {
      showToast('Gagal memuat riwayat kas', 'error');
    }
  } catch (error) {
    console.error('Load cash drawer history error:', error);
    showToast('Terjadi kesalahan saat memuat riwayat kas', 'error');
  }
}

function renderCashDrawerTable(cashDrawers) {
  const tbody = document.getElementById('cashDrawerTableBody');

  if (cashDrawers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center">Tidak ada data kas</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cashDrawers.map(cash => `
    <tr>
      <td>
        <div>${formatDateOnly(cash.open_time)}</div>
        <small>${formatTimeOnly(cash.open_time)}</small>
      </td>
      <td>${escapeHtml(cash.cashier_name)}</td>
      <td>${formatCurrency(cash.opening_balance)}</td>
      <td>${formatCurrency(cash.total_cash_sales)}</td>
      <td>${formatCurrency(cash.total_expenses)}</td>
      <td>${formatCurrency(cash.expected_balance || 0)}</td>
      <td>${cash.closing_balance !== null ? formatCurrency(cash.closing_balance) : '-'}</td>
      <td>
        ${cash.difference !== null ? 
          `<span class="${cash.difference === 0 ? 'text-success' : 'text-danger'}">${formatCurrency(cash.difference)}</span>` 
          : '-'}
      </td>
      <td>
        <span class="badge ${cash.status === 'open' ? 'badge-success' : 'badge-secondary'}">
          ${cash.status === 'open' ? 'Open' : 'Closed'}
        </span>
      </td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="openDetailCashDrawer(${cash.id})" title="Detail">
          👁️
        </button>
      </td>
    </tr>
  `).join('');
}

// Open Cash Drawer Modal
function openOpenCashModal() {
  document.getElementById('openCashForm').reset();
  document.getElementById('openCashError').style.display = 'none';
  document.getElementById('openCashModal').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('openingBalance').focus();
  }, 100);
}

function closeOpenCashModal() {
  document.getElementById('openCashModal').style.display = 'none';
}

async function handleOpenCash(e) {
  e.preventDefault();

  const openingBalance = parseFloat(document.getElementById('openingBalance').value) || 0;
  const notes = document.getElementById('openCashNotes').value.trim();

  if (openingBalance <= 0) {
    showOpenCashError('Saldo awal harus lebih dari 0');
    return;
  }

  showConfirm(
    'Konfirmasi Buka Kas',
    `Yakin ingin membuka kas dengan saldo awal ${formatCurrency(openingBalance)}?`,
    async () => {
      await openCashDrawer({ opening_balance: openingBalance, notes });
    }
  );
}

async function openCashDrawer(data) {
  try {
    const result = await window.api.cashDrawer.open(data);

    if (result.success) {
      showToast('Kas berhasil dibuka', 'success');
      closeOpenCashModal();
      await checkCurrentCashDrawer();
    } else {
      showOpenCashError(result.message || 'Gagal membuka kas');
    }
  } catch (error) {
    console.error('Open cash drawer error:', error);
    showOpenCashError('Terjadi kesalahan saat membuka kas');
  }
}

function showOpenCashError(message) {
  const errorDiv = document.getElementById('openCashError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Close Cash Drawer Modal
function openCloseCashModal(cashDrawerId) {
  if (!currentCashDrawer) return;

  document.getElementById('closeCashDrawerId').value = cashDrawerId;
  document.getElementById('closeOpeningBalance').textContent = formatCurrency(currentCashDrawer.opening_balance);
  document.getElementById('closeCashSales').textContent = formatCurrency(currentCashDrawer.total_cash_sales);
  document.getElementById('closeExpenses').textContent = formatCurrency(currentCashDrawer.total_expenses);

  const expected = currentCashDrawer.opening_balance + currentCashDrawer.total_cash_sales - currentCashDrawer.total_expenses;
  document.getElementById('closeExpectedBalance').textContent = formatCurrency(expected);

  document.getElementById('closingBalance').value = '';
  document.getElementById('closeCashNotes').value = '';
  document.getElementById('differenceDisplay').style.display = 'none';
  document.getElementById('closeCashError').style.display = 'none';

  document.getElementById('closeCashModal').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('closingBalance').focus();
  }, 100);
}

function closeCloseCashModal() {
  document.getElementById('closeCashModal').style.display = 'none';
}

function calculateDifference() {
  if (!currentCashDrawer) return;

  const closingBalance = parseFloat(document.getElementById('closingBalance').value) || 0;
  const expected = currentCashDrawer.opening_balance + currentCashDrawer.total_cash_sales - currentCashDrawer.total_expenses;
  const difference = closingBalance - expected;

  const differenceEl = document.getElementById('differenceAmount');
  differenceEl.textContent = formatCurrency(difference);

  if (difference === 0) {
    differenceEl.className = 'text-success';
  } else {
    differenceEl.className = 'text-danger';
  }

  document.getElementById('differenceDisplay').style.display = 'flex';
}

async function handleCloseCash(e) {
  e.preventDefault();

  const cashDrawerId = parseInt(document.getElementById('closeCashDrawerId').value);
  const closingBalance = parseFloat(document.getElementById('closingBalance').value) || 0;
  const notes = document.getElementById('closeCashNotes').value.trim();

  if (closingBalance < 0) {
    showCloseCashError('Saldo akhir tidak boleh negatif');
    return;
  }

  showConfirm(
    'Konfirmasi Tutup Kas',
    `Yakin ingin menutup kas dengan saldo akhir ${formatCurrency(closingBalance)}?`,
    async () => {
      await closeCashDrawer(cashDrawerId, { closing_balance: closingBalance, notes });
    }
  );
}

async function closeCashDrawer(cashDrawerId, data) {
  try {
    const result = await window.api.cashDrawer.close(cashDrawerId, data);

    if (result.success) {
      showToast('Kas berhasil ditutup', 'success');
      closeCloseCashModal();
      await checkCurrentCashDrawer();
      await loadCashDrawerHistory();
    } else {
      showCloseCashError(result.message || 'Gagal menutup kas');
    }
  } catch (error) {
    console.error('Close cash drawer error:', error);
    showCloseCashError('Terjadi kesalahan saat menutup kas');
  }
}

function showCloseCashError(message) {
  const errorDiv = document.getElementById('closeCashError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Detail Cash Drawer
async function openDetailCashDrawer(cashDrawerId) {
  try {
    const result = await window.api.cashDrawer.getById(cashDrawerId);

    if (result.success) {
      displayCashDrawerDetail(result.cashDrawer);
      document.getElementById('detailCashModal').style.display = 'flex';
    } else {
      showToast('Gagal memuat detail kas', 'error');
    }
  } catch (error) {
    console.error('Open detail cash drawer error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function displayCashDrawerDetail(cashDrawer) {
  const container = document.getElementById('cashDetailContent');

  const transactions = cashDrawer.transactions || [];
  const expenses = cashDrawer.expenses || [];

  container.innerHTML = `
    <div class="detail-section">
      <h3>Informasi Kas</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Kasir:</span>
          <strong>${escapeHtml(cashDrawer.cashier_name)}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tanggal:</span>
          <strong>${formatDateOnly(cashDrawer.open_time)}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Waktu Buka:</span>
          <strong>${formatTimeOnly(cashDrawer.open_time)}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Waktu Tutup:</span>
          <strong>${cashDrawer.close_time ? formatTimeOnly(cashDrawer.close_time) : '-'}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Saldo Awal:</span>
          <strong>${formatCurrency(cashDrawer.opening_balance)}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Saldo Akhir:</span>
          <strong>${cashDrawer.closing_balance !== null ? formatCurrency(cashDrawer.closing_balance) : '-'}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status:</span>
          <span class="badge ${cashDrawer.status === 'open' ? 'badge-success' : 'badge-secondary'}">
            ${cashDrawer.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        ${cashDrawer.notes ? `
        <div class="detail-item">
          <span class="detail-label">Catatan:</span>
          <span>${escapeHtml(cashDrawer.notes)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="detail-section">
      <h3>Transaksi Penjualan Cash (${transactions.length})</h3>
      ${transactions.length > 0 ? `
        <table class="detail-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Kode</th>
              <th>Customer</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td>${formatTimeOnly(tx.transaction_date)}</td>
                <td><code>${escapeHtml(tx.transaction_code)}</code></td>
                <td>${escapeHtml(tx.customer_name || '-')}</td>
                <td><strong>${formatCurrency(tx.total_amount)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="text-center">Tidak ada transaksi cash</p>'}
    </div>

    <div class="detail-section">
      <h3>Pengeluaran (${expenses.length})</h3>
      ${expenses.length > 0 ? `
        <table class="detail-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(exp => `
              <tr>
                <td>${escapeHtml(exp.category)}</td>
                <td>${escapeHtml(exp.description)}</td>
                <td><strong>${formatCurrency(exp.amount)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="text-center">Tidak ada pengeluaran</p>'}
    </div>

    <div class="detail-section">
      <div class="payment-detail">
        <div class="payment-row">
          <span>Saldo Awal:</span>
          <strong>${formatCurrency(cashDrawer.opening_balance)}</strong>
        </div>
        <div class="payment-row">
          <span>Total Penjualan Cash:</span>
          <strong class="text-success">+ ${formatCurrency(cashDrawer.total_cash_sales)}</strong>
        </div>
        <div class="payment-row">
          <span>Total Pengeluaran:</span>
          <strong class="text-danger">- ${formatCurrency(cashDrawer.total_expenses)}</strong>
        </div>
        <div class="payment-row total-row">
          <span>Expected Balance:</span>
          <strong>${formatCurrency(cashDrawer.expected_balance || 0)}</strong>
        </div>
        ${cashDrawer.closing_balance !== null ? `
        <div class="payment-row">
          <span>Saldo Akhir Aktual:</span>
          <strong>${formatCurrency(cashDrawer.closing_balance)}</strong>
        </div>
        <div class="payment-row">
          <span>Selisih:</span>
          <strong class="${cashDrawer.difference === 0 ? 'text-success' : 'text-danger'}">
            ${formatCurrency(cashDrawer.difference)}
          </strong>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

function closeDetailCashModal() {
  document.getElementById('detailCashModal').style.display = 'none';
}

// ============================================
// EXPENSES
// ============================================

async function loadExpenses() {
  try {
    const filters = {
      startDate: document.getElementById('expenseFilterStartDate').value,
      endDate: document.getElementById('expenseFilterEndDate').value,
      category: document.getElementById('expenseFilterCategory').value
    };

    // Set default to current month if empty
    if (!filters.startDate || !filters.endDate) {
      const monthRange = getCurrentMonthRange();
      document.getElementById('expenseFilterStartDate').value = monthRange.startDate;
      document.getElementById('expenseFilterEndDate').value = monthRange.endDate;
      filters.startDate = monthRange.startDate;
      filters.endDate = monthRange.endDate;
    }

    const result = await window.api.expenses.getAll(filters);

    if (result.success) {
      allExpenses = result.expenses;
      renderExpensesTable(allExpenses);
      updateExpensesTotal(allExpenses);
    } else {
      showToast('Gagal memuat data pengeluaran', 'error');
    }
  } catch (error) {
    console.error('Load expenses error:', error);
    showToast('Terjadi kesalahan saat memuat data', 'error');
  }
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesTableBody');

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">Tidak ada data pengeluaran</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = expenses.map(expense => `
    <tr>
      <td>${formatDateOnly(expense.expense_date)}</td>
      <td><span class="badge badge-category">${escapeHtml(expense.category)}</span></td>
      <td>${escapeHtml(expense.description)}</td>
      <td><strong>${formatCurrency(expense.amount)}</strong></td>
      <td>${expense.payment_method || '-'}</td>
      <td>${escapeHtml(expense.user_name)}</td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="editExpense(${expense.id})" title="Edit">
          ✏️
        </button>
        <button class="btn-icon" onclick="confirmDeleteExpense(${expense.id}, '${escapeHtml(expense.description)}')" title="Hapus">
          🗑️
        </button>
      </td>
    </tr>
  `).join('');
}

function updateExpensesTotal(expenses) {
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  document.getElementById('expensesTotal').textContent = formatCurrency(total);
}

function populateExpenseCategories() {
  const categories = getExpenseCategories();
  
  // For filter dropdown
  const filterSelect = document.getElementById('expenseFilterCategory');
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    filterSelect.appendChild(option);
  });

  // For form dropdown
  const formSelect = document.getElementById('expenseCategory');
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    formSelect.appendChild(option);
  });
}

function openAddExpenseModal() {
  editingExpenseId = null;
  document.getElementById('expenseModalTitle').textContent = 'Tambah Pengeluaran';
  document.getElementById('expenseForm').reset();
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('expenseDate').value = today;
  
  document.getElementById('expenseFormError').style.display = 'none';
  document.getElementById('btnSubmitExpenseText').textContent = 'Simpan';
  document.getElementById('expenseModal').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('expenseDate').focus();
  }, 100);
}

async function editExpense(expenseId) {
  try {
    const result = await window.api.expenses.getById(expenseId);

    if (result.success) {
      const expense = result.expense;
      editingExpenseId = expenseId;

      document.getElementById('expenseModalTitle').textContent = 'Edit Pengeluaran';
      document.getElementById('expenseId').value = expense.id;
      document.getElementById('expenseDate').value = expense.expense_date.split('T')[0];
      document.getElementById('expenseCategory').value = expense.category;
      document.getElementById('expenseDescription').value = expense.description;
      document.getElementById('expenseAmount').value = expense.amount;
      document.getElementById('expensePaymentMethod').value = expense.payment_method || 'cash';
      document.getElementById('expenseNotes').value = expense.notes || '';

      document.getElementById('expenseFormError').style.display = 'none';
      document.getElementById('btnSubmitExpenseText').textContent = 'Update';
      document.getElementById('expenseModal').style.display = 'flex';

      setTimeout(() => {
        document.getElementById('expenseDate').focus();
      }, 100);
    } else {
      showToast('Gagal memuat data pengeluaran', 'error');
    }
  } catch (error) {
    console.error('Edit expense error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closeExpenseModal() {
  document.getElementById('expenseModal').style.display = 'none';
  editingExpenseId = null;
}

async function handleExpenseFormSubmit(e) {
  e.preventDefault();

  const formData = {
    expense_date: document.getElementById('expenseDate').value,
    category: document.getElementById('expenseCategory').value,
    description: document.getElementById('expenseDescription').value.trim(),
    amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
    payment_method: document.getElementById('expensePaymentMethod').value,
    notes: document.getElementById('expenseNotes').value.trim()
  };

  if (!formData.category || !formData.description) {
    showExpenseFormError('Kategori dan deskripsi harus diisi');
    return;
  }

  if (formData.amount <= 0) {
    showExpenseFormError('Jumlah harus lebih dari 0');
    return;
  }

  const actionText = editingExpenseId ? 'mengupdate' : 'menambahkan';

  showConfirm(
    'Konfirmasi Simpan',
    `Yakin ingin ${actionText} pengeluaran "${formData.description}" sebesar ${formatCurrency(formData.amount)}?`,
    async () => {
      await saveExpense(formData);
    }
  );
}

async function saveExpense(formData) {
  try {
    let result;

    if (editingExpenseId) {
      result = await window.api.expenses.update(editingExpenseId, formData);
    } else {
      result = await window.api.expenses.create(formData);
    }

    if (result.success) {
      closeExpenseModal();
      await loadExpenses();
      showToast(
        editingExpenseId ? 'Pengeluaran berhasil diupdate' : 'Pengeluaran berhasil ditambahkan',
        'success'
      );
    } else {
      showExpenseFormError(result.message || 'Gagal menyimpan pengeluaran');
    }
  } catch (error) {
    console.error('Save expense error:', error);
    showExpenseFormError('Terjadi kesalahan saat menyimpan');
  }
}

function confirmDeleteExpense(expenseId, description) {
  showConfirm(
    'Konfirmasi Hapus',
    `Yakin ingin menghapus pengeluaran "${description}"?`,
    async () => {
      await deleteExpense(expenseId);
    }
  );
}

async function deleteExpense(expenseId) {
  try {
    const result = await window.api.expenses.delete(expenseId);

    if (result.success) {
      await loadExpenses();
      showToast('Pengeluaran berhasil dihapus', 'success');
    } else {
      showToast(result.message || 'Gagal menghapus pengeluaran', 'error');
    }
  } catch (error) {
    console.error('Delete expense error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function showExpenseFormError(message) {
  const errorDiv = document.getElementById('expenseFormError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// ============================================
// PURCHASES
// ============================================

async function loadProducts() {
  try {
    const result = await window.api.products.getAll();

    if (result.success) {
      allProducts = result.products.filter(p => p.is_active === 1);
      populateProductDropdown();
    }
  } catch (error) {
    console.error('Load products error:', error);
  }
}

function populateProductDropdown() {
  const select = document.getElementById('itemProduct');
  select.innerHTML = '<option value="">Pilih Produk</option>';

  allProducts.forEach(product => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = `${product.name} (${product.barcode})`;
    option.dataset.unit = product.unit;
    option.dataset.purchasePrice = product.purchase_price;
    select.appendChild(option);
  });
}

async function loadPurchases() {
  try {
    const filters = {
      startDate: document.getElementById('purchaseFilterStartDate').value,
      endDate: document.getElementById('purchaseFilterEndDate').value,
      paymentStatus: document.getElementById('purchaseFilterStatus').value
    };

    // Set default to current month if empty
    if (!filters.startDate || !filters.endDate) {
      const monthRange = getCurrentMonthRange();
      document.getElementById('purchaseFilterStartDate').value = monthRange.startDate;
      document.getElementById('purchaseFilterEndDate').value = monthRange.endDate;
      filters.startDate = monthRange.startDate;
      filters.endDate = monthRange.endDate;
    }

    const result = await window.api.purchases.getAll(filters);

    if (result.success) {
      allPurchases = result.purchases;
      renderPurchasesTable(allPurchases);
      updatePurchasesSummary(allPurchases);
    } else {
      showToast('Gagal memuat data pembelian', 'error');
    }
  } catch (error) {
    console.error('Load purchases error:', error);
    showToast('Terjadi kesalahan saat memuat data', 'error');
  }
}

function renderPurchasesTable(purchases) {
  const tbody = document.getElementById('purchasesTableBody');

  if (purchases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">Tidak ada data pembelian</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = purchases.map(purchase => `
    <tr>
      <td><code>${escapeHtml(purchase.purchase_code)}</code></td>
      <td>${formatDateOnly(purchase.purchase_date)}</td>
      <td>${escapeHtml(purchase.supplier_name || '-')}</td>
      <td><strong>${formatCurrency(purchase.total_amount)}</strong></td>
      <td>
        <span class="badge ${getPaymentStatusClass(purchase.payment_status)}">
          ${getPaymentStatusLabel(purchase.payment_status)}
        </span>
      </td>
      <td>
        ${purchase.remaining_amount > 0 ? 
          `<strong class="text-danger">${formatCurrency(purchase.remaining_amount)}</strong>` 
          : '-'}
      </td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="openDetailPurchase(${purchase.id})" title="Detail">
          👁️
        </button>
        ${purchase.payment_status !== 'paid' ? `
          <button class="btn-icon" onclick="openPayPurchaseModal(${purchase.id})" title="Bayar">
            💰
          </button>
        ` : ''}
        ${purchase.paid_amount === 0 ? `
          <button class="btn-icon" onclick="confirmDeletePurchase(${purchase.id}, '${escapeHtml(purchase.purchase_code)}')" title="Hapus">
            🗑️
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function updatePurchasesSummary(purchases) {
  const total = purchases.reduce((sum, p) => sum + p.total_amount, 0);
  const debt = purchases.reduce((sum, p) => sum + (p.remaining_amount || 0), 0);

  document.getElementById('purchasesTotal').textContent = formatCurrency(total);
  document.getElementById('purchasesDebt').textContent = formatCurrency(debt);
}

function openAddPurchaseModal() {
  editingPurchaseId = null;
  purchaseItems = [];

  document.getElementById('purchaseModalTitle').textContent = 'Tambah Pembelian';
  document.getElementById('purchaseForm').reset();

  // Set defaults
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('purchaseDate').value = today;
  document.getElementById('purchaseCode').value = generatePurchaseCode();
  document.getElementById('paymentStatus').value = 'unpaid';
  document.getElementById('paidAmount').value = 0;
  document.getElementById('paidAmount').disabled = true;

  renderPurchaseItemsTable();
  updatePurchaseTotal();

  document.getElementById('purchaseFormError').style.display = 'none';
  document.getElementById('btnSubmitPurchaseText').textContent = 'Simpan';
  document.getElementById('purchaseModal').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('purchaseDate').focus();
  }, 100);
}

function closePurchaseModal() {
  document.getElementById('purchaseModal').style.display = 'none';
  editingPurchaseId = null;
  purchaseItems = [];
}

function renderPurchaseItemsTable() {
  const tbody = document.getElementById('purchaseItemsTableBody');

  if (purchaseItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">Belum ada item. Klik "Tambah Item" untuk menambahkan.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = purchaseItems.map((item, index) => `
    <tr>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>${formatCurrency(item.purchase_price)}</td>
      <td><strong>${formatCurrency(item.subtotal)}</strong></td>
      <td>
        <button class="btn-remove" onclick="removePurchaseItem(${index})" title="Hapus">
          ❌
        </button>
      </td>
    </tr>
  `).join('');
}

function removePurchaseItem(index) {
  purchaseItems.splice(index, 1);
  renderPurchaseItemsTable();
  updatePurchaseTotal();
}

function updatePurchaseTotal() {
  const total = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  document.getElementById('purchaseTotalAmount').textContent = formatCurrency(total);
  calculateRemainingAmount();
}

function handlePaymentStatusChange() {
  const status = document.getElementById('paymentStatus').value;
  const paidAmountInput = document.getElementById('paidAmount');

  if (status === 'unpaid') {
    paidAmountInput.value = 0;
    paidAmountInput.disabled = true;
  } else {
    paidAmountInput.disabled = false;
    if (status === 'paid') {
      const total = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
      paidAmountInput.value = total;
    }
  }

  calculateRemainingAmount();
}

function calculateRemainingAmount() {
  const total = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  const paid = parseFloat(document.getElementById('paidAmount').value) || 0;
  const remaining = total - paid;

  document.getElementById('remainingAmount').value = formatCurrency(remaining);
}

// Add Purchase Item Modal
function openAddItemModal() {
  document.getElementById('addPurchaseItemForm').reset();
  document.getElementById('itemUnit').value = '';
  document.getElementById('itemSubtotal').value = 'Rp 0';
  document.getElementById('addPurchaseItemModal').style.display = 'flex';

  setTimeout(() => {
    document.getElementById('itemProduct').focus();
  }, 100);
}

function closeAddItemModal() {
  document.getElementById('addPurchaseItemModal').style.display = 'none';
}

function handleProductSelect() {
  const select = document.getElementById('itemProduct');
  const selectedOption = select.options[select.selectedIndex];

  if (selectedOption.value) {
    document.getElementById('itemUnit').value = selectedOption.dataset.unit || 'pcs';
    document.getElementById('itemPurchasePrice').value = selectedOption.dataset.purchasePrice || 0;
    calculateItemSubtotal();
  } else {
    document.getElementById('itemUnit').value = '';
    document.getElementById('itemPurchasePrice').value = '';
    document.getElementById('itemSubtotal').value = 'Rp 0';
  }
}

function calculateItemSubtotal() {
  const quantity = parseFloat(document.getElementById('itemQuantity').value) || 0;
  const price = parseFloat(document.getElementById('itemPurchasePrice').value) || 0;
  const subtotal = quantity * price;

  document.getElementById('itemSubtotal').value = formatCurrency(subtotal);
}

async function handleAddPurchaseItem(e) {
  e.preventDefault();

  const productId = parseInt(document.getElementById('itemProduct').value);
  const quantity = parseFloat(document.getElementById('itemQuantity').value);
  const purchasePrice = parseFloat(document.getElementById('itemPurchasePrice').value);

  if (!productId || quantity <= 0 || purchasePrice < 0) {
    showToast('Isi semua field dengan benar', 'error');
    return;
  }

  const product = allProducts.find(p => p.id === productId);
  if (!product) {
    showToast('Produk tidak ditemukan', 'error');
    return;
  }

  // Check if product already in list
  const existing = purchaseItems.find(item => item.product_id === productId);
  if (existing) {
    showToast('Produk sudah ada dalam daftar', 'error');
    return;
  }

  purchaseItems.push({
    product_id: productId,
    product_name: product.name,
    quantity: quantity,
    unit: product.unit,
    purchase_price: purchasePrice,
    subtotal: quantity * purchasePrice
  });

  closeAddItemModal();
  renderPurchaseItemsTable();
  updatePurchaseTotal();
}

async function handlePurchaseFormSubmit(e) {
  e.preventDefault();

  if (purchaseItems.length === 0) {
    showPurchaseFormError('Tambahkan minimal 1 item pembelian');
    return;
  }

  const total = purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  const paidAmount = parseFloat(document.getElementById('paidAmount').value) || 0;

  if (paidAmount > total) {
    showPurchaseFormError('Jumlah dibayar tidak boleh melebihi total');
    return;
  }

  const formData = {
    purchase_code: document.getElementById('purchaseCode').value,
    supplier_name: document.getElementById('supplierName').value.trim(),
    purchase_date: document.getElementById('purchaseDate').value,
    total_amount: total,
    payment_status: document.getElementById('paymentStatus').value,
    paid_amount: paidAmount,
    notes: document.getElementById('purchaseNotes').value.trim(),
    items: purchaseItems
  };

  showConfirm(
    'Konfirmasi Simpan',
    `Yakin ingin menyimpan pembelian dengan ${purchaseItems.length} item (Total: ${formatCurrency(total)})?`,
    async () => {
      await savePurchase(formData);
    }
  );
}

async function savePurchase(formData) {
  const btnSubmit = document.getElementById('btnSubmitPurchaseText');
  const originalText = btnSubmit.textContent;
  btnSubmit.textContent = 'Menyimpan...';

  try {
    const result = await window.api.purchases.create(formData);

    if (result.success) {
      closePurchaseModal();
      await loadPurchases();
      showToast('Pembelian berhasil disimpan', 'success');
    } else {
      showPurchaseFormError(result.message || 'Gagal menyimpan pembelian');
      btnSubmit.textContent = originalText;
    }
  } catch (error) {
    console.error('Save purchase error:', error);
    showPurchaseFormError('Terjadi kesalahan saat menyimpan');
    btnSubmit.textContent = originalText;
  }
}

function showPurchaseFormError(message) {
  const errorDiv = document.getElementById('purchaseFormError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Pay Purchase
async function openPayPurchaseModal(purchaseId) {
  try {
    const result = await window.api.purchases.getById(purchaseId);

    if (result.success) {
      const purchase = result.purchase;

      if (purchase.payment_status === 'paid') {
        showToast('Pembelian sudah lunas', 'info');
        return;
      }

      document.getElementById('payPurchaseId').value = purchase.id;
      document.getElementById('payPurchaseCode').textContent = purchase.purchase_code;
      document.getElementById('paySupplier').textContent = purchase.supplier_name || '-';
      document.getElementById('payTotal').textContent = formatCurrency(purchase.total_amount);
      document.getElementById('payAlreadyPaid').textContent = formatCurrency(purchase.paid_amount);
      document.getElementById('payRemaining').textContent = formatCurrency(purchase.remaining_amount);

      document.getElementById('payAmount').value = '';
      document.getElementById('payAmount').max = purchase.remaining_amount;
      document.getElementById('payPurchaseError').style.display = 'none';

      document.getElementById('payPurchaseModal').style.display = 'flex';

      setTimeout(() => {
        document.getElementById('payAmount').focus();
      }, 100);
    } else {
      showToast('Gagal memuat data pembelian', 'error');
    }
  } catch (error) {
    console.error('Open pay purchase modal error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function closePayPurchaseModal() {
  document.getElementById('payPurchaseModal').style.display = 'none';
}

async function handlePayPurchase(e) {
  e.preventDefault();

  const purchaseId = parseInt(document.getElementById('payPurchaseId').value);
  const amount = parseFloat(document.getElementById('payAmount').value) || 0;
  const remaining = parseCurrency(document.getElementById('payRemaining').textContent);

  if (amount <= 0) {
    showPayPurchaseError('Jumlah bayar harus lebih dari 0');
    return;
  }

  if (amount > remaining) {
    showPayPurchaseError('Jumlah bayar melebihi sisa hutang');
    return;
  }

  showConfirm(
    'Konfirmasi Pembayaran',
    `Yakin ingin membayar ${formatCurrency(amount)} untuk pembelian ini?`,
    async () => {
      await processPurchasePayment(purchaseId, amount);
    }
  );
}

async function processPurchasePayment(purchaseId, amount) {
  try {
    const result = await window.api.purchases.pay(purchaseId, amount);

    if (result.success) {
      closePayPurchaseModal();
      await loadPurchases();
      showToast('Pembayaran berhasil diproses', 'success');
    } else {
      showPayPurchaseError(result.message || 'Gagal memproses pembayaran');
    }
  } catch (error) {
    console.error('Process purchase payment error:', error);
    showPayPurchaseError('Terjadi kesalahan saat memproses pembayaran');
  }
}

function showPayPurchaseError(message) {
  const errorDiv = document.getElementById('payPurchaseError');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

// Detail Purchase
async function openDetailPurchase(purchaseId) {
  try {
    const result = await window.api.purchases.getById(purchaseId);

    if (result.success) {
      displayPurchaseDetail(result.purchase);
      document.getElementById('detailPurchaseModal').style.display = 'flex';
    } else {
      showToast('Gagal memuat detail pembelian', 'error');
    }
  } catch (error) {
    console.error('Open detail purchase error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function displayPurchaseDetail(purchase) {
  const container = document.getElementById('purchaseDetailContent');

  container.innerHTML = `
    <div class="detail-section">
      <h3>Informasi Pembelian</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Kode PO:</span>
          <strong><code>${escapeHtml(purchase.purchase_code)}</code></strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tanggal:</span>
          <strong>${formatDateOnly(purchase.purchase_date)}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Supplier:</span>
          <strong>${escapeHtml(purchase.supplier_name || '-')}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">User:</span>
          <strong>${escapeHtml(purchase.user_name)}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status Bayar:</span>
          <span class="badge ${getPaymentStatusClass(purchase.payment_status)}">
            ${getPaymentStatusLabel(purchase.payment_status)}
          </span>
        </div>
        ${purchase.notes ? `
        <div class="detail-item">
          <span class="detail-label">Catatan:</span>
          <span>${escapeHtml(purchase.notes)}</span>
        </div>
        ` : ''}
      </div>
    </div>

    <div class="detail-section">
      <h3>Item Pembelian</h3>
      <table class="detail-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Produk</th>
            <th>Qty</th>
            <th>Satuan</th>
            <th>Harga Beli</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${purchase.items.map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(item.product_name)}</td>
              <td>${item.quantity}</td>
              <td>${item.unit}</td>
              <td>${formatCurrency(item.purchase_price)}</td>
              <td><strong>${formatCurrency(item.subtotal)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="detail-section">
      <div class="payment-detail">
        <div class="payment-row total-row">
          <span>Total Pembelian:</span>
          <strong>${formatCurrency(purchase.total_amount)}</strong>
        </div>
        <div class="payment-row">
          <span>Sudah Dibayar:</span>
          <strong class="text-success">${formatCurrency(purchase.paid_amount)}</strong>
        </div>
        <div class="payment-row">
          <span>Sisa Hutang:</span>
          <strong class="${purchase.remaining_amount > 0 ? 'text-danger' : 'text-success'}">
            ${formatCurrency(purchase.remaining_amount)}
          </strong>
        </div>
      </div>
    </div>
  `;
}

function closeDetailPurchaseModal() {
  document.getElementById('detailPurchaseModal').style.display = 'none';
}

// Delete Purchase
function confirmDeletePurchase(purchaseId, purchaseCode) {
  showConfirm(
    'Konfirmasi Hapus',
    `Yakin ingin menghapus pembelian "${purchaseCode}"? Stok produk akan dikembalikan.`,
    async () => {
      await deletePurchase(purchaseId);
    }
  );
}

async function deletePurchase(purchaseId) {
  try {
    const result = await window.api.purchases.delete(purchaseId);

    if (result.success) {
      await loadPurchases();
      showToast('Pembelian berhasil dihapus', 'success');
    } else {
      showToast(result.message || 'Gagal menghapus pembelian', 'error');
    }
  } catch (error) {
    console.error('Delete purchase error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}