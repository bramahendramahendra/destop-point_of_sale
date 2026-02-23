// Transactions History Page
let currentUser = null;
let allTransactions = [];
let allUsers = [];
let currentPage = 1;
let itemsPerPage = 20;
let currentFilters = {};
let currentTransactionId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Transactions page loaded');

  // Initialize page layout
  if (!initializePageLayout('transaksi')) {
    return;
  }

  currentUser = getCurrentUser();

  // Set default date range (today)
  const today = getTodayRange();
  document.getElementById('filterStartDate').value = today.startDate;
  document.getElementById('filterEndDate').value = today.endDate;

  // Load data
  await loadUsers();
  await loadTransactions();

  // Setup event listeners
  setupEventListeners();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Apply filter button
  document.getElementById('btnApplyFilter').addEventListener('click', applyFilters);

  // Search input
  document.getElementById('searchTransaction').addEventListener('input', applyFilters);

  // Pagination
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadTransactions();
    }
  });

  document.getElementById('btnNextPage').addEventListener('click', () => {
    currentPage++;
    loadTransactions();
  });

  // Detail modal
  document.getElementById('closeDetailModal').addEventListener('click', closeDetailModal);
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetailModal);
  document.getElementById('btnPrintReceipt').addEventListener('click', printReceipt);
  document.getElementById('btnVoidTransaction').addEventListener('click', confirmVoidTransaction);

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('detailModal');
    if (e.target === modal) {
      closeDetailModal();
    }
  });
}

// ============================================
// LOAD DATA
// ============================================

async function loadUsers() {
  try {
    const result = await window.api.users.getAll();
    
    if (result.success) {
      allUsers = result.users;
      populateCashierFilter();
    }
  } catch (error) {
    console.error('Load users error:', error);
  }
}

function populateCashierFilter() {
  const select = document.getElementById('filterCashier');
  
  allUsers.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = `${user.full_name} (${user.role})`;
    select.appendChild(option);
  });
}

