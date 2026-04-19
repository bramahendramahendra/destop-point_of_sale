const { app, BrowserWindow, ipcMain, globalShortcut, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let mainWindow;
let currentUser = null;
let pendingLabelPrintData = null;

// Import database functions
const dbModule = require('./database/db');
const { initDatabase } = require('./database/init');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'src/views/login.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Build application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Backup Database',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:backup');
          }
        },
        {
          label: 'Restore Database',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu:restore');
          }
        },
        { type: 'separator' },
        {
          label: 'Keluar',
          accelerator: 'CmdOrCtrl+Q',
          click: () => { app.quit(); }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Tentang Aplikasi',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Tentang POS Retail',
              message: 'POS Retail v1.0.0',
              detail: 'Aplikasi Point of Sale Desktop\nDibangun dengan Electron + SQLite\n\nLogin Default:\nUsername: admin\nPassword: admin123'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

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

  // Register global keyboard shortcuts
  app.on('browser-window-focus', () => {
    // Navigation shortcuts — kirim ke renderer
    const shortcuts = [
      { key: 'CmdOrCtrl+N', channel: 'shortcut:kasir' },
      { key: 'CmdOrCtrl+P', channel: 'shortcut:products' },
      { key: 'CmdOrCtrl+T', channel: 'shortcut:transactions' },
      { key: 'CmdOrCtrl+F', channel: 'shortcut:finance' },
      { key: 'CmdOrCtrl+Shift+R', channel: 'shortcut:reports' },
      { key: 'CmdOrCtrl+U', channel: 'shortcut:users' },
      { key: 'CmdOrCtrl+Shift+S', channel: 'shortcut:settings' },
      { key: 'CmdOrCtrl+L', channel: 'shortcut:logout' },
      { key: 'CmdOrCtrl+Shift+L', channel: 'pinlock:lock' }
    ];

    shortcuts.forEach(({ key, channel }) => {
      globalShortcut.register(key, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(channel);
        }
      });
    });
  });

  app.on('browser-window-blur', () => {
    globalShortcut.unregisterAll();
  });

  // Auto backup on startup
  try {
    await runAutoBackupIfNeeded();
  } catch (err) {
    console.error('Auto backup error:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// AUTO BACKUP HELPER
// ============================================

async function runAutoBackupIfNeeded() {
  try {
    const autoBackupSetting = dbModule.get("SELECT value FROM settings WHERE key = 'auto_backup'");
    if (!autoBackupSetting || autoBackupSetting.value !== '1') return;

    const backupDaysSetting = dbModule.get("SELECT value FROM settings WHERE key = 'backup_days'");
    const daysToKeep = parseInt(backupDaysSetting?.value || '7', 10);

    const userDataPath = app.getPath('userData');
    const backupDir = path.join(userDataPath, 'backups');

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Check if backup already done today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todayBackupExists = fs.readdirSync(backupDir)
      .some(f => f.startsWith(`backup_${today}`));

    if (todayBackupExists) {
      console.log('Auto backup already done today, skipping');
      return;
    }

    // Create backup
    const dbPath = path.join(__dirname, 'pos-retail.db');
    if (!fs.existsSync(dbPath)) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFilename = `backup_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFilename);

    fs.copyFileSync(dbPath, backupPath);
    console.log(`Auto backup created: ${backupFilename}`);

    // Clean old backups
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
      }))
      .sort((a, b) => a.time - b.time);

    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    files.forEach(file => {
      if (file.time < cutoff) {
        fs.unlinkSync(path.join(backupDir, file.name));
        console.log(`Deleted old backup: ${file.name}`);
      }
    });

  } catch (err) {
    console.error('runAutoBackupIfNeeded error:', err);
  }
}

// IPC Handler: Load login page
ipcMain.on('load-login-page', (event) => {
  console.log('Reloading login page...');
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'src/views/login.html'));
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
    
    // Reload login page from main process
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'src/views/login.html'));
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
// PIN LOCK IPC HANDLERS
// ============================================

ipcMain.handle('pinlock:hasPin', async (event, userId) => {
  try {
    const user = dbModule.get('SELECT pin_hash FROM users WHERE id = ?', [userId]);
    return { success: true, hasPin: !!(user && user.pin_hash) };
  } catch (error) {
    console.error('pinlock:hasPin error:', error);
    return { success: false, hasPin: false };
  }
});

ipcMain.handle('pinlock:setPin', async (event, userId, pin) => {
  try {
    const pinHash = await bcrypt.hash(pin, 10);
    dbModule.run('UPDATE users SET pin_hash = ? WHERE id = ?', [pinHash, userId]);
    dbModule.saveDb();
    return { success: true };
  } catch (error) {
    console.error('pinlock:setPin error:', error);
    return { success: false, message: 'Gagal menyimpan PIN' };
  }
});

ipcMain.handle('pinlock:verifyPin', async (event, userId, pin) => {
  try {
    const user = dbModule.get('SELECT pin_hash FROM users WHERE id = ?', [userId]);
    if (!user || !user.pin_hash) {
      return { success: false, message: 'PIN belum diset' };
    }
    const valid = await bcrypt.compare(pin, user.pin_hash);
    return { success: valid, message: valid ? 'OK' : 'PIN salah' };
  } catch (error) {
    console.error('pinlock:verifyPin error:', error);
    return { success: false, message: 'Terjadi kesalahan' };
  }
});

ipcMain.handle('pinlock:changePin', async (event, userId, oldPin, newPin) => {
  try {
    const user = dbModule.get('SELECT pin_hash FROM users WHERE id = ?', [userId]);
    if (!user || !user.pin_hash) {
      return { success: false, message: 'PIN lama tidak ditemukan' };
    }
    const valid = await bcrypt.compare(oldPin, user.pin_hash);
    if (!valid) {
      return { success: false, message: 'PIN lama salah' };
    }
    const newHash = await bcrypt.hash(newPin, 10);
    dbModule.run('UPDATE users SET pin_hash = ? WHERE id = ?', [newHash, userId]);
    dbModule.saveDb();
    return { success: true };
  } catch (error) {
    console.error('pinlock:changePin error:', error);
    return { success: false, message: 'Gagal mengubah PIN' };
  }
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

// ============================================
// CATEGORIES MANAGEMENT IPC HANDLERS
// ============================================

// Get all categories
ipcMain.handle('categories:getAll', async (event) => {
  try {
    const categories = dbModule.all(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
      FROM categories c 
      ORDER BY c.name
    `);
    
    return { success: true, categories };
  } catch (error) {
    console.error('Get all categories error:', error);
    return { success: false, message: 'Gagal memuat data kategori' };
  }
});

// Get category by ID
ipcMain.handle('categories:getById', async (event, id) => {
  try {
    const category = dbModule.get('SELECT * FROM categories WHERE id = ?', [id]);
    
    if (!category) {
      return { success: false, message: 'Kategori tidak ditemukan' };
    }
    
    return { success: true, category };
  } catch (error) {
    console.error('Get category by ID error:', error);
    return { success: false, message: 'Gagal memuat data kategori' };
  }
});

// Create new category
ipcMain.handle('categories:create', async (event, categoryData) => {
  try {
    console.log('Creating new category:', categoryData.name);

    const result = dbModule.run(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [categoryData.name, categoryData.description || null]
    );

    console.log('Category created successfully:', categoryData.name);
    return { success: true, categoryId: result.lastInsertRowid };

  } catch (error) {
    console.error('Create category error:', error);
    return { success: false, message: 'Gagal menambahkan kategori' };
  }
});

// Update category
ipcMain.handle('categories:update', async (event, id, categoryData) => {
  try {
    console.log('Updating category:', id);

    dbModule.run(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [categoryData.name, categoryData.description || null, id]
    );

    console.log('Category updated successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Update category error:', error);
    return { success: false, message: 'Gagal mengupdate kategori' };
  }
});

// Delete category
ipcMain.handle('categories:delete', async (event, id) => {
  try {
    console.log('Deleting category:', id);

    // Check if category has products
    const productCount = dbModule.get(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );

    if (productCount.count > 0) {
      return { 
        success: false, 
        message: `Tidak dapat menghapus kategori. Masih ada ${productCount.count} produk dalam kategori ini.` 
      };
    }

    dbModule.run('DELETE FROM categories WHERE id = ?', [id]);

    console.log('Category deleted successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Delete category error:', error);
    return { success: false, message: 'Gagal menghapus kategori' };
  }
});

// ============================================
// PRODUCTS MANAGEMENT IPC HANDLERS
// ============================================

// Get all products with category name
ipcMain.handle('products:getAll', async (event) => {
  try {
    const products = dbModule.all(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.name
    `);
    
    return { success: true, products };
  } catch (error) {
    console.error('Get all products error:', error);
    return { success: false, message: 'Gagal memuat data produk' };
  }
});

// Get product by ID
ipcMain.handle('products:getById', async (event, id) => {
  try {
    const product = dbModule.get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [id]);
    
    if (!product) {
      return { success: false, message: 'Produk tidak ditemukan' };
    }
    
    return { success: true, product };
  } catch (error) {
    console.error('Get product by ID error:', error);
    return { success: false, message: 'Gagal memuat data produk' };
  }
});

// Get product by barcode
ipcMain.handle('products:getByBarcode', async (event, barcode) => {
  try {
    const product = dbModule.get(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.barcode = ?
    `, [barcode]);
    
    return { success: true, product: product || null };
  } catch (error) {
    console.error('Get product by barcode error:', error);
    return { success: false, message: 'Gagal memuat data produk' };
  }
});

// Create new product
ipcMain.handle('products:create', async (event, productData) => {
  try {
    console.log('Creating new product:', productData.name);

    // Check if barcode already exists
    const existingProduct = dbModule.get('SELECT id FROM products WHERE barcode = ?', [productData.barcode]);
    
    if (existingProduct) {
      return { success: false, message: 'Barcode sudah digunakan' };
    }

    dbModule.run(
      `INSERT INTO products (barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        productData.barcode,
        productData.name,
        productData.category_id || null,
        productData.purchase_price,
        productData.selling_price,
        productData.stock || 0,
        productData.min_stock || 5,
        productData.unit || 'pcs'
      ]
    );

    const inserted = dbModule.get('SELECT id FROM products WHERE barcode = ?', [productData.barcode]);
    console.log('Product created successfully:', productData.name);
    return { success: true, productId: inserted ? inserted.id : null };

  } catch (error) {
    console.error('Create product error:', error);
    return { success: false, message: 'Gagal menambahkan produk' };
  }
});

// Update product
ipcMain.handle('products:update', async (event, id, productData) => {
  try {
    console.log('Updating product:', id);

    // Check if barcode already exists (except current product)
    const existingProduct = dbModule.get(
      'SELECT id FROM products WHERE barcode = ? AND id != ?',
      [productData.barcode, id]
    );
    
    if (existingProduct) {
      return { success: false, message: 'Barcode sudah digunakan' };
    }

    dbModule.run(
      `UPDATE products 
       SET barcode = ?, name = ?, category_id = ?, purchase_price = ?, selling_price = ?, 
           stock = ?, min_stock = ?, unit = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        productData.barcode,
        productData.name,
        productData.category_id || null,
        productData.purchase_price,
        productData.selling_price,
        productData.stock,
        productData.min_stock,
        productData.unit,
        id
      ]
    );

    console.log('Product updated successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Update product error:', error);
    return { success: false, message: 'Gagal mengupdate produk' };
  }
});

// Delete product
ipcMain.handle('products:delete', async (event, id) => {
  try {
    console.log('Deleting product:', id);

    dbModule.run('DELETE FROM products WHERE id = ?', [id]);

    console.log('Product deleted successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Delete product error:', error);
    return { success: false, message: 'Gagal menghapus produk' };
  }
});

