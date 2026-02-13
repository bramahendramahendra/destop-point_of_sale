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