async function loadTransactions() {
  try {
    const filters = {
      startDate: document.getElementById('filterStartDate').value,
      endDate: document.getElementById('filterEndDate').value,
      transactionCode: document.getElementById('searchTransaction').value.trim(),
      userId: document.getElementById('filterCashier').value,
      paymentMethod: document.getElementById('filterPaymentMethod').value,
      status: document.getElementById('filterStatus').value,
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage
    };

    currentFilters = filters;

    const result = await window.api.transactions.getAll(filters);
    
    if (result.success) {
      allTransactions = result.transactions;
      renderTransactionsTable(allTransactions);
      updateSummary(allTransactions);
      updatePagination();
    } else {
      showToast('Gagal memuat data transaksi', 'error');
    }
  } catch (error) {
    console.error('Load transactions error:', error);
    showToast('Terjadi kesalahan saat memuat data', 'error');
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  
  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center">Tidak ada data transaksi</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(transaction => `
    <tr>
      <td>
        <div>${formatDateOnly(transaction.transaction_date)}</div>
        <small>${formatTimeOnly(transaction.transaction_date)}</small>
      </td>
      <td><code>${escapeHtml(transaction.transaction_code)}</code></td>
      <td>${escapeHtml(transaction.cashier_name)}</td>
      <td>${escapeHtml(transaction.customer_name || '-')}</td>
      <td><strong>${formatCurrency(transaction.total_amount)}</strong></td>
      <td>
        <span class="badge badge-payment">${getPaymentMethodLabel(transaction.payment_method)}</span>
      </td>
      <td>
        <span class="badge ${transaction.status === 'completed' ? 'badge-success' : 'badge-danger'}">
          ${transaction.status === 'completed' ? 'Completed' : 'Void'}
        </span>
      </td>
      <td class="action-buttons">
        <button class="btn-icon" onclick="openTransactionDetail(${transaction.id})" title="Detail">
          👁️
        </button>
        <button class="btn-icon" onclick="printReceiptDirect(${transaction.id})" title="Print">
          🖨️
        </button>
      </td>
    </tr>
  `).join('');
}

function updateSummary(transactions) {
  const completedTransactions = transactions.filter(t => t.status === 'completed');
  const totalSales = completedTransactions.reduce((sum, t) => sum + t.total_amount, 0);
  
  document.getElementById('totalSales').textContent = formatCurrency(totalSales);
  document.getElementById('totalTransactions').textContent = completedTransactions.length;
}

function updatePagination() {
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  
  btnPrev.disabled = currentPage === 1;
  btnNext.disabled = allTransactions.length < itemsPerPage;
  
  document.getElementById('pageInfo').textContent = `Halaman ${currentPage}`;
}

function applyFilters() {
  currentPage = 1;
  loadTransactions();
}

// ============================================
// TRANSACTION DETAIL
// ============================================

async function openTransactionDetail(transactionId) {
  try {
    currentTransactionId = transactionId;
    
    const result = await window.api.transactions.getById(transactionId);
    
    if (result.success) {
      const transaction = result.transaction;
      displayTransactionDetail(transaction);
      
      document.getElementById('detailModal').style.display = 'flex';
    } else {
      showToast('Gagal memuat detail transaksi', 'error');
    }
  } catch (error) {
    console.error('Open transaction detail error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

function displayTransactionDetail(transaction) {
  // Transaction info
  document.getElementById('detailCode').textContent = transaction.transaction_code;
  document.getElementById('detailDate').textContent = formatDateTime(transaction.transaction_date);
  document.getElementById('detailCashier').textContent = transaction.cashier_name;
  document.getElementById('detailCustomer').textContent = transaction.customer_name || '-';
  document.getElementById('detailPaymentMethod').textContent = getPaymentMethodLabel(transaction.payment_method);
  
  // Status badge
  const statusEl = document.getElementById('detailStatus');
  statusEl.innerHTML = `
    <span class="badge ${transaction.status === 'completed' ? 'badge-success' : 'badge-danger'}">
      ${transaction.status === 'completed' ? 'Completed' : 'Void'}
    </span>
  `;

  // Notes
  if (transaction.notes) {
    document.getElementById('detailNotesContainer').style.display = 'flex';
    document.getElementById('detailNotes').textContent = transaction.notes;
  } else {
    document.getElementById('detailNotesContainer').style.display = 'none';
  }

  // Items
  const itemsBody = document.getElementById('detailItemsBody');
  itemsBody.innerHTML = transaction.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.product_name)}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${item.quantity} ${item.unit}</td>
      <td><strong>${formatCurrency(item.subtotal)}</strong></td>
    </tr>
  `).join('');

  // Payment summary
  document.getElementById('detailSubtotal').textContent = formatCurrency(transaction.subtotal);
  
  if (transaction.discount_amount > 0) {
    document.getElementById('detailDiscountRow').style.display = 'flex';
    document.getElementById('detailDiscount').textContent = formatCurrency(transaction.discount_amount);
  } else {
    document.getElementById('detailDiscountRow').style.display = 'none';
  }

  if (transaction.tax_amount > 0) {
    document.getElementById('detailTaxRow').style.display = 'flex';
    document.getElementById('detailTax').textContent = formatCurrency(transaction.tax_amount);
  } else {
    document.getElementById('detailTaxRow').style.display = 'none';
  }

  document.getElementById('detailTotal').textContent = formatCurrency(transaction.total_amount);
  document.getElementById('detailPaid').textContent = formatCurrency(transaction.payment_amount);
  document.getElementById('detailChange').textContent = formatCurrency(transaction.change_amount);

  // Void button visibility
  const btnVoid = document.getElementById('btnVoidTransaction');
  if (transaction.status === 'void' || (currentUser.role !== 'owner' && currentUser.role !== 'admin')) {
    btnVoid.style.display = 'none';
  } else {
    btnVoid.style.display = 'inline-block';
  }
}

function closeDetailModal() {
  document.getElementById('detailModal').style.display = 'none';
  currentTransactionId = null;
}

function printReceipt() {
  if (currentTransactionId) {
    window.api.window.openReceipt(currentTransactionId);
  }
}

function printReceiptDirect(transactionId) {
  window.api.window.openReceipt(transactionId);
}

// ============================================
// VOID TRANSACTION
// ============================================

function confirmVoidTransaction() {
  if (!currentTransactionId) return;

  showConfirm(
    'Konfirmasi Void Transaksi',
    'Yakin ingin void transaksi ini? Stok produk akan dikembalikan.',
    async () => {
      await voidTransaction(currentTransactionId);
    }
  );
}

async function voidTransaction(transactionId) {
  try {
    const result = await window.api.transactions.void(transactionId);
    
    if (result.success) {
      showToast('Transaksi berhasil di-void', 'success');
      closeDetailModal();
      await loadTransactions();
    } else {
      showToast(result.message || 'Gagal void transaksi', 'error');
    }
  } catch (error) {
    console.error('Void transaction error:', error);
    showToast('Terjadi kesalahan', 'error');
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPaymentMethodLabel(method) {
  const labels = {
    cash: 'Cash',
    debit: 'Debit Card',
    credit: 'Credit Card',
    qris: 'QRIS',
    transfer: 'Transfer'
  };
  return labels[method] || method;
}