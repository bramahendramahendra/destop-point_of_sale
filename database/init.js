const { initDb, run, get } = require('./db');
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

  // Create purchases table
  const createPurchasesTable = `
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_code TEXT UNIQUE NOT NULL,
      supplier_name TEXT,
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
  const categoriesExist = get('SELECT id FROM categories LIMIT 1');

  if (!categoriesExist) {
    console.log('Creating sample categories...');

    const categories = [
      ['Makanan', 'Produk makanan ringan dan berat'],
      ['Minuman', 'Berbagai jenis minuman'],
      ['Snack', 'Camilan dan makanan ringan'],
      ['Kebutuhan Rumah', 'Peralatan dan kebutuhan rumah tangga'],
      ['Lainnya', 'Produk lain-lain']
    ];

    categories.forEach(([name, description]) => {
      run(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [name, description]
      );
    });

    console.log('Sample categories created successfully');
  }

  // Check if products exist
  const productsExist = get('SELECT id FROM products LIMIT 1');

  if (!productsExist) {
    console.log('Creating sample products...');

    const products = [
      // Makanan (category_id: 1)
      ['PROD-1001', 'Nasi Goreng Instan', 1, 8000, 12000, 50, 10, 'pcs'],
      ['PROD-1002', 'Mie Instan Goreng', 1, 2500, 3500, 100, 20, 'pcs'],
      ['PROD-1003', 'Roti Tawar', 1, 10000, 15000, 30, 5, 'pcs'],
      
      // Minuman (category_id: 2)
      ['PROD-2001', 'Air Mineral 600ml', 2, 2000, 3000, 200, 50, 'botol'],
      ['PROD-2002', 'Teh Botol', 2, 3500, 5000, 150, 30, 'botol'],
      ['PROD-2003', 'Kopi Sachet', 2, 1500, 2500, 100, 20, 'sachet'],
      
      // Snack (category_id: 3)
      ['PROD-3001', 'Keripik Kentang', 3, 8000, 12000, 80, 15, 'pcs'],
      ['PROD-3002', 'Biskuit Marie', 3, 5000, 7500, 60, 10, 'pcs'],
      ['PROD-3003', 'Coklat Batang', 3, 15000, 20000, 40, 10, 'pcs'],
      
      // Kebutuhan Rumah (category_id: 4)
      ['PROD-4001', 'Sabun Mandi', 4, 3000, 5000, 70, 15, 'pcs'],
      ['PROD-4002', 'Pasta Gigi', 4, 8000, 12000, 50, 10, 'pcs'],
      ['PROD-4003', 'Shampo Sachet', 4, 1000, 2000, 150, 30, 'sachet'],
      
      // Lainnya (category_id: 5)
      ['PROD-5001', 'Pulpen', 5, 2000, 3500, 100, 20, 'pcs'],
      ['PROD-5002', 'Buku Tulis', 5, 5000, 8000, 60, 15, 'pcs']
    ];

    products.forEach(([barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit]) => {
      run(
        `INSERT INTO products (barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [barcode, name, category_id, purchase_price, selling_price, stock, min_stock, unit]
      );
    });

    console.log('Sample products created successfully');
  }

  console.log('Database initialization completed');
}

module.exports = { initDatabase };