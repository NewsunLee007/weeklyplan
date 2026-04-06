# 导出数据为空及列表自动加载修复计划

## 1. 现状分析 (Current State Analysis)
根据用户的反馈和代码审查，发现当前系统存在以下问题：
1. **导出的 Word 文档没有显示出计划内容**：
   - 之前在处理日期字符串兼容问题时，修改了 `export.js` 中的逻辑：
     `const dateKey = (item.plan_date instanceof Date ? item.plan_date.toISOString() : String(item.plan_date)).split('T')[0];`
   - 然而，当 `item.plan_date` 已经是标准的格式（如 `2025-04-10`，并不带 `T` 字符）且类型是 String 时，上述逻辑中 `itemsByDate[dateKey]` 的 `dateKey` 可能因为没有带 `T`，或其它原因，匹配不到下面的 `currentDate.toISOString().split('T')[0]`。
   - 更严重的问题是：在拼接表格时，代码中使用的是 `const dateKey = currentDate.toISOString().split('T')[0];`。由于时区问题，`toISOString()` 会返回 UTC 时间。如果服务器的时区是 UTC+8，在当天早晨生成的 `toISOString()` 实际上是前一天晚上的日期（例如 `2026-04-10T00:00:00.000+08:00` 变成 `2026-04-09T16:00:00.000Z`）。这会导致用日期作为 Key 匹配不到当天的内容，从而使导出的 Word 全部显示“无任务”。
2. **“已发布计划”等列表页面未自动加载当前周次内容**：
   - 用户期望在首次进入“已发布计划”等页面时，无需点击“查询”即可自动显示当周的计划内容。
   - **原因**：之前虽然修改了 `PlanList.vue` 和 `ReviewConsolidated.vue`，但在部分组件（如 `PublishedPlan.vue`）的生命周期 `onMounted` 中，`loadData()` 的调用可能没有充分等待 `filter.week_number` 被赋值完成。

## 2. 拟议修改 (Proposed Changes)

### 2.1 修复导出 Word 匹配不到内容的 Bug
- **文件**：`api/_lib/routes/export.js` 和 `backend/src/routes/export.js`
- **修改**：
  - 彻底抛弃使用 `.toISOString().split('T')[0]` 来获取日期字符串的危险做法。
  - 引入一个安全提取当地日期字符串的辅助函数（格式化为 `YYYY-MM-DD`），例如：
    ```javascript
    function getLocalDateString(d) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    ```
  - 将提取 `dateKey` 的逻辑统一改为使用这个函数：
    `const dateKey = getLocalDateString(new Date(item.plan_date));`
  - 在生成数据行的 `for` 循环中，同样使用这个函数：
    `const dateKey = getLocalDateString(currentDate);`
  - 这样可以保证存取字典的 Key 始终基于本地时区，绝对不会出现错位。

### 2.2 确保列表页面首次进入自动加载
- **文件**：`frontend/src/views/plan/PublishedPlan.vue` 等列表组件
- **修改**：
  - 确保在 `onMounted` 中：
    ```javascript
    onMounted(async () => {
      await loadConfig()
      if (filter.week_number) {
        await loadData()
      }
    })
    ```
  - `PlanList.vue` 中也执行同样的严谨等待逻辑。

## 3. 验证步骤 (Verification Steps)
1. 刷新进入“已发布计划”和“审核中心”，验证是否无需手动点击“查询”即可自动展示当周的计划列表。
2. 在任意有数据的周次点击“导出 Word”，打开下载的文件，验证表格中是否准确填入了具体的工作内容和负责人（不再全是“无任务”）。