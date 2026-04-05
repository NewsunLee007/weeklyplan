# 修复用户管理模块新增与导入失败的计划

## 1. 现状分析 (Current State Analysis)
根据用户反馈，“批量上传和新增用户后界面没有出现新增的用户”，经过代码排查，根本原因在于：
1. **全局常量求值时机错误导致 SQL 类型不匹配**：
   在 `users.js`、`departments.js` 和 `ai.js` 中，定义了 `IS_DELETED_FALSE = getBooleanValue(false)`。由于 `require` 是在服务启动时同步执行的，此时数据库尚未连接，`dbType` 为空，导致这几个文件永远把 `IS_DELETED_FALSE` 解析为 SQLite 的 `0`。
2. **PostgreSQL 强类型拦截**：
   在 Neon (PostgreSQL) 环境下执行 `SELECT ... WHERE is_deleted = 0` 时，由于 `is_deleted` 是 `BOOLEAN` 类型，而 `0` 是 `INTEGER` 类型，Postgres 强类型机制会直接报错 `operator does not exist: boolean = integer`。
3. **表现出的现象**：
   查询报错被底层的 `try-catch` 拦截，返回了空数据（`[]` 或 `null`）。这导致：
   - 新增用户时，系统无法判断用户名是否已存在。
   - 获取用户列表时（`GET /users`），由于 WHERE 语句中包含 `is_deleted = 0`，查询崩溃返回空列表，导致界面刷新后“没有出现新增的用户”。
   - 批量导入时，原本系统设置的机制是**如果用户名已存在则更新信息，不存在则插入**，但由于查询报错导致永远查不到已存在用户，从而尝试全部执行 `INSERT`，导致用户名唯一索引冲突报错，或者数据错乱。

## 2. 拟议修改 (Proposed Changes)

为了彻底根除 `is_deleted` 带来的强类型判断问题（因为无论是 Postgres 还是高版本的 SQLite 均原生支持 `true` 和 `false` 关键字）：

**针对文件：**
- `api/_lib/routes/users.js` 和 `backend/src/routes/users.js`
- `api/_lib/routes/departments.js` 和 `backend/src/routes/departments.js`
- `api/_lib/routes/ai.js` 和 `backend/src/routes/ai.js`

**具体步骤：**
1. **移除不可靠的布尔转换函数**：
   删掉上述文件顶部的 `getBooleanValue` 函数以及 `IS_DELETED_FALSE` / `IS_DELETED_TRUE` / `IS_ACTIVE_TRUE` 等常量。
2. **SQL 语句硬编码布尔值适配**：
   - 将查询语句中的 `is_deleted = ?` 替换为 `is_deleted = false`，并从 `params` 数组中移除对应的参数。
   - 将软删除语句 `UPDATE ... SET is_deleted = ?` 替换为 `UPDATE ... SET is_deleted = true`，移除对应的参数。
   - 将 `is_active = ?` 替换为 `is_active = true` 等。
   *(注：这样修改后，SQLite 和 PostgreSQL 都能完美原生解析 `false` 和 `true` 关键字，不会再有任何类型冲突)*
3. **优化导入机制的容错处理 (在 `users.js` 的 `/import` 接口)**：
   恢复原本的逻辑：在上传用户时，如果通过 `SELECT id FROM sys_user WHERE username = ? AND is_deleted = false` 查询到用户已存在，系统将直接执行 **更新 (UPDATE)** 操作，将最新的部门、角色和真实姓名覆盖到该用户上。这样如果用户重复导入相同数据，就相当于做了一次信息同步，不会导致报错或冗余。

## 3. 假设与决策 (Assumptions & Decisions)
- **假设**：Neon DB (PostgreSQL) 和 本地 SQLite 都能正常处理 SQL 中的 `is_deleted = false` 语法。事实上，SQLite >= 3.23.0 已经原生支持 TRUE/FALSE 关键字，而 Postgres 本身也是标准支持的。
- **决策**：针对“上传相同用户数据”的处理机制，继续采用“**存在则更新，不存在则插入 (Upsert 逻辑)**”的机制。这比直接略过更能满足管理员修改/同步大批量用户数据的需求。

## 4. 验证步骤 (Verification Steps)
1. 修改完成后进行编译 `npm run build`。
2. 验证前端“用户管理”页面能否正常刷出用户列表。
3. 验证在页面上新增一个测试用户，能否正常保存并在列表中展示。
4. 验证批量导入功能，上传重复的用户数据，确认系统返回更新成功且列表无重复。