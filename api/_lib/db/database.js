/**
 * SQLite 数据库初始化模块（使用 sql.js + fs 持久化）
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../../data/school_plan.db');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  // 确保数据目录存在
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 加载或新建数据库
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 开启外键支持
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA journal_mode = WAL;');

  createTables();
  insertInitialData();
  saveDB();

  console.log('✅ 数据库初始化完成');
  return db;
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sys_department (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      description TEXT,
      status INTEGER DEFAULT 1,
      create_time TEXT,
      update_time TEXT,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sys_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      real_name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      avatar TEXT,
      status INTEGER DEFAULT 1,
      create_time TEXT,
      update_time TEXT,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (department_id) REFERENCES sys_department(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS biz_week_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      creator_id INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      semester TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      current_step INTEGER DEFAULT 1,
      remark TEXT,
      published_at TEXT,
      create_time TEXT,
      update_time TEXT,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (department_id) REFERENCES sys_department(id),
      FOREIGN KEY (creator_id) REFERENCES sys_user(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS biz_plan_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      plan_date TEXT NOT NULL,
      weekday TEXT NOT NULL,
      content TEXT NOT NULL,
      responsible TEXT,
      sort_order INTEGER DEFAULT 0,
      create_time TEXT,
      update_time TEXT,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (plan_id) REFERENCES biz_week_plan(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS biz_review_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      reviewer_id INTEGER NOT NULL,
      step INTEGER NOT NULL,
      result TEXT NOT NULL,
      comment TEXT,
      create_time TEXT,
      FOREIGN KEY (plan_id) REFERENCES biz_week_plan(id),
      FOREIGN KEY (reviewer_id) REFERENCES sys_user(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS biz_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_item_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      feedback_user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      content TEXT,
      create_time TEXT,
      update_time TEXT,
      FOREIGN KEY (plan_item_id) REFERENCES biz_plan_item(id),
      FOREIGN KEY (plan_id) REFERENCES biz_week_plan(id),
      FOREIGN KEY (feedback_user_id) REFERENCES sys_user(id),
      UNIQUE(plan_item_id, feedback_user_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sys_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT NOT NULL UNIQUE,
      config_value TEXT NOT NULL,
      description TEXT,
      update_time TEXT
    )
  `);
}

function insertInitialData() {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // 插入部门
  const departments = [
    { name: '办公室', code: 'OFFICE', sort_order: 1 },
    { name: '教务处', code: 'ACADEMIC', sort_order: 2 },
    { name: '政教处', code: 'POLITICS', sort_order: 3 },
    { name: '后勤部', code: 'LOGISTICS', sort_order: 4 },
    { name: '生活中心', code: 'LIFE_CENTER', sort_order: 5 },
    { name: '七年级', code: 'GRADE_7', sort_order: 6 },
    { name: '八年级', code: 'GRADE_8', sort_order: 7 },
    { name: '九年级', code: 'GRADE_9', sort_order: 8 }
  ];

  for (const dept of departments) {
    const exists = db.exec(`SELECT id FROM sys_department WHERE code = '${dept.code}'`);
    if (!exists.length || !exists[0].values.length) {
      db.run(
        `INSERT INTO sys_department (name, code, sort_order, status, create_time, update_time) VALUES (?, ?, ?, 1, ?, ?)`,
        [dept.name, dept.code, dept.sort_order, now, now]
      );
    }
  }

  // 获取部门ID映射
  function getDeptId(code) {
    const r = db.exec(`SELECT id FROM sys_department WHERE code = '${code}'`);
    return r.length && r[0].values.length ? r[0].values[0][0] : 1;
  }

  // 预置账号列表
  const presetUsers = [
    { username: 'admin',      password: 'admin123', real_name: '系统管理员',   dept_code: 'OFFICE',      role: 'ADMIN'       },
    // 校长
    { username: 'principal',  password: 'principal123', real_name: '李校长',  dept_code: 'OFFICE',      role: 'PRINCIPAL'   },
    // 办公室主任
    { username: 'office',     password: 'office123',    real_name: '张主任',   dept_code: 'OFFICE',      role: 'OFFICE_HEAD' },
    // 各部门主任
    { username: 'academic',   password: 'dept123',      real_name: '王主任（教务处）', dept_code: 'ACADEMIC',    role: 'DEPT_HEAD' },
    { username: 'politics',   password: 'dept123',      real_name: '刘主任（政教处）', dept_code: 'POLITICS',    role: 'DEPT_HEAD' },
    { username: 'logistics',  password: 'dept123',      real_name: '陈主任（后勤部）', dept_code: 'LOGISTICS',   role: 'DEPT_HEAD' },
    { username: 'lifecenter', password: 'dept123',      real_name: '赵主任（生活中心）', dept_code: 'LIFE_CENTER', role: 'DEPT_HEAD' },
    { username: 'grade7',     password: 'dept123',      real_name: '孙主任（七年级）', dept_code: 'GRADE_7',    role: 'DEPT_HEAD' },
    { username: 'grade8',     password: 'dept123',      real_name: '吴主任（八年级）', dept_code: 'GRADE_8',    role: 'DEPT_HEAD' },
    { username: 'grade9',     password: 'dept123',      real_name: '周主任（九年级）', dept_code: 'GRADE_9',    role: 'DEPT_HEAD' },
    // 普通教师（各部门各一名）
    { username: 'staff_academic',  password: 'staff123', real_name: '教务处老师',   dept_code: 'ACADEMIC',    role: 'STAFF' },
    { username: 'staff_politics',  password: 'staff123', real_name: '政教处老师',   dept_code: 'POLITICS',    role: 'STAFF' },
    { username: 'staff_grade7',    password: 'staff123', real_name: '七年级老师',   dept_code: 'GRADE_7',     role: 'STAFF' },
  ];

  for (const u of presetUsers) {
    const exists = db.exec(`SELECT id FROM sys_user WHERE username = '${u.username}'`);
    if (!exists.length || !exists[0].values.length) {
      const hashedPwd = bcrypt.hashSync(u.password, 10);
      const deptId = getDeptId(u.dept_code);
      db.run(
        `INSERT INTO sys_user (username, password, real_name, department_id, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [u.username, hashedPwd, u.real_name, deptId, u.role, now, now]
      );
    }
  }

  // 插入系统配置
  const configs = [
    { key: 'current_semester', value: '2025-2', desc: '当前学期' },
    { key: 'current_week_start', value: '2026-02-25', desc: '本学期第1周起始日期' },
    { key: 'week_first_day', value: '0', desc: '每周第一天（0=周日，1=周一）' },
    { key: 'school_name', value: '上海新纪元教育集团瑞安总校', desc: '学校全称' },
    { key: 'school_sub_name', value: '初中部', desc: '学校子名称' },
    { key: 'wechat_webhook_url', value: '', desc: '企业微信机器人 Webhook URL' }
  ];

  for (const cfg of configs) {
    const exists = db.exec(`SELECT id FROM sys_config WHERE config_key = '${cfg.key}'`);
    if (!exists.length || !exists[0].values.length) {
      db.run(
        `INSERT INTO sys_config (config_key, config_value, description, update_time) VALUES (?, ?, ?, ?)`,
        [cfg.key, cfg.value, cfg.desc, now]
      );
    }
  }
}

// 封装查询辅助函数
function query(sql, params = []) {
  try {
    const result = db.exec(sql, params);
    if (!result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch (e) {
    console.error('SQL query error:', e.message, sql);
    throw e;
  }
}

function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    // 获取最后插入的 rowid
    const r = db.exec('SELECT last_insert_rowid() as id');
    const lastId = r[0]?.values[0]?.[0] || null;
    saveDB();
    return { lastInsertRowid: lastId };
  } catch (e) {
    console.error('SQL run error:', e.message, sql);
    throw e;
  }
}

module.exports = { initDB, getDB, saveDB, query, queryOne, run };
