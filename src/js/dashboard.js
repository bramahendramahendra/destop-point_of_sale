// ============================================
// DASHBOARD PAGE JAVASCRIPT
// src/js/dashboard.js
// ============================================

'use strict';

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

  // Stok menipis card click → ke laporan stok
  document.getElementById('statLowStockCard')?.addEventListener('click', () => {
    if (user && (user.role === 'owner' || user.role === 'admin')) {
      window.location.href = 'reports.html';
    }
  });

  // Global keyboard shortcuts listener (dari main process)
  setupKeyboardShortcuts();
});

// ============================================
// LOAD STATS
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

    // Low stock: gabung menipis + habis
    const lowTotal = (s.low_stock || 0) + (s.empty_stock || 0);
    setStatValue('statLowStock', lowTotal.toLocaleString('id-ID'));

    // Update label & warna
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
// KEYBOARD SHORTCUTS
// ============================================

function setupKeyboardShortcuts() {
  if (!window.api?.window) return;

  // Listen for IPC messages from main process
  // Electron ipcRenderer.on via contextBridge — kita pakai custom event trick
  // Shortcuts dikirim via webContents.send dari main.js

  // Tambahkan listener via preload onShortcut jika tersedia
  if (window.api.shortcuts) {
    window.api.shortcuts.onNavigate((channel) => {
      handleShortcutNavigation(channel);
    });
  }
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

  // Role check untuk halaman restricted
  if (['reports.html', 'settings.html', 'users.html', 'finance.html'].includes(target)) {
    if (user && user.role === 'kasir') return;
  }

  window.location.href = target;
}