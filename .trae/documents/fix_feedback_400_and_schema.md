# 彻底修复反馈保存 400 错误计划

## 1. 现状分析 (Current State Analysis)
用户在“填写反馈”页面点击保存时，控制台依然抛出 `AxiosError: Request failed with status code 400`。
经过对前后端代码和数据库底层结构的深度追踪，发现了这是一个**“前端传空参数”与“云端数据库结构版本差异”**叠加导致的终极嵌套 Bug。

1. **前端传空参数导致 400 错误**：
   - 在 `FeedbackForm.vue` 中，前端构建提交的 `payload` 时，使用了 `plan_item_id: item.id`。
   - 这里的 `item.id` 实际上是这条工作内容对应的**已有反馈记录的 ID**。如果某条工作内容是**第一次**被填写反馈，它在数据库里还没有生成反馈记录，因此 `item.id` 为空（`null`）。
   - 后端的安全校验逻辑中包含 `if (!plan_item_id) return fail(res, '必填字段不能为空');`。因为收到了空的 `plan_item_id`，后端立刻拦截并抛出了 400 错误。
2. **云端数据库确实缺失 `plan_id` 字段**：
   - 在之前的版本中，我们在 SQLite 数据库里增加了 `plan_id` 字段，并设为 `NOT NULL`。
   - 但是在 Vercel 上的 Postgres 数据库中，由于表在早期已经创建，`CREATE TABLE IF NOT EXISTS` 语法直接跳过了表结构的更新，导致云端数据库的 `biz_feedback` 表里自始至终都没有 `plan_id` 字段。
   - 这就造成了一个死局：如果后端代码不写 `plan_id`，本地 SQLite 就会报 `NOT NULL constraint failed`；如果写了 `plan_id`，云端 Postgres 就会报 `column "plan_id" does not exist`。

## 2. 拟议修改 (Proposed Changes)

### 2.1 修复前端获取工作条目 ID 的逻辑
- **文件**：`frontend/src/views/feedback/FeedbackForm.vue`
- **修改**：将 `submitFeedback` 方法中的 `plan_item_id: item.id` 修正为 `plan_item_id: item.plan_item_id`。这样即使是第一次填写的反馈，也能准确抓取到它所对应的工作内容条目的真实 ID。

### 2.2 强制同步云端数据库结构
- **文件**：`api/_lib/db/adapter.js`
- **修改**：在数据库初始化自检脚本中，紧跟着之前修复 `published_at` 的逻辑下方，追加一条强力的表结构修复语句：
  `await pool.query('ALTER TABLE biz_feedback ADD COLUMN IF NOT EXISTS plan_id INTEGER DEFAULT 0');`
  这样，Vercel 部署完成后，云端数据库会自动给自己打补丁，加上缺失的 `plan_id` 字段，从而实现本地与云端底层结构的完美统一。

### 2.3 恢复后端的 `plan_id` 参数
- **文件**：`api/_lib/routes/feedbacks.js` 和 `backend/src/routes/feedbacks.js`
- **修改**：将 `plan_id` 重新加回 `req.body` 的解构、非空校验以及 `INSERT INTO` 语句中。

## 3. 验证步骤 (Verification Steps)
1. 刷新页面，进入“反馈管理”，选择任意一个未填写过反馈的计划点击“填写反馈”。
2. 填写内容并修改状态，点击“保存反馈”。
3. 验证是否瞬间弹出绿色的“反馈已保存”提示，且控制台不再出现 400 错误或任何关于 `plan_id` 的红字报错。