// Toggle product status
ipcMain.handle('products:toggleStatus', async (event, id) => {
  try {
    console.log('Toggling product status:', id);

    dbModule.run(
      `UPDATE products 
       SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    console.log('Product status toggled successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Toggle product status error:', error);
    return { success: false, message: 'Gagal mengubah status produk' };
  }
});

// Get low stock products
ipcMain.handle('products:getLowStock', async () => {
  try {
    const products = dbModule.all(`
      SELECT p.id, p.name, p.stock, p.min_stock, p.unit,
             c.name AS category_name,
             CASE WHEN p.stock = 0 THEN 'empty' ELSE 'low' END AS status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.stock <= p.min_stock
      ORDER BY p.stock ASC, p.name ASC
    `);
    return { success: true, products };
  } catch (error) {
    console.error('products:getLowStock error:', error);
    return { success: false, products: [] };
  }
});

// Bulk import products
ipcMain.handle('products:importBulk', async (event, rows) => {
  const results = { success: 0, failed: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Resolve category_id from name
      let category_id = null;
      if (row.kategori) {
        const cat = dbModule.get('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)', [row.kategori.trim()]);
        if (!cat) {
          results.failed.push({ baris: i + 2, data: row, alasan: `Kategori "${row.kategori}" tidak ditemukan` });
          continue;
        }
        category_id = cat.id;
      }

      // Validate prices
      const purchasePrice = parseFloat(row.harga_beli) || 0;
      const sellingPrice = parseFloat(row.harga_jual) || 0;
      if (sellingPrice < purchasePrice) {
        results.failed.push({ baris: i + 2, data: row, alasan: 'Harga jual tidak boleh lebih kecil dari harga beli' });
        continue;
      }

      // Check barcode uniqueness
      const barcode = String(row.barcode || '').trim();
      if (!barcode) {
        results.failed.push({ baris: i + 2, data: row, alasan: 'Barcode wajib diisi' });
        continue;
      }
      const existing = dbModule.get('SELECT id FROM products WHERE barcode = ?', [barcode]);
      if (existing) {
        results.failed.push({ baris: i + 2, data: row, alasan: `Barcode "${barcode}" sudah digunakan` });
        continue;
      }

      const name = String(row.nama || '').trim();
      if (!name) {
        results.failed.push({ baris: i + 2, data: row, alasan: 'Nama produk wajib diisi' });
        continue;
      }

      dbModule.run(
        `INSERT INTO products (barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          barcode,
          name,
          category_id,
          purchasePrice,
          sellingPrice,
          parseInt(row.stok) || 0,
          parseInt(row.stok_minimum) || 5,
          String(row.satuan || 'pcs').trim()
        ]
      );
      results.success++;
    } catch (err) {
      console.error('importBulk row error:', err);
      results.failed.push({ baris: i + 2, data: row, alasan: err.message || 'Kesalahan tidak diketahui' });
    }
  }

  return { success: true, results };
});

// ============================================
// TRANSACTIONS IPC HANDLERS
// ============================================

