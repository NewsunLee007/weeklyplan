/**
 * 数据库适配器 - 支持 SQLite 和 PostgreSQL
 */
const { Pool } = require('pg');
const sqliteDB = require('./database');

// 环境变量
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let db = null;
let pool = null;
let dbType = null;

// 初始化数据库
async function initDatabase() {
  if (DATABASE_URL && DATABASE_URL.startsWith('postgresql://')) {
    // 使用 PostgreSQL (Neon)
    console.log('📦 使用 PostgreSQL 数据库');
    try {
      pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false,
        max: 5,
        min: 1,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000
      });

      // 测试连接
      await pool.query('SELECT 1');

      // 创建数据库表（如果不存在） - 只创建核心表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sys_user (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          real_name VARCHAR(50),
          role VARCHAR(20) NOT NULL,
          department_id INTEGER,
          phone VARCHAR(20),
          status INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_deleted BOOLEAN DEFAULT FALSE
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sys_department (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) UNIQUE NOT NULL,
          code VARCHAR(50) UNIQUE NOT NULL,
          sort_order INTEGER DEFAULT 0,
          description TEXT,
          status INTEGER DEFAULT 1,
          is_deleted BOOLEAN DEFAULT FALSE,
          create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS sys_config (
          id SERIAL PRIMARY KEY,
          config_key VARCHAR(50) UNIQUE NOT NULL,
          config_value TEXT,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 跳过其他表的创建，只在需要时创建
      // 快速插入默认数据
      await fastInsertDefaultData();

      dbType = 'postgres';
      return 'postgres';
    } catch (error) {
      console.error('PostgreSQL 连接失败，使用 SQLite 数据库:', error.message);
      // 回退到 SQLite
      return await initSQLite();
    }
  } else {
    // 直接使用 SQLite
    return await initSQLite();
  }
}

// 初始化 SQLite 数据库
async function initSQLite() {
  console.log('📦 使用 SQLite 数据库');
  try {
    db = await sqliteDB.initDB();
    dbType = 'sqlite';
    return 'sqlite';
  } catch (error) {
    console.error('SQLite 初始化失败:', error.message);
    throw error;
  }
}

// 快速插入默认数据
async function fastInsertDefaultData() {
  try {
    // 检查是否已有数据
    const result = await pool.query('SELECT COUNT(*) as count FROM sys_department');
    const hasData = result.rows[0].count > 0;
    if (hasData) return;

    // 插入默认部门（使用批量插入）
    await pool.query(`
      INSERT INTO sys_department (name, code, sort_order) VALUES 
      ('办公室', 'office', 0),
      ('教务处', 'academic', 1),
      ('政教处', 'student', 2),
      ('后勤部', 'logistics', 3),
      ('生活中心', 'life', 4),
      ('七年级', 'grade7', 5),
      ('八年级', 'grade8', 6),
      ('九年级', 'grade9', 7)
      ON CONFLICT (name) DO NOTHING
    `);

    // 插入默认配置（使用批量插入）
    await pool.query(`
      INSERT INTO sys_config (config_key, config_value) VALUES 
      ('school_name', '上海新纪元教育集团瑞安总校'),
      ('school_sub_name', '初中部'),
      ('current_semester', '2025-2026学年第二学期'),
      ('current_week_start', '2025-02-16'),
      ('week_first_day', '0'),
      ('wechat_webhook_url', ''),
      ('ai_provider', 'openai'),
      ('ai_api_url', 'https://api.openai.com/v1'),
      ('ai_api_key', ''),
      ('ai_model', 'gpt-4o'),
      ('ai_temperature', '0.7'),
      ('ai_analysis_enabled', 'true'),
      ('ai_chat_enabled', 'true'),
      ('ai_suggestions_enabled', 'true')
      ON CONFLICT (config_key) DO NOTHING
    `);

    // 插入默认管理员用户
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    
    await pool.query(
      'INSERT INTO sys_user (username, password, real_name, role, department_id, phone, status, created_at, create_time, update_time, is_deleted) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE) ON CONFLICT (username) DO NOTHING',
      ['admin', hashedPassword, '超级管理员', 'ADMIN', 1, '', 1]
    );
  } catch (error) {
    console.error('快速插入默认数据失败:', error);
  }
}

// 获取数据库类型
function getDatabaseType() {
  return dbType || 'sqlite'; // 返回当前使用的数据库类型
}

// 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2, ...
function convertPlaceholders(sql) {
  // 如果SQL中已经有$1、$2这样的占位符，直接返回
  if (sql.includes('$1')) {
    return sql;
  }
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

// 执行查询（用于 SELECT）
async function query(sql, params = []) {
  // 确保数据库已初始化
  if (!dbType) {
    await initDatabase();
  }
  
  if (dbType === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return result.rows;
  } else {
    // 使用 SQLite
    return sqliteDB.query(sql, params);
  }
}

// 执行查询（用于 SELECT 单行）
async function queryOne(sql, params = []) {
  // 确保数据库已初始化
  if (!dbType) {
    await initDatabase();
  }
  
  if (dbType === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return result.rows[0] || null;
  } else {
    // 使用 SQLite
    return sqliteDB.queryOne(sql, params);
  }
}

// 执行查询（用于 INSERT/UPDATE/DELETE）
async function execute(sql, params = []) {
  // 确保数据库已初始化
  if (!dbType) {
    await initDatabase();
  }
  
  if (dbType === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    return await pool.query(pgSql, params);
  } else {
    // 使用 SQLite
    return sqliteDB.run(sql, params);
  }
}

// 获取最后插入的 ID
async function getLastInsertId() {
  if (dbType === 'postgres') {
    const result = await pool.query('SELECT lastval() as id');
    return result.rows[0].id;
  } else {
    // SQLite 会在 run 函数中返回 lastInsertRowid
    return null;
  }
}

// 注意：数据库初始化由 app.js 中的 bootstrap() 函数控制
// 这样避免了重复初始化和竞态条件问题

// run 是 execute 的别名
const run = execute;

module.exports = {
  query,
  queryOne,
  execute,
  run,
  getLastInsertId,
  getDatabaseType,
  initDatabase,
  pool
};
