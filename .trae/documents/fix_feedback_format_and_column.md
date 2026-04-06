# 反馈表单错位与保存失败终极修复计划

## 1. 现状分析 (Current State Analysis)
根据用户的截图和报错日志，目前反馈功能出现了两个连锁的致命错误：
1. **前端表格错位且控制台报 `r.formatDate is not a function`**：
   - **原因**：在上一轮尝试砍掉日期多余的 `T00:00:00.000Z` 尾巴时，我在 `<template>` 中调用了 `formatDate` 函数，但却**漏掉了在 `<script setup>` 中引入 `dayjs` 并定义该函数**。
   - 这导致 Vue 在渲染第一列（日期）时直接崩溃报错。由于第一列没渲染出来，后面的“星期”、“工作内容”等列的 DOM 节点就全部向左挤占了一个位置，造成了表头和内容完全牛头不对马嘴的“灵异”错位现象。
2. **点击保存报错 `column "content" of relation "biz_feedback" does not exist`**：
   - **原因**：在数据库底层结构中，为了和“计划内容”区分，老师填写的“反馈说明”字段被严格命名为了 `feedback_content`。但在后端 `POST /` 路由执行 `INSERT` 和 `UPDATE` 时，错写成了往 `content` 列中塞数据。数据库找不到这个列，于是报错拦截。

## 2. 拟议修改 (Proposed Changes)

### 2.1 修复前端崩溃与表格错位
- **文件**：`frontend/src/views/feedback/FeedbackForm.vue`
- **修改**：
  - 在 `<script setup>` 顶部加入 `import dayjs from 'dayjs'`。
  - 定义缺失的格式化函数：
    ```javascript
    function formatDate(val) {
      if (!val) return ''
      return dayjs(val).format('YYYY-MM-DD')
    }
    ```
  - 这样 Vue 就能正常渲染日期列，整个表格的错位现象将不治而愈。

### 2.2 修复后端数据库字段不匹配
- **文件**：`api/_lib/routes/feedbacks.js` 和 `backend/src/routes/feedbacks.js`
- **修改**：
  - 在 `UPDATE` 语句中，将 `content=$2` 修正为 `feedback_content=$2`。
  - 在 `INSERT INTO` 语句中，将列名 `content` 修正为 `feedback_content`。
  - 前端传过来的参数名依然是 `content`，但在拼装 SQL 时，必须对齐数据库的真实列名 `feedback_content`。

## 3. 验证步骤 (Verification Steps)
1. 刷新页面，进入“填写反馈”，观察第一列的日期是否正常显示为 `2026-04-09` 且不再报错。
2. 观察表头“星期”、“工作内容”、“负责人”等是否和下方的单元格数据严丝合缝地对齐了。
3. 填写“反馈说明”并点击“保存反馈”，验证是否瞬间弹出“反馈已保存”的成功提示，且控制台不再有任何红字报错。