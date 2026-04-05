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
let isInitializing = false;
let initError = null;

console.log('📊 数据库适配器加载 - DATABASE_URL:', DATABASE_URL ? '已配置' : '未配置');

// 初始化数据库
async function initDatabase() {
  if (dbType) {
    console.log('📊 数据库已经初始化完成:', dbType);
    return dbType;
  }
  
  if (isInitializing) {
    console.log('📊 数据库正在初始化中，等待完成...');
    // 如果正在初始化，等待一下然后返回
    await new Promise(resolve => setTimeout(resolve, 1000));
    return dbType || 'sqlite';
  }

  if (initError) {
    console.log('📊 之前初始化失败，使用SQLite');
    return dbType || 'sqlite';
  }

  isInitializing = true;
  console.log('📦 开始初始化数据库...');

  try {
    if (DATABASE_URL && DATABASE_URL.startsWith('postgresql://')) {
      // 使用 PostgreSQL (Neon)
      console.log('📦 尝试使用 PostgreSQL 数据库');
      try {
        pool = new Pool({
          connectionString: DATABASE_URL,
          ssl: DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false,
          max: 3,
          min: 0,
          idleTimeoutMillis: 5000,
          connectionTimeoutMillis: 3000
        });

        // 测试连接
        console.log('📦 测试 PostgreSQL 连接...');
        await pool.query('SELECT 1');
        console.log('✅ PostgreSQL 连接成功');

        // 只快速创建核心表，其他表在需要时创建
        console.log('📦 创建核心表...');
        
        // 使用 CREATE TABLE IF NOT EXISTS 但不等待太久
        const createTablePromises = [];
        
        createTablePromises.push(pool.query(`
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
        `));

        createTablePromises.push(pool.query(`
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
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS sys_config (
            id SERIAL PRIMARY KEY,
            config_key VARCHAR(50) UNIQUE NOT NULL,
            config_value TEXT,
            update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS biz_week_plan (
            id SERIAL PRIMARY KEY,
            department_id INTEGER NOT NULL,
            creator_id INTEGER NOT NULL,
            week_number INTEGER NOT NULL,
            semester VARCHAR(20) NOT NULL,
            start_date VARCHAR(20) NOT NULL,
            end_date VARCHAR(20) NOT NULL,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            current_step VARCHAR(20) DEFAULT 'CREATE',
            remark TEXT,
            published_at TIMESTAMP,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT FALSE
          )
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS biz_plan_item (
            id SERIAL PRIMARY KEY,
            plan_id INTEGER NOT NULL,
            plan_date VARCHAR(20) NOT NULL,
            weekday VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            responsible VARCHAR(100),
            sort_order INTEGER DEFAULT 0,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT FALSE
          )
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS biz_review_record (
            id SERIAL PRIMARY KEY,
            plan_id INTEGER NOT NULL,
            reviewer_id INTEGER NOT NULL,
            step VARCHAR(50) NOT NULL,
            result VARCHAR(20) NOT NULL,
            comment TEXT,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS biz_feedback (
            id SERIAL PRIMARY KEY,
            plan_item_id INTEGER NOT NULL,
            plan_id INTEGER NOT NULL,
            feedback_user_id INTEGER NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            content TEXT,
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_deleted BOOLEAN DEFAULT FALSE
          )
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS biz_knowledge_base (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            type VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            creator_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

        createTablePromises.push(pool.query(`
          CREATE TABLE IF NOT EXISTS biz_knowledge_item (
            id SERIAL PRIMARY KEY,
            knowledge_base_id INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            file_url VARCHAR(500),
            file_name VARCHAR(255),
            file_size INTEGER,
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            creator_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `));

        createTablePromises.push(pool.query('CREATE TABLE IF NOT EXISTS biz_semester_plan (id SERIAL PRIMARY KEY, is_deleted BOOLEAN DEFAULT FALSE)'));
        createTablePromises.push(pool.query('CREATE TABLE IF NOT EXISTS sys_school_config (id SERIAL PRIMARY KEY, is_deleted BOOLEAN DEFAULT FALSE)'));
        createTablePromises.push(pool.query('CREATE TABLE IF NOT EXISTS biz_calendar_event (id SERIAL PRIMARY KEY, is_deleted BOOLEAN DEFAULT FALSE)'));

        // 等待表创建，但设置超时
        await Promise.race([
          Promise.all(createTablePromises),
          new Promise((_, reject) => setTimeout(() => reject(new Error('表创建超时')), 5000))
        ]);

        console.log('✅ 核心表创建完成');

        // 快速插入默认数据（不等待）
        fastInsertDefaultData().catch(err => {
          console.log('⚠️ 默认数据插入失败，但继续运行:', err.message);
        });

        dbType = 'postgres';
        console.log('✅ PostgreSQL 数据库初始化完成');
        return 'postgres';
      } catch (error) {
        console.error('❌ PostgreSQL 连接失败，回退到 SQLite:', error.message);
        initError = error;
        // 回退到 SQLite
        return await initSQLite();
      }
    } else {
      // 直接使用 SQLite
      console.log('📦 使用 SQLite 数据库');
      return await initSQLite();
    }
  } finally {
    isInitializing = false;
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
  console.log('🔍 查询执行:', sql.substring(0, 100));
  
  // 检查是否正在初始化
  if (!dbType) {
    console.log('⚠️ 数据库未初始化，返回空结果');
    // 返回空数组，避免等待初始化
    return [];
  }
  
  if (dbType === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    try {
      // 添加查询超时
      const result = await Promise.race([
        pool.query(pgSql, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('查询超时')), 10000))
      ]);
      console.log('✅ 查询成功，返回', result.rows.length, '行');
      return result.rows;
    } catch (error) {
      console.error('❌ 查询失败:', error.message);
      return [];
    }
  } else {
    // 使用 SQLite
    try {
      const result = sqliteDB.query(sql, params);
      console.log('✅ SQLite 查询成功');
      return result;
    } catch (error) {
      console.error('❌ SQLite 查询失败:', error.message);
      return [];
    }
  }
}

// 执行查询（用于 SELECT 单行）
async function queryOne(sql, params = []) {
  console.log('🔍 查询单行:', sql.substring(0, 100));
  
  // 检查是否正在初始化
  if (!dbType) {
    console.log('⚠️ 数据库未初始化，返回null');
    // 返回 null，避免等待初始化
    return null;
  }
  
  if (dbType === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    const pgSql = convertPlaceholders(sql);
    try {
      // 添加查询超时
      const result = await Promise.race([
        pool.query(pgSql, params),
        new Promise((_, reject) => setTimeout(() => reject(new Error('查询超时')), 10000))
      ]);
      console.log('✅ 查询单行成功');
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ 查询单行失败:', error.message);
      return null;
    }
  } else {
    // 使用 SQLite
    try {
      const result = sqliteDB.queryOne(sql, params);
      console.log('✅ SQLite 查询单行成功');
      return result;
    } catch (error) {
      console.error('❌ SQLite 查询单行失败:', error.message);
      return null;
    }
  }
}

// 执行查询（用于 INSERT/UPDATE/DELETE）
async function execute(sql, params = []) {
  console.log('✏️ 执行操作:', sql.substring(0, 100));
  
  // 检查是否正在初始化
  if (!dbType) {
    console.log('⚠️ 数据库未初始化，尝试初始化...');
    // 尝试初始化数据库
    try {
      await initDatabase();
    } catch (error) {
      console.error('❌ 执行操作时初始化数据库失败:', error);
      throw error;
    }
  }
  
  if (dbType === 'postgres') {
    // 将 ? 占位符转换为 $1, $2, ...
    let pgSql = convertPlaceholders(sql);
    let isInsert = sql.trim().toUpperCase().startsWith('INSERT');
    
    // 如果是 INSERT 且没有包含 RETURNING，自动追加 RETURNING id
    if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    
    try {
      const result = await pool.query(pgSql, params);
      console.log('✅ 执行操作成功');
      
      let lastInsertRowid = null;
      if (isInsert && result.rows && result.rows.length > 0) {
        lastInsertRowid = result.rows[0].id;
      }
      
      // 兼容 SQLite 的返回格式
      return {
        ...result,
        lastInsertRowid
      };
    } catch (error) {
      console.error('❌ 执行操作失败:', error);
      throw error;
    }
  } else {
    // 使用 SQLite
    try {
      const result = sqliteDB.run(sql, params);
      console.log('✅ SQLite 执行操作成功');
      return result;
    } catch (error) {
      console.error('❌ SQLite 执行操作失败:', error);
      throw error;
    }
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
