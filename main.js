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

// IPC Handlers for Authentication
ipcMain.handle('auth:login', async (event, username, password) => {
  try {
    console.log('Login attempt for username:', username);

    // Get user from database
    const user = dbModule.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);

    if (!user) {
      console.log('User not found or inactive');
      return { success: false, message: 'Username atau password salah' };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log('Invalid password');
      return { success: false, message: 'Username atau password salah' };
    }

    // Remove password from user object
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
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, message: 'Terjadi kesalahan saat logout' };
  }
});

ipcMain.handle('auth:getCurrentUser', async (event) => {
  return currentUser;
});