// Search products (for autocomplete)
ipcMain.handle('products:search', async (event, keyword) => {
  try {
    if (!keyword || keyword.length < 2) {
      return { success: true, products: [] };
    }

    const products = dbModule.all(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 
      AND (p.name LIKE ? OR p.barcode LIKE ?)
      ORDER BY p.name
      LIMIT 10
    `, [`%${keyword}%`, `%${keyword}%`]);
    
    return { success: true, products };
  } catch (error) {
    console.error('Search products error:', error);
    return { success: false, message: 'Gagal mencari produk' };
  }
});

// Create transaction
ipcMain.handle('transactions:create', async (event, transactionData) => {
  try {
    console.log('Creating transaction:', transactionData.transaction_code);

    // Check if transaction code already exists
    const existingTransaction = dbModule.get(
      'SELECT id FROM transactions WHERE transaction_code = ?',
      [transactionData.transaction_code]
    );

    if (existingTransaction) {
      return { success: false, message: 'Kode transaksi sudah ada' };
    }

    // Ensure all values have defaults (no undefined)
    const txData = {
      transaction_code: transactionData.transaction_code || '',
      user_id: transactionData.user_id || 0,
      transaction_date: transactionData.transaction_date || new Date().toISOString(),
      subtotal: transactionData.subtotal || 0,
      discount_type: transactionData.discount_type || 'none',
      discount_value: transactionData.discount_value || 0,
      discount_amount: transactionData.discount_amount || 0,
      tax_percent: transactionData.tax_percent || 0,
      tax_amount: transactionData.tax_amount || 0,
      total_amount: transactionData.total_amount || 0,
      payment_method: transactionData.payment_method || 'cash',
      payment_amount: transactionData.payment_amount || 0,
      change_amount: transactionData.change_amount || 0,
      customer_name: transactionData.customer_name || '',
      notes: transactionData.notes || '',
      status: 'completed',
      customer_id: transactionData.customer_id || null,
      is_credit: transactionData.is_credit ? 1 : 0
    };

    console.log('Transaction data prepared:', txData);

    // Validasi kredit limit sebelum insert
    if (txData.is_credit && txData.customer_id) {
      const customer = dbModule.get('SELECT * FROM customers WHERE id = ? AND is_active = 1', [txData.customer_id]);
      if (!customer) {
        return { success: false, message: 'Pelanggan tidak ditemukan atau tidak aktif' };
      }
      if (customer.credit_limit > 0) {
        const outstanding = dbModule.get(
          'SELECT COALESCE(SUM(remaining_amount),0) as total FROM receivables WHERE customer_id = ? AND status != ?',
          [txData.customer_id, 'paid']
        );
        const currentOutstanding = outstanding ? outstanding.total : 0;
        if (currentOutstanding + txData.total_amount > customer.credit_limit) {
          return { success: false, message: `Batas kredit terlampaui. Sisa limit: ${(customer.credit_limit - currentOutstanding).toLocaleString('id-ID')}` };
        }
      }
    }

    // 1. Insert transaction
    dbModule.run(
      `INSERT INTO transactions (
        transaction_code, user_id, transaction_date, subtotal,
        discount_type, discount_value, discount_amount,
        tax_percent, tax_amount, total_amount,
        payment_method, payment_amount, change_amount,
        customer_name, notes, status, customer_id, is_credit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txData.transaction_code,
        txData.user_id,
        txData.transaction_date,
        txData.subtotal,
        txData.discount_type,
        txData.discount_value,
        txData.discount_amount,
        txData.tax_percent,
        txData.tax_amount,
        txData.total_amount,
        txData.payment_method,
        txData.payment_amount,
        txData.change_amount,
        txData.customer_name,
        txData.notes,
        txData.status,
        txData.customer_id,
        txData.is_credit
      ]
    );

    // Get the transaction ID by querying with transaction_code
    const insertedTransaction = dbModule.get(
      'SELECT id FROM transactions WHERE transaction_code = ?',
      [txData.transaction_code]
    );

    if (!insertedTransaction) {
      throw new Error('Failed to retrieve inserted transaction');
    }

    const transactionId = insertedTransaction.id;
    console.log('Transaction inserted with ID:', transactionId);

    // 2. Insert transaction items and update stock
    for (const item of transactionData.items) {
      console.log('Processing item:', item.product_name);

      // Ensure item values have defaults
      const itemData = {
        transaction_id: transactionId,
        product_id: item.product_id || 0,
        product_name: item.product_name || '',
        barcode: item.barcode || '',
        quantity: item.quantity || 0,
        unit: item.unit || 'pcs',
        unit_id: item.unit_id || null,
        conversion_qty: item.conversion_qty || 1,
        price: item.price || 0,
        subtotal: item.subtotal || 0,
        discount_item: item.discount_item || 0,
        discount_item_type: item.discount_item_type || 'none',
        discount_item_amount: item.discount_item_amount || 0
      };

      // Stock deduction in base unit (quantity * conversion_qty)
      const stockDeduction = itemData.quantity * itemData.conversion_qty;

      // Insert transaction item
      dbModule.run(
        `INSERT INTO transaction_items (
          transaction_id, product_id, product_name, barcode,
          quantity, unit, unit_id, conversion_qty, price, subtotal,
          discount_item, discount_item_type, discount_item_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemData.transaction_id,
          itemData.product_id,
          itemData.product_name,
          itemData.barcode,
          itemData.quantity,
          itemData.unit,
          itemData.unit_id,
          itemData.conversion_qty,
          itemData.price,
          itemData.subtotal,
          itemData.discount_item,
          itemData.discount_item_type,
          itemData.discount_item_amount
        ]
      );

      // Update product stock (deduct in base unit)
      dbModule.run(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [stockDeduction, itemData.product_id]
      );

      // Create stock mutation (quantity in base unit)
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id,
          notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemData.product_id,
          'out',
          stockDeduction,
          'sale',
          transactionId,
          `Penjualan ${txData.transaction_code} (${itemData.quantity} ${itemData.unit})`,
          txData.user_id
        ]
      );

      console.log('Item processed successfully:', item.product_name);
    }

    // Jika transaksi kredit, buat record piutang
    if (txData.is_credit && txData.customer_id) {
      dbModule.run(
        `INSERT INTO receivables (transaction_id, customer_id, total_amount, paid_amount, remaining_amount, status)
         VALUES (?, ?, ?, 0, ?, 'unpaid')`,
        [transactionId, txData.customer_id, txData.total_amount, txData.total_amount]
      );
    }

    console.log('Transaction created successfully:', transactionData.transaction_code);
    return { success: true, transactionId };

  } catch (error) {
    console.error('Create transaction error:', error);
    console.error('Error stack:', error.stack);
    return { success: false, message: 'Gagal menyimpan transaksi: ' + error.message };
  }
});

// Get all transactions with filters
ipcMain.handle('transactions:getAll', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT t.*, u.full_name as cashier_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by date range
    if (filters.startDate) {
      sql += ' AND DATE(t.transaction_date) >= DATE(?)';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND DATE(t.transaction_date) <= DATE(?)';
      params.push(filters.endDate);
    }

    // Filter by transaction code
    if (filters.transactionCode) {
      sql += ' AND t.transaction_code LIKE ?';
      params.push(`%${filters.transactionCode}%`);
    }

    // Filter by cashier
    if (filters.userId) {
      sql += ' AND t.user_id = ?';
      params.push(filters.userId);
    }

    // Filter by payment method
    if (filters.paymentMethod) {
      sql += ' AND t.payment_method = ?';
      params.push(filters.paymentMethod);
    }

    // Filter by status
    if (filters.status) {
      sql += ' AND t.status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY t.transaction_date DESC';

    // Pagination
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const transactions = dbModule.all(sql, params);
    
    return { success: true, transactions };
  } catch (error) {
    console.error('Get all transactions error:', error);
    return { success: false, message: 'Gagal memuat data transaksi' };
  }
});

// Get transaction by ID with items
ipcMain.handle('transactions:getById', async (event, id) => {
  try {
    const transaction = dbModule.get(`
      SELECT t.*, u.full_name as cashier_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `, [id]);
    
    if (!transaction) {
      return { success: false, message: 'Transaksi tidak ditemukan' };
    }

    // Get transaction items
    const items = dbModule.all(
      'SELECT * FROM transaction_items WHERE transaction_id = ?',
      [id]
    );

    transaction.items = items;
    
    return { success: true, transaction };
  } catch (error) {
    console.error('Get transaction by ID error:', error);
    return { success: false, message: 'Gagal memuat data transaksi' };
  }
});

// Void transaction
ipcMain.handle('transactions:void', async (event, id) => {
  try {
    console.log('Voiding transaction:', id);

    // Get transaction data
    const transaction = dbModule.get('SELECT * FROM transactions WHERE id = ?', [id]);
    
    if (!transaction) {
      return { success: false, message: 'Transaksi tidak ditemukan' };
    }

    if (transaction.status === 'void') {
      return { success: false, message: 'Transaksi sudah di-void sebelumnya' };
    }

    // Get transaction items
    const items = dbModule.all('SELECT * FROM transaction_items WHERE transaction_id = ?', [id]);

    // 1. Update transaction status
    dbModule.run(
      'UPDATE transactions SET status = ? WHERE id = ?',
      ['void', id]
    );

    // 2. Restore stock for each item
    for (const item of items) {
      // Restore stock
      dbModule.run(
        'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Create stock mutation
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id, 
          notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          'in',
          item.quantity,
          'void',
          id,
          `Void transaksi ${transaction.transaction_code}`,
          currentUser ? currentUser.id : null
        ]
      );
    }

    console.log('Transaction voided successfully:', id);
    return { success: true };

  } catch (error) {
    console.error('Void transaction error:', error);
    return { success: false, message: 'Gagal void transaksi: ' + error.message };
  }
});

// ============================================
// CASH DRAWER IPC HANDLERS
// ============================================

// Get current open cash drawer for logged in user
ipcMain.handle('cashDrawer:getCurrent', async (event) => {
  try {
    if (!currentUser) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    const today = new Date().toISOString().split('T')[0];
    
    const cashDrawer = dbModule.get(`
      SELECT cd.*, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end
      FROM cash_drawer cd
      LEFT JOIN shifts s ON cd.shift_id = s.id
      WHERE cd.user_id = ?
      AND DATE(cd.open_time) = DATE(?)
      AND cd.status = 'open'
      ORDER BY cd.open_time DESC
      LIMIT 1
    `, [currentUser.id, today]);
    
    return { success: true, cashDrawer: cashDrawer || null };
  } catch (error) {
    console.error('Get current cash drawer error:', error);
    return { success: false, message: 'Gagal memuat data kas' };
  }
});

// Open cash drawer
ipcMain.handle('cashDrawer:open', async (event, data) => {
  try {
    if (!currentUser) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if this user already has an open session for this shift today
    const shiftCheck = data.shift_id
      ? dbModule.get(`
          SELECT id FROM cash_drawer
          WHERE user_id = ?
          AND shift_id = ?
          AND DATE(open_time) = DATE(?)
          AND status = 'open'
        `, [currentUser.id, data.shift_id, today])
      : dbModule.get(`
          SELECT id FROM cash_drawer
          WHERE user_id = ?
          AND shift_id IS NULL
          AND DATE(open_time) = DATE(?)
          AND status = 'open'
        `, [currentUser.id, today]);

    if (shiftCheck) {
      return { success: false, message: 'Kas untuk shift ini sudah dibuka dan masih aktif' };
    }

    // Insert new cash drawer
    dbModule.run(
      `INSERT INTO cash_drawer (
        user_id, shift_id, open_time, opening_balance, status, notes
      ) VALUES (?, ?, ?, ?, 'open', ?)`,
      [currentUser.id, data.shift_id || null, new Date().toISOString(), data.opening_balance, data.notes || '']
    );

    // Get inserted cash drawer
    const cashDrawer = dbModule.get(
      'SELECT * FROM cash_drawer WHERE user_id = ? AND status = ? ORDER BY open_time DESC LIMIT 1',
      [currentUser.id, 'open']
    );

    console.log('Cash drawer opened successfully');
    return { success: true, cashDrawer };
  } catch (error) {
    console.error('Open cash drawer error:', error);
    return { success: false, message: 'Gagal membuka kas' };
  }
});

// Close cash drawer
ipcMain.handle('cashDrawer:close', async (event, id, data) => {
  try {
    const cashDrawer = dbModule.get('SELECT * FROM cash_drawer WHERE id = ?', [id]);

    if (!cashDrawer) {
      return { success: false, message: 'Kas tidak ditemukan' };
    }

    if (cashDrawer.status === 'closed') {
      return { success: false, message: 'Kas sudah ditutup' };
    }

    // Calculate expected balance
    const expected = cashDrawer.opening_balance + cashDrawer.total_cash_sales - cashDrawer.total_expenses;
    const difference = data.closing_balance - expected;

    dbModule.run(
      `UPDATE cash_drawer 
       SET close_time = ?, closing_balance = ?, expected_balance = ?, 
           difference = ?, status = 'closed', notes = ?
       WHERE id = ?`,
      [
        new Date().toISOString(),
        data.closing_balance,
        expected,
        difference,
        data.notes || '',
        id
      ]
    );

    console.log('Cash drawer closed successfully');
    return { success: true };
  } catch (error) {
    console.error('Close cash drawer error:', error);
    return { success: false, message: 'Gagal menutup kas' };
  }
});

// Get cash drawer history
ipcMain.handle('cashDrawer:getHistory', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT cd.*, u.full_name as cashier_name,
             s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end
      FROM cash_drawer cd
      LEFT JOIN users u ON cd.user_id = u.id
      LEFT JOIN shifts s ON cd.shift_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.startDate) {
      sql += ' AND DATE(cd.open_time) >= DATE(?)';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND DATE(cd.open_time) <= DATE(?)';
      params.push(filters.endDate);
    }

    if (filters.userId) {
      sql += ' AND cd.user_id = ?';
      params.push(filters.userId);
    }

    if (filters.status) {
      sql += ' AND cd.status = ?';
      params.push(filters.status);
    }

    if (filters.shiftId) {
      sql += ' AND cd.shift_id = ?';
      params.push(filters.shiftId);
    }

    sql += ' ORDER BY cd.open_time DESC';

    const history = dbModule.all(sql, params);
    
    return { success: true, history };
  } catch (error) {
    console.error('Get cash drawer history error:', error);
    return { success: false, message: 'Gagal memuat riwayat kas' };
  }
});

// Get cash drawer by ID with details
ipcMain.handle('cashDrawer:getById', async (event, id) => {
  try {
    const cashDrawer = dbModule.get(`
      SELECT cd.*, u.full_name as cashier_name,
             s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end
      FROM cash_drawer cd
      LEFT JOIN users u ON cd.user_id = u.id
      LEFT JOIN shifts s ON cd.shift_id = s.id
      WHERE cd.id = ?
    `, [id]);

    if (!cashDrawer) {
      return { success: false, message: 'Kas tidak ditemukan' };
    }

    // Get cash transactions for that day
    const date = cashDrawer.open_time.split('T')[0];
    const transactions = dbModule.all(`
      SELECT * FROM transactions
      WHERE DATE(transaction_date) = DATE(?)
      AND payment_method = 'cash'
      AND status = 'completed'
      AND user_id = ?
      ORDER BY transaction_date DESC
    `, [date, cashDrawer.user_id]);

    // Get expenses for that day (CASH ONLY)
    const expenses = dbModule.all(`
      SELECT * FROM expenses
      WHERE DATE(expense_date) = DATE(?)
      AND user_id = ?
      AND payment_method = 'cash'
      ORDER BY expense_date DESC
    `, [date, cashDrawer.user_id]);

    // Calculate totals from actual data (backup jika data di cash_drawer salah)
    const actualCashSales = transactions.reduce((sum, t) => sum + t.total_amount, 0);
    const actualExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    console.log('Cash Drawer Detail:', {
      id: cashDrawer.id,
      date: date,
      storedCashSales: cashDrawer.total_cash_sales,
      actualCashSales: actualCashSales,
      storedExpenses: cashDrawer.total_expenses,
      actualExpenses: actualExpenses,
      transactionsCount: transactions.length,
      expensesCount: expenses.length
    });

    cashDrawer.transactions = transactions;
    cashDrawer.expenses = expenses;
    
    // Use actual calculated values for accuracy
    cashDrawer.calculated_cash_sales = actualCashSales;
    cashDrawer.calculated_expenses = actualExpenses;

    return { success: true, cashDrawer };
  } catch (error) {
    console.error('Get cash drawer by ID error:', error);
    return { success: false, message: 'Gagal memuat detail kas' };
  }
});

// Update cash sales (called when transaction is completed)
ipcMain.handle('cashDrawer:updateSales', async (event, amount) => {
  try {
    if (!currentUser) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's open cash drawer
    const cashDrawer = dbModule.get(`
      SELECT id FROM cash_drawer 
      WHERE user_id = ? 
      AND DATE(open_time) = DATE(?) 
      AND status = 'open'
    `, [currentUser.id, today]);

    if (cashDrawer) {
      dbModule.run(
        `UPDATE cash_drawer 
         SET total_sales = total_sales + ?,
             total_cash_sales = total_cash_sales + ?
         WHERE id = ?`,
        [amount, amount, cashDrawer.id]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Update cash sales error:', error);
    return { success: false };
  }
});

// Update expenses (called when expense is created)
ipcMain.handle('cashDrawer:updateExpenses', async (event, amount) => {
  try {
    if (!currentUser) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's open cash drawer
    const cashDrawer = dbModule.get(`
      SELECT id FROM cash_drawer 
      WHERE user_id = ? 
      AND DATE(open_time) = DATE(?) 
      AND status = 'open'
    `, [currentUser.id, today]);

    if (cashDrawer) {
      dbModule.run(
        'UPDATE cash_drawer SET total_expenses = total_expenses + ? WHERE id = ?',
        [amount, cashDrawer.id]
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Update expenses error:', error);
    return { success: false };
  }
});

// ============================================
// EXPENSES IPC HANDLERS
// ============================================

// Get all expenses with filters
ipcMain.handle('expenses:getAll', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT e.*, u.full_name as user_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.startDate) {
      sql += ' AND DATE(e.expense_date) >= DATE(?)';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND DATE(e.expense_date) <= DATE(?)';
      params.push(filters.endDate);
    }

    if (filters.category) {
      sql += ' AND e.category = ?';
      params.push(filters.category);
    }

    sql += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    const expenses = dbModule.all(sql, params);
    
    return { success: true, expenses };
  } catch (error) {
    console.error('Get all expenses error:', error);
    return { success: false, message: 'Gagal memuat data pengeluaran' };
  }
});

// Get expense by ID
ipcMain.handle('expenses:getById', async (event, id) => {
  try {
    const expense = dbModule.get('SELECT * FROM expenses WHERE id = ?', [id]);
    
    if (!expense) {
      return { success: false, message: 'Pengeluaran tidak ditemukan' };
    }
    
    return { success: true, expense };
  } catch (error) {
    console.error('Get expense by ID error:', error);
    return { success: false, message: 'Gagal memuat data pengeluaran' };
  }
});

// Create expense
ipcMain.handle('expenses:create', async (event, expenseData) => {
  try {
    if (!currentUser) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    console.log('Creating expense:', expenseData);

    // Insert expense
    dbModule.run(
      `INSERT INTO expenses (
        expense_date, category, description, amount, 
        payment_method, user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        expenseData.expense_date,
        expenseData.category,
        expenseData.description,
        expenseData.amount,
        expenseData.payment_method || 'cash',
        currentUser.id,
        expenseData.notes || ''
      ]
    );

    console.log('Expense created successfully');

    // Update cash drawer if payment is cash AND expense date is today
    const today = new Date().toISOString().split('T')[0];
    const expenseDate = expenseData.expense_date.split('T')[0];
    
    console.log('Checking cash drawer update:', {
      paymentMethod: expenseData.payment_method,
      expenseDate: expenseDate,
      today: today,
      shouldUpdate: expenseData.payment_method === 'cash' && expenseDate === today
    });

    if (expenseData.payment_method === 'cash' && expenseDate === today) {
      // Get today's open cash drawer
      const cashDrawer = dbModule.get(`
        SELECT id FROM cash_drawer 
        WHERE user_id = ? 
        AND DATE(open_time) = DATE(?) 
        AND status = 'open'
      `, [currentUser.id, today]);

      console.log('Cash drawer found:', cashDrawer);

      if (cashDrawer) {
        dbModule.run(
          'UPDATE cash_drawer SET total_expenses = total_expenses + ? WHERE id = ?',
          [expenseData.amount, cashDrawer.id]
        );
        console.log('Cash drawer updated with expense:', expenseData.amount);
      } else {
        console.log('No open cash drawer found for today');
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Create expense error:', error);
    return { success: false, message: 'Gagal menambahkan pengeluaran' };
  }
});

// Update expense
ipcMain.handle('expenses:update', async (event, id, expenseData) => {
  try {
    dbModule.run(
      `UPDATE expenses 
       SET expense_date = ?, category = ?, description = ?, 
           amount = ?, payment_method = ?, notes = ?
       WHERE id = ?`,
      [
        expenseData.expense_date,
        expenseData.category,
        expenseData.description,
        expenseData.amount,
        expenseData.payment_method || '',
        expenseData.notes || '',
        id
      ]
    );

    console.log('Expense updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Update expense error:', error);
    return { success: false, message: 'Gagal mengupdate pengeluaran' };
  }
});

// Delete expense
ipcMain.handle('expenses:delete', async (event, id) => {
  try {
    dbModule.run('DELETE FROM expenses WHERE id = ?', [id]);

    console.log('Expense deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Delete expense error:', error);
    return { success: false, message: 'Gagal menghapus pengeluaran' };
  }
});

// ============================================
// PURCHASES IPC HANDLERS
// ============================================

// Get all purchases with filters
ipcMain.handle('purchases:getAll', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT p.*, u.full_name as user_name
      FROM purchases p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.startDate) {
      sql += ' AND DATE(p.purchase_date) >= DATE(?)';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND DATE(p.purchase_date) <= DATE(?)';
      params.push(filters.endDate);
    }

    if (filters.paymentStatus) {
      sql += ' AND p.payment_status = ?';
      params.push(filters.paymentStatus);
    }

    if (filters.supplier) {
      sql += ' AND p.supplier_name LIKE ?';
      params.push(`%${filters.supplier}%`);
    }

    sql += ' ORDER BY p.purchase_date DESC, p.created_at DESC';

    const purchases = dbModule.all(sql, params);
    
    return { success: true, purchases };
  } catch (error) {
    console.error('Get all purchases error:', error);
    return { success: false, message: 'Gagal memuat data pembelian' };
  }
});

