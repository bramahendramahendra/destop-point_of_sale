// ============================================
// NOTIFICATION / TOAST UTILITY
// src/js/notification.js
// ============================================

(function () {
  // Inject container once
  function getContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    return container;
  }

  const ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const COLORS = {
    success: { bg: '#2ecc71', border: '#27ae60', text: '#fff' },
    error:   { bg: '#e74c3c', border: '#c0392b', text: '#fff' },
    warning: { bg: '#f39c12', border: '#d68910', text: '#fff' },
    info:    { bg: '#3498db', border: '#2980b9', text: '#fff' }
  };

  /**
   * Show a toast notification
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration  ms, default 3500
   */
  function showToast(message, type = 'info', duration = 3500) {
    const container = getContainer();
    const color = COLORS[type] || COLORS.info;
    const icon = ICONS[type] || ICONS.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      background: ${color.bg};
      border-left: 5px solid ${color.border};
      color: ${color.text};
      padding: 12px 16px;
      border-radius: 8px;
      min-width: 280px;
      max-width: 380px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      font-size: 14px;
      font-family: inherit;
      pointer-events: all;
      cursor: pointer;
      opacity: 0;
      transform: translateX(40px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-body">${escapeHtmlToast(message)}</span>
      <span class="toast-close">✕</span>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      });
    });

    // Dismiss
    const dismiss = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 320);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    const timer = setTimeout(dismiss, duration);
    toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
  }

  function escapeHtmlToast(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Expose globally
  window.Notification = window.Notification || {};
  window.showToast = showToast;
  window.Toast = {
    success: (msg, duration) => showToast(msg, 'success', duration),
    error:   (msg, duration) => showToast(msg, 'error',   duration),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    info:    (msg, duration) => showToast(msg, 'info',    duration)
  };
})();

// ============================================
// STOCK ALERT MODULE
// ============================================

