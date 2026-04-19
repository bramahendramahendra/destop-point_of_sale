// My Cash Page - Kasir Only
let currentUser = null;
let allCashDrawers = [];
let currentCashDrawer = null;
let shiftsCache = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('My Cash page loaded');

  // Initialize page layout
  if (!initializePageLayout('my-cash')) {
    return;
  }

  currentUser = getCurrentUser();

  // Check role - only kasir
  if (currentUser.role !== 'kasir') {
    showToast('Halaman ini hanya untuk kasir', 'error');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
    return;
  }

  // Setup event listeners
  setupEventListeners();

  // Load initial data
  await loadShiftsDropdown();
  await checkCurrentCashDrawer();
  await loadMyCashHistory();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Cash drawer filters
  document.getElementById('btnApplyCashFilter').addEventListener('click', loadMyCashHistory);

  // Open cash modal
  document.getElementById('closeOpenCashModal').addEventListener('click', closeOpenCashModal);
  document.getElementById('btnCancelOpenCash').addEventListener('click', closeOpenCashModal);
  document.getElementById('openCashForm').addEventListener('submit', handleOpenCash);

  // Close cash modal
  document.getElementById('closeCloseCashModal').addEventListener('click', closeCloseCashModal);
  document.getElementById('btnCancelCloseCash').addEventListener('click', closeCloseCashModal);
  document.getElementById('closeCashForm').addEventListener('submit', handleCloseCash);
  document.getElementById('closingBalance').addEventListener('input', calculateDifference);

  // Detail cash modal
  document.getElementById('closeDetailCashModal').addEventListener('click', closeDetailCashModal);
  document.getElementById('btnCloseDetailCash').addEventListener('click', closeDetailCashModal);

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    const modals = ['openCashModal', 'closeCashModal', 'detailCashModal'];
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
}

// ============================================
// SHIFTS
// ============================================

async function loadShiftsDropdown() {
  try {
    const result = await window.api.shifts.getActive();
    if (result.success) {
      shiftsCache = result.shifts;
      const select = document.getElementById('openShiftSelect');
      select.innerHTML = '<option value="">-- Pilih Shift --</option>' +
        result.shifts.map(s =>
          `<option value="${s.id}">${escapeHtml(s.name)} (${s.start_time} - ${s.end_time})</option>`
        ).join('');
    }
  } catch (error) {
    console.error('loadShiftsDropdown error:', error);
  }
}

function getShiftLabel(shiftId, shiftName) {
  if (shiftName) return shiftName;
  if (!shiftId) return '-';
  const s = shiftsCache.find(x => x.id === shiftId);
  return s ? s.name : '-';
}

// ============================================
// CASH DRAWER STATUS
// ============================================

