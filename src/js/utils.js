// ============================================
// GLOBAL UTILITIES & FUNCTIONS
// ============================================

// Get current user from localStorage
function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }
  return null;
}

// Display user info in navbar
function displayUserInfo(user) {
  const userNameElement = document.getElementById('userName');
  const userRoleElement = document.getElementById('userRole');

  if (userNameElement) {
    userNameElement.textContent = user.full_name;
  }

  if (userRoleElement) {
    userRoleElement.textContent = `(${user.role})`;
  }
}

// Setup logout button (unified for all pages)
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      showConfirm(
        'Konfirmasi Logout',
        'Apakah Anda yakin ingin logout?',
        async () => {
          try {
            // Clear localStorage first
            localStorage.clear();
            sessionStorage.clear();
            
            console.log('Storage cleared');

            // Call logout API
            await window.api.auth.logout();
            
            console.log('Logout successful');
            
          } catch (error) {
            console.error('Logout error:', error);
            
            // Force reload using IPC if available
            if (window.api && window.api.window) {
              window.api.window.loadLoginPage();
            } else {
              // Fallback
              window.location.href = 'login.html';
            }
          }
        }
      );
    });
  }
}

// ============================================
// CUSTOM TOAST NOTIFICATION
// ============================================

function showToast(message, type = 'info') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());

  // Create toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <p class="toast-message">${message}</p>
    </div>
    <button class="toast-close">×</button>
  `;

  document.body.appendChild(toast);

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto close after 3 seconds
  setTimeout(() => {
    removeToast(toast);
  }, 3000);
}

function removeToast(toast) {
  toast.classList.add('hiding');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// ============================================
// CUSTOM CONFIRM DIALOG
// ============================================

function showConfirm(title, message, onConfirm, onCancel = null) {
  // Remove existing confirms
  const existing = document.querySelectorAll('.confirm-overlay');
  existing.forEach(el => el.remove());

  // Create confirm overlay
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.style.display = 'flex';
  
  overlay.innerHTML = `
    <div class="confirm-dialog">
      <div class="confirm-header">
        <h3>${title}</h3>
      </div>
      <div class="confirm-body">
        <p class="confirm-message">${message}</p>
      </div>
      <div class="confirm-footer">
        <button class="btn btn-secondary confirm-cancel">Batal</button>
        <button class="btn btn-primary confirm-ok">Ya</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Focus on OK button
  setTimeout(() => {
    overlay.querySelector('.confirm-ok').focus();
  }, 100);

  // Handle buttons
  overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });

  overlay.querySelector('.confirm-ok').addEventListener('click', () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCancel) onCancel();
    }
  });

  // ESC key to close
  const handleEsc = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', handleEsc);
    }
  };
  document.addEventListener('keydown', handleEsc);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// PRODUCT & FINANCE HELPER FUNCTIONS
// ============================================

// Generate barcode dengan timestamp
function generateBarcode() {
  const timestamp = Date.now();
  return `PROD-${timestamp}`;
}

// Calculate margin percentage
function calculateMargin(purchasePrice, sellingPrice) {
  if (!purchasePrice || purchasePrice === 0) return 0;
  const margin = ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  return Math.round(margin * 100) / 100; // 2 decimal places
}


// ============================================
// TRANSACTION HELPER FUNCTIONS
// ============================================

// Generate transaction code: TRX-YYYYMMDD-0001
function generateTransactionCode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = now.getTime();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `TRX-${year}${month}${day}-${random}`;
}

// Get today date range for filters
function getTodayRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  return {
    startDate: `${year}-${month}-${day}`,
    endDate: `${year}-${month}-${day}`
  };
}

// Format date for display
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  return date.toLocaleString('id-ID', options);
}


function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleDateString('id-ID', options);
}

// Format date only
function formatDateOnly(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

// Format time only
function formatTimeOnly(dateString) {
  const date = new Date(dateString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Format Rupiah (alias for formatCurrency)
function formatRupiah(amount) {
  return formatCurrency(amount);
}

// Format currency to IDR
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Parse currency string to number
function parseCurrency(currencyString) {
  if (typeof currencyString === 'number') return currencyString;
  return parseFloat(currencyString.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
}

// Format number with thousand separator
function formatNumber(number) {
  return new Intl.NumberFormat('id-ID').format(number);
}

// ============================================
// FINANCE HELPER FUNCTIONS
// ============================================

// Generate purchase code: PO-YYYYMMDD-0001
function generatePurchaseCode() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `PO-${year}${month}${day}-${random}`;
}

// Get current month range
function getCurrentMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const startDate = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
  const endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  
  return { startDate, endDate };
}

// Get last N days range
function getLastNDaysRange(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  
  return { startDate: start, endDate: end };
}

// Format percentage
function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

// Calculate percentage change
function calculatePercentageChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Get payment status label
function getPaymentStatusLabel(status) {
  const labels = {
    'paid': 'Lunas',
    'unpaid': 'Belum Bayar',
    'partial': 'Bayar Sebagian'
  };
  return labels[status] || status;
}

// Get payment status class
function getPaymentStatusClass(status) {
  const classes = {
    'paid': 'badge-success',
    'unpaid': 'badge-danger',
    'partial': 'badge-warning'
  };
  return classes[status] || 'badge-secondary';
}

// Get expense categories
function getExpenseCategories() {
  return [
    'Operasional',
    'Gaji Karyawan',
    'Listrik',
    'Air',
    'Sewa Toko',
    'Transport',
    'Lainnya'
  ];
}