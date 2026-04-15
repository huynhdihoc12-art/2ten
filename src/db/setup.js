// src/db/setup.js
// Khởi tạo database và tạo bảng từ schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const DB_NAME = process.env.TIDB_DATABASE || 'vinahentai';

async function setupDatabase() {
  const sslConfig =
    process.env.TIDB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {};

  const baseConfig = {
    host: process.env.TIDB_HOST,
    port: parseInt(process.env.TIDB_PORT) || 4000,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    charset: 'utf8mb4',
    ...sslConfig,
  };

  // ── Bước 1: Tạo database (kết nối không chỉ định DB) ──
  const conn1 = await mysql.createConnection(baseConfig);
  logger.info('[Setup] Kết nối TiDB thành công!');

  try {
    await conn1.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    logger.info(`[Setup] ✓ Database '${DB_NAME}' đã sẵn sàng`);
  } catch (e) {
    logger.warn(`[Setup] Tạo database: ${e.message}`);
  }
  await conn1.end();

  // ── Bước 2: Kết nối LẠI với đúng database để tạo bảng ──
  const conn2 = await mysql.createConnection({
    ...baseConfig,
    database: DB_NAME,
  });

  // Đọc schema.sql và chạy từng statement
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Tách theo dấu ; và làm sạch từng statement
  const statements = schemaSql
    .split(';')
    .map((s) => {
      // Xóa toàn bộ dòng comment (--)
      return s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
    })
    .filter((s) => {
      if (!s) return false;
      // Bỏ qua CREATE DATABASE và USE (đã xử lý ở trên)
      if (/^CREATE\s+DATABASE/i.test(s)) return false;
      if (/^USE\s+/i.test(s)) return false;
      return true;
    });

  logger.info(`[Setup] Tạo ${statements.length} bảng/index...`);

  for (const stmt of statements) {
    try {
      await conn2.execute(stmt);
      const preview = stmt.split('\n')[0].replace(/\s+/g, ' ').substring(0, 55);
      logger.info(`[Setup] ✓ ${preview}...`);
    } catch (e) {
      if (
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
        e.message.includes('already exists') ||
        e.message.includes('Duplicate key name')
      ) {
        // Bảng/index đã tồn tại → bình thường
      } else {
        logger.warn(`[Setup] Cảnh báo: ${e.message.substring(0, 100)}`);
      }
    }
  }

  await conn2.end();
  logger.info(`[Setup] ✅ Database '${DB_NAME}' setup hoàn tất!`);
}

// Chạy trực tiếp nếu gọi từ CLI
if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('[Setup] LỖI:', e.message);
      process.exit(1);
    });
}

module.exports = { setupDatabase };
