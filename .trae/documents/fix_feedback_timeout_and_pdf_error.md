# 修复反馈提交超时与导出 PDF 400 错误计划

## 1. 现状分析 (Current State Analysis)
用户反馈了两个系统异常：
1. **反馈管理页面提交反馈时，提示 `AxiosError: timeout of 30000ms exceeded`**。
   - **原因分析**：在 `api/_lib/routes/feedbacks.js` 的 `POST /` 路由中，获取当前用户 ID 的解构赋值写成了 `const { id: user_id } = req.user`。但是，身份验证中间件注入到 `req.user` 中的主键字段名是 `userId`，导致 `user_id` 实际上是 `undefined`。当试图将 `undefined` 插入数据库的 `NOT NULL` 字段时，引发了底层数据库的抛错。而该路由没有使用 `try...catch` 块包裹异步的 `execute` 数据库操作，导致错误没有被 Express 捕获，请求一直挂起不响应，直到前端 30 秒后强制超时。
2. **在“已发布计划”页面点击“导出 PDF”时，提示 `Request failed with status code 400`**。
   - **原因分析**：后端的 PDF 导出逻辑依赖于服务器本地安装的 WPS 或 LibreOffice。然而，系统目前部署在 Vercel Serverless 云环境中，该环境没有也无法安装这些庞大的桌面办公软件。当后端检测不到转换工具时，会主动返回 `400` 错误。但前端在请求时设置了 `responseType: 'blob'`，导致 Axios 将包含错误信息的 JSON 响应当成了二进制文件流处理，无法直接在页面上弹出友好的中文提示。

## 2. 拟议修改 (Proposed Changes)

### 2.1 彻底修复反馈提交超时Bug
- **文件**：`api/_lib/routes/feedbacks.js` 和 `backend/src/routes/feedbacks.js`
- **修改内容**：
  1. 修正用户 ID 的获取方式：从 `const { id: user_id } = req.user` 改为 `const { userId: user_id } = req.user`。
  2. 使用 `try...catch` 块包裹整个路由的异步逻辑，确保即使数据库出现任何异常，也能立刻向前端返回包含错误信息的 JSON 响应，彻底杜绝请求挂起和 30 秒超时的现象。

### 2.2 处理云环境下的导出 PDF 报错
- **文件**：`frontend/src/views/plan/PublishedPlan.vue`
- **修改内容**：
  鉴于 Vercel 免费 Serverless 环境的体积限制（最大 50MB），纯 Node.js 环境无法完美实现带复杂表格的 Word 到 PDF 的转换。为了避免用户点击后报错带来糟糕的体验，最稳妥的方案是：
  1. 在前端页面中暂时隐藏/移除“导出 PDF”按钮。
  2. 仅保留“导出 Word”按钮（用户可以下载 Word 后在本地使用 Office 软件另存为 PDF）。
  3. （可选）清理掉多余的 `exportSummaryPdf` 前端方法。

## 3. 验证步骤 (Verification Steps)
1. 进入“反馈管理”页面，随意填写一段反馈并点击提交，验证是否能在一秒内提示“提交成功”，不再出现转圈 30 秒超时的现象。
2. 进入“已发布计划”页面，验证右上角的“导出 PDF”按钮是否已经消失，且“导出 Word”按钮依然正常可用。