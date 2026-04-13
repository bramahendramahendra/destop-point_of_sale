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