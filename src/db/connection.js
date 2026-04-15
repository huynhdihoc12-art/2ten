// src/db/connection.js
// Quản lý kết nối TiDB (MySQL-compatible)
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

function getPool() {
  if (pool) return pool;

  const sslConfig = process.env.TIDB_SSL === 'true'
    ? { ssl: { rejectUnauthorized: true } }
    : {};

  pool = mysql.createPool({
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    ...sslConfig,
  });

  return pool;
}

async function query(sql, params = []) {
  const db = getPool();
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, closePool };
