// Dashboard initialization and functionality

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');

  // Check if user is authenticated
  const user = getCurrentUser();
  if (!user) {
    console.log('No user found, redirecting to login');
    window.location.href = 'login.html';
    return;
  }

  console.log('Current user:', user);

  // Display user info
  displayUserInfo(user);

  // Setup logout button
  setupLogoutButton();

  // Hide menu Pengguna untuk role kasir
  if (user.role === 'kasir') {
    const menuPengguna = document.getElementById('menuPengguna');
    if (menuPengguna) {
      menuPengguna.style.display = 'none';
    }
  }
});