async function checkCurrentCashDrawer() {
  try {
    const result = await window.api.cashDrawer.getCurrent();

    if (result.success) {
      currentCashDrawer = result.cashDrawer;
      renderCashStatus(currentCashDrawer);
    } else {
      showToast('Gagal memuat status kas', 'error');
      renderCashStatus(null);
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
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <p class="empty-title">Kas Belum Dibuka</p>
          <p class="empty-desc">Buka kas terlebih dahulu untuk memulai transaksi hari ini</p>
        </div>
        <button class="btn btn-success btn-large" onclick="openOpenCashModal()">
          🔓 Buka Kas Sekarang
        </button>
      </div>
    `;
  } else {
    // Kas sudah dibuka
    const expected = cashDrawer.opening_balance + cashDrawer.total_cash_sales - cashDrawer.total_expenses;
    
    container.innerHTML = `
      <div class="cash-status-open">
        <div class="status-badge badge-success">● KAS TERBUKA</div>
        
        <div class="cash-info-grid">
          ${cashDrawer.shift_name ? `
          <div class="cash-info-item">
            <span class="label">Shift:</span>
            <strong>${escapeHtml(cashDrawer.shift_name)} (${cashDrawer.shift_start} - ${cashDrawer.shift_end})</strong>
          </div>` : ''}
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
            <strong class="text-success">${formatCurrency(cashDrawer.total_cash_sales)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Pengeluaran:</span>
            <strong class="text-danger">${formatCurrency(cashDrawer.total_expenses)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Expected Balance:</span>
            <strong class="text-primary">${formatCurrency(expected)}</strong>
          </div>
          <div class="cash-info-item">
            <span class="label">Durasi:</span>
            <strong>${calculateDuration(cashDrawer.open_time)}</strong>
          </div>
        </div>
        
        ${cashDrawer.notes ? `<p class="cash-notes">📝 ${escapeHtml(cashDrawer.notes)}</p>` : ''}
        
        <button class="btn btn-danger btn-large" onclick="openCloseCashModal(${cashDrawer.id})">
          🔒 Tutup Kas
        </button>
      </div>
    `;
  }
}

function calculateDuration(openTime) {
  const start = new Date(openTime);
  const now = new Date();
  const diffMs = now - start;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `${diffHours} jam ${diffMins} menit`;
  } else {
    return `${diffMins} menit`;
  }
}

// ============================================
// CASH DRAWER HISTORY (MY CASH ONLY)
// ============================================

async function loadMyCashHistory() {
  try {
    const filters = {
      userId: currentUser.id, // IMPORTANT: Only my cash
      startDate: document.getElementById('cashFilterStartDate').value,
      endDate: document.getElementById('cashFilterEndDate').value
    };

    // Set default to last 7 days if empty
    if (!filters.startDate || !filters.endDate) {
      const range = getLastNDaysRange(7);
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
    console.error('Load my cash history error:', error);
    showToast('Terjadi kesalahan saat memuat riwayat kas', 'error');
  }
}

function renderCashDrawerTable(cashDrawers) {
  const tbody = document.getElementById('cashDrawerTableBody');

  if (cashDrawers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="text-center">Tidak ada riwayat kas</td>
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
      <td>
        ${cash.shift_name
          ? `<span class="badge badge-info">${escapeHtml(cash.shift_name)}</span>`
          : '<span class="text-muted">-</span>'}
      </td>
      <td>${formatCurrency(cash.opening_balance)}</td>
      <td class="text-success">${formatCurrency(cash.total_cash_sales)}</td>
      <td class="text-danger">${formatCurrency(cash.total_expenses)}</td>
      <td>${formatCurrency(cash.expected_balance || 0)}</td>
      <td>${cash.closing_balance !== null ? formatCurrency(cash.closing_balance) : '-'}</td>
      <td>
        ${cash.difference !== null ? 
          `<span class="${cash.difference === 0 ? 'text-success' : 'text-danger'} font-weight-bold">${formatCurrency(cash.difference)}</span>` 
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

// ============================================
// OPEN CASH DRAWER MODAL
// ============================================

function openOpenCashModal() {
  document.getElementById('openCashForm').reset();
  document.getElementById('openCashError').style.display = 'none';
  document.getElementById('openCashModal').style.display = 'flex';

  // Pre-select shift if current time matches
  if (shiftsCache.length > 0) {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const matched = shiftsCache.find(s => hhmm >= s.start_time && hhmm < s.end_time);
    if (matched) {
      document.getElementById('openShiftSelect').value = matched.id;
    }
  }

  setTimeout(() => {
    document.getElementById('openShiftSelect').focus();
  }, 100);
}

function closeOpenCashModal() {
  document.getElementById('openCashModal').style.display = 'none';
}

async function handleOpenCash(e) {
  e.preventDefault();

  const shiftId = parseInt(document.getElementById('openShiftSelect').value) || null;
  const openingBalance = parseFloat(document.getElementById('openingBalance').value) || 0;
  const notes = document.getElementById('openCashNotes').value.trim();

  if (!shiftId) {
    showOpenCashError('Pilih shift terlebih dahulu');
    return;
  }

  if (openingBalance < 0) {
    showOpenCashError('Saldo awal tidak boleh negatif');
    return;
  }

  const selectedShift = shiftsCache.find(s => s.id === shiftId);
  const shiftLabel = selectedShift ? ` (${selectedShift.name})` : '';

  showConfirm(
    'Konfirmasi Buka Kas',
    `Yakin ingin membuka kas${shiftLabel} dengan saldo awal ${formatCurrency(openingBalance)}?`,
    async () => {
      await openCashDrawer({ shift_id: shiftId, opening_balance: openingBalance, notes });
    }
  );
}

async function openCashDrawer(data) {
  try {
    const result = await window.api.cashDrawer.open(data);

    if (result.success) {
      showToast('Kas berhasil dibuka! Anda siap untuk transaksi.', 'success');
      closeOpenCashModal();
      await checkCurrentCashDrawer();
      await loadMyCashHistory();
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

// ============================================
// CLOSE CASH DRAWER MODAL
// ============================================

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
  const displayDiv = document.getElementById('differenceDisplay');
  
  differenceEl.textContent = formatCurrency(difference);

  if (difference === 0) {
    differenceEl.className = 'text-success';
    displayDiv.style.backgroundColor = '#d5f4e6';
    displayDiv.style.borderColor = '#27ae60';
  } else if (difference > 0) {
    differenceEl.className = 'text-warning';
    displayDiv.style.backgroundColor = '#fff3cd';
    displayDiv.style.borderColor = '#f39c12';
  } else {
    differenceEl.className = 'text-danger';
    displayDiv.style.backgroundColor = '#fee';
    displayDiv.style.borderColor = '#e74c3c';
  }

  displayDiv.style.display = 'flex';
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

  const expected = currentCashDrawer.opening_balance + currentCashDrawer.total_cash_sales - currentCashDrawer.total_expenses;
  const difference = closingBalance - expected;

  let confirmMessage = `Yakin ingin menutup kas dengan saldo akhir ${formatCurrency(closingBalance)}?`;
  
  if (difference !== 0) {
    confirmMessage += `\n\nSelisih: ${formatCurrency(difference)}`;
    if (difference > 0) {
      confirmMessage += ' (Uang lebih)';
    } else {
      confirmMessage += ' (Uang kurang)';
    }
  }

  showConfirm(
    'Konfirmasi Tutup Kas',
    confirmMessage,
    async () => {
      await closeCashDrawer(cashDrawerId, { closing_balance: closingBalance, notes });
    }
  );
}

async function closeCashDrawer(cashDrawerId, data) {
  try {
    const result = await window.api.cashDrawer.close(cashDrawerId, data);

    if (result.success) {
      showToast('Kas berhasil ditutup!', 'success');
      closeCloseCashModal();
      await checkCurrentCashDrawer();
      await loadMyCashHistory();
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

// ============================================
// DETAIL CASH DRAWER
// ============================================

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

  // Use calculated values if available (more accurate)
  const totalCashSales = cashDrawer.calculated_cash_sales || cashDrawer.total_cash_sales;
  const totalExpenses = cashDrawer.calculated_expenses || cashDrawer.total_expenses;
  const expectedBalance = cashDrawer.opening_balance + totalCashSales - totalExpenses;

  container.innerHTML = `
    <div class="detail-section">
      <h3>Informasi Kas</h3>
      <div class="detail-grid">
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
          <strong>${cashDrawer.close_time ? formatTimeOnly(cashDrawer.close_time) : 'Belum ditutup'}</strong>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status:</span>
          <span class="badge ${cashDrawer.status === 'open' ? 'badge-success' : 'badge-secondary'}">
            ${cashDrawer.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
        ${cashDrawer.notes ? `
        <div class="detail-item detail-item-full">
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
        <div class="summary-box">
          <strong>Total Penjualan Cash: ${formatCurrency(totalCashSales)}</strong>
        </div>
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
        <div class="summary-box">
          <strong>Total Pengeluaran: ${formatCurrency(totalExpenses)}</strong>
        </div>
      ` : '<p class="text-center">Tidak ada pengeluaran</p>'}
    </div>

    <div class="detail-section">
      <h3>Ringkasan</h3>
      <div class="payment-detail">
        <div class="payment-row">
          <span>Saldo Awal:</span>
          <strong>${formatCurrency(cashDrawer.opening_balance)}</strong>
        </div>
        <div class="payment-row">
          <span>Total Penjualan Cash:</span>
          <strong class="text-success">+ ${formatCurrency(totalCashSales)}</strong>
        </div>
        <div class="payment-row">
          <span>Total Pengeluaran:</span>
          <strong class="text-danger">- ${formatCurrency(totalExpenses)}</strong>
        </div>
        <div class="payment-row total-row">
          <span>Expected Balance:</span>
          <strong>${formatCurrency(expectedBalance)}</strong>
        </div>
        ${cashDrawer.closing_balance !== null ? `
        <div class="payment-row">
          <span>Saldo Akhir Aktual:</span>
          <strong>${formatCurrency(cashDrawer.closing_balance)}</strong>
        </div>
        <div class="payment-row">
          <span>Selisih:</span>
          <strong class="${(cashDrawer.closing_balance - expectedBalance) === 0 ? 'text-success' : 'text-danger'}">
            ${formatCurrency(cashDrawer.closing_balance - expectedBalance)}
          </strong>
        </div>
        ${(cashDrawer.closing_balance - expectedBalance) === 0 ? 
          '<div class="success-box">✅ Kas pas, tidak ada selisih!</div>' : 
          (cashDrawer.closing_balance - expectedBalance) > 0 ?
            '<div class="warning-box">⚠️ Uang lebih dari expected</div>' :
            '<div class="error-box">❌ Uang kurang dari expected</div>'
        }
        ` : ''}
      </div>
    </div>
  `;
}

function closeDetailCashModal() {
  document.getElementById('detailCashModal').style.display = 'none';
}