// Get purchase by ID with items
ipcMain.handle('purchases:getById', async (event, id) => {
  try {
    const purchase = dbModule.get(`
      SELECT p.*, u.full_name as user_name
      FROM purchases p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);
    
    if (!purchase) {
      return { success: false, message: 'Pembelian tidak ditemukan' };
    }

    // Get purchase items
    const items = dbModule.all(
      'SELECT * FROM purchase_items WHERE purchase_id = ?',
      [id]
    );

    purchase.items = items;
    
    return { success: true, purchase };
  } catch (error) {
    console.error('Get purchase by ID error:', error);
    return { success: false, message: 'Gagal memuat data pembelian' };
  }
});

// Create purchase
ipcMain.handle('purchases:create', async (event, purchaseData) => {
  try {
    if (!currentUser) {
      return { success: false, message: 'User tidak ditemukan' };
    }

    console.log('Creating purchase:', purchaseData.purchase_code);

    // Check if purchase code already exists
    const existing = dbModule.get(
      'SELECT id FROM purchases WHERE purchase_code = ?',
      [purchaseData.purchase_code]
    );

    if (existing) {
      return { success: false, message: 'Kode pembelian sudah ada' };
    }

    // Calculate remaining amount
    const remaining = purchaseData.total_amount - purchaseData.paid_amount;

    // Insert purchase
    dbModule.run(
      `INSERT INTO purchases (
        purchase_code, supplier_name, supplier_id, purchase_date,
        total_amount, payment_status, paid_amount, remaining_amount,
        user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseData.purchase_code,
        purchaseData.supplier_name || '',
        purchaseData.supplier_id || null,
        purchaseData.purchase_date,
        purchaseData.total_amount,
        purchaseData.payment_status || 'unpaid',
        purchaseData.paid_amount || 0,
        purchaseData.total_amount - (purchaseData.paid_amount || 0),
        currentUser.id,
        purchaseData.notes || ''
      ]
    );

    // Get inserted purchase ID
    const insertedPurchase = dbModule.get(
      'SELECT id FROM purchases WHERE purchase_code = ?',
      [purchaseData.purchase_code]
    );

    if (!insertedPurchase) {
      throw new Error('Failed to retrieve inserted purchase');
    }

    const purchaseId = insertedPurchase.id;
    console.log('Purchase inserted with ID:', purchaseId);

    // Insert purchase items and update stock
    for (const item of purchaseData.items) {
      console.log('Processing item:', item.product_name);

      // Insert purchase item
      dbModule.run(
        `INSERT INTO purchase_items (
          purchase_id, product_id, product_name, quantity, unit, purchase_price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit,
          item.purchase_price,
          item.subtotal
        ]
      );

      // Update product stock
      dbModule.run(
        'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Create stock mutation
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          'in',
          item.quantity,
          'purchase',
          purchaseId,
          `Pembelian ${purchaseData.purchase_code}`,
          currentUser.id
        ]
      );

      console.log('Item processed successfully:', item.product_name);
    }

    console.log('Purchase created successfully:', purchaseData.purchase_code);
    return { success: true, purchaseId };
  } catch (error) {
    console.error('Create purchase error:', error);
    return { success: false, message: 'Gagal menyimpan pembelian: ' + error.message };
  }
});

// Update purchase
ipcMain.handle('purchases:update', async (event, id, purchaseData) => {
  try {
    console.log('Updating purchase:', id);

    // Check if purchase has payments
    const purchase = dbModule.get('SELECT paid_amount FROM purchases WHERE id = ?', [id]);
    
    if (purchase && purchase.paid_amount > 0) {
      return { success: false, message: 'Tidak dapat mengubah pembelian yang sudah ada pembayaran' };
    }

    // Calculate remaining amount
    const remaining = purchaseData.total_amount - purchaseData.paid_amount;

    dbModule.run(
      `UPDATE purchases 
       SET supplier_name = ?, supplier_id = ?, purchase_date = ?, total_amount = ?,
           payment_status = ?, paid_amount = ?, remaining_amount = ?, notes = ?
       WHERE id = ?`,
      [
        purchaseData.supplier_name || '',
        purchaseData.supplier_id || null,
        purchaseData.purchase_date,
        purchaseData.total_amount,
        purchaseData.payment_status,
        purchaseData.paid_amount,
        remaining,
        purchaseData.notes || '',
        id
      ]
    );

    console.log('Purchase updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Update purchase error:', error);
    return { success: false, message: 'Gagal mengupdate pembelian' };
  }
});

// Delete purchase
ipcMain.handle('purchases:delete', async (event, id) => {
  try {
    console.log('Deleting purchase:', id);

    // Check if purchase has payments
    const purchase = dbModule.get('SELECT * FROM purchases WHERE id = ?', [id]);
    
    if (!purchase) {
      return { success: false, message: 'Pembelian tidak ditemukan' };
    }

    if (purchase.paid_amount > 0) {
      return { success: false, message: 'Tidak dapat menghapus pembelian yang sudah ada pembayaran' };
    }

    // Get purchase items to restore stock
    const items = dbModule.all('SELECT * FROM purchase_items WHERE purchase_id = ?', [id]);

    // Restore stock for each item
    for (const item of items) {
      dbModule.run(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Create stock mutation
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          'out',
          item.quantity,
          'purchase_delete',
          id,
          `Hapus pembelian ${purchase.purchase_code}`,
          currentUser ? currentUser.id : null
        ]
      );
    }

    // Delete purchase items
    dbModule.run('DELETE FROM purchase_items WHERE purchase_id = ?', [id]);

    // Delete purchase
    dbModule.run('DELETE FROM purchases WHERE id = ?', [id]);

    console.log('Purchase deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Delete purchase error:', error);
    return { success: false, message: 'Gagal menghapus pembelian' };
  }
});

// Pay purchase
ipcMain.handle('purchases:pay', async (event, id, amount) => {
  try {
    console.log('Processing payment for purchase:', id);

    const purchase = dbModule.get('SELECT * FROM purchases WHERE id = ?', [id]);
    
    if (!purchase) {
      return { success: false, message: 'Pembelian tidak ditemukan' };
    }

    if (purchase.payment_status === 'paid') {
      return { success: false, message: 'Pembelian sudah lunas' };
    }

    if (amount > purchase.remaining_amount) {
      return { success: false, message: 'Jumlah bayar melebihi sisa hutang' };
    }

    // Calculate new values
    const newPaidAmount = purchase.paid_amount + amount;
    const newRemainingAmount = purchase.total_amount - newPaidAmount;
    
    let newStatus = 'partial';
    if (newRemainingAmount === 0) {
      newStatus = 'paid';
    } else if (newPaidAmount === 0) {
      newStatus = 'unpaid';
    }

    // Update purchase
    dbModule.run(
      `UPDATE purchases 
       SET paid_amount = ?, remaining_amount = ?, payment_status = ?
       WHERE id = ?`,
      [newPaidAmount, newRemainingAmount, newStatus, id]
    );

    console.log('Payment processed successfully');
    return { success: true };
  } catch (error) {
    console.error('Pay purchase error:', error);
    return { success: false, message: 'Gagal memproses pembayaran' };
  }
});

// ============================================
// SUPPLIERS IPC HANDLERS
// ============================================

// Generate supplier code
function generateSupplierCode() {
  const last = dbModule.get(
    "SELECT supplier_code FROM suppliers ORDER BY id DESC LIMIT 1"
  );
  if (!last) return 'SUP-0001';
  const num = parseInt(last.supplier_code.replace('SUP-', ''), 10) + 1;
  return 'SUP-' + String(num).padStart(4, '0');
}

// Get all suppliers
ipcMain.handle('suppliers:getAll', async (event, filters = {}) => {
  try {
    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (filters.search) {
      sql += ' AND (name LIKE ? OR supplier_code LIKE ? OR phone LIKE ? OR contact_person LIKE ?)';
      const kw = `%${filters.search}%`;
      params.push(kw, kw, kw, kw);
    }

    if (filters.status !== undefined && filters.status !== '') {
      sql += ' AND is_active = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY name ASC';

    const suppliers = dbModule.all(sql, params);
    return { success: true, suppliers };
  } catch (error) {
    console.error('suppliers:getAll error:', error);
    return { success: false, message: 'Gagal memuat data supplier' };
  }
});

// Get active suppliers for dropdown
ipcMain.handle('suppliers:getActiveList', async () => {
  try {
    const suppliers = dbModule.all(
      'SELECT id, supplier_code, name FROM suppliers WHERE is_active = 1 ORDER BY name ASC'
    );
    return { success: true, suppliers };
  } catch (error) {
    console.error('suppliers:getActiveList error:', error);
    return { success: false, message: 'Gagal memuat daftar supplier' };
  }
});

// Get supplier by ID
ipcMain.handle('suppliers:getById', async (event, id) => {
  try {
    const supplier = dbModule.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) return { success: false, message: 'Supplier tidak ditemukan' };
    return { success: true, supplier };
  } catch (error) {
    console.error('suppliers:getById error:', error);
    return { success: false, message: 'Gagal memuat data supplier' };
  }
});

// Get supplier detail: info + purchase history + total debt
ipcMain.handle('suppliers:getDetail', async (event, id) => {
  try {
    const supplier = dbModule.get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) return { success: false, message: 'Supplier tidak ditemukan' };

    const purchases = dbModule.all(
      `SELECT p.*, u.full_name as user_name
       FROM purchases p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.supplier_id = ?
       ORDER BY p.purchase_date DESC, p.created_at DESC`,
      [id]
    );

    const debtRow = dbModule.get(
      `SELECT COALESCE(SUM(remaining_amount), 0) as total_debt
       FROM purchases
       WHERE supplier_id = ? AND payment_status != 'paid'`,
      [id]
    );

    const statsRow = dbModule.get(
      `SELECT 
         COUNT(*) as total_purchases,
         COALESCE(SUM(total_amount), 0) as total_amount
       FROM purchases WHERE supplier_id = ?`,
      [id]
    );

    return {
      success: true,
      supplier,
      purchases,
      total_debt: debtRow ? debtRow.total_debt : 0,
      stats: statsRow
    };
  } catch (error) {
    console.error('suppliers:getDetail error:', error);
    return { success: false, message: 'Gagal memuat detail supplier' };
  }
});

// Create supplier
ipcMain.handle('suppliers:create', async (event, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM suppliers WHERE name = ?', [data.name]);
    if (existing) return { success: false, message: 'Supplier dengan nama ini sudah ada' };

    const supplierCode = generateSupplierCode();

    dbModule.run(
      `INSERT INTO suppliers (supplier_code, name, address, phone, email, contact_person, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        supplierCode,
        data.name,
        data.address || '',
        data.phone || '',
        data.email || '',
        data.contact_person || '',
        data.notes || ''
      ]
    );

    console.log('Supplier created:', supplierCode);
    return { success: true, supplier_code: supplierCode };
  } catch (error) {
    console.error('suppliers:create error:', error);
    return { success: false, message: 'Gagal menyimpan supplier: ' + error.message };
  }
});

// Update supplier
ipcMain.handle('suppliers:update', async (event, id, data) => {
  try {
    const existing = dbModule.get(
      'SELECT id FROM suppliers WHERE name = ? AND id != ?',
      [data.name, id]
    );
    if (existing) return { success: false, message: 'Supplier dengan nama ini sudah ada' };

    dbModule.run(
      `UPDATE suppliers
       SET name = ?, address = ?, phone = ?, email = ?, contact_person = ?, notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.name,
        data.address || '',
        data.phone || '',
        data.email || '',
        data.contact_person || '',
        data.notes || '',
        id
      ]
    );

    console.log('Supplier updated:', id);
    return { success: true };
  } catch (error) {
    console.error('suppliers:update error:', error);
    return { success: false, message: 'Gagal mengupdate supplier: ' + error.message };
  }
});

// Delete supplier
ipcMain.handle('suppliers:delete', async (event, id) => {
  try {
    const inUse = dbModule.get(
      'SELECT id FROM purchases WHERE supplier_id = ? LIMIT 1',
      [id]
    );
    if (inUse) {
      return { success: false, message: 'Supplier tidak dapat dihapus karena sudah digunakan di data pembelian' };
    }

    dbModule.run('DELETE FROM suppliers WHERE id = ?', [id]);
    console.log('Supplier deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('suppliers:delete error:', error);
    return { success: false, message: 'Gagal menghapus supplier' };
  }
});

// Toggle supplier status
ipcMain.handle('suppliers:toggleStatus', async (event, id) => {
  try {
    const supplier = dbModule.get('SELECT is_active FROM suppliers WHERE id = ?', [id]);
    if (!supplier) return { success: false, message: 'Supplier tidak ditemukan' };

    const newStatus = supplier.is_active === 1 ? 0 : 1;
    dbModule.run(
      'UPDATE suppliers SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, id]
    );

    return { success: true, is_active: newStatus };
  } catch (error) {
    console.error('suppliers:toggleStatus error:', error);
    return { success: false, message: 'Gagal mengubah status supplier' };
  }
});

// ============================================
// SUPPLIER RETURNS IPC HANDLERS
// ============================================

function generateReturnCode() {
  const now = new Date();
  const datePart = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const last = dbModule.get(
    "SELECT return_code FROM supplier_returns ORDER BY id DESC LIMIT 1"
  );
  let seq = 1;
  if (last) {
    const parts = last.return_code.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `RTR-${datePart}-${String(seq).padStart(4, '0')}`;
}

// Get purchase items for a given purchase (to fill return form)
ipcMain.handle('supplierReturns:getPurchaseItems', async (event, purchaseId) => {
  try {
    const purchase = dbModule.get(
      `SELECT p.*, s.name as supplier_name_from_db
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [purchaseId]
    );
    if (!purchase) return { success: false, message: 'Pembelian tidak ditemukan' };

    const items = dbModule.all(
      `SELECT pi.*, pr.name as product_current_name
       FROM purchase_items pi
       LEFT JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = ?`,
      [purchaseId]
    );

    return { success: true, purchase, items };
  } catch (error) {
    console.error('supplierReturns:getPurchaseItems error:', error);
    return { success: false, message: 'Gagal memuat data pembelian' };
  }
});

// Get all supplier returns with filters
ipcMain.handle('supplierReturns:getAll', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT sr.*,
             p.purchase_code,
             u.full_name as user_name
      FROM supplier_returns sr
      LEFT JOIN purchases p ON sr.purchase_id = p.id
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.supplierId) {
      sql += ' AND sr.supplier_id = ?';
      params.push(filters.supplierId);
    }
    if (filters.status) {
      sql += ' AND sr.status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      sql += ' AND DATE(sr.return_date) >= DATE(?)';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND DATE(sr.return_date) <= DATE(?)';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY sr.created_at DESC';

    const returns = dbModule.all(sql, params);
    return { success: true, returns };
  } catch (error) {
    console.error('supplierReturns:getAll error:', error);
    return { success: false, message: 'Gagal memuat data retur' };
  }
});

