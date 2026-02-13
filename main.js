const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const bcrypt = require('bcryptjs');

let mainWindow;
let currentUser = null;

// Import database functions
const dbModule = require('./database/db');
const { initDatabase } = require('./database/init');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src/views/login.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize database when app is ready
app.whenReady().then(async () => {
  console.log('Initializing database...');
  
  try {
    await dbModule.initDb();
    await initDatabase();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler: Load login page
ipcMain.on('load-login-page', (event) => {
  console.log('Reloading login page...');
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'src/views/login.html'));
    
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('Login page loaded, focusing window...');
      mainWindow.focus();
      mainWindow.show();
      
      setTimeout(() => {
        mainWindow.blur();
        setTimeout(() => {
          mainWindow.focus();
        }, 50);
      }, 100);
    });
  }
});

// ============================================
// AUTHENTICATION IPC HANDLERS
// ============================================

ipcMain.handle('auth:login', async (event, username, password) => {
  try {
    console.log('Login attempt for username:', username);

    const user = dbModule.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);

    if (!user) {
      console.log('User not found or inactive');
      return { success: false, message: 'Username atau password salah' };
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log('Invalid password');
      return { success: false, message: 'Username atau password salah' };
    }

    delete user.password;
    currentUser = user;

    console.log('Login successful for user:', user.username);
    return { success: true, user: currentUser };

  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Terjadi kesalahan saat login' };
  }
});

ipcMain.handle('auth:logout', async (event) => {
  try {
    console.log('Logout user:', currentUser?.username);
    currentUser = null;
    
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'src/views/login.html'));
      
      mainWindow.webContents.once('did-finish-load', () => {
        console.log('Login page loaded after logout, focusing window...');
        
        mainWindow.focus();
        mainWindow.show();
        
        setTimeout(() => {
          mainWindow.blur();
          setTimeout(() => {
            mainWindow.focus();
            console.log('Window focused and ready for input');
          }, 50);
        }, 100);
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, message: 'Terjadi kesalahan saat logout' };
  }
});

ipcMain.handle('auth:getCurrentUser', async (event) => {
  return currentUser;
});

// ============================================
// USERS MANAGEMENT IPC HANDLERS
// ============================================

// Get all users
ipcMain.handle('users:getAll', async (event) => {
  try {
    const users = dbModule.all(
      'SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    
    return { success: true, users };
  } catch (error) {
    console.error('Get all users error:', error);
    return { success: false, message: 'Gagal memuat data user' };
  }
});

// Get user by ID
ipcMain.handle('users:getById', async (event, id) => {
  try {
    const user = dbModule.get(
      'SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?',
      [id]
    );
    
    if (!user) {
      return { success: false, message: 'User tidak ditemukan' };
    }
    
    return { success: true, user };
  } catch (error) {
    console.error('Get user by ID error:', error);
    return { success: false, message: 'Gagal memuat data user' };
  }
});

// Create new user
ipcMain.handle('users:create', async (event, userData) => {
  try {
    console.log('Creating new user:', userData.username);

    // Check if username already exists
    const existingUser = dbModule.get('SELECT id FROM users WHERE username = ?', [userData.username]);
    
    if (existingUser) {
      return { success: false, message: 'Username sudah digunakan' };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Insert user
    const result = dbModule.run(
      `INSERT INTO users (username, password, full_name, role, is_active) 
       VALUES (?, ?, ?, ?, 1)`,
      [userData.username, hashedPassword, userData.full_name, userData.role]
    );

    console.log('User created successfully:', userData.username);
    return { success: true, userId: result.lastInsertRowid };

  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, message: 'Gagal menambahkan user' };
  }
});

// Update user
ipcMain.handle('users:update', async (event, id, userData) => {
  try {
    console.log('Updating user:', id);

    // Check if username already exists (except current user)
    const existingUser = dbModule.get(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [userData.username, id]
    );
    
    if (existingUser) {
      return { success: false, message: 'Username sudah digunakan' };
    }

    // Update user
    if (userData.password) {
      // Update with new password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      dbModule.run(
        `UPDATE users 
         SET username = ?, password = ?, full_name = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userData.username, hashedPassword, userData.full_name, userData.role, id]
      );
    } else {
      // Update without changing password
      dbModule.run(
        `UPDATE users 
         SET username = ?, full_name = ?, role = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [userData.username, userData.full_name, userData.role, id]
      );
    }

    console.log('User updated successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, message: 'Gagal mengupdate user' };
  }
});

// Delete user
ipcMain.handle('users:delete', async (event, id) => {
  try {
    console.log('Deleting user:', id);

    // Don't allow deleting current user
    if (currentUser && currentUser.id === id) {
      return { success: false, message: 'Tidak dapat menghapus akun yang sedang login' };
    }

    dbModule.run('DELETE FROM users WHERE id = ?', [id]);

    console.log('User deleted successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, message: 'Gagal menghapus user' };
  }
});

// Toggle user status
ipcMain.handle('users:toggleStatus', async (event, id) => {
  try {
    console.log('Toggling user status:', id);

    // Don't allow toggling own status
    if (currentUser && currentUser.id === id) {
      return { success: false, message: 'Tidak dapat mengubah status akun sendiri' };
    }

    dbModule.run(
      `UPDATE users 
       SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    console.log('User status toggled successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Toggle user status error:', error);
    return { success: false, message: 'Gagal mengubah status user' };
  }
});