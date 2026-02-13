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

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
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

// Format currency to IDR
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Format number with thousand separator
function formatNumber(number) {
  return new Intl.NumberFormat('id-ID').format(number);
}