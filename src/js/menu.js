// ============================================
// DYNAMIC MENU COMPONENT
// ============================================

function renderMenu(activePage) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Define all menu items
  const menuItems = [
    {
      id: 'dashboard',
      icon: '📊',
      text: 'Dashboard',
      href: 'dashboard.html',
      roles: ['owner', 'admin', 'kasir']
    },
    {
      id: 'kasir',
      icon: '🛒',
      text: 'Kasir',
      href: 'kasir.html',
      roles: ['owner', 'admin', 'kasir']
    },
    {
      id: 'products',
      icon: '📦',
      text: 'Produk',
      href: 'products.html',
      roles: ['owner', 'admin', 'kasir']
    },
    {
      id: 'transaksi',
      icon: '💳',
      text: 'Transaksi',
      href: 'transactions.html',
      roles: ['owner', 'admin', 'kasir']
    },
    {
      id: 'my-cash',
      icon: '💰',
      text: 'Kas Saya',
      href: 'my-cash.html',
      roles: ['kasir']
    },
    {
      id: 'keuangan',
      icon: '💰',
      text: 'Keuangan',
      href: 'finance.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'piutang',
      icon: '📋',
      text: 'Piutang',
      href: 'receivables.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'supplier',
      icon: '🏭',
      text: 'Supplier',
      href: 'suppliers.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'laporan',
      icon: '📈',
      text: 'Laporan',
      href: 'reports.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'shifts',
      icon: '🕐',
      text: 'Manajemen Shift',
      href: 'shifts.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'pengaturan',
      icon: '⚙️',
      text: 'Pengaturan',
      href: 'settings.html',
      roles: ['owner', 'admin']
    },
    {
      id: 'pengguna',
      icon: '👥',
      text: 'Pengguna',
      href: 'users.html',
      roles: ['owner', 'admin']
    }
  ];

  // Filter menu by user role
  const allowedMenuItems = menuItems.filter(item => 
    item.roles.includes(currentUser.role)
  );

  // Generate menu HTML
  const menuHTML = `
    <ul class="sidebar-menu">
      ${allowedMenuItems.map(item => `
        <li class="menu-item ${item.id === activePage ? 'active' : ''} ${item.disabled ? 'disabled' : ''}">
          <a href="${item.href}">
            <span class="menu-icon">${item.icon}</span>
            <span class="menu-text">${item.text}</span>
            ${item.id === 'products' ? '<span class="menu-badge" id="menuStockBadge" style="display:none">0</span>' : ''}
          </a>
        </li>
      `).join('')}
    </ul>
  `;

  sidebar.innerHTML = menuHTML;

  // Update stock badge async
  updateMenuStockBadge();
}

async function updateMenuStockBadge() {
  const badge = document.getElementById('menuStockBadge');
  if (!badge || !window.api?.products?.getLowStock) return;

  try {
    const res = await window.api.products.getLowStock();
    if (!res.success) return;
    const count = res.products.length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    // silently ignore
  }
}

// ============================================
// RENDER NAVBAR
// ============================================

function renderNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const navbarHTML = `
    <div class="navbar-brand">
      <h2>POS Retail</h2>
    </div>
    <div class="navbar-user">
      <span class="user-info">
        <strong id="userName">${escapeHtml(currentUser.full_name)}</strong>
        <span class="user-role" id="userRole">(${currentUser.role})</span>
      </span>
      <button class="btn btn-danger btn-sm" id="logoutBtn">Logout</button>
    </div>
  `;

  navbar.innerHTML = navbarHTML;

  // Setup logout button after rendering
  setupLogoutButton();
}

// ============================================
// INITIALIZE PAGE LAYOUT
// ============================================

function initializePageLayout(activePage) {
  // Check authentication
  const user = getCurrentUser();
  if (!user) {
    console.log('No user found, redirecting to login');
    window.location.href = 'login.html';
    return false;
  }

  console.log('Current user:', user);

  // Render navbar and menu
  renderNavbar();
  renderMenu(activePage);

  // Global shortcut: Ctrl+L = Logout
  if (window.api?.shortcuts) {
    window.api.shortcuts.onNavigate((channel) => {
      if (channel === 'shortcut:logout') {
        setupLogoutButton(); // trigger existing logout
        document.getElementById('logoutBtn')?.click();
        return;
      }
      // Navigate
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
      if (target) window.location.href = target;
    });
  }

  return true;
}