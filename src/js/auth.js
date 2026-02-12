// Auth utility functions (used in login.html)

async function login(username, password) {
  try {
    const result = await window.api.auth.login(username, password);
    return result;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Terjadi kesalahan saat login' };
  }
}

async function logout() {
  try {
    await window.api.auth.logout();
    localStorage.removeItem('currentUser');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

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

function checkAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}