const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'pos-retail.db');
let db = null;

// Initialize database
async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
    console.log('Database loaded from file');
  } else {
    db = new SQL.Database();
    console.log('New database created');
  }

  return db;
}

// Save database to file
function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log('Database saved');
  }
}

// Helper functions
const query = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = [];
    while (stmt.step()) {
      result.push(stmt.getAsObject());
    }
    stmt.free();
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

const run = (sql, params = []) => {
  try {
    db.run(sql, params);
    saveDb(); // Auto-save after write operations
    return { changes: db.getRowsModified() };
  } catch (error) {
    console.error('Run error:', error);
    throw error;
  }
};

const get = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (error) {
    console.error('Get error:', error);
    throw error;
  }
};

const all = (sql, params = []) => {
  return query(sql, params);
};

module.exports = {
  initDb,
  saveDb,
  query,
  run,
  get,
  all
};