// Get supplier return by ID with items
ipcMain.handle('supplierReturns:getById', async (event, id) => {
  try {
    const ret = dbModule.get(
      `SELECT sr.*, p.purchase_code, u.full_name as user_name
       FROM supplier_returns sr
       LEFT JOIN purchases p ON sr.purchase_id = p.id
       LEFT JOIN users u ON sr.user_id = u.id
       WHERE sr.id = ?`,
      [id]
    );
    if (!ret) return { success: false, message: 'Retur tidak ditemukan' };

    const items = dbModule.all(
      'SELECT * FROM supplier_return_items WHERE return_id = ?',
      [id]
    );
    ret.items = items;

    return { success: true, return: ret };
  } catch (error) {
    console.error('supplierReturns:getById error:', error);
    return { success: false, message: 'Gagal memuat detail retur' };
  }
});

// Create supplier return
ipcMain.handle('supplierReturns:create', async (event, data) => {
  try {
    if (!currentUser) return { success: false, message: 'User tidak ditemukan' };

    const returnCode = generateReturnCode();

    // Get purchase to know supplier
    const purchase = dbModule.get('SELECT * FROM purchases WHERE id = ?', [data.purchase_id]);
    if (!purchase) return { success: false, message: 'Pembelian tidak ditemukan' };

    const totalReturnAmount = data.items.reduce((sum, item) => sum + item.subtotal, 0);

    // Insert supplier return header
    dbModule.run(
      `INSERT INTO supplier_returns (
        return_code, purchase_id, supplier_id, supplier_name, return_date,
        total_return_amount, reason, status, notes, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'diproses', ?, ?)`,
      [
        returnCode,
        data.purchase_id,
        purchase.supplier_id || null,
        purchase.supplier_name || '',
        data.return_date,
        totalReturnAmount,
        data.reason,
        data.notes || '',
        currentUser.id
      ]
    );

    const inserted = dbModule.get(
      'SELECT id FROM supplier_returns WHERE return_code = ?',
      [returnCode]
    );
    if (!inserted) throw new Error('Gagal mengambil ID retur yang baru dibuat');

    const returnId = inserted.id;

    // Insert return items, reduce stock, create stock mutations
    for (const item of data.items) {
      dbModule.run(
        `INSERT INTO supplier_return_items (
          return_id, purchase_item_id, product_id, product_name,
          quantity, unit, purchase_price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          item.purchase_item_id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit || 'pcs',
          item.purchase_price,
          item.subtotal
        ]
      );

      // Reduce product stock
      dbModule.run(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Stock mutation
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          'out',
          item.quantity,
          'supplier_return',
          returnId,
          `Retur ke supplier ${returnCode}`,
          currentUser.id
        ]
      );
    }

    // Reduce remaining debt on purchase if not fully paid
    if (purchase.payment_status !== 'paid') {
      const newRemaining = Math.max(0, (purchase.remaining_amount || 0) - totalReturnAmount);
      const newPaidEffective = purchase.total_amount - newRemaining;
      let newStatus = 'partial';
      if (newRemaining <= 0) newStatus = 'paid';
      else if (newPaidEffective <= 0) newStatus = 'unpaid';

      dbModule.run(
        `UPDATE purchases SET remaining_amount = ?, payment_status = ? WHERE id = ?`,
        [newRemaining, newStatus, purchase.id]
      );
    }

    console.log('Supplier return created:', returnCode);
    return { success: true, returnCode, returnId };
  } catch (error) {
    console.error('supplierReturns:create error:', error);
    return { success: false, message: 'Gagal menyimpan retur: ' + error.message };
  }
});

// Update return status
ipcMain.handle('supplierReturns:updateStatus', async (event, id, status) => {
  try {
    const ret = dbModule.get('SELECT id FROM supplier_returns WHERE id = ?', [id]);
    if (!ret) return { success: false, message: 'Retur tidak ditemukan' };

    dbModule.run(
      'UPDATE supplier_returns SET status = ? WHERE id = ?',
      [status, id]
    );
    return { success: true };
  } catch (error) {
    console.error('supplierReturns:updateStatus error:', error);
    return { success: false, message: 'Gagal mengubah status retur' };
  }
});

// Delete supplier return
ipcMain.handle('supplierReturns:delete', async (event, id) => {
  try {
    const ret = dbModule.get('SELECT * FROM supplier_returns WHERE id = ?', [id]);
    if (!ret) return { success: false, message: 'Retur tidak ditemukan' };

    if (ret.status === 'selesai') {
      return { success: false, message: 'Retur yang sudah selesai tidak dapat dihapus' };
    }

    // Get return items to restore stock
    const items = dbModule.all(
      'SELECT * FROM supplier_return_items WHERE return_id = ?',
      [id]
    );

    for (const item of items) {
      // Restore stock
      dbModule.run(
        'UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [item.quantity, item.product_id]
      );

      // Stock mutation
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id, notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.product_id,
          'in',
          item.quantity,
          'supplier_return_delete',
          id,
          `Hapus retur ${ret.return_code}`,
          currentUser ? currentUser.id : null
        ]
      );
    }

    // Restore remaining_amount on purchase
    const purchase = dbModule.get('SELECT * FROM purchases WHERE id = ?', [ret.purchase_id]);
    if (purchase) {
      const paid = purchase.paid_amount || 0;
      const remaining2 = purchase.total_amount - paid;
      let finalStatus = 'partial';
      if (remaining2 <= 0) finalStatus = 'paid';
      else if (paid <= 0) finalStatus = 'unpaid';

      dbModule.run(
        'UPDATE purchases SET remaining_amount = ?, payment_status = ? WHERE id = ?',
        [remaining2, finalStatus, purchase.id]
      );
    }

    dbModule.run('DELETE FROM supplier_return_items WHERE return_id = ?', [id]);
    dbModule.run('DELETE FROM supplier_returns WHERE id = ?', [id]);

    console.log('Supplier return deleted:', id);
    return { success: true };
  } catch (error) {
    console.error('supplierReturns:delete error:', error);
    return { success: false, message: 'Gagal menghapus retur: ' + error.message };
  }
});

// ============================================
// UNITS MANAGEMENT IPC HANDLERS
// ============================================

ipcMain.handle('units:getAll', async () => {
  try {
    const units = dbModule.all('SELECT * FROM units ORDER BY name');
    return { success: true, units };
  } catch (error) {
    console.error('units:getAll error:', error);
    return { success: false, message: 'Gagal memuat data satuan' };
  }
});

ipcMain.handle('units:getActive', async () => {
  try {
    const units = dbModule.all('SELECT * FROM units WHERE is_active = 1 ORDER BY name');
    return { success: true, units };
  } catch (error) {
    console.error('units:getActive error:', error);
    return { success: false, message: 'Gagal memuat data satuan' };
  }
});

ipcMain.handle('units:getById', async (event, id) => {
  try {
    const unit = dbModule.get('SELECT * FROM units WHERE id = ?', [id]);
    if (!unit) return { success: false, message: 'Satuan tidak ditemukan' };
    return { success: true, unit };
  } catch (error) {
    console.error('units:getById error:', error);
    return { success: false, message: 'Gagal memuat data satuan' };
  }
});

ipcMain.handle('units:create', async (event, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM units WHERE name = ?', [data.name]);
    if (existing) return { success: false, message: 'Nama satuan sudah ada' };
    dbModule.run(
      'INSERT INTO units (name, abbreviation, is_active) VALUES (?, ?, 1)',
      [data.name, data.abbreviation]
    );
    const unit = dbModule.get('SELECT * FROM units WHERE name = ?', [data.name]);
    return { success: true, unit };
  } catch (error) {
    console.error('units:create error:', error);
    return { success: false, message: 'Gagal menambahkan satuan' };
  }
});

ipcMain.handle('units:update', async (event, id, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM units WHERE name = ? AND id != ?', [data.name, id]);
    if (existing) return { success: false, message: 'Nama satuan sudah ada' };
    dbModule.run(
      'UPDATE units SET name = ?, abbreviation = ? WHERE id = ?',
      [data.name, data.abbreviation, id]
    );
    return { success: true };
  } catch (error) {
    console.error('units:update error:', error);
    return { success: false, message: 'Gagal mengupdate satuan' };
  }
});

ipcMain.handle('units:delete', async (event, id) => {
  try {
    const used = dbModule.get('SELECT id FROM product_units WHERE unit_id = ? LIMIT 1', [id]);
    if (used) return { success: false, message: 'Satuan sedang digunakan oleh produk, tidak dapat dihapus' };
    dbModule.run('DELETE FROM units WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('units:delete error:', error);
    return { success: false, message: 'Gagal menghapus satuan' };
  }
});

ipcMain.handle('units:toggleStatus', async (event, id) => {
  try {
    dbModule.run('UPDATE units SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('units:toggleStatus error:', error);
    return { success: false, message: 'Gagal mengubah status satuan' };
  }
});

// ============================================
// PRODUCT UNITS IPC HANDLERS
// ============================================

ipcMain.handle('productUnits:getByProduct', async (event, productId) => {
  try {
    const units = dbModule.all(
      `SELECT pu.*, u.abbreviation
       FROM product_units pu
       LEFT JOIN units u ON pu.unit_id = u.id
       WHERE pu.product_id = ?
       ORDER BY pu.is_default DESC, pu.conversion_qty ASC`,
      [productId]
    );
    return { success: true, units };
  } catch (error) {
    console.error('productUnits:getByProduct error:', error);
    return { success: false, message: 'Gagal memuat satuan produk' };
  }
});

ipcMain.handle('productUnits:save', async (event, productId, units) => {
  try {
    // Delete existing, re-insert all
    dbModule.run('DELETE FROM product_units WHERE product_id = ?', [productId]);
    for (const u of units) {
      dbModule.run(
        `INSERT INTO product_units (product_id, unit_id, unit_name, conversion_qty, selling_price, is_default)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productId, u.unit_id, u.unit_name, u.conversion_qty, u.selling_price, u.is_default ? 1 : 0]
      );
    }
    return { success: true };
  } catch (error) {
    console.error('productUnits:save error:', error);
    return { success: false, message: 'Gagal menyimpan satuan produk' };
  }
});

