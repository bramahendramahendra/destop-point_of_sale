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
});

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

function displayUserInfo(user) {
  // Update navbar user info
  const userNameElement = document.getElementById('userName');
  const userRoleElement = document.getElementById('userRole');
  const welcomeNameElement = document.getElementById('welcomeName');

  if (userNameElement) {
    userNameElement.textContent = user.full_name;
  }

  if (userRoleElement) {
    userRoleElement.textContent = `(${user.role})`;
  }

  if (welcomeNameElement) {
    welcomeNameElement.textContent = user.full_name;
  }

  console.log('User info displayed:', user.full_name);
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Logout button clicked');

      if (confirm('Apakah Anda yakin ingin logout?')) {
        try {
          // Clear localStorage first
          localStorage.clear();
          sessionStorage.clear();
          
          console.log('Storage cleared');

          // Call logout API (main process akan reload login page dan focus window)
          await window.api.auth.logout();
          
          console.log('Logout successful');
          
        } catch (error) {
          console.error('Logout error:', error);
          
          // Fallback jika error
          localStorage.clear();
          sessionStorage.clear();
          
          // Try to use IPC to reload
          if (window.api && window.api.window) {
            window.api.window.loadLoginPage();
          } else {
            // Last resort fallback
            window.location.href = 'login.html';
          }
        }
      }
    });
  }
}