(function () {
  function getOrCreateModal() {
    let modal = document.getElementById('stockAlertModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'stockAlertModal';
    modal.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 99998;
      align-items: center;
      justify-content: center;
    `;
    modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 12px;
        width: 680px;
        max-width: 95vw;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        font-family: inherit;
      ">
        <div style="
          padding: 20px 24px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #fff3cd;
          border-radius: 12px 12px 0 0;
        ">
          <h3 style="margin:0; color:#856404; font-size:16px;">⚠️ Peringatan Stok Menipis</h3>
          <button id="closeStockAlertModal" style="
            background: none; border: none; cursor: pointer;
            font-size: 20px; color: #856404; line-height: 1; padding: 0 4px;
          ">✕</button>
        </div>
        <div style="padding: 16px 24px; overflow-y: auto; flex: 1;">
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px 12px; text-align:left; border-bottom: 2px solid #dee2e6; color:#495057;">Produk</th>
                <th style="padding: 10px 12px; text-align:left; border-bottom: 2px solid #dee2e6; color:#495057;">Kategori</th>
                <th style="padding: 10px 12px; text-align:center; border-bottom: 2px solid #dee2e6; color:#495057;">Stok Saat Ini</th>
                <th style="padding: 10px 12px; text-align:center; border-bottom: 2px solid #dee2e6; color:#495057;">Stok Minimum</th>
                <th style="padding: 10px 12px; text-align:center; border-bottom: 2px solid #dee2e6; color:#495057;">Status</th>
              </tr>
            </thead>
            <tbody id="stockAlertTableBody"></tbody>
          </table>
        </div>
        <div style="
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        ">
          <button id="btnStockAlertToProducts" style="
            background: #e67e22; color: #fff;
            border: none; border-radius: 6px;
            padding: 9px 20px; cursor: pointer;
            font-size: 14px; font-family: inherit;
          ">📦 Buka Halaman Produk</button>
          <button id="btnStockAlertClose" style="
            background: #6c757d; color: #fff;
            border: none; border-radius: 6px;
            padding: 9px 20px; cursor: pointer;
            font-size: 14px; font-family: inherit;
          ">Tutup</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('closeStockAlertModal').addEventListener('click', hideStockModal);
    document.getElementById('btnStockAlertClose').addEventListener('click', hideStockModal);
    document.getElementById('btnStockAlertToProducts').addEventListener('click', () => {
      window.location.href = 'products.html';
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) hideStockModal(); });

    return modal;
  }

  function hideStockModal() {
    const modal = document.getElementById('stockAlertModal');
    if (modal) modal.style.display = 'none';
  }

  function showStockModal(products) {
    const modal = getOrCreateModal();
    const tbody = document.getElementById('stockAlertTableBody');

    tbody.innerHTML = products.map(p => {
      const isEmpty = p.status === 'empty';
      const badgeStyle = isEmpty
        ? 'background:#e74c3c; color:#fff; padding:2px 10px; border-radius:12px; font-size:12px;'
        : 'background:#f39c12; color:#fff; padding:2px 10px; border-radius:12px; font-size:12px;';
      const statusText = isEmpty ? 'Habis' : 'Menipis';
      const stockColor = isEmpty ? '#e74c3c' : '#e67e22';

      return `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 10px 12px;">${escapeHtmlSA(p.name)}</td>
          <td style="padding: 10px 12px; color:#666;">${escapeHtmlSA(p.category_name || '-')}</td>
          <td style="padding: 10px 12px; text-align:center; font-weight:700; color:${stockColor};">${p.stock} ${escapeHtmlSA(p.unit)}</td>
          <td style="padding: 10px 12px; text-align:center; color:#666;">${p.min_stock} ${escapeHtmlSA(p.unit)}</td>
          <td style="padding: 10px 12px; text-align:center;"><span style="${badgeStyle}">${statusText}</span></td>
        </tr>
      `;
    }).join('');

    modal.style.display = 'flex';
  }

  function escapeHtmlSA(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function checkAndShowStockAlert(options = {}) {
    const { showToastOnly = false, afterTransaction = false } = options;

    if (!window.api?.products?.getLowStock) return;

    // Check setting
    try {
      const settingRes = await window.api.settings.get('stock_notification_enabled');
      if (settingRes.success && settingRes.value === '0') return;
    } catch (e) { /* default = enabled */ }

    try {
      const res = await window.api.products.getLowStock();
      if (!res.success || !res.products.length) return;

      const products = res.products;
      const emptyCount = products.filter(p => p.status === 'empty').length;
      const lowCount = products.filter(p => p.status === 'low').length;

      let message = '';
      if (emptyCount > 0 && lowCount > 0) {
        message = `${emptyCount} produk habis & ${lowCount} produk menipis`;
      } else if (emptyCount > 0) {
        message = `${emptyCount} produk stok habis`;
      } else {
        message = `${lowCount} produk stok menipis`;
      }

      // Show persistent warning toast with "Lihat Detail" link
      const container = (function () {
        let c = document.getElementById('toast-container');
        if (!c) {
          c = document.createElement('div');
          c.id = 'toast-container';
          c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
          document.body.appendChild(c);
        }
        return c;
      })();

      const toast = document.createElement('div');
      toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        background: #f39c12;
        border-left: 5px solid #d68910;
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        min-width: 300px;
        max-width: 420px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        font-size: 14px;
        font-family: inherit;
        pointer-events: all;
        opacity: 0;
        transform: translateX(40px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      toast.innerHTML = `
        <span style="font-size:18px;">⚠️</span>
        <div style="flex:1;">
          <div style="font-weight:600; margin-bottom:4px;">Peringatan Stok</div>
          <div style="font-size:13px; opacity:0.95;">${message}</div>
        </div>
        <button id="btnToastStockDetail" style="
          background: rgba(255,255,255,0.25);
          border: 1px solid rgba(255,255,255,0.5);
          color: #fff; border-radius: 5px;
          padding: 5px 10px; cursor: pointer;
          font-size: 12px; font-family: inherit;
          white-space: nowrap;
        ">Lihat Detail</button>
        <span style="cursor:pointer; opacity:0.8; margin-left:4px;" id="btnToastStockClose">✕</span>
      `;

      container.appendChild(toast);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      }));

      const dismiss = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 320);
      };

      toast.querySelector('#btnToastStockClose').addEventListener('click', dismiss);
      toast.querySelector('#btnToastStockDetail').addEventListener('click', () => {
        dismiss();
        showStockModal(products);
      });

      // Auto-dismiss after 8s
      setTimeout(dismiss, 8000);

    } catch (e) {
      console.error('checkAndShowStockAlert error:', e);
    }
  }

  window.StockAlert = {
    check: checkAndShowStockAlert,
    showModal: showStockModal,
    hideModal: hideStockModal
  };
})();