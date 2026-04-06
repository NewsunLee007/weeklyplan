# 审核中心与导出功能优化计划

## 1. 现状分析 (Current State Analysis)
根据用户的反馈和日志，当前系统在审核中心和导出模块存在以下问题：
1. **整合审核数据加载问题**：
   - 用户进入“整合审核”页面时，没有像“列表审核”那样自动加载数据，而是需要手动点击查询才能显示。
   - **原因**：在 Vue 的 `setup` 生命周期中，虽然调用了 `onMounted(async () => { await loadConfig(); loadData(); })`，但是 `weekNumber` 的计算结果因为存在异步延迟，导致 `loadData` 请求发出去的时候，可能使用了默认的 `weekNumber`（1）而不是当前周，或者数据虽然返回了但由于空依赖导致未及时渲染。
2. **批量审核/发布报错 `42703` (column "published_at" does not exist)**：
   - **原因**：由于迁移数据库时，在 `biz_week_plan` 建表语句中确实漏掉了 `published_at` 字段（在 SQLite 中可能通过自动处理规避了，但在 Postgres 中严格检查列名）。`backend/src/db/adapter.js` 中的创建表语句和 `api/_lib/db/adapter.js` 都没有成功将该列加到已存在的表中。
3. **按钮名称统一**：
   - 审核中心下的“导出全校整合 Word”需要统一改为“导出 Word”。
   - 这个按钮需要同时出现在“列表审核”和“整合审核”页面。

## 2. 拟议修改 (Proposed Changes)

### 2.1 修复整合审核自动加载数据的问题
- **文件**：`frontend/src/views/review/ReviewConsolidated.vue`
- **修改**：
  - 优化 `loadConfig` 和 `loadData` 的调用顺序和依赖。确保 `weekNumber` 和 `semester` 从配置中成功计算出来后，再执行 `loadData()`。
  - 添加对配置加载状态的监控，确保用户首次进入页面即可看到对应的当周数据。

### 2.2 修复 `published_at` 列缺失导致的一键发布失败
- **文件**：`api/_lib/db/adapter.js` 和 `backend/src/db/adapter.js`
- **修改**：
  - 在数据库初始化过程的“数据自愈”模块中，加入一条 `ALTER TABLE biz_week_plan ADD COLUMN IF NOT EXISTS published_at TIMESTAMP` 的容错 SQL，确保在发布计划时更新该字段不会因为列不存在而崩溃。

### 2.3 统一并补全“导出 Word”功能
- **文件**：`frontend/src/views/review/ReviewConsolidated.vue` 和 `frontend/src/views/review/ReviewPending.vue`
- **修改**：
  - 将 `ReviewConsolidated.vue` 中的“导出全校整合 Word”按钮重命名为“导出 Word”。
  - 将同样的“导出 Word”按钮和对应的 `exportWord` 方法移植到 `ReviewPending.vue`（列表审核页面）的右上角，使其在这两个视图中保持功能和体验一致。
  - 在 `ReviewPending.vue` 中也引入 `semester` 和 `weekNumber` 的自动计算逻辑（复用 `loadConfig`），以便导出时能传递正确的周次参数。

## 3. 验证步骤 (Verification Steps)
1. 刷新进入“整合审核”页面，验证是否在不点击“查询”的情况下就能自动显示当周的待审核列表。
2. 选中部分计划点击“批量一键发布”，验证后台是否不再报错 `published_at does not exist`，且状态成功变为“已发布”。
3. 在“列表审核”和“整合审核”页面的右上角，确认均有“导出 Word”按钮，且点击后均能正常下载包含当前周次数据的 `.docx` 文件。