/**
 * 数据库适配器 - 支持 SQLite 和 PostgreSQL
 */
const { Pool } = require('pg');

// 环境变量
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let db = null;
let pool = null;

// 初始化数据库
async function initDatabase() {
  if (DATABASE_URL && DATABASE_URL.startsWith('postgresql://')) {
    // 使用 PostgreSQL (Neon)
    console.log('📦 使用 PostgreSQL 数据库');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
    });

    // 创建数据库表（如果不存在）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sys_user (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(50),
        role VARCHAR(20) NOT NULL,
        department_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        config_value TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS biz_week_plan (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        department_id INTEGER REFERENCES sys_department(id),
        week_number INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        semester VARCHAR(20),
        status VARCHAR(20) DEFAULT 'DRAFT',
        current_step VARCHAR(50) DEFAULT 'CREATE',
        creator_id INTEGER REFERENCES sys_user(id),
        submitter_id INTEGER REFERENCES sys_user(id),
        reviewer_id INTEGER REFERENCES sys_user(id),
        reviewed_at TIMESTAMP,
        remark TEXT,
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS biz_plan_item (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES biz_week_plan(id) ON DELETE CASCADE,
        plan_date DATE NOT NULL,
        weekday VARCHAR(10),
        content TEXT NOT NULL,
        responsible VARCHAR(100),
        sort_order INTEGER DEFAULT 0,
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS biz_feedback (
        id SERIAL PRIMARY KEY,
        plan_item_id INTEGER REFERENCES biz_plan_item(id),
        status VARCHAR(20) NOT NULL,
        feedback TEXT,
        creator_id INTEGER REFERENCES sys_user(id),
        feedback_user_id INTEGER REFERENCES sys_user(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS biz_semester_plan (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        semester VARCHAR(20) NOT NULL,
        school_year VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT',
        creator_id INTEGER REFERENCES sys_user(id),
        submitter_id INTEGER REFERENCES sys_user(id),
        reviewer_id INTEGER REFERENCES sys_user(id),
        reviewed_at TIMESTAMP,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sys_school_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(50) UNIQUE NOT NULL,
        config_value TEXT,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS biz_calendar_event (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        semester VARCHAR(20),
        type VARCHAR(50),
        location VARCHAR(100),
        description TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 升级现有表结构
    await upgradeTableSchemas();

    // 插入默认数据
    await insertDefaultData();

    return 'postgres';
  } else {
    // 使用 PostgreSQL 作为默认数据库（简化部署）
    console.log('📦 使用 PostgreSQL 数据库');
    // 这里我们假设在Vercel环境中会提供DATABASE_URL
    // 如果没有提供，我们会使用一个默认的连接（实际部署时会失败，但本地开发可以测试）
    pool = new Pool({
      connectionString: 'postgresql://admin:admin123@localhost:5432/school_plan',
      ssl: false
    });

    // 创建数据库表（如果不存在）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sys_user (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(50),
        role VARCHAR(20) NOT NULL,
        department_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        config_value TEXT
      )
    `);

    // 升级现有表结构
    await upgradeTableSchemas();

    // 插入默认数据
    await insertDefaultData();

    return 'postgres';
  }
}

// 升级表结构
async function upgradeTableSchemas() {
  try {
    // 升级 sys_department 表
    await pool.query(`
      ALTER TABLE sys_department 
      ADD COLUMN IF NOT EXISTS code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `).catch(() => {
      // 忽略错误，因为列可能已经存在
    });

    // 升级 biz_week_plan 表
    await pool.query(`
      ALTER TABLE biz_week_plan 
      ADD COLUMN IF NOT EXISTS current_step VARCHAR(50) DEFAULT 'CREATE',
      ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES sys_user(id),
      ADD COLUMN IF NOT EXISTS submitter_id INTEGER REFERENCES sys_user(id),
      ADD COLUMN IF NOT EXISTS reviewer_id INTEGER REFERENCES sys_user(id),
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
    `).catch(() => {
      // 忽略错误，因为列可能已经存在
    });

    // 升级 biz_plan_item 表
    await pool.query(`
      ALTER TABLE biz_plan_item 
      ADD COLUMN IF NOT EXISTS create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
    `).catch(() => {
      // 忽略错误，因为列可能已经存在
    });

    // 升级 biz_feedback 表
    await pool.query(`
      ALTER TABLE biz_feedback 
      ADD COLUMN IF NOT EXISTS feedback_user_id INTEGER REFERENCES sys_user(id),
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
    `).catch(() => {
      // 忽略错误，因为列可能已经存在
    });

    console.log('表结构升级完成');
  } catch (error) {
    console.log('表结构升级时出现错误（可能表或列已存在）:', error.message);
  }
}

// 插入默认数据
async function insertDefaultData() {
  try {
    // 检查是否已有数据
    const result = await pool.query('SELECT COUNT(*) as count FROM sys_department');
    const hasData = result.rows[0].count > 0;
    if (hasData) return;
  } catch (error) {
    console.error('检查数据库数据失败:', error);
    // 继续尝试插入数据
  }

  // 插入默认部门
  const departments = [
    { name: '办公室', code: 'office', sort_order: 0 },
    { name: '教务处', code: 'academic', sort_order: 1 },
    { name: '政教处', code: 'student', sort_order: 2 },
    { name: '后勤部', code: 'logistics', sort_order: 3 },
    { name: '生活中心', code: 'life', sort_order: 4 },
    { name: '七年级', code: 'grade7', sort_order: 5 },
    { name: '八年级', code: 'grade8', sort_order: 6 },
    { name: '九年级', code: 'grade9', sort_order: 7 }
  ];

  for (const dept of departments) {
    await pool.query(
      'INSERT INTO sys_department (name, code, sort_order) VALUES ($1, $2, $3)',
      [dept.name, dept.code, dept.sort_order]
    );
  }

  // 插入默认配置
  const configs = [
    { key: 'school_name', value: '上海新纪元教育集团瑞安总校' },
    { key: 'school_sub_name', value: '初中部' },
    { key: 'current_semester', value: '2025-2026学年第二学期' },
    { key: 'current_week_start', value: '2025-02-16' },
    { key: 'week_first_day', value: '0' },
    { key: 'wechat_webhook_url', value: '' }
  ];

  for (const config of configs) {
    await pool.query(
      'INSERT INTO sys_config (config_key, config_value) VALUES ($1, $2) ON CONFLICT (config_key) DO NOTHING',
      [config.key, config.value]
    );
  }

  // 插入默认管理员用户
  const bcrypt = require('bcryptjs');
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  
  try {
    await pool.query(
      'INSERT INTO sys_user (username, password, real_name, role, department_id, created_at, is_deleted) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, FALSE) ON CONFLICT (username) DO NOTHING',
      ['admin', hashedPassword, '超级管理员', 'ADMIN', 1]
    );
  } catch (error) {
    console.error('插入默认管理员失败:', error);
  }
}

// 获取数据库类型
function getDatabaseType() {
  return 'postgres'; // 只支持PostgreSQL
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
  // 将 ? 占位符转换为 $1, $2, ...
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows;
}

// 执行查询（用于 SELECT 单行）
async function queryOne(sql, params = []) {
  // 将 ? 占位符转换为 $1, $2, ...
  const pgSql = convertPlaceholders(sql);
  const result = await pool.query(pgSql, params);
  return result.rows[0] || null;
}

// 执行查询（用于 INSERT/UPDATE/DELETE）
async function execute(sql, params = []) {
  // 将 ? 占位符转换为 $1, $2, ...
  const pgSql = convertPlaceholders(sql);
  return await pool.query(pgSql, params);
}

// 获取最后插入的 ID
async function getLastInsertId() {
  const result = await pool.query('SELECT lastval() as id');
  return result.rows[0].id;
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
