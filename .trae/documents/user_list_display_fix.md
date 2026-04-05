# 分析并修复用户导入及分页查询的错误

## 1. 现状分析 (Current State Analysis)
根据您提供的终端报错图片：
- 前端有 4 个 `Error`（如 401 权限报错），且显示“数据库正在初始化中，等待完成...”或者“数据库未初始化，返回空结果”。
- 导入功能（`POST /api/users/import`）显示成功返回了。
- 获取用户列表（`GET /api/users`）成功返回了。但是没有显示导入的用户。

通过深入查看代码逻辑，可以发现两个核心问题：

1. **导入用户的 `deptId` 外键关联失败导致隐性问题**：
   在 `users.js` 的 `/import` 逻辑中：
   ```javascript
   const dept = await queryOne(`SELECT id FROM sys_department WHERE name = ? AND is_deleted = false`, [deptName]);
   ```
   这里查询返回的部门如果不存在，`deptId` 会是 `null`。而在我们的 PostgreSQL 数据库中，`sys_user.department_id` 通常不能为 null，如果没有报错，那么这些用户就是被插入到了 `department_id = null` 的状态下（如果建表语句允许的话）。

2. **用户列表查询因为 `department_id` 参数错位导致数据丢失 (最关键的 Bug)**：
   在 `users.js` 的 `GET /` 接口中：
   ```javascript
   const { page = 1, pageSize = 10, department_id, role, keyword } = req.query;
   let where = `WHERE u.is_deleted = false`;
   const params = [];
   if (department_id) { where += ` AND u.department_id = ?`; params.push(department_id); }
   if (role) { where += ` AND u.role = ?`; params.push(role); }
   if (keyword) { where += ` AND (u.username LIKE ? OR u.real_name LIKE ?)`; params.push(`%${keyword}%`, `%${keyword}%`); }
   ```
   在组装 `params` 时，如果只有 `keyword` 有值，`params` 会是 `["%张三%", "%张三%"]`。
   而在分页查询时：
   ```javascript
   const records = await query(
     `SELECT ... FROM sys_user u LEFT JOIN sys_department d ON u.department_id = d.id
      ${where} ORDER BY u.id LIMIT ? OFFSET ?`,
     [...params, Number(pageSize), offset]
   );
   ```
   在 PostgreSQL 下，`adapter.js` 使用了一个自定义的 `convertPlaceholders(sql)`，它会把 `?` 按顺序替换为 `$1`, `$2`, `$3`。
   - `?` 在 `where` 里面有 0 个到 4 个不等。
   - `LIMIT ? OFFSET ?` 也会被替换成占位符。
   如果传的参数类型是 `NaN`（因为 `page` 和 `pageSize` 的隐式转换可能出错，或者是空字符串导致），或者因为参数数量没对齐，会导致底层查询查不到正确数据。而且，更重要的是如果用户导入时没有部门（`deptId = null`），在界面上如果前端强制要求关联部门，它们可能会被前端过滤掉。

3. **初始化拦截机制的问题**：
   从您的日志看到，有大量的 401 报错是因为数据库“还在初始化中”，所以 `queryOne` 强制返回了 `null`。当用户未登录或登录校验拦截时，由于查不到 session 数据，直接返回 401 了。
   
## 2. 拟议修改 (Proposed Changes)

我们将对 `api/_lib/routes/users.js` 和 `backend/src/routes/users.js` 做如下改进：

**针对分页列表不显示的问题：**
在 PostgreSQL 的 `convertPlaceholders` 中，`LIMIT ? OFFSET ?` 如果拼接参数类型不对（比如前端传的是字符串 `'10'`，但传给了 Postgres 的 limit，需要整数），虽然有时能兼容，但最佳做法是**在分页查询时将 LIMIT 和 OFFSET 直接拼接进 SQL 字符串**（避免占位符转换错位），或者确保传给 Postgres 的是严格的数字类型。我们将修改 `users.js` 中的查询：
```javascript
const sizeNum = parseInt(pageSize, 10) || 10;
const offsetNum = (parseInt(page, 10) - 1) * sizeNum;
const records = await query(
  `SELECT ... ${where} ORDER BY u.id LIMIT ${sizeNum} OFFSET ${offsetNum}`,
  params
);
```
这将彻底消除 PostgreSQL 下分页参数类型和位置匹配引发的玄学 Bug。

**针对导入用户的部门外键问题：**
在导入用户时，如果表格填写的部门名称在数据库中找不到对应的部门（比如有空格、错别字，或者完全没填），我们要么报错，要么给一个默认的部门 ID（比如 1：办公室）。
修改导入逻辑：
```javascript
let deptId = 1; // 默认分配给办公室
if (deptName) {
  const dept = await queryOne(`SELECT id FROM sys_department WHERE name = ? AND is_deleted = false`, [deptName]);
  if (dept) deptId = dept.id;
}
```
这样确保新导入的用户都会挂在一个合法的部门下，从而能在前端被正常渲染出来。

## 3. 验证步骤
1. 执行修改后，本地或者 Vercel 构建代码。
2. 进入前端的用户管理列表，查看之前导入的 15 个用户是否因为修改了 `LIMIT` 逻辑而出现。
3. 再次尝试导入含有错误部门名称的用户，验证是否默认分配了有效部门并显示。