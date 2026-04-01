/**
 * 数据库适配器 - 支持 SQLite 和 PostgreSQL
 */
const { Pool } = require('pg');
const { default: sqljs } = require('sql.js');

// 环境变量
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

let db = null;
let pool = null;

// 初始化数据库
function initDatabase() {
  if (DATABASE_URL && DATABASE_URL.startsWith('postgresql://')) {
    // 使用 PostgreSQL (Neon)
    console.log('📦 使用 PostgreSQL 数据库');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
    });

    // 创建数据库表（如果不存在）
    pool.query(`
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

    pool.query(`
      CREATE TABLE IF NOT EXISTS sys_department (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    pool.query(`
      CREATE TABLE IF NOT EXISTS sys_config (
        id SERIAL PRIMARY KEY,
        config_key VARCHAR(50) UNIQUE NOT NULL,
        config_value TEXT
      )
    `);

    pool.query(`
      CREATE TABLE IF NOT EXISTS biz_week_plan (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        department_id INTEGER REFERENCES sys_department(id),
        week_number INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        semester VARCHAR(20),
        status VARCHAR(20) DEFAULT 'DRAFT',
        submitter_id INTEGER REFERENCES sys_user(id),
        reviewer_id INTEGER REFERENCES sys_user(id),
        reviewed_at TIMESTAMP,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    pool.query(`
      CREATE TABLE IF NOT EXISTS biz_plan_item (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES biz_week_plan(id) ON DELETE CASCADE,
        plan_date DATE NOT NULL,
        weekday VARCHAR(10),
        content TEXT NOT NULL,
        responsible VARCHAR(100),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    pool.query(`
      CREATE TABLE IF NOT EXISTS biz_feedback (
        id SERIAL PRIMARY KEY,
        plan_item_id INTEGER REFERENCES biz_plan_item(id),
        status VARCHAR(20) NOT NULL,
        feedback TEXT,
        creator_id INTEGER REFERENCES sys_user(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);

    // 插入默认数据
    insertDefaultData();

    return 'postgres';
  } else {
    // 使用 SQLite (本地开发)
    console.log('📦 使用 SQLite 数据库');
    const fs = require('fs');
    const path = require('path');

    const dbPath = path.join(__dirname, '../data/school_plan.db');
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const SQL = sqljs();
    const buffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
    db = new SQL.Database(buffer || '');

    if (!buffer) {
      // 创建表结构
      db.run(`
        CREATE TABLE IF NOT EXISTS sys_user (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          real_name TEXT,
          role TEXT NOT NULL,
          department_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sys_department (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sys_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key TEXT UNIQUE NOT NULL,
          config_value TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS biz_week_plan (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          department_id INTEGER,
          week_number INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          semester TEXT,
          status TEXT DEFAULT 'DRAFT',
          submitter_id INTEGER,
          reviewer_id INTEGER,
          reviewed_at DATETIME,
          remark TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (department_id) REFERENCES sys_department(id),
          FOREIGN KEY (submitter_id) REFERENCES sys_user(id),
          FOREIGN KEY (reviewer_id) REFERENCES sys_user(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS biz_plan_item (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER NOT NULL,
          plan_date TEXT NOT NULL,
          weekday TEXT,
          content TEXT NOT NULL,
          responsible TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (plan_id) REFERENCES biz_week_plan(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS biz_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_item_id INTEGER,
          status TEXT NOT NULL,
          feedback TEXT,
          creator_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (plan_item_id) REFERENCES biz_plan_item(id),
          FOREIGN KEY (creator_id) REFERENCES sys_user(id)
        )
      `);

      // 插入默认数据
      insertDefaultData();

      // 保存数据库
      const data = db.export();
      const nodeBuffer = Buffer.from(data);
      fs.writeFileSync(dbPath, nodeBuffer);
    }

    return 'sqlite';
  }
}

// 插入默认数据
async function insertDefaultData() {
  const adapter = getDatabaseType();

  // 检查是否已有数据
  const hasData = adapter === 'postgres'
    ? (await pool.query('SELECT COUNT(*) as count FROM sys_department')).rows[0].count > 0
    : db.exec('SELECT COUNT(*) as count FROM sys_department')[0].count > 0;

  if (hasData) return;

  // 插入默认部门
  const departments = [
    { name: '办公室', sort_order: 0 },
    { name: '教务处', sort_order: 1 },
    { name: '政教处', sort_order: 2 },
    { name: '后勤部', sort_order: 3 },
    { name: '生活中心', sort_order: 4 },
    { name: '七年级', sort_order: 5 },
    { name: '八年级', sort_order: 6 },
    { name: '九年级', sort_order: 7 }
  ];

  if (adapter === 'postgres') {
    for (const dept of departments) {
      await pool.query(
        'INSERT INTO sys_department (name, sort_order) VALUES ($1, $2)',
        [dept.name, dept.sort_order]
      );
    }
  } else {
    const stmt = db.prepare('INSERT INTO sys_department (name, sort_order) VALUES (?, ?)');
    for (const dept of departments) {
      stmt.run(dept.name, dept.sort_order);
    }
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

  if (adapter === 'postgres') {
    for (const config of configs) {
      await pool.query(
        'INSERT INTO sys_config (config_key, config_value) VALUES ($1, $2) ON CONFLICT (config_key) DO NOTHING',
        [config.key, config.value]
      );
    }
  } else {
    const stmt = db.prepare('INSERT OR IGNORE INTO sys_config (config_key, config_value) VALUES (?, ?)');
    for (const config of configs) {
      stmt.run(config.key, config.value);
    }
  }
}

// 获取数据库类型
function getDatabaseType() {
  return DATABASE_URL && DATABASE_URL.startsWith('postgresql://') ? 'postgres' : 'sqlite';
}

// 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2, ...
function convertPlaceholders(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => `$${++count}`);
}

// 执行查询（用于 SELECT）
async function query(sql, params = []) {
  const adapter = getDatabaseType();

  if (adapter === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return result.rows;
  } else {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }
}

// 执行查询（用于 SELECT 单行）
async function queryOne(sql, params = []) {
  const adapter = getDatabaseType();

  if (adapter === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    const result = await pool.query(pgSql, params);
    return result.rows[0] || null;
  } else {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  }
}

// 执行查询（用于 INSERT/UPDATE/DELETE）
async function execute(sql, params = []) {
  const adapter = getDatabaseType();

  if (adapter === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    return await pool.query(pgSql, params);
  } else {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }
}

// 获取最后插入的 ID
async function getLastInsertId() {
  const adapter = getDatabaseType();

  if (adapter === 'postgres') {
    const result = await pool.query('SELECT lastval() as id');
    return result.rows[0].id;
  } else {
    const result = db.exec('SELECT last_insert_rowid() as id')[0];
    return result ? result.id : null;
  }
}

// 初始化数据库
initDatabase();

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
