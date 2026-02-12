const Database = require('better-sqlite3');
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, '..', 'pos-retail.db');
console.log('Database path:', dbPath);

const db = new Database(dbPath, { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Helper functions
const query = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

const run = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(params);
  } catch (error) {
    console.error('Run error:', error);
    throw error;
  }
};

const get = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(params);
  } catch (error) {
    console.error('Get error:', error);
    throw error;
  }
};

const all = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(params);
  } catch (error) {
    console.error('All error:', error);
    throw error;
  }
};

module.exports = {
  db,
  query,
  run,
  get,
  all
};