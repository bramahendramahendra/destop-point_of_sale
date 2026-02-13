// Dashboard initialization and functionality

document.addEventListener('DOMContentLoaded', () => {
  console.log('Dashboard loaded');

  // Initialize page layout (navbar + menu)
  if (!initializePageLayout('dashboard')) {
    return;
  }

  // Update welcome name
  const user = getCurrentUser();
  const welcomeNameElement = document.getElementById('welcomeName');
  if (welcomeNameElement && user) {
    welcomeNameElement.textContent = user.full_name;
  }
});