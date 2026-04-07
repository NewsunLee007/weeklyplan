# 系统优化方案 (System Optimization Plan)

## 1. 摘要 (Summary)
本次优化旨在解决用户在计划填报和审核过程中的三个核心痛点：
1. **审核操作增强**：允许审核人员对计划条目进行“仅保存修改”而不推进审核状态，且修改内容实时同步给计划发起人。
2. **多任务填报体验优化**：满足发起人“在同个方框内填写一天多项工作及对应负责人”的习惯。
3. **新增预发计划（工作指导）功能**：由办公室主任预先发布本周大致工作，全员可见，避免各部门重复提交相同内容。

## 2. 当前状态分析 (Current State Analysis)
- **审核操作**：目前 `ReviewDetail.vue` 和 `ReviewConsolidated.vue` 中仅有“通过”、“发布”和“退回”操作。修改条目后必须点击通过才能保存。
- **填报体验**：`PlanForm.vue` 中的“负责人/部门”字段是一个单行输入框 (`<el-input>`)，当“工作内容”是多行文本时，负责人无法对齐，排版体验不佳。
- **全局预发计划**：目前系统没有全局的工作指导或预发计划功能，导致各部门可能在自己的计划中重复填报学校的公共事务。

## 3. 具体修改方案 (Proposed Changes)

### 3.1 审核时仅保存修改
- **后端 (Backend)**: 
  - 在 `api/_lib/routes/reviews.js` 中新增两个接口：
    1. `POST /:planId/save`：用于单计划审核视图的暂存。
    2. `POST /consolidated/:weekNumber/:semester/save`：用于整合审核视图的暂存。
  - 这两个接口将复用现有的权限校验和 `biz_plan_item` 更新逻辑，但**不修改** `biz_week_plan` 的状态，也**不记录**审核日志。
- **前端 (Frontend)**:
  - 在 `frontend/src/views/review/ReviewDetail.vue` 的底部操作区增加一个“仅保存修改”按钮。点击后调用新接口并提示成功。
  - 在 `frontend/src/views/review/ReviewConsolidated.vue` 的底部操作区同样增加该按钮。

### 3.2 优化同方框多任务填报 (负责人字段多行化)
- **前端输入 (Input)**:
  - 在 `frontend/src/views/plan/PlanForm.vue`、`ReviewDetail.vue`、`ReviewConsolidated.vue` 中，将 `responsible`（负责人/部门）的组件从单行 `<el-input size="small">` 更改为多行文本框 `<el-input type="textarea" :autosize="{ minRows: 1, maxRows: 6 }">`。
  - 这样发起人可以通过回车换行，让负责人列表与工作内容列表在视觉上逐行对齐。
- **前端展示 (Display)**:
  - 在 `PlanDetail.vue`、`PublishedPlan.vue` 及其他表格展示页中，为负责人列的显示内容添加 CSS 样式 `white-space: pre-wrap;`，确保换行符能够正确渲染。
- **数据结构 (Database)**: 
  - 无需修改数据库，因为现有的 `responsible` 字段已经是 `TEXT` 类型，完全支持存储包含换行符的多行字符串。

### 3.3 办公室主任预发本周工作 (全局工作指导)
- **数据库 (Database)**:
  - 在 `api/_lib/db/database.js` 中新建表 `biz_weekly_guideline`，包含字段：`id`, `semester`, `week_number`, `content`, `create_time`, `update_time`, `create_by`。
- **后端 API (Backend)**:
  - 创建新路由文件 `api/_lib/routes/guidelines.js`。
  - 提供 `GET /api/guidelines/current`（根据学期和周次获取指导内容）和 `POST /api/guidelines/save`（保存或更新指导内容，仅限 `OFFICE_HEAD` 和 `ADMIN`）。
  - 在 `api/app.js` 中注册该路由。
- **前端 UI (Frontend)**:
  - **展示位置**：在 `frontend/src/views/plan/PlanForm.vue` (新建计划页) 的顶部区域（表格上方）增加一个专属的“本周学校工作指导”展示卡片 (`<el-alert>` 或带背景色的 `<el-card>`)。
  - **动态获取**：当用户选择/切换“学期”和“周次”时，自动请求接口获取当周的预发计划并展示。
  - **编辑入口**：如果当前登录用户的角色是 `OFFICE_HEAD` 或 `ADMIN`，卡片内会额外显示一个“编辑预发工作”按钮。点击弹出一个 Dialog 对话框，内含多行文本框供其编写并保存本周的预发计划。
  - **效果**：所有填报人在开始写自己的计划前，都会先看到这段内容，从而完美实现“大家就可以不用重复提交相关的计划内容了”的需求。

## 4. 假设与决策 (Assumptions & Decisions)
- **假设**：“后端要同步给计划发起人” 意味着发起人在查看自己的计划详情时能看到审核人修改后的最新条目。由于我们直接更新了 `biz_plan_item` 表，发起人刷新页面即可看到，无需额外开发 WebSocket 或站内信通知。
- **决策**：将“预发计划”集成到新建计划页（PlanForm.vue）的顶部，而不是做成一个单独的菜单页，这是因为强上下文关联能最大程度防止用户重复填报，体验最好。

## 5. 验证步骤 (Verification Steps)
1. **审核保存**：以审核人身份登录，修改某条目并点击“仅保存修改”，刷新页面后确认修改保留，且计划状态未推进。以发起人身份登录查看该计划，确认能看到修改后的条目。
2. **多行填报**：在新建计划时，在“工作内容”和“负责人”中均输入多行文本（使用回车换行），保存后查看详情页和已发布页，确认换行排版正常显示。
3. **预发计划**：以办公室主任身份登录进入新建计划页，点击“编辑预发工作”并保存一段测试文本。然后以普通部门主任身份登录进入新建计划页，确认能清晰看到该预发内容且无法编辑。