ipcMain.handle('productUnits:delete', async (event, id) => {
  try {
    dbModule.run('DELETE FROM product_units WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('productUnits:delete error:', error);
    return { success: false, message: 'Gagal menghapus satuan produk' };
  }
});

// ============================================
// PRODUCT PRICES (MULTI-HARGA / GROSIR) IPC HANDLERS
// ============================================

ipcMain.handle('productPrices:getByProduct', async (event, productId) => {
  try {
    const prices = dbModule.all(
      `SELECT * FROM product_prices WHERE product_id = ? ORDER BY min_qty ASC`,
      [productId]
    );
    return { success: true, prices };
  } catch (error) {
    console.error('productPrices:getByProduct error:', error);
    return { success: false, message: 'Gagal memuat harga produk' };
  }
});

ipcMain.handle('productPrices:save', async (event, productId, prices) => {
  try {
    dbModule.run('DELETE FROM product_prices WHERE product_id = ?', [productId]);
    for (const p of prices) {
      dbModule.run(
        `INSERT INTO product_prices (product_id, tier_name, min_qty, price) VALUES (?, ?, ?, ?)`,
        [productId, p.tier_name, p.min_qty, p.price]
      );
    }
    return { success: true };
  } catch (error) {
    console.error('productPrices:save error:', error);
    return { success: false, message: 'Gagal menyimpan harga produk' };
  }
});

// ============================================
// FINANCE DASHBOARD IPC HANDLERS
// ============================================

// Get finance dashboard data
ipcMain.handle('finance:getDashboard', async (event, filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = filters.endDate || new Date().toISOString().split('T')[0];

    // Get sales summary
    const salesData = dbModule.get(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(total_amount) as total_sales,
        SUM(subtotal) as total_revenue,
        AVG(total_amount) as avg_transaction
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
      AND status = 'completed'
    `, [startDate, endDate]);

    // Get expenses summary
    const expensesData = dbModule.get(`
      SELECT 
        COUNT(*) as total_expenses_count,
        SUM(amount) as total_expenses
      FROM expenses
      WHERE DATE(expense_date) BETWEEN DATE(?) AND DATE(?)
    `, [startDate, endDate]);

    // Get purchases summary (for calculating COGS)
    const purchasesData = dbModule.get(`
      SELECT 
        SUM(total_amount) as total_purchases
      FROM purchases
      WHERE DATE(purchase_date) BETWEEN DATE(?) AND DATE(?)
    `, [startDate, endDate]);

    // Calculate COGS (Cost of Goods Sold) from transaction items
    const cogsData = dbModule.get(`
      SELECT 
        SUM(ti.quantity * p.purchase_price) as cogs
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      INNER JOIN products p ON ti.product_id = p.id
      WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
      AND t.status = 'completed'
    `, [startDate, endDate]);

    const totalSales = salesData.total_sales || 0;
    const totalExpenses = expensesData.total_expenses || 0;
    const cogs = cogsData.cogs || 0;
    const grossProfit = totalSales - cogs;
    const netProfit = grossProfit - totalExpenses;

    const dashboard = {
      total_sales: totalSales,
      total_expenses: totalExpenses,
      gross_profit: grossProfit,
      net_profit: netProfit,
      total_transactions: salesData.total_transactions || 0,
      avg_transaction: salesData.avg_transaction || 0,
      total_purchases: purchasesData.total_purchases || 0,
      cogs: cogs
    };

    // Get daily sales and expenses for chart
    const dailyData = dbModule.all(`
      SELECT 
        DATE(transaction_date) as date,
        SUM(total_amount) as sales,
        0 as expenses
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
      AND status = 'completed'
      GROUP BY DATE(transaction_date)
      
      UNION ALL
      
      SELECT 
        DATE(expense_date) as date,
        0 as sales,
        SUM(amount) as expenses
      FROM expenses
      WHERE DATE(expense_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY DATE(expense_date)
      
      ORDER BY date
    `, [startDate, endDate, startDate, endDate]);

    // Aggregate daily data
    const chartData = {};
    dailyData.forEach(row => {
      if (!chartData[row.date]) {
        chartData[row.date] = { date: row.date, sales: 0, expenses: 0 };
      }
      chartData[row.date].sales += row.sales;
      chartData[row.date].expenses += row.expenses;
    });

    dashboard.chart_data = Object.values(chartData);

    return { success: true, dashboard };
  } catch (error) {
    console.error('Get finance dashboard error:', error);
    return { success: false, message: 'Gagal memuat dashboard keuangan' };
  }
});

// Get top selling products
ipcMain.handle('finance:getTopProducts', async (event, filters = {}) => {
  try {
    const startDate = filters.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = filters.endDate || new Date().toISOString().split('T')[0];
    const limit = filters.limit || 10;

    const topProducts = dbModule.all(`
      SELECT 
        ti.product_name,
        SUM(ti.quantity) as total_quantity,
        SUM(ti.subtotal) as total_sales,
        COUNT(DISTINCT ti.transaction_id) as transaction_count
      FROM transaction_items ti
      INNER JOIN transactions t ON ti.transaction_id = t.id
      WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
      AND t.status = 'completed'
      GROUP BY ti.product_id, ti.product_name
      ORDER BY total_quantity DESC
      LIMIT ?
    `, [startDate, endDate, limit]);

    return { success: true, topProducts };
  } catch (error) {
    console.error('Get top products error:', error);
    return { success: false, message: 'Gagal memuat produk terlaris' };
  }
});

// ============================================
// PRINTER IPC HANDLERS
// ============================================

ipcMain.handle('printer:getAll', async () => {
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return { success: true, printers };
  } catch (error) {
    console.error('printer:getAll error:', error);
    return { success: true, printers: [] };
  }
});

ipcMain.handle('labelPrint:getData', () => {
  return pendingLabelPrintData;
});

// Open barcode label print window
ipcMain.on('window:openBarcodeLabel', (event, data) => {
  pendingLabelPrintData = data;
  const labelWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Cetak Label Barcode'
  });
  labelWindow.loadFile(path.join(__dirname, 'src/views/barcode-label.html'));
});

// Open receipt window
ipcMain.on('window:openReceipt', (event, transactionId) => {
  const receiptWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load receipt page with transaction ID as query parameter
  receiptWindow.loadFile(path.join(__dirname, 'src/views/receipt.html'), {
    query: { id: transactionId.toString() }
  });
});

// ============================================
// REPORTS IPC HANDLERS
// ============================================

// Get users list for filter dropdown
ipcMain.handle('reports:getUsers', async () => {
  try {
    const users = dbModule.all(
      'SELECT id, full_name, username, role FROM users WHERE is_active = 1 ORDER BY full_name'
    );
    return { success: true, users };
  } catch (error) {
    console.error('reports:getUsers error:', error);
    return { success: false, message: 'Gagal memuat data user' };
  }
});

// Sales Report
ipcMain.handle('reports:getSalesReport', async (event, filters = {}) => {
  try {
    let whereClauses = ["t.status = 'completed'"];
    const params = [];

    if (filters.startDate) {
      whereClauses.push('DATE(t.transaction_date) >= DATE(?)');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClauses.push('DATE(t.transaction_date) <= DATE(?)');
      params.push(filters.endDate);
    }
    if (filters.userId) {
      whereClauses.push('t.user_id = ?');
      params.push(filters.userId);
    }
    if (filters.paymentMethod) {
      whereClauses.push('t.payment_method = ?');
      params.push(filters.paymentMethod);
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Transactions detail
    const transactions = dbModule.all(`
      SELECT 
        t.id,
        t.transaction_code,
        t.transaction_date,
        t.total_amount,
        t.payment_method,
        t.customer_name,
        u.full_name AS kasir_name,
        (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) AS item_count,
        (SELECT SUM(ti.quantity) FROM transaction_items ti WHERE ti.transaction_id = t.id) AS total_qty
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      ${where}
      ORDER BY t.transaction_date DESC
    `, params);

    // Summary
    const summary = dbModule.get(`
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(t.total_amount), 0) AS total_sales,
        COALESCE(AVG(t.total_amount), 0) AS avg_per_transaction,
        COALESCE(SUM(
          (SELECT SUM(ti.quantity) FROM transaction_items ti WHERE ti.transaction_id = t.id)
        ), 0) AS total_items_sold
      FROM transactions t
      ${where}
    `, params);

    // Chart data: sales per day
    const chartData = dbModule.all(`
      SELECT 
        DATE(t.transaction_date) AS date,
        COALESCE(SUM(t.total_amount), 0) AS total,
        COUNT(*) AS count
      FROM transactions t
      ${where}
      GROUP BY DATE(t.transaction_date)
      ORDER BY DATE(t.transaction_date) ASC
    `, params);

    return { success: true, transactions, summary, chartData };
  } catch (error) {
    console.error('reports:getSalesReport error:', error);
    return { success: false, message: 'Gagal memuat laporan penjualan' };
  }
});

// Profit Loss Report
ipcMain.handle('reports:getProfitLossReport', async (event, filters = {}) => {
  try {
    let whereClauses = ["t.status = 'completed'"];
    const params = [];

    if (filters.startDate) {
      whereClauses.push('DATE(t.transaction_date) >= DATE(?)');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClauses.push('DATE(t.transaction_date) <= DATE(?)');
      params.push(filters.endDate);
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // Revenue from sales
    const revenueRow = dbModule.get(`
      SELECT COALESCE(SUM(total_amount), 0) AS revenue
      FROM transactions t ${where}
    `, params);

    // COGS: sum(quantity * purchase_price) dari transaction_items
    const cogsRow = dbModule.get(`
      SELECT COALESCE(SUM(ti.quantity * p.purchase_price), 0) AS cogs
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN products p ON ti.product_id = p.id
      ${where.replace(/WHERE/, 'WHERE')}
    `, params);

    // Expenses
    let expWhere = 'WHERE 1=1';
    const expParams = [];
    if (filters.startDate) {
      expWhere += ' AND DATE(expense_date) >= DATE(?)';
      expParams.push(filters.startDate);
    }
    if (filters.endDate) {
      expWhere += ' AND DATE(expense_date) <= DATE(?)';
      expParams.push(filters.endDate);
    }

    const expensesRow = dbModule.get(`
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses ${expWhere}
    `, expParams);

    const expensesByCategory = dbModule.all(`
      SELECT category, COALESCE(SUM(amount), 0) AS total
      FROM expenses ${expWhere}
      GROUP BY category
      ORDER BY total DESC
    `, expParams);

    // Sales by product category
    const salesByCategory = dbModule.all(`
      SELECT 
        COALESCE(c.name, 'Tanpa Kategori') AS category_name,
        COALESCE(SUM(ti.subtotal), 0) AS revenue,
        COALESCE(SUM(ti.quantity * p.purchase_price), 0) AS cogs,
        COALESCE(SUM(ti.subtotal) - SUM(ti.quantity * p.purchase_price), 0) AS gross_profit
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN products p ON ti.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `, params);

    const revenue        = revenueRow?.revenue || 0;
    const cogs           = cogsRow?.cogs || 0;
    const grossProfit    = revenue - cogs;
    const totalExpenses  = expensesRow?.total_expenses || 0;
    const netProfit      = grossProfit - totalExpenses;

    return {
      success: true,
      summary: { revenue, cogs, grossProfit, totalExpenses, netProfit },
      expensesByCategory,
      salesByCategory
    };
  } catch (error) {
    console.error('reports:getProfitLossReport error:', error);
    return { success: false, message: 'Gagal memuat laporan laba rugi' };
  }
});

// Stock Report
ipcMain.handle('reports:getStockReport', async (event, filters = {}) => {
  try {
    let whereClauses = [];
    const params = [];

    if (filters.categoryId) {
      whereClauses.push('p.category_id = ?');
      params.push(filters.categoryId);
    }
    if (filters.stockStatus === 'low') {
      whereClauses.push('p.stock > 0 AND p.stock <= p.min_stock');
    } else if (filters.stockStatus === 'empty') {
      whereClauses.push('p.stock = 0');
    } else if (filters.stockStatus === 'safe') {
      whereClauses.push('p.stock > p.min_stock');
    }

    const where = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const products = dbModule.all(`
      SELECT 
        p.id,
        p.barcode,
        p.name,
        p.stock,
        p.min_stock,
        p.unit,
        p.purchase_price,
        p.selling_price,
        p.is_active,
        COALESCE(c.name, 'Tanpa Kategori') AS category_name,
        (p.stock * p.purchase_price) AS inventory_value,
        CASE
          WHEN p.stock = 0 THEN 'empty'
          WHEN p.stock <= p.min_stock THEN 'low'
          ELSE 'safe'
        END AS stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.stock ASC, p.name ASC
    `, params);

    const summary = dbModule.get(`
      SELECT
        COUNT(*) AS total_sku,
        COALESCE(SUM(p.stock * p.purchase_price), 0) AS total_inventory_value,
        SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) AS active_products,
        SUM(CASE WHEN p.stock > 0 AND p.stock <= p.min_stock THEN 1 ELSE 0 END) AS low_stock_count,
        SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END) AS empty_stock_count
      FROM products p
    `);

    const categories = dbModule.all('SELECT id, name FROM categories ORDER BY name');

    return { success: true, products, summary, categories };
  } catch (error) {
    console.error('reports:getStockReport error:', error);
    return { success: false, message: 'Gagal memuat laporan stok' };
  }
});

// Cashier Report
ipcMain.handle('reports:getCashierReport', async (event, filters = {}) => {
  try {
    let whereClauses = ["t.status = 'completed'"];
    const params = [];

    if (filters.startDate) {
      whereClauses.push('DATE(t.transaction_date) >= DATE(?)');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      whereClauses.push('DATE(t.transaction_date) <= DATE(?)');
      params.push(filters.endDate);
    }
    if (filters.userId) {
      whereClauses.push('t.user_id = ?');
      params.push(filters.userId);
    }

    const where = 'WHERE ' + whereClauses.join(' AND ');

    const cashierStats = dbModule.all(`
      SELECT 
        u.id,
        u.full_name,
        u.username,
        u.role,
        COUNT(t.id) AS total_transactions,
        COALESCE(SUM(t.total_amount), 0) AS total_sales,
        COALESCE(AVG(t.total_amount), 0) AS avg_per_transaction,
        COALESCE(MAX(t.total_amount), 0) AS highest_transaction
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id AND ${whereClauses.join(' AND ')}
      WHERE u.is_active = 1
      GROUP BY u.id, u.full_name, u.username, u.role
      ORDER BY total_sales DESC
    `, params);

    // Daily chart per kasir (for bar chart)
    const dailyChart = dbModule.all(`
      SELECT 
        DATE(t.transaction_date) AS date,
        u.full_name AS kasir_name,
        COUNT(t.id) AS transactions,
        COALESCE(SUM(t.total_amount), 0) AS total
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      ${where}
      GROUP BY DATE(t.transaction_date), t.user_id
      ORDER BY date ASC
    `, params);

    return { success: true, cashierStats, dailyChart };
  } catch (error) {
    console.error('reports:getCashierReport error:', error);
    return { success: false, message: 'Gagal memuat laporan kasir' };
  }
});

// ============================================
// SETTINGS IPC HANDLERS
// ============================================

ipcMain.handle('settings:getAll', async () => {
  try {
    const rows = dbModule.all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(row => { settings[row.key] = row.value; });
    return { success: true, settings };
  } catch (error) {
    console.error('settings:getAll error:', error);
    return { success: false, message: 'Gagal memuat pengaturan' };
  }
});

ipcMain.handle('settings:get', async (event, key) => {
  try {
    const row = dbModule.get('SELECT value FROM settings WHERE key = ?', [key]);
    return { success: true, value: row?.value ?? null };
  } catch (error) {
    console.error('settings:get error:', error);
    return { success: false, message: 'Gagal memuat pengaturan' };
  }
});

ipcMain.handle('settings:save', async (event, data) => {
  try {
    Object.entries(data).forEach(([key, value]) => {
      dbModule.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value ?? '']
      );
    });
    return { success: true };
  } catch (error) {
    console.error('settings:save error:', error);
    return { success: false, message: 'Gagal menyimpan pengaturan' };
  }
});

ipcMain.handle('settings:reset', async () => {
  try {
    const defaults = [
      ['store_name', 'TOKO RETAIL'],
      ['store_address', 'Jl. Contoh No. 123, Kota'],
      ['store_phone', '021-12345678'],
      ['store_email', 'info@tokoretail.com'],
      ['tax_enabled', '0'],
      ['tax_percent', '0'],
      ['receipt_footer', 'Terima Kasih - Barang yang sudah dibeli tidak dapat ditukar'],
      ['auto_backup', '1'],
      ['backup_days', '7'],
      ['store_logo', ''],
      ['label_size_default', '4x2.5'],
      ['label_printer_default', '']
    ];
    defaults.forEach(([key, value]) => {
      dbModule.run(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    });
    return { success: true };
  } catch (error) {
    console.error('settings:reset error:', error);
    return { success: false, message: 'Gagal reset pengaturan' };
  }
});

// ============================================
// BACKUP IPC HANDLERS
// ============================================

ipcMain.handle('backup:selectFolder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Pilih Folder Backup'
    });
    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }
    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('backup:selectFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Database', extensions: ['db'] }],
      title: 'Pilih File Backup'
    });
    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }
    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('backup:create', async () => {
  try {
    const dbPath = path.join(__dirname, 'pos-retail.db');
    if (!fs.existsSync(dbPath)) {
      return { success: false, message: 'File database tidak ditemukan' };
    }

    // Ask user where to save
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultFilename = `backup_${timestamp}.db`;

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Simpan Backup',
      defaultPath: defaultFilename,
      filters: [{ name: 'Database Backup', extensions: ['db'] }]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.copyFileSync(dbPath, result.filePath);

    return { success: true, filePath: result.filePath, filename: path.basename(result.filePath) };
  } catch (error) {
    console.error('backup:create error:', error);
    return { success: false, message: 'Gagal membuat backup: ' + error.message };
  }
});

ipcMain.handle('backup:restore', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, message: 'File backup tidak ditemukan' };
    }

    const dbPath = path.join(__dirname, 'pos-retail.db');

    // Create auto-backup before restore
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const autoBackupPath = path.join(__dirname, `pos-retail.backup-before-restore.${timestamp}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, autoBackupPath);
    }

    // Copy backup file to db path
    fs.copyFileSync(filePath, dbPath);

    // Restart app
    app.relaunch();
    app.exit(0);

    return { success: true };
  } catch (error) {
    console.error('backup:restore error:', error);
    return { success: false, message: 'Gagal restore database: ' + error.message };
  }
});

