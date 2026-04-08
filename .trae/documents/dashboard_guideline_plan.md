# 系统优化方案 (System Optimization Plan - Phase 3)

## 1. 摘要 (Summary)
本次优化旨在在首页控制台 (Dashboard) 为所有用户提供便捷的“下周工作指南”查看入口，避免非办公室主任用户必须进入“新建计划”页面才能看到工作指导的问题：
1. **控制台新增板块**：在 `Dashboard.vue` 的概览统计和快速操作区域之间，插入一个专门的“下周工作指南”卡片。
2. **动态数据获取**：修改仪表盘后端接口，使其返回当前的学期和周次信息，前端利用该信息自动请求并展示下一周 (`当前周次 + 1`) 的预发工作内容。

## 2. 当前状态分析 (Current State Analysis)
- **前端页面**：`Dashboard.vue` 目前展示了统计概览、快速操作、图表、AI分析和最近活动，但没有任何与“预发工作/工作指导”相关的模块。
- **后端接口**：获取仪表盘统计数据的 `/api/dashboard/stats` 接口内部虽然计算了当前周次，但并未将 `current_week` 和 `current_semester` 返回给前端，导致前端无法直接知道“下一周”是第几周。

## 3. 具体修改方案 (Proposed Changes)

### 3.1 修改后端 Dashboard API (`api/_lib/routes/dashboard.js`)
- **位置**：`GET /stats`
- **逻辑**：在原有的获取 `current_week_start` 的查询中，使用 `IN ('current_week_start', 'current_semester')` 同时拉取当前学期的配置。
- **输出**：在返回的 JSON 对象中，新增 `semester` 和 `week` 两个字段，供前端使用。

### 3.2 修改前端 Dashboard 页面 (`frontend/src/views/Dashboard.vue`)
- **新增状态变量**：在 `<script setup>` 中新增 `nextWeekGuidelineItems` 和 `nextWeekGuidelineContent`，用于存储请求回来的表格或文本格式的指导内容，以及 `nextWeekNumber` 用于界面显示。
- **新增请求逻辑**：新增异步函数 `fetchNextWeekGuideline(semester, currentWeek)`，在成功获取 `stats` 数据后被调用，请求 `/api/guidelines/current?semester=${semester}&weekNumber=${currentWeek + 1}`。
- **UI 插入**：在 `<template>` 的快速操作区域 (`.quick-actions-section`) 和标签页区域 (`.tabs-section`) 之间，插入“下周工作指南”卡片区块。
  - 如果数据是表格数组（最新格式），则使用精简的 `el-table` 进行展示。
  - 如果数据是纯文本（兼容旧格式），则直接使用 `div` 渲染多行文本。
- **样式适配**：为新插入的区块添加 `.guideline-section` 和 `.guideline-card` 的 CSS 类，确保其视觉效果（背景、圆角、阴影、深色模式适配）与控制台其他卡片高度一致。

## 4. 假设与决策 (Assumptions & Decisions)
- **展示权限**：所有用户（包含普通教师和管理员）都可以在控制台看到这个板块，这也是“全校可见”的核心需求。
- **异常处理**：如果下一周没有发布任何工作指南（接口返回空），则整个板块 `v-if` 会判断为 `false` 并自动隐藏，以保证控制台的整洁，避免显示大块的“暂无数据”。

## 5. 验证步骤 (Verification Steps)
1. **数据请求**：登录系统，打开控制台，在浏览器 Network 面板检查 `/api/dashboard/stats` 是否正确返回了 `semester` 和 `week`，并检查随后是否触发了针对下一周的 `/api/guidelines/current` 请求。
2. **界面显示**：如果办公室主任提前发布了下周的工作，控制台中央应出现美观的“下周工作指南”卡片及表格。如果没有发布，则不显示该卡片。
3. **样式一致性**：切换深浅色模式，确认指南卡片的背景色和文字颜色过渡平滑且不刺眼。