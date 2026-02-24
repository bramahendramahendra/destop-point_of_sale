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
    const transactionResult = dbModule.run(
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

    const transactionId = transactionResult.lastInsertRowid;
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