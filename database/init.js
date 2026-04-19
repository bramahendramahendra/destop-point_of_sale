const { initDb, run, get, query } = require('./db');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  console.log('Initializing database...');

  // Initialize database connection
  await initDb();

  console.log('Creating tables...');

  // Create users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'kasir')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  run(createUsersTable);
  console.log('Users table created successfully');

  // Create categories table
  const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  run(createCategoriesTable);
  console.log('Categories table created successfully');

  // Create products table
  const createProductsTable = `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      unit TEXT DEFAULT 'pcs',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `;

  run(createProductsTable);
  console.log('Products table created successfully');

  // Create transactions table
  const createTransactionsTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      discount_type TEXT DEFAULT 'none',
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      change_amount REAL DEFAULT 0,
      customer_name TEXT,
      notes TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  run(createTransactionsTable);
  console.log('Transactions table created successfully');

  // Create transaction_items table
  const createTransactionItemsTable = `
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      barcode TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      price REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `;

  run(createTransactionItemsTable);
  console.log('Transaction items table created successfully');

  // Create stock_mutations table
  const createStockMutationsTable = `
    CREATE TABLE IF NOT EXISTS stock_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      mutation_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  run(createStockMutationsTable);
  console.log('Stock mutations table created successfully');

  // Create cash_drawer table
  const createCashDrawerTable = `
    CREATE TABLE IF NOT EXISTS cash_drawer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      open_time DATETIME NOT NULL,
      close_time DATETIME,
      opening_balance REAL NOT NULL,
      closing_balance REAL,
      expected_balance REAL,
      difference REAL,
      total_sales REAL DEFAULT 0,
      total_cash_sales REAL DEFAULT 0,
      total_expenses REAL DEFAULT 0,
      status TEXT DEFAULT 'open',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  run(createCashDrawerTable);
  console.log('Cash drawer table created successfully');

  // Create expenses table
  const createExpensesTable = `
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_date DATE NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      user_id INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  run(createExpensesTable);
  console.log('Expenses table created successfully');

  // Create suppliers table
  const createSuppliersTable = `
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      contact_person TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  run(createSuppliersTable);
  console.log('Suppliers table created successfully');

  // Create purchases table
  const createPurchasesTable = `
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_code TEXT UNIQUE NOT NULL,
      supplier_name TEXT,
      supplier_id INTEGER REFERENCES suppliers(id),
      purchase_date DATE NOT NULL,
      total_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'unpaid',
      paid_amount REAL DEFAULT 0,
      remaining_amount REAL,
      user_id INTEGER NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  run(createPurchasesTable);
  console.log('Purchases table created successfully');

  // Create purchase_items table
  const createPurchaseItemsTable = `
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      purchase_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `;

  run(createPurchaseItemsTable);
  console.log('Purchase items table created successfully');

// Create settings table
  const createSettingsTable = `
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  run(createSettingsTable);
  console.log('Settings table created successfully');

    // Create supplier_returns table
  const createSupplierReturnsTable = `
    CREATE TABLE IF NOT EXISTS supplier_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_code TEXT UNIQUE NOT NULL,
      purchase_id INTEGER NOT NULL,
      supplier_id INTEGER,
      supplier_name TEXT,
      return_date DATE NOT NULL,
      total_return_amount REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'diproses',
      notes TEXT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;
  run(createSupplierReturnsTable);
  console.log('Supplier returns table created successfully');

  // Create supplier_return_items table
  const createSupplierReturnItemsTable = `
    CREATE TABLE IF NOT EXISTS supplier_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      purchase_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT,
      purchase_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (return_id) REFERENCES supplier_returns(id),
      FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `;
  run(createSupplierReturnItemsTable);
  console.log('Supplier return items table created successfully');

  // Create shifts table
  const createShiftsTable = `
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  run(createShiftsTable);
  console.log('Shifts table created successfully');

  // Create units table
  const createUnitsTable = `
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      abbreviation TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  run(createUnitsTable);
  console.log('Units table created successfully');

  // Create product_units table
  const createProductUnitsTable = `
    CREATE TABLE IF NOT EXISTS product_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      unit_name TEXT NOT NULL,
      conversion_qty REAL NOT NULL DEFAULT 1,
      selling_price REAL NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (unit_id) REFERENCES units(id)
    )
  `;
  run(createProductUnitsTable);
  console.log('Product units table created successfully');

  // Create product_prices table (multi-price / harga grosir)
  const createProductPricesTable = `
    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      tier_name TEXT NOT NULL,
      min_qty REAL NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `;
  run(createProductPricesTable);
  console.log('Product prices table created successfully');

  // Create customers table
  const createCustomersTable = `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  run(createCustomersTable);
  console.log('Customers table created successfully');

  // Create receivables table
  const createReceivablesTable = `
    CREATE TABLE IF NOT EXISTS receivables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      remaining_amount REAL NOT NULL,
      status TEXT DEFAULT 'unpaid',
      due_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `;
  run(createReceivablesTable);
  console.log('Receivables table created successfully');

  // Create receivable_payments table
  const createReceivablePaymentsTable = `
    CREATE TABLE IF NOT EXISTS receivable_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receivable_id INTEGER NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      notes TEXT,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (receivable_id) REFERENCES receivables(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;
  run(createReceivablePaymentsTable);
  console.log('Receivable payments table created successfully');

  // Migration: add pin_hash to users if not exists
  try {
    const userCols = query('PRAGMA table_info(users)');
    const userColNames = userCols.map(r => r.name);
    if (!userColNames.includes('pin_hash')) {
      run('ALTER TABLE users ADD COLUMN pin_hash TEXT');
      console.log('Migration: added pin_hash to users');
    }
  } catch (e) {
    console.error('Migration error (users pin_hash):', e);
  }

  // Migration: add customer_id and is_credit to transactions if not exists
  try {
    const trxCols = query('PRAGMA table_info(transactions)');
    const trxColNames = trxCols.map(r => r.name);
    if (!trxColNames.includes('customer_id')) {
      run('ALTER TABLE transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id)');
      console.log('Migration: added customer_id to transactions');
    }
    if (!trxColNames.includes('is_credit')) {
      run('ALTER TABLE transactions ADD COLUMN is_credit INTEGER DEFAULT 0');
      console.log('Migration: added is_credit to transactions');
    }
  } catch (e) {
    console.error('Migration error (transactions):', e);
  }

  // Migration: add shift_id to cash_drawer if not exists
  try {
    const cdCols = query('PRAGMA table_info(cash_drawer)');
    const cdColNames = cdCols.map(r => r.name);
    if (!cdColNames.includes('shift_id')) {
      run('ALTER TABLE cash_drawer ADD COLUMN shift_id INTEGER REFERENCES shifts(id)');
      console.log('Migration: added shift_id to cash_drawer');
    }
  } catch (e) {
    console.error('Migration error (cash_drawer shift_id):', e);
  }

  // Migration: add conversion_qty and unit_id to transaction_items if not exists
  try {
    const tiCols = query('PRAGMA table_info(transaction_items)');
    const colNames = tiCols.map(r => r.name);
    if (!colNames.includes('conversion_qty')) {
      run('ALTER TABLE transaction_items ADD COLUMN conversion_qty REAL DEFAULT 1');
      console.log('Migration: added conversion_qty to transaction_items');
    }
    if (!colNames.includes('unit_id')) {
      run('ALTER TABLE transaction_items ADD COLUMN unit_id INTEGER');
      console.log('Migration: added unit_id to transaction_items');
    }
    if (!colNames.includes('discount_item')) {
      run('ALTER TABLE transaction_items ADD COLUMN discount_item REAL DEFAULT 0');
      console.log('Migration: added discount_item to transaction_items');
    }
    if (!colNames.includes('discount_item_type')) {
      run("ALTER TABLE transaction_items ADD COLUMN discount_item_type TEXT DEFAULT 'none'");
      console.log('Migration: added discount_item_type to transaction_items');
    }
    if (!colNames.includes('discount_item_amount')) {
      run('ALTER TABLE transaction_items ADD COLUMN discount_item_amount REAL DEFAULT 0');
      console.log('Migration: added discount_item_amount to transaction_items');
    }
  } catch (e) {
    console.error('Migration error (transaction_items):', e);
  }

  // Seed default units if not exist
  const unitsExist = get('SELECT id FROM units LIMIT 1');
  if (!unitsExist) {
    const defaultUnits = [
      ['Pcs', 'pcs'],
      ['Box', 'box'],
      ['Pack', 'pack'],
      ['Botol', 'btl'],
      ['Sachet', 'sct'],
      ['Kilogram', 'kg'],
      ['Gram', 'gr'],
      ['Liter', 'ltr'],
      ['Lusin', 'lsn'],
      ['Dus', 'dus'],
      ['Karton', 'ktn']
    ];
    defaultUnits.forEach(([name, abbreviation]) => {
      run('INSERT INTO units (name, abbreviation) VALUES (?, ?)', [name, abbreviation]);
    });
    console.log('Default units seeded');
  }

  // Seed default shifts if not exist
  const shiftsExist = get('SELECT id FROM shifts LIMIT 1');
  if (!shiftsExist) {
    const defaultShifts = [
      ['Shift Pagi', '07:00', '14:00'],
      ['Shift Siang', '14:00', '21:00'],
      ['Shift Malam', '21:00', '07:00']
    ];
    defaultShifts.forEach(([name, start_time, end_time]) => {
      run('INSERT INTO shifts (name, start_time, end_time) VALUES (?, ?, ?)', [name, start_time, end_time]);
    });
    console.log('Default shifts seeded');
  }

  // Check if admin user exists
  const adminExists = get('SELECT id FROM users WHERE username = ?', ['admin']);

  if (!adminExists) {
    console.log('Creating default admin user...');

    // Hash password
    const hashedPassword = bcrypt.hashSync('admin123', 10);

    // Insert admin user
    run(
      `INSERT INTO users (username, password, full_name, role, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      ['admin', hashedPassword, 'Administrator', 'owner', 1]
    );

    console.log('Default admin user created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
  } else {
    console.log('Admin user already exists');
  }

  // Check if categories exist
  // const categoriesExist = get('SELECT id FROM categories LIMIT 1');

  // if (!categoriesExist) {
  //   console.log('Creating sample categories...');

  //   const categories = [
  //     ['Makanan', 'Produk makanan ringan dan berat'],
  //     ['Minuman', 'Berbagai jenis minuman'],
  //     ['Snack', 'Camilan dan makanan ringan'],
  //     ['Kebutuhan Rumah', 'Peralatan dan kebutuhan rumah tangga'],
  //     ['Lainnya', 'Produk lain-lain']
  //   ];

  //   categories.forEach(([name, description]) => {
  //     run(
  //       'INSERT INTO categories (name, description) VALUES (?, ?)',
  //       [name, description]
  //     );
  //   });

  //   console.log('Sample categories created successfully');
  // }

  // Check if products exist
  // const productsExist = get('SELECT id FROM products LIMIT 1');

  // if (!productsExist) {
  //   console.log('Creating sample products...');

  //   const products = [
  //     // Makanan (category_id: 1)
  //     ['PROD-1001', 'Nasi Goreng Instan', 1, 8000, 12000, 50, 10, 'pcs'],
  //     ['PROD-1002', 'Mie Instan Goreng', 1, 2500, 3500, 100, 20, 'pcs'],
  //     ['PROD-1003', 'Roti Tawar', 1, 10000, 15000, 30, 5, 'pcs'],
      
  //     // Minuman (category_id: 2)
  //     ['PROD-2001', 'Air Mineral 600ml', 2, 2000, 3000, 200, 50, 'botol'],
  //     ['PROD-2002', 'Teh Botol', 2, 3500, 5000, 150, 30, 'botol'],
  //     ['PROD-2003', 'Kopi Sachet', 2, 1500, 2500, 100, 20, 'sachet'],
      
  //     // Snack (category_id: 3)
  //     ['PROD-3001', 'Keripik Kentang', 3, 8000, 12000, 80, 15, 'pcs'],
  //     ['PROD-3002', 'Biskuit Marie', 3, 5000, 7500, 60, 10, 'pcs'],
  //     ['PROD-3003', 'Coklat Batang', 3, 15000, 20000, 40, 10, 'pcs'],
      
  //     // Kebutuhan Rumah (category_id: 4)
  //     ['PROD-4001', 'Sabun Mandi', 4, 3000, 5000, 70, 15, 'pcs'],
  //     ['PROD-4002', 'Pasta Gigi', 4, 8000, 12000, 50, 10, 'pcs'],
  //     ['PROD-4003', 'Shampo Sachet', 4, 1000, 2000, 150, 30, 'sachet'],
      
  //     // Lainnya (category_id: 5)
  //     ['PROD-5001', 'Pulpen', 5, 2000, 3500, 100, 20, 'pcs'],
  //     ['PROD-5002', 'Buku Tulis', 5, 5000, 8000, 60, 15, 'pcs']
  //   ];

  //   products.forEach(([barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit]) => {
  //     run(
  //       `INSERT INTO products (barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit, is_active) 
  //        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  //       [barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit]
  //     );
  //   });

  //   console.log('Sample products created successfully');
  // }
  
 // Insert default settings if not exist
  
  const settingsExist = get("SELECT id FROM settings WHERE key = 'store_name'");
  if (!settingsExist) {
    const defaultSettings = [
      ['store_name', 'TOKO RETAIL'],
      ['store_address', 'Jl. Contoh No. 123, Kota'],
      ['store_phone', '021-12345678'],
      ['store_email', 'info@tokoretail.com'],
      ['tax_enabled', '0'],
      ['tax_percent', '0'],
      ['receipt_footer', 'Terima Kasih - Barang yang sudah dibeli tidak dapat ditukar'],
      ['auto_backup', '1'],
      ['backup_days', '7'],
      ['store_logo', '']
    ];
    defaultSettings.forEach(([key, value]) => {
      run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    });
    console.log('Default settings inserted');
  }

  console.log('Database initialization completed');
}

module.exports = { initDatabase };