// Shell: open external URL
ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false };
  }
});

// ============================================
// DASHBOARD STATS IPC HANDLER
// ============================================

ipcMain.handle('dashboard:getStats', async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Total penjualan hari ini
    const salesRow = dbModule.get(`
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(*) AS total_transactions
      FROM transactions
      WHERE DATE(transaction_date) = DATE(?)
      AND status = 'completed'
    `, [today]);

    // Total produk aktif
    const productsRow = dbModule.get(
      'SELECT COUNT(*) AS total FROM products WHERE is_active = 1'
    );

    // Stok menipis (stock <= min_stock tapi > 0)
    const lowStockRow = dbModule.get(
      'SELECT COUNT(*) AS total FROM products WHERE stock <= min_stock AND stock > 0 AND is_active = 1'
    );

    // Stok habis
    const emptyStockRow = dbModule.get(
      'SELECT COUNT(*) AS total FROM products WHERE stock = 0 AND is_active = 1'
    );

    // Total transaksi bulan ini
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const monthStart = firstOfMonth.toISOString().split('T')[0];

    const monthSalesRow = dbModule.get(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_sales
      FROM transactions
      WHERE DATE(transaction_date) >= DATE(?)
      AND status = 'completed'
    `, [monthStart]);

    // Total user aktif
    const usersRow = dbModule.get(
      'SELECT COUNT(*) AS total FROM users WHERE is_active = 1'
    );

    return {
      success: true,
      stats: {
        today_sales:       salesRow?.total_sales       || 0,
        today_transactions: salesRow?.total_transactions || 0,
        total_products:    productsRow?.total          || 0,
        low_stock:         lowStockRow?.total          || 0,
        empty_stock:       emptyStockRow?.total        || 0,
        month_sales:       monthSalesRow?.total_sales  || 0,
        total_users:       usersRow?.total             || 0
      }
    };
  } catch (error) {
    console.error('dashboard:getStats error:', error);
    return { success: false, message: 'Gagal memuat statistik dashboard' };
  }
});

// ============================================
// DASHBOARD CHARTS IPC HANDLERS
// ============================================

function getDashboardDateRange(period) {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  switch (period) {
    case '7days': {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start: fmt(s), end: fmt(today) };
    }
    case '30days': {
      const s = new Date(today); s.setDate(s.getDate() - 29);
      return { start: fmt(s), end: fmt(today) };
    }
    case 'month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: fmt(s), end: fmt(today) };
    }
    default: // today
      return { start: fmt(today), end: fmt(today) };
  }
}

// Grafik 1 — Trend Penjualan (periode ini vs periode sebelumnya)
ipcMain.handle('dashboard:getSalesTrend', async (event, period = '7days') => {
  try {
    const { start, end } = getDashboardDateRange(period);
    const startDate = new Date(start);
    const endDate   = new Date(end);
    const diffDays  = Math.round((endDate - startDate) / 86400000) + 1;

    const prevEnd   = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);   prevStart.setDate(prevStart.getDate() - diffDays + 1);
    const fmt = d => d.toISOString().split('T')[0];

    const rows = dbModule.all(`
      SELECT DATE(transaction_date) as date,
             COALESCE(SUM(total_amount),0) as total,
             COUNT(*) as count
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND status = 'completed'
      GROUP BY DATE(transaction_date)
      ORDER BY date
    `, [start, end]);

    const prevRows = dbModule.all(`
      SELECT DATE(transaction_date) as date,
             COALESCE(SUM(total_amount),0) as total,
             COUNT(*) as count
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND status = 'completed'
      GROUP BY DATE(transaction_date)
      ORDER BY date
    `, [fmt(prevStart), fmt(prevEnd)]);

    // Buat array label (tanggal periode ini)
    const labels = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      labels.push(fmt(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const mapByDate = (arr) => {
      const m = {};
      arr.forEach(r => { m[r.date] = r; });
      return m;
    };
    const curMap  = mapByDate(rows);
    const prevMap = mapByDate(prevRows);

    const currentTotals  = labels.map((d, i) => curMap[d]?.total  || 0);
    const previousTotals = labels.map((d, i) => {
      const pd = fmt(new Date(new Date(prevStart).setDate(prevStart.getDate() + i)));
      return prevMap[pd]?.total || 0;
    });
    const currentCounts  = labels.map(d => curMap[d]?.count || 0);

    return { success: true, labels, currentTotals, previousTotals, currentCounts };
  } catch (error) {
    console.error('dashboard:getSalesTrend error:', error);
    return { success: false, message: 'Gagal memuat trend penjualan' };
  }
});

// Grafik 2 — Top 5 Kategori Terlaris
ipcMain.handle('dashboard:getTopCategories', async (event, period = 'today') => {
  try {
    const { start, end } = getDashboardDateRange(period);
    const rows = dbModule.all(`
      SELECT c.name as category,
             COALESCE(SUM(ti.quantity * ti.price), 0) as total,
             COALESCE(SUM(ti.quantity), 0) as qty
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      JOIN products p ON p.id = ti.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND t.status = 'completed'
      GROUP BY p.category_id
      ORDER BY total DESC
      LIMIT 5
    `, [start, end]);
    return { success: true, rows };
  } catch (error) {
    console.error('dashboard:getTopCategories error:', error);
    return { success: false, message: 'Gagal memuat kategori terlaris' };
  }
});

// Grafik 3 — Top 5 Produk Terlaris
ipcMain.handle('dashboard:getTopProducts', async (event, period = 'today', mode = 'qty') => {
  try {
    const { start, end } = getDashboardDateRange(period);
    const orderBy = mode === 'value' ? 'total DESC' : 'qty DESC';
    const rows = dbModule.all(`
      SELECT p.name as product,
             COALESCE(SUM(ti.quantity), 0) as qty,
             COALESCE(SUM(ti.quantity * ti.price), 0) as total
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      JOIN products p ON p.id = ti.product_id
      WHERE DATE(t.transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND t.status = 'completed'
      GROUP BY ti.product_id
      ORDER BY ${orderBy}
      LIMIT 5
    `, [start, end]);
    return { success: true, rows };
  } catch (error) {
    console.error('dashboard:getTopProducts error:', error);
    return { success: false, message: 'Gagal memuat produk terlaris' };
  }
});

// Grafik 4 — Metode Pembayaran
ipcMain.handle('dashboard:getPaymentMethods', async (event, period = 'today') => {
  try {
    const { start, end } = getDashboardDateRange(period);
    const rows = dbModule.all(`
      SELECT payment_method,
             COUNT(*) as count,
             COALESCE(SUM(total_amount), 0) as total
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND status = 'completed'
      GROUP BY payment_method
      ORDER BY total DESC
    `, [start, end]);
    return { success: true, rows };
  } catch (error) {
    console.error('dashboard:getPaymentMethods error:', error);
    return { success: false, message: 'Gagal memuat metode pembayaran' };
  }
});

// Summary Extra — transaksi tertinggi, peak hour, rata-rata
ipcMain.handle('dashboard:getSummaryExtra', async (event, period = 'today') => {
  try {
    const { start, end } = getDashboardDateRange(period);

    const highest = dbModule.get(`
      SELECT transaction_code, total_amount, transaction_date
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND status = 'completed'
      ORDER BY total_amount DESC
      LIMIT 1
    `, [start, end]);

    const peakHour = dbModule.get(`
      SELECT strftime('%H', transaction_date) as hour, COUNT(*) as count
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND status = 'completed'
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `, [start, end]);

    const avg = dbModule.get(`
      SELECT COALESCE(AVG(total_amount), 0) as avg_amount,
             COUNT(*) as total_count
      FROM transactions
      WHERE DATE(transaction_date) BETWEEN DATE(?) AND DATE(?)
        AND status = 'completed'
    `, [start, end]);

    return { success: true, highest, peakHour, avg };
  } catch (error) {
    console.error('dashboard:getSummaryExtra error:', error);
    return { success: false, message: 'Gagal memuat summary' };
  }
});

// ============================================
// CUSTOMERS IPC HANDLERS
// ============================================

ipcMain.handle('customers:getAll', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT c.*,
        COALESCE((SELECT SUM(r.remaining_amount) FROM receivables r WHERE r.customer_id = c.id AND r.status != 'paid'), 0) as outstanding
      FROM customers c
      WHERE 1=1
    `;
    const params = [];
    if (filters.search) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.is_active !== undefined && filters.is_active !== '') {
      sql += ' AND c.is_active = ?';
      params.push(filters.is_active);
    }
    sql += ' ORDER BY c.name';
    const customers = dbModule.all(sql, params);
    return { success: true, customers };
  } catch (error) {
    console.error('customers:getAll error:', error);
    return { success: false, message: 'Gagal memuat data pelanggan' };
  }
});

