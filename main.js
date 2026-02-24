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

    const result = dbModule.run(
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

    console.log('Product created successfully:', productData.name);
    return { success: true, productId: result.lastInsertRowid };

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
      status: 'completed'
    };

    console.log('Transaction data prepared:', txData);

    // 1. Insert transaction
    dbModule.run(
      `INSERT INTO transactions (
        transaction_code, user_id, transaction_date, subtotal, 
        discount_type, discount_value, discount_amount, 
        tax_percent, tax_amount, total_amount, 
        payment_method, payment_amount, change_amount, 
        customer_name, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        txData.status
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
        price: item.price || 0,
        subtotal: item.subtotal || 0
      };

      // Insert transaction item
      dbModule.run(
        `INSERT INTO transaction_items (
          transaction_id, product_id, product_name, barcode, 
          quantity, unit, price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemData.transaction_id,
          itemData.product_id,
          itemData.product_name,
          itemData.barcode,
          itemData.quantity,
          itemData.unit,
          itemData.price,
          itemData.subtotal
        ]
      );

      // Update product stock
      dbModule.run(
        'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [itemData.quantity, itemData.product_id]
      );

      // Create stock mutation
      dbModule.run(
        `INSERT INTO stock_mutations (
          product_id, mutation_type, quantity, reference_type, reference_id, 
          notes, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          itemData.product_id,
          'out',
          itemData.quantity,
          'sale',
          transactionId,
          `Penjualan ${txData.transaction_code}`,
          txData.user_id
        ]
      );

      console.log('Item processed successfully:', item.product_name);
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
      SELECT * FROM cash_drawer 
      WHERE user_id = ? 
      AND DATE(open_time) = DATE(?) 
      AND status = 'open'
      ORDER BY open_time DESC 
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

    // Check if already opened today
    const existing = dbModule.get(`
      SELECT id FROM cash_drawer 
      WHERE user_id = ? 
      AND DATE(open_time) = DATE(?) 
      AND status = 'open'
    `, [currentUser.id, today]);

    if (existing) {
      return { success: false, message: 'Kas sudah dibuka hari ini' };
    }

    // Insert new cash drawer
    dbModule.run(
      `INSERT INTO cash_drawer (
        user_id, open_time, opening_balance, status, notes
      ) VALUES (?, ?, ?, 'open', ?)`,
      [currentUser.id, new Date().toISOString(), data.opening_balance, data.notes || '']
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
      SELECT cd.*, u.full_name as cashier_name
      FROM cash_drawer cd
      LEFT JOIN users u ON cd.user_id = u.id
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
      SELECT cd.*, u.full_name as cashier_name
      FROM cash_drawer cd
      LEFT JOIN users u ON cd.user_id = u.id
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

    // Get expenses for that day
    const expenses = dbModule.all(`
      SELECT * FROM expenses
      WHERE DATE(expense_date) = DATE(?)
      AND user_id = ?
      ORDER BY expense_date DESC
    `, [date, cashDrawer.user_id]);

    cashDrawer.transactions = transactions;
    cashDrawer.expenses = expenses;

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
        expenseData.payment_method || '',
        currentUser.id,
        expenseData.notes || ''
      ]
    );

    // Update cash drawer if payment is cash and today
    if (expenseData.payment_method === 'cash') {
      const today = new Date().toISOString().split('T')[0];
      const expenseDate = expenseData.expense_date.split('T')[0];
      
      if (today === expenseDate) {
        await ipcMain.emit('cashDrawer:updateExpenses', event, expenseData.amount);
      }
    }

    console.log('Expense created successfully');
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
        purchase_code, supplier_name, purchase_date, total_amount,
        payment_status, paid_amount, remaining_amount, user_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseData.purchase_code,
        purchaseData.supplier_name || '',
        purchaseData.purchase_date,
        purchaseData.total_amount,
        purchaseData.payment_status,
        purchaseData.paid_amount,
        remaining,
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
       SET supplier_name = ?, purchase_date = ?, total_amount = ?,
           payment_status = ?, paid_amount = ?, remaining_amount = ?, notes = ?
       WHERE id = ?`,
      [
        purchaseData.supplier_name || '',
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