# 反馈模块连带 Bug 综合修复计划

## 1. 现状分析 (Current State Analysis)
根据用户的反馈和后台日志，反馈模块目前存在以下三个阻碍正常使用的问题：
1. **保存反馈时提示 `column "plan_id" does not exist`**：
   - **原因**：在后端的 `api/_lib/routes/feedbacks.js` 中，执行 `INSERT INTO biz_feedback` 语句时，错误地包含了 `plan_id` 字段。而实际的数据库表中，反馈是直接精确挂载到每一条具体工作内容（`plan_item_id`）上的，并没有 `plan_id` 这个字段。导致数据库直接拒绝插入并报错 400。
2. **填写反馈页面的日期显示多余的 `T00:00:00.000Z`**：
   - **原因**：前端 `FeedbackForm.vue` 中渲染表格的“日期”列时，直接使用了 `prop="plan_date"`，没有对云端数据库返回的 ISO 8601 标准时间字符串进行格式化裁剪。
3. **反馈管理主界面没有进行部门数据隔离**：
   - **原因**：目前 `FeedbackList.vue` 调用的后端接口 `/published/feedbacks`，是直接拉取了全校所有的已发布计划。这导致像“教务处”这样的普通部门账号，也能看到并试图反馈“办公室”的计划，违背了“各扫门前雪”的业务逻辑。

## 2. 拟议修改 (Proposed Changes)

### 2.1 修复保存反馈时的数据库字段报错
- **文件**：`api/_lib/routes/feedbacks.js` 和 `backend/src/routes/feedbacks.js`
- **修改**：
  - 在 `POST /` 路由的 `INSERT INTO` 语句中，彻底删除 `plan_id` 字段及其对应的占位符 `$2` 和参数传入。
  - 只保留 `plan_item_id`, `feedback_user_id`, `status`, `content`, `create_time`, `update_time` 这 6 个真实存在的字段。

### 2.2 修复填写反馈页面的日期格式
- **文件**：`frontend/src/views/feedback/FeedbackForm.vue`
- **修改**：
  - 将原有的 `<el-table-column prop="plan_date" label="日期" width="120" />` 改为使用自定义插槽 `<template #default="{row}">`。
  - 在插槽内部调用 `formatDate(row.plan_date)`（该文件已有此工具函数），将其转化为干净的 `YYYY-MM-DD` 格式。

### 2.3 修复反馈主界面的部门隔离越权问题
- **文件**：`api/_lib/routes/published.js` 和 `backend/src/routes/published.js`
- **修改**：
  - 在 `GET /feedbacks` 路由中，获取当前请求用户的角色（`role`）和所属部门 ID（`departmentId`）。
  - 增加 SQL 过滤条件：如果当前用户**不是**系统管理员（`ADMIN`）或校长（`PRINCIPAL`），则在查询条件中强制追加 `AND p.department_id = $1`，并传入该用户的 `departmentId`。
  - 这样，普通部门主任或干事登录时，接口将严格只返回本部门的已发布计划，彻底解决越权显示问题。

## 3. 验证步骤 (Verification Steps)
1. 登录教务处账号，进入“反馈管理”主界面，验证列表中是否**只显示**教务处本部门的计划，不再混杂办公室等其他部门的计划。
2. 点击“填写反馈”进入表单页，观察最左侧的“日期”列，验证是否变成了干净的 `2026-04-09` 而不再带有 `T00:00:00.000Z`。
3. 在具体的条目上填写反馈说明并修改状态，点击“保存反馈”，验证是否能顺利提示“反馈已保存”且控制台不再报 `column plan_id does not exist` 的错误。