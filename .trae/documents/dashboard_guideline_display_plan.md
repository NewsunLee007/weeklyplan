# 工作台预发工作指导展示修复计划

## 1. 现状分析
当前在工作台 (`Dashboard.vue`) 的“下周工作指导”板块中，预发的工作内容被显示为了一串原始的 JSON 代码（例如 `[{"plan_date":"2026-04-14",...}]`）。
其根本原因是：
1. 后端数据库 `biz_weekly_guideline` 表中存储的 `content` 实际上是由多个任务条目组成的 **JSON 数组字符串**（由于预发工作现在使用了与新建计划相同的表格录入方式）。
2. 工作台前端 `Dashboard.vue` 依然将 `upcomingGuideline.content` 作为普通文本字符串对待，仅做了简单的换行符替换 (`<br>`) 和 `v-html` 渲染，导致 JSON 字符串直接暴露在界面上。

## 2. 拟议更改 (Proposed Changes)

为了使预发工作内容像正常的计划一样以表格形式优雅呈现，计划进行以下代码调整：

### 2.1 修改 `frontend/src/views/Dashboard.vue`
- **新增 JSON 解析计算属性**：
  在 `<script setup>` 中新增一个 `parsedGuideline` 的 `computed` 属性。该属性会尝试通过 `JSON.parse()` 将 `upcomingGuideline.value.content` 转换为 JavaScript 数组。如果解析失败，则返回空数组。
- **新增日期格式化函数**：
  由于 `Dashboard.vue` 尚未定义 `formatDate` 函数，我们将添加一个基于 `dayjs` 的 `formatDate` 辅助函数，将表格中的时间戳格式化为 `YYYY-MM-DD` 形式。
- **更新模板结构 (Template)**：
  将原本直接展示内容的 `div` 替换为 `<el-table>` 组件结构（与 `PlanForm.vue` 保持风格一致）。
  - 如果 `parsedGuideline` 数组存在有效数据，使用 `<el-table>` 渲染包含“序号”、“日期”、“星期”、“工作内容”、“负责人/部门”五列的表格。
  - 为了兼容可能存在的纯文本旧数据，在 `v-else-if` 中保留原本的 `v-html` 文本渲染逻辑。

## 3. 假设与决定
- **兼容性决定**：由于早期数据或某些极端情况下，`content` 可能不是标准的 JSON 数组而是纯文本。因此，在模板中我们通过判断 `parsedGuideline` 的解析结果长度来决定是展示漂亮的 `el-table`，还是回退到展示纯文本，这样可以最大程度避免页面报错。
- **样式统一**：使用 Element Plus 的 `el-table` 组件及相同的列宽设定，确保工作台上的表格与计划管理中的表格体验一致。

## 4. 验证步骤
1. 完成代码修改后，检查控制台是否有 Vue 语法报错。
2. 回到系统工作台，查看“下周工作指导”板块，确认 JSON 代码已转变为结构清晰的表格。
3. 确认日期列和多行文本（包含序号）显示正常且高度自适应。