# 导出 Word 负责人序号同步及代码提交流程计划

## 1. 现状分析
当前系统中，导出 Word 文档（无论是单一部门计划导出还是全校周汇总导出）的业务逻辑分别位于 `api/_lib/routes/export.js` 和 `backend/src/routes/export.js` 中。在构建表格内容时：
- “工作内容”列会自动添加动态序号（例如 `1. `, `2. ` 等），并且文本默认左对齐。
- “负责人”列目前去除了自带的序号，仅展示纯文本，并且文本为居中对齐（`AlignmentType.CENTER`）。

## 2. 拟议更改 (Proposed Changes)

为了使“负责人”列和“工作内容”列的序号及排版完全匹配，计划进行以下代码调整：

### 2.1 修改 `backend/src/routes/export.js` 和 `api/_lib/routes/export.js`
- **函数 `buildDocxFromPlan` (单一计划导出)**
  - 定位到构建“负责人”列 `TableCell` 的位置（约第 190 行附近）。
  - 将原来的 `new TextRun({ text: item.responsible || '', ... })` 替换为追加序号的格式，并在同一段落中移除居中对齐或显式声明为左对齐。
  - 预期修改为：`new TextRun({ text: \`\${dailyIndex}. \${item.responsible || '——'}\`, ... })`，并将该段落对齐方式改为 `AlignmentType.LEFT`。

- **全校汇总导出逻辑（例如 `buildWeeklySummary` 等相关函数）**
  - 定位到 `responsibleParagraphs` 的构建位置。
  - 将原来的文本生成逻辑修改为包含序号：`new TextRun({ text: \`\${index + 1}. \${item.responsible || '——'}\`, ... })`。
  - 同步将对齐方式 `AlignmentType.CENTER` 改为 `AlignmentType.LEFT`。

### 2.2 Git 提交与推送到 GitHub
- 在完成上述所有 Word 导出逻辑的修复后，使用命令 `git add .` 将本次修复内容以及刚刚新增的“下周工作指导”工作台代码全部暂存。
- 使用 `git commit -m "fix: Word导出负责人列增加序号匹配; feat: 工作台新增下周预发工作概览板块"` 提交代码。
- 使用 `git push` 将所有更改推送到远程 GitHub 仓库。

## 3. 假设与决定
- **对齐方式调整**：由于增加了数字序号，如果继续保持居中对齐会导致各行序号无法左侧对齐而显得参差不齐。因此，决定将其同步调整为左对齐（`AlignmentType.LEFT`），使其在视觉上与前面的“工作内容”列保持完全一致。

## 4. 验证步骤
1. 修改完成后，检查对应代码逻辑是否完全闭环。
2. 运行 Git 命令验证工作区状态，确保所有涉及的新功能及修复都能被成功 Commit 并 Push 到 GitHub。