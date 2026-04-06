# 系统功能优化计划

## 1. 现状分析 (Current State Analysis)
根据用户的反馈，目前系统存在以下问题：
1. **教务处主任审核报错**：以教务处主任（ACADEMIC_HEAD）身份审核普通教师提交的计划时，提示“部门/教务处主任只能进行第一步审核”并报 `400 Bad Request`。原因是数据库中 `current_step` 字段的类型问题导致严格比较 `!== 1` 判断失败。
2. **“我的计划”页面展示问题**：
   - 教务处主任能看到“办公室”的计划，越权了。
   - “日期范围”列多余，需替换为“提交人”。
   - “操作”列存在视觉分界线，不够融合。
3. **“审核中心 -> 列表审核”内容展示**：表格列名已改为“工作内容”，但实际显示的是计划的 `title`（如“第6周工作行事历”），而不是真正的条目工作内容。
4. **全局默认周次**：要求全局（计划列表、整合审核、新建计划等）根据系统设置的学期开始时间，自动默认选择当前日期的 **下一周（所在周次+1）**，免去每次进入系统都要手动选择的繁琐。
5. **“新建计划”表单交互**：首次进入时没有自动添加一个空白条目行；且“日期”列的宽度不够，导致日期选择框显示不完整。

## 2. 拟议修改 (Proposed Changes)

### 2.1 修复审核权限拦截报错
- **文件**：`api/_lib/routes/reviews.js` 和 `backend/src/routes/reviews.js` (如适用)
- **修改**：在 `/:planId/approve` 和 `/:planId/reject` 接口中，将对 `step` 的判断加上 `Number()` 类型转换，例如 `if (Number(step) !== 1)`。这可以解决从数据库读取到的数值为字符串时导致的 `!==` 严格相等判断失败的问题。

### 2.2 修复“我的计划”越权及界面优化
- **文件**：`api/_lib/routes/plans.js` (及对应后端代码) 和 `frontend/src/views/plan/PlanList.vue`
- **修改**：
  - 在 `GET /` 接口中，将 `ACADEMIC_HEAD` 移出“可查看全校计划”的白名单，使其与 `DEPT_HEAD` 一样只能查看本部门的计划。
  - 在 `GET /` 接口的 SQL 查询中，加入 `LEFT JOIN sys_user u`，并在 `SELECT` 中增加 `u.real_name as creator_name`。
  - 在 `PlanList.vue` 中，将“日期范围”列替换为“提交人”列，并移除“操作”列的 `fixed="right"` 属性以消除分界线。

### 2.3 优化“列表审核”的工作内容展示
- **文件**：`api/_lib/routes/reviews.js` (及对应后端代码) 和 `frontend/src/views/review/ReviewPending.vue`
- **修改**：
  - 在 `GET /pending` 接口中，查询出计划列表后，额外去 `biz_plan_item` 表查询对应的条目内容，并将其用 `；` 拼接后赋值给计划的 `content` 属性返回（使用跨数据库兼容的 JS 层拼接方式）。
  - 在 `ReviewPending.vue` 中，将对应的 `<el-table-column prop="title"` 更改为 `prop="content"`。

### 2.4 全局周次默认值优化
- **文件**：涉及周次筛选的视图组件，如 `PlanList.vue`, `ReviewConsolidated.vue`, `PublishedPlan.vue`
- **修改**：在组件挂载并获取系统配置后，利用 `calcWeekNumber` 计算当前周次，并将筛选条件中的 `week_number` 默认赋值为 `currentWeek + 1`。

### 2.5 新建计划界面交互优化
- **文件**：`frontend/src/views/plan/PlanForm.vue`
- **修改**：
  - 在 `onMounted` 中，当为新建模式时，自动调用一次 `addItem()` 以默认展示一个空条目。
  - 调整“日期”列的宽度（如 `width="180"` 或 `200"`），确保日期选择框可以完整显示。

## 3. 验证步骤 (Verification Steps)
1. 登录为教务处主任，查看“我的计划”是否只能看到自己部门的计划。
2. 登录为教务处主任，去“审核中心”点击审核某位老师提交的计划，验证是否能成功审核通过而不再报 400 错误。
3. 在“列表审核”页面，验证列表中是否直接展示了拼装好的工作内容。
4. 验证各个页面默认选中的周次是否为当前真实周次 + 1。
5. 验证进入“新建计划”时，是否自动有一行空条目且日期框显示完整。