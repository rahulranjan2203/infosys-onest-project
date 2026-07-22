const dotenv = require('dotenv');
dotenv.config();

const dbType = process.env.DB_TYPE || 'sqlite';
let dbInstance = null;

if (dbType === 'mysql') {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_NAME || 'onest_cert_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  dbInstance = {
    type: 'mysql',
    async query(sql, params = []) {
      const [results] = await pool.execute(sql, params);
      return results;
    },
    async close() {
      await pool.end();
    }
  };
  console.log('Database Configured: MySQL Connection Pool initialized.');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.resolve(__dirname, '../../database.sqlite');
  const db = new sqlite3.Database(dbPath);

  dbInstance = {
    type: 'sqlite',
    query(sql, params = []) {
      return new Promise((resolve, reject) => {
        // SQLite uses run for write commands, all for reads, but we can normalize using a regex check
        const isRead = sql.trim().toUpperCase().startsWith('SELECT') || 
                       sql.trim().toUpperCase().startsWith('PRAGMA');
        
        // SQLite uses ? instead of ? for params, which matches mysql2
        if (isRead) {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        } else {
          db.run(sql, params, function (err) {
            if (err) {
              reject(err);
            } else {
              // Return format matching mysql2 expectations (insertId, affectedRows)
              resolve({
                insertId: this.lastID,
                affectedRows: this.changes
              });
            }
          });
        }
      });
    },
    async close() {
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
  console.log(`Database Configured: SQLite database loaded at ${dbPath}`);
}

module.exports = dbInstance;
