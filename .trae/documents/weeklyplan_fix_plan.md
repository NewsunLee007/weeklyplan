# 修改方案：打通前端与后端 (Vercel + Neon 部署修复)

## 一、当前系统分析
经过深入探查，发现导致 Vercel 线上环境前后端无法打通的几个核心 Bug：
1. **Vercel Serverless 入口错误**：`api/app.js` 没有导出 Express 实例，而是执行了 `app.listen()`，导致 Vercel 访问 `/api/*` 时触发 `app is not a function` 的崩溃。
2. **Neon PostgreSQL 数据库表缺失**：`api/_lib/db/adapter.js` 在使用 Postgres（Neon）时，仅仅初始化了三张基础表（用户、部门、配置），遗漏了所有核心业务表（`biz_week_plan`、`biz_plan_item`、`biz_knowledge_base` 等），这直接导致大部分业务接口报 "relation does not exist" 错误。
3. **INSERT 语句主键返回失效**：原系统依赖 SQLite 的 `.lastInsertRowid` 获取新建记录的 ID，切换到 Postgres 后，`execute` 函数未适配此特性，导致新建计划、部门、用户等操作无法获取 `id`，引发后续关联插入报错或失败。
4. **SQL 占位符兼容性问题**：部分接口（如 `auth.js` 和 `knowledge.js`）混用了 Postgres 特有的 `$1` 和 SQLite 的 `?` 占位符，导致 `adapter.js` 的自动转换逻辑错乱。
5. **本地 SQLite 参数绑定失效**：`api/_lib/db/database.js` 错误地使用了 `db.exec(sql, params)`（`sql.js` 的 `exec` 不支持参数绑定），导致本地开发环境完全瘫痪。

## 二、修改方案详情

### 1. 修复 Vercel Serverless 入口 (`api/app.js` & `api/index.js`)
- **What**：重构 `api/app.js` 的启动逻辑。
- **Why**：Vercel Serverless 必须接收一个可被调用的函数（如 Express `app`）。
- **How**：
  - 移除同步等待 `initDatabase()` 的 `bootstrap` 逻辑，改用 `app.use` 中间件来懒加载或前置初始化数据库。
  - 使用 `module.exports = app;` 导出实例。
  - 将 `app.listen()` 限制在非 Vercel 环境（`!process.env.VERCEL`）下执行，以兼容本地运行。
  - （为了保持同步，`backend/src/app.js` 也将应用相同的逻辑）

### 2. 补全 PostgreSQL 数据表结构 (`api/_lib/db/adapter.js`)
- **What**：在 `initDatabase` 中补全所有业务表的 `CREATE TABLE` 语句。
- **Why**：Neon DB 当前是空的，没有这些表系统无法运作。
- **How**：追加以下核心表的创建：
  - `biz_week_plan`、`biz_plan_item`、`biz_review_record`、`biz_feedback`
  - `biz_knowledge_base`、`biz_knowledge_item`
  - `biz_semester_plan`、`biz_calendar_event`、`sys_school_config`（用于 Dashboard 统计不报错）
  - 修正字段类型，如使用 `SERIAL`, `BOOLEAN`, `TIMESTAMP`, `VARCHAR`。

### 3. 适配 PostgreSQL 的 `lastInsertRowid` (`api/_lib/db/adapter.js`)
- **What**：修复 `execute` 函数中的返回值。
- **Why**：让 `plans.js` 和 `users.js` 等依赖 `result.lastInsertRowid` 的逻辑在 Neon 下继续工作。
- **How**：在 `execute` 内检测若是 `INSERT` 语句且未包含 `RETURNING`，自动追加 `RETURNING id`，并将 `result.rows[0].id` 注入到返回对象的 `lastInsertRowid` 属性中。

### 4. 统一 SQL 占位符语法 (`api/_lib/routes/auth.js` & `api/_lib/routes/knowledge.js`)
- **What**：将硬编码的 `$1`, `$2` 等全部替换为 `?`。
- **Why**：统一语法，交由 `adapter.js` 的 `convertPlaceholders` 底层自动适配 Postgres (`$n`)，防止混用导致崩溃。
- **How**：在相关文件中执行全局替换。

### 5. 修复 SQLite 层的 `query` 函数（`api/_lib/db/database.js`）
- **What**：修复 `db.exec()` 忽略参数绑定的问题。
- **Why**：保障未配置 Neon 环境变量的本地测试环境能正常运行。
- **How**：改用 `const stmt = db.prepare(sql); stmt.bind(params);` 的标准 `sql.js` 遍历执行逻辑。

## 三、验证步骤
1. 代码修改完成后，Vercel 重新部署。
2. 访问线上环境的 `/api/auth/login`，测试使用默认管理员账号 `admin`/`admin123` 登录。
3. 进入系统进行“新建周计划”操作，验证能否正常保存至 Neon DB，不再抛出 500 错误。
4. 浏览系统 Dashboard 与知识库模块，验证图表和列表是否正常加载无错。