# 反馈管理查看与导出优化计划

## 1. 现状分析
- **权限问题**：目前只有 `ADMIN` 和 `PRINCIPAL` 能在“已发布计划”接口（`/api/published`）中看到全校所有部门的计划，而 `OFFICE_HEAD` (办公室主任) 仅能看到自己部门的计划。
- **反馈查看**：前端 `FeedbackList.vue` 只有“填写反馈”的入口，并且点击后进入的是可编辑表单（`FeedbackForm.vue`），缺少一个只读的“查看明细”弹窗供校长和主任审阅其他部门的反馈。
- **反馈导出**：目前系统缺乏导出反馈为 Excel 的功能。用户要求支持一键打印（A4横向排版、美观、带标题、重复表头、页脚等），这需要引入支持高级打印页面设置的 `exceljs` 库。

## 2. 拟议更改 (Proposed Changes)

### 2.1 后端权限及接口调整
- **文件**：`api/_lib/routes/published.js` 和 `backend/src/routes/published.js`
  - **修改内容**：将判断条件中的 `!['ADMIN', 'PRINCIPAL'].includes(req.user.role)` 修改为 `!['ADMIN', 'PRINCIPAL', 'OFFICE_HEAD'].includes(req.user.role)`，允许办公室主任获取所有部门的已发布计划列表。
  
- **文件**：`api/_lib/routes/feedbacks.js` 和 `backend/src/routes/feedbacks.js`
  - **新增内容**：增加 `GET /export/excel` 接口。
  - **实现逻辑**：
    - 接收 `semester` 和 `weekNumber` 参数。
    - 使用 `exceljs` 创建 A4 横向（`orientation: 'landscape'`）、含表头重复（`printTitlesRow: '1:2'`）及页脚页码（`oddFooter: '&C第 &P 页，共 &N 页'`）的 Workbook。
    - 联表查询该周所有已发布计划、工作条目（`biz_plan_item`）及反馈内容（`biz_feedback`）。
    - 组装包含“序号、日期、星期、部门、工作内容、负责人、完成状态、反馈说明”的数据行，设置边框、居中、自动换行等样式后，以 Excel Buffer 格式响应下载。

### 2.2 依赖库安装
- **需要执行的操作**：在 `api/` 和 `backend/` 目录下分别执行 `npm install exceljs`，安装生成精美 Excel 所需的依赖库。

### 2.3 前端反馈列表优化
- **文件**：`frontend/src/views/feedback/FeedbackList.vue`
  - **筛选与导出 UI**：在页面顶部引入类似 `PublishedPlan.vue` 的筛选栏，支持选择“学期”和“周次”。新增一个“导出本周汇总 (Excel)”按钮，当且仅当选中了周次时可用。
  - **列表操作列重构**：
    - 如果计划属于当前用户所在部门（`row.department_id === userStore.userInfo?.departmentId`），则显示原有的“填写反馈/编辑反馈”按钮。
    - 如果不属于本部门（即校长/办公室主任查阅其他部门），则显示“查看明细”按钮。
  - **在线预览弹窗**：新增一个 `<el-dialog>`，点击“查看明细”时弹出。在弹窗内请求该计划的工作内容（`/plans/:id`）及反馈（`/feedbacks?plan_id=:id`）并合并，通过只读的 `<el-table>` 展示每个条目的完成状态和反馈说明。

## 3. 假设与决定
- **Excel 库的选择**：因为 `xlsx` (SheetJS 社区版) 无法实现用户要求的打印页面设置（页脚、重复表头等），故决定引入并使用 `exceljs`。
- **在线预览方式**：为了不破坏现有的填写反馈逻辑，将预览功能以弹窗（Dialog）形式嵌入在 `FeedbackList.vue` 中，方便领导快速审阅而无需频繁跳转页面。

## 4. 验证步骤
1. 执行依赖安装后，检查后端服务是否正常启动。
2. 以前端校长或办公室主任角色登录，进入“反馈管理”页面。
3. 验证是否能看到全部部门的计划，且非本部门计划显示为“查看明细”。
4. 点击“查看明细”弹窗，检查数据是否正确只读展示。
5. 选定学期和周次，点击“导出本周汇总”，下载并打开 Excel 文件，按 `Ctrl+P` (或 `Cmd+P`) 进入打印预览，检查 A4 横向、表头、页脚和边框等格式是否完美。