ipcMain.handle('customers:getById', async (event, id) => {
  try {
    const customer = dbModule.get(`
      SELECT c.*,
        COALESCE((SELECT SUM(r.remaining_amount) FROM receivables r WHERE r.customer_id = c.id AND r.status != 'paid'), 0) as outstanding
      FROM customers c WHERE c.id = ?
    `, [id]);
    if (!customer) return { success: false, message: 'Pelanggan tidak ditemukan' };
    return { success: true, customer };
  } catch (error) {
    console.error('customers:getById error:', error);
    return { success: false, message: 'Gagal memuat data pelanggan' };
  }
});

ipcMain.handle('customers:getActiveList', async (event) => {
  try {
    const customers = dbModule.all(
      `SELECT c.id, c.name, c.customer_code, c.phone, c.credit_limit,
        COALESCE((SELECT SUM(r.remaining_amount) FROM receivables r WHERE r.customer_id = c.id AND r.status != 'paid'), 0) as outstanding
       FROM customers c WHERE c.is_active = 1 ORDER BY c.name`
    );
    return { success: true, customers };
  } catch (error) {
    console.error('customers:getActiveList error:', error);
    return { success: false, message: 'Gagal memuat daftar pelanggan' };
  }
});

ipcMain.handle('customers:create', async (event, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM customers WHERE customer_code = ?', [data.customer_code]);
    if (existing) return { success: false, message: 'Kode pelanggan sudah digunakan' };
    dbModule.run(
      `INSERT INTO customers (customer_code, name, phone, address, credit_limit, is_active, notes)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [data.customer_code, data.name, data.phone || '', data.address || '', data.credit_limit || 0, data.notes || '']
    );
    const inserted = dbModule.get('SELECT id FROM customers WHERE customer_code = ?', [data.customer_code]);
    return { success: true, customerId: inserted ? inserted.id : null };
  } catch (error) {
    console.error('customers:create error:', error);
    return { success: false, message: 'Gagal menambahkan pelanggan' };
  }
});

ipcMain.handle('customers:update', async (event, id, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM customers WHERE customer_code = ? AND id != ?', [data.customer_code, id]);
    if (existing) return { success: false, message: 'Kode pelanggan sudah digunakan' };
    dbModule.run(
      `UPDATE customers SET customer_code=?, name=?, phone=?, address=?, credit_limit=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [data.customer_code, data.name, data.phone || '', data.address || '', data.credit_limit || 0, data.notes || '', id]
    );
    return { success: true };
  } catch (error) {
    console.error('customers:update error:', error);
    return { success: false, message: 'Gagal mengupdate pelanggan' };
  }
});

ipcMain.handle('customers:delete', async (event, id) => {
  try {
    const hasReceivables = dbModule.get('SELECT id FROM receivables WHERE customer_id = ? LIMIT 1', [id]);
    if (hasReceivables) return { success: false, message: 'Pelanggan memiliki data piutang, tidak dapat dihapus' };
    dbModule.run('DELETE FROM customers WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('customers:delete error:', error);
    return { success: false, message: 'Gagal menghapus pelanggan' };
  }
});

ipcMain.handle('customers:toggleStatus', async (event, id) => {
  try {
    dbModule.run(
      `UPDATE customers SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [id]
    );
    return { success: true };
  } catch (error) {
    console.error('customers:toggleStatus error:', error);
    return { success: false, message: 'Gagal mengubah status pelanggan' };
  }
});

// ============================================
// RECEIVABLES IPC HANDLERS
// ============================================

ipcMain.handle('receivables:getAll', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT r.*, c.name as customer_name, c.customer_code, c.phone as customer_phone,
             t.transaction_code, t.transaction_date
      FROM receivables r
      JOIN customers c ON r.customer_id = c.id
      JOIN transactions t ON r.transaction_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (filters.customer_id) {
      sql += ' AND r.customer_id = ?';
      params.push(filters.customer_id);
    }
    if (filters.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY r.created_at DESC';
    const receivables = dbModule.all(sql, params);
    return { success: true, receivables };
  } catch (error) {
    console.error('receivables:getAll error:', error);
    return { success: false, message: 'Gagal memuat data piutang' };
  }
});

ipcMain.handle('receivables:getById', async (event, id) => {
  try {
    const receivable = dbModule.get(`
      SELECT r.*, c.name as customer_name, c.customer_code, c.phone as customer_phone,
             t.transaction_code, t.transaction_date
      FROM receivables r
      JOIN customers c ON r.customer_id = c.id
      JOIN transactions t ON r.transaction_id = t.id
      WHERE r.id = ?
    `, [id]);
    if (!receivable) return { success: false, message: 'Piutang tidak ditemukan' };
    const payments = dbModule.all(
      `SELECT rp.*, u.full_name as user_name FROM receivable_payments rp
       LEFT JOIN users u ON rp.user_id = u.id
       WHERE rp.receivable_id = ? ORDER BY rp.payment_date DESC`,
      [id]
    );
    return { success: true, receivable, payments };
  } catch (error) {
    console.error('receivables:getById error:', error);
    return { success: false, message: 'Gagal memuat data piutang' };
  }
});

ipcMain.handle('receivables:getSummaryByCustomer', async (event) => {
  try {
    const summary = dbModule.all(`
      SELECT c.id, c.customer_code, c.name, c.phone, c.credit_limit,
        COALESCE(SUM(CASE WHEN r.status != 'paid' THEN r.remaining_amount ELSE 0 END), 0) as outstanding,
        COUNT(CASE WHEN r.status = 'unpaid' THEN 1 END) as count_unpaid,
        COUNT(CASE WHEN r.status = 'partial' THEN 1 END) as count_partial,
        COUNT(CASE WHEN r.status = 'paid' THEN 1 END) as count_paid
      FROM customers c
      LEFT JOIN receivables r ON r.customer_id = c.id
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY outstanding DESC, c.name
    `);
    return { success: true, summary };
  } catch (error) {
    console.error('receivables:getSummaryByCustomer error:', error);
    return { success: false, message: 'Gagal memuat ringkasan piutang' };
  }
});

ipcMain.handle('receivables:pay', async (event, receivableId, paymentData) => {
  try {
    if (!currentUser) return { success: false, message: 'User tidak ditemukan' };

    const receivable = dbModule.get('SELECT * FROM receivables WHERE id = ?', [receivableId]);
    if (!receivable) return { success: false, message: 'Piutang tidak ditemukan' };
    if (receivable.status === 'paid') return { success: false, message: 'Piutang sudah lunas' };

    const amount = parseFloat(paymentData.amount);
    if (!amount || amount <= 0) return { success: false, message: 'Jumlah pembayaran tidak valid' };
    if (amount > receivable.remaining_amount) return { success: false, message: 'Jumlah pembayaran melebihi sisa piutang' };

    const newPaid = receivable.paid_amount + amount;
    const newRemaining = receivable.remaining_amount - amount;
    const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

    dbModule.run(
      `UPDATE receivables SET paid_amount=?, remaining_amount=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [newPaid, newRemaining, newStatus, receivableId]
    );

    dbModule.run(
      `INSERT INTO receivable_payments (receivable_id, payment_date, amount, payment_method, notes, user_id)
       VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
      [receivableId, amount, paymentData.payment_method || 'cash', paymentData.notes || '', currentUser.id]
    );

    return { success: true, newStatus, newRemaining, newPaid };
  } catch (error) {
    console.error('receivables:pay error:', error);
    return { success: false, message: 'Gagal memproses pembayaran piutang' };
  }
});

ipcMain.handle('receivables:getPayments', async (event, receivableId) => {
  try {
    const payments = dbModule.all(
      `SELECT rp.*, u.full_name as user_name FROM receivable_payments rp
       LEFT JOIN users u ON rp.user_id = u.id
       WHERE rp.receivable_id = ? ORDER BY rp.payment_date DESC`,
      [receivableId]
    );
    return { success: true, payments };
  } catch (error) {
    console.error('receivables:getPayments error:', error);
    return { success: false, message: 'Gagal memuat riwayat pembayaran' };
  }
});
// ============================================
// SHIFTS MANAGEMENT IPC HANDLERS
// ============================================

ipcMain.handle('shifts:getAll', async (event) => {
  try {
    const shifts = dbModule.all('SELECT * FROM shifts ORDER BY start_time ASC');
    return { success: true, shifts };
  } catch (error) {
    console.error('shifts:getAll error:', error);
    return { success: false, message: 'Gagal memuat data shift' };
  }
});

ipcMain.handle('shifts:getActive', async (event) => {
  try {
    const shifts = dbModule.all('SELECT * FROM shifts WHERE is_active = 1 ORDER BY start_time ASC');
    return { success: true, shifts };
  } catch (error) {
    console.error('shifts:getActive error:', error);
    return { success: false, message: 'Gagal memuat data shift' };
  }
});

ipcMain.handle('shifts:getById', async (event, id) => {
  try {
    const shift = dbModule.get('SELECT * FROM shifts WHERE id = ?', [id]);
    if (!shift) return { success: false, message: 'Shift tidak ditemukan' };
    return { success: true, shift };
  } catch (error) {
    console.error('shifts:getById error:', error);
    return { success: false, message: 'Gagal memuat data shift' };
  }
});

ipcMain.handle('shifts:create', async (event, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM shifts WHERE name = ?', [data.name]);
    if (existing) return { success: false, message: 'Nama shift sudah digunakan' };

    dbModule.run(
      `INSERT INTO shifts (name, start_time, end_time, is_active) VALUES (?, ?, ?, 1)`,
      [data.name, data.start_time, data.end_time]
    );
    return { success: true };
  } catch (error) {
    console.error('shifts:create error:', error);
    return { success: false, message: 'Gagal menambahkan shift' };
  }
});

ipcMain.handle('shifts:update', async (event, id, data) => {
  try {
    const existing = dbModule.get('SELECT id FROM shifts WHERE name = ? AND id != ?', [data.name, id]);
    if (existing) return { success: false, message: 'Nama shift sudah digunakan' };

    dbModule.run(
      `UPDATE shifts SET name = ?, start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [data.name, data.start_time, data.end_time, id]
    );
    return { success: true };
  } catch (error) {
    console.error('shifts:update error:', error);
    return { success: false, message: 'Gagal mengupdate shift' };
  }
});

ipcMain.handle('shifts:delete', async (event, id) => {
  try {
    const used = dbModule.get('SELECT id FROM cash_drawer WHERE shift_id = ? LIMIT 1', [id]);
    if (used) return { success: false, message: 'Shift tidak dapat dihapus karena sudah digunakan' };

    dbModule.run('DELETE FROM shifts WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('shifts:delete error:', error);
    return { success: false, message: 'Gagal menghapus shift' };
  }
});

ipcMain.handle('shifts:toggleStatus', async (event, id) => {
  try {
    dbModule.run(
      `UPDATE shifts SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    return { success: true };
  } catch (error) {
    console.error('shifts:toggleStatus error:', error);
    return { success: false, message: 'Gagal mengubah status shift' };
  }
});

// Shift summary for finance page
ipcMain.handle('shifts:getSummary', async (event, filters = {}) => {
  try {
    let sql = `
      SELECT
        s.id as shift_id,
        s.name as shift_name,
        s.start_time,
        s.end_time,
        COUNT(cd.id) as session_count,
        SUM(cd.total_cash_sales) as total_cash_sales,
        SUM(cd.total_sales) as total_sales,
        SUM(cd.total_expenses) as total_expenses,
        SUM(COALESCE(cd.closing_balance, 0) - COALESCE(cd.expected_balance, 0)) as total_difference
      FROM shifts s
      LEFT JOIN cash_drawer cd ON cd.shift_id = s.id
    `;
    const params = [];
    const where = [];

    if (filters.startDate) {
      where.push('DATE(cd.open_time) >= DATE(?)');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      where.push('DATE(cd.open_time) <= DATE(?)');
      params.push(filters.endDate);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');

    sql += ' GROUP BY s.id, s.name, s.start_time, s.end_time ORDER BY s.start_time ASC';

    const summary = dbModule.all(sql, params);
    return { success: true, summary };
  } catch (error) {
    console.error('shifts:getSummary error:', error);
    return { success: false, message: 'Gagal memuat ringkasan shift' };
  }
});
