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
      id: 'keuangan',
      icon: '💰',
      text: 'Keuangan',
      href: '#keuangan',
      roles: ['owner', 'admin'],
      disabled: true
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
          </a>
        </li>
      `).join('')}
    </ul>
  `;

  sidebar.innerHTML = menuHTML;
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

  return true;
}