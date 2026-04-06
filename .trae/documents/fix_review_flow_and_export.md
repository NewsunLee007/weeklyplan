# 系统核心修复与数据自愈计划

## 1. 现状分析 (Current State Analysis)
根据您提供的日志和反馈，当前系统主要存在以下三个核心问题：
1. **控制台大量的 401 报错**（如 `/api/dashboard/stats` 等）：
   - **原因**：这是因为您之前登录的身份（Token）已过期（通常静置一段时间后发生）。当您重新打开浏览器或刷新页面时，由于 Token 失效，所有的 API 请求都会被服务器拦截并返回 `401 Unauthorized`。系统底层的 `request.js` 拦截器在捕捉到 401 后，已经将您重新重定向到了 `/login` 登录页。
   - **结论**：这属于正常的安全过期保护机制，并非系统 Bug。只要重新登录，获取新的 Token 后，这些接口即可正常工作。

2. **“审核流程异常”的 400 报错**：
   - **原因**：这是由于底层数据库中 `current_step` 字段被定义为了字符串（VARCHAR）。之前的代码在流转状态时使用了 `step + 1`，导致在 JavaScript 中 `"1" + 1` 变成了 `"11"`，`"2" + 1` 变成了 `"21"`。当您或者其他主任尝试审核这些 `current_step` 为 `"11"` 或 `"21"` 的计划时，系统在状态流转映射表（`STATUS_FLOW`）中找不到对应的节点，从而抛出了“审核流程异常”并拒绝操作。
   - **结论**：我们需要修正加法逻辑为 `Number(step) + 1`，并在系统底层加入**数据自愈脚本**，把数据库里所有被破坏的步骤数据（如 `"11"`, `"21"`）修复为正常的 `1`、`2`、`3`。

3. **导出 Word 失败（报错 `item.plan_date.split is not a function`）**：
   - **原因**：由于迁移到云端 Postgres 数据库后，部分日期字段被底层驱动解析成了 JavaScript 的原生 `Date` 对象，而原生对象没有 `.split()` 方法（之前本地 SQLite 返回的是字符串），从而导致拼接导出数据时代码崩溃。
   - **结论**：需要增强代码对日期格式的兼容处理。

## 2. 拟议修改 (Proposed Changes)

### 2.1 引入数据自愈脚本（修复脏数据）
- **文件**：`api/_lib/db/adapter.js` 和 `backend/src/db/adapter.js`
- **修改**：在数据库初始化流程中，加入自动修复 `biz_week_plan` 表 `current_step` 的 SQL 语句。根据计划的真实 `status`（如 `SUBMITTED`, `DEPT_APPROVED` 等），强制把 `current_step` 重置为正确的数字字符串 `'1'`, `'2'`, `'3'` 等，从而让所有卡死的计划恢复正常的审核流。

### 2.2 修复状态流转的字符串拼接 Bug
- **文件**：`api/_lib/routes/reviews.js` 和 `backend/src/routes/reviews.js`
- **修改**：在审核通过的逻辑中，将 `let nextStep = step + 1;` 严谨地修改为 `let nextStep = Number(step) + 1;`。彻底杜绝 `"11"` 这种错误的步骤值再次产生。

### 2.3 修复导出 Word 崩溃 Bug
- **文件**：`api/_lib/routes/export.js` 和 `backend/src/routes/export.js`
- **修改**：在处理 `item.plan_date` 时，加入类型判断：如果是原生 `Date` 对象，则先调用 `.toISOString()` 转换为字符串后再执行 `.split('T')[0]`，从而兼容不同的云端数据库驱动。

## 3. 验证步骤 (Verification Steps)
1. 部署后，刷新系统并登录教务处主任账号，进入“审核中心”。
2. 尝试点击任意一条之前报“审核流程异常”的计划进行审核，验证是否能够顺利通过。
3. 尝试点击“导出全校整合 Word”按钮，验证是否能正常弹出下载而不再报 500 错误。
4. （对于 401 错误，您可以放心地正常登录使用，过期重定向机制将继续保护您的系统安全）。