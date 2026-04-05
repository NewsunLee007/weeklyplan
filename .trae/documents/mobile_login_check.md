# 分析用户手机号登录支持

## 1. 现状分析 (Current State Analysis)
根据用户要求，“确认下系统是否支持用手机号码登录？如果不能，请处理起来。”

通过对 `api/_lib/routes/auth.js` 和 `backend/src/routes/auth.js` 文件的分析：
```javascript
// 特殊处理：admin账号只能用用户名登录
if (username === 'admin') {
  user = await queryOne(`SELECT ... WHERE u.username = ?`, [username]);
} else {
  // 其他用户可以用用户名、真实姓名或电话号码登录
  user = await queryOne(
    `SELECT ... WHERE (u.username = ? OR u.real_name = ? OR u.phone = ?) AND u.is_deleted = false`,
    [username, username, username]
  );
}
```

结论是：**系统后端底层已经原生支持使用手机号码和真实姓名进行登录！**
当用户在输入框输入手机号时，SQL 语句中的 `OR u.phone = ?` 会精准匹配到对应的用户记录。

目前唯一存在的小瑕疵是：前端登录页面 (`Login.vue`) 的输入框占位符写的是 `用户名`，这可能让用户误以为只能用账号登录。

## 2. 拟议修改 (Proposed Changes)

由于后端逻辑完全正确，本次计划仅需对前端进行极小的提示优化。

**涉及文件：**
- `frontend/src/views/Login.vue`

**修改内容：**
1. 将登录输入框的 `placeholder` 从 `"用户名"` 修改为 `"用户名 / 手机号 / 姓名"`。
2. 将对应的表单验证错误提示 `message` 从 `"请输入用户名"` 修改为 `"请输入账号/手机号/姓名"`。

这能让教职工在使用时非常明确地知道，自己可以直接用导入表格里的真实姓名或手机号码进行登录。

## 3. 验证步骤 (Verification Steps)
1. 编译代码 `npm run build` 并 push。
2. 在前端登录界面查看占位符是否已更新为 `用户名 / 手机号 / 姓名`。
3. 实际输入一位已导入用户的手机号和默认密码（123456），测试能否成功登录。