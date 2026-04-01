# 快速部署指南 (Vercel + Neon)

## 🚀 5分钟部署步骤

### 第1步：创建Neon数据库（2分钟）

1. 访问 [Neon Console](https://console.neon.tech) 并登录
2. 点击 "Create a project"
3. 选择区域（推荐：Singapore - 新加坡 或 Tokyo - 东京）
4. 点击 "Create project" 等待数据库创建完成
5. 复制连接字符串（Connection String）
   ```
   postgresql://username:password@hostname/database_name?sslmode=require
   ```

### 第2步：导入到Vercel（1分钟）

1. 访问 [Vercel](https://vercel.com/new) 并登录
2. 点击 "Import Git Repository"
3. 选择 `NewsunLee007/weeklyplan` 仓库
4. 项目名称输入：`weekly-plan-system`（或自定义）
5. 点击 "Continue" → "Deploy"（先不要点，继续第3步）

### 第3步：配置环境变量（2分钟）

在Vercel部署页面，点击 "Environment Variables" 添加以下变量：

1. **DATABASE_URL**
   - 值：粘贴Neon连接字符串
   - 示例：`postgresql://username:password@hostname/database_name?sslmode=require`

2. **JWT_SECRET**
   - 值：生成一个随机密钥
   - 在本地终端运行：
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - 复制输出结果作为值

3. **FRONTEND_URL**
   - 值：留空（Vercel会自动填充）
   - 或者设置为 `https://weekly-plan-system.vercel.app`

4. **NEON_DATABASE_URL**
   - 值：与DATABASE_URL相同（复制粘贴即可）

### 第4步：部署（自动）

点击 "Deploy" 按钮，Vercel会自动：
1. 构建前端（Vite）
2. 构建后端（Node.js）
3. 配置路由
4. 初始化Neon数据库

等待约2-3分钟，部署完成！

## ✅ 验证部署

### 1. 访问前端
点击Vercel提供的域名（如：`https://weekly-plan-system.vercel.app`）

### 2. 登录测试
- 用户名：`admin`
- 密码：`admin123`

### 3. 测试功能
- 创建测试用户
- 创建测试部门
- 创建周计划
- 导出Word文档

## 📝 重要提示

### 首次登录后必须做：

1. **修改admin密码**
   - 进入"系统管理" → "用户管理"
   - 找到admin用户，点击"重置密码"

2. **完善系统配置**
   - 进入"系统管理" → "系统配置"
   - 修改学校名称、学期等信息

3. **创建部门和用户**
   - 根据实际需求创建部门
   - 为每个部门创建用户

## 🔧 常见问题

### Q1: 部署失败，提示数据库连接错误
**A:** 检查`DATABASE_URL`是否正确，确认Neon数据库状态为Active

### Q2: 前端可以访问，但API报错
**A:** 检查`FRONTEND_URL`是否正确设置为Vercel域名

### Q3: 登录时提示"用户名或密码错误"
**A:** 确认使用正确的默认账户：`admin` / `admin123`

### Q4: 导出Word文档失败
**A:** 这是正常的，首次部署可能需要等待数据库完全初始化

## 📚 详细文档

查看完整部署指南：[DEPLOYMENT.md](./DEPLOYMENT.md)

## 🎯 下一步

部署成功后，您可以：
1. 配置自定义域名（Vercel支持免费SSL）
2. 配置企业微信机器人（系统配置中设置）
3. 导入真实数据
4. 培训用户使用

## 📞 技术支持

如遇到问题，请检查：
1. Vercel部署日志
2. Neon数据库连接状态
3. 浏览器控制台错误信息

---

**祝部署顺利！** 🎉
