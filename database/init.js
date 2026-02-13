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

  console.log('Database initialization completed');
}

module.exports = { initDatabase };