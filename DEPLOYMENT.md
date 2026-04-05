# Vercel + Neon 部署指南

## 前置条件

1. **GitHub仓库**：已经创建 `https://github.com/NewsunLee007/weeklyplan.git`
2. **Neon数据库**：已创建PostgreSQL数据库（用于生产环境）
3. **Vercel账号**：已注册并连接GitHub

## 部署步骤

### 1. 准备代码并推送到GitHub

```bash
cd "/Users/newsunlee/Desktop/AI for learning/weekly plan/school-plan-system"

# 添加远程仓库
git remote add origin https://github.com/NewsunLee007/weeklyplan.git

# 推送到GitHub
git push -u origin main
```

### 2. 配置Neon数据库

1. 登录 [Neon Console](https://console.neon.tech)
2. 创建新的PostgreSQL数据库项目
3. 复制连接字符串（Connection String），格式如：
   ```
   postgresql://username:password@hostname/database_name?sslmode=require
   ```

### 3. 在Vercel中导入项目

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New Project" → "Import Git Repository"
3. 选择 `NewsunLee007/weeklyplan` 仓库
4. Vercel会自动检测到`vercel.json`配置

### 4. 配置环境变量

在Vercel项目设置中添加以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|----------|
| `DATABASE_URL` | Neon数据库连接字符串 | `postgresql://username:password@hostname/database_name?sslmode=require` |
| `JWT_SECRET` | JWT加密密钥 | 生成一个随机字符串（至少32位） |
| `FRONTEND_URL` | 前端URL（生产环境） | Vercel部署后的域名 |
| `NEON_DATABASE_URL` | Neon数据库连接（备用） | 与DATABASE_URL相同 |

**获取JWT_SECRET的方法：**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. 部署配置说明

#### Vercel配置（vercel.json）

```json
{
  "version": 2,
  "builds": [
    {
      "src": "backend/package.json",
      "use": "@vercel/node"
    },
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/src/app.js"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/index.html"
    }
  ]
}
```

**说明：**
- `/api/*` 路由转发到后端Express服务
- 其他路由转发到前端静态文件（Vue单页应用）

### 6. 数据库初始化

首次部署后，数据库会自动创建以下表：
- `sys_user` - 用户表
- `sys_department` - 部门表
- `sys_config` - 系统配置表
- `biz_week_plan` - 周计划表
- `biz_plan_item` - 计划条目表
- `biz_feedback` - 反馈表

并自动插入：
- 8个默认部门
- 6个系统配置
- 1个默认管理员账户

### 7. 默认管理员账户

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 系统管理员 |

**⚠️ 重要：首次登录后请立即修改密码！**

### 8. 验证部署

部署成功后，访问Vercel提供的域名：
- 前端：`https://your-project.vercel.app`
- 后端API：`https://your-project.vercel.app/api`

## 本地开发

### 使用SQLite（默认）

```bash
cd backend
npm install
node src/app.js  # 后端启动在 3001

cd ../frontend
npm install
npm run dev     # 前端启动在 5173
```

### 使用Neon PostgreSQL（模拟生产环境）

```bash
# 在backend目录创建.env文件
cd backend
cp .env.example .env

# 编辑.env，设置DATABASE_URL为Neon连接字符串
DATABASE_URL=postgresql://username:password@hostname/database_name?sslmode=require
JWT_SECRET=your-secret-key

# 启动后端（会自动使用PostgreSQL）
node src/app.js
```

## 技术架构

```
┌─────────────────┐
│   Vercel      │
└────────┬────────┘
         │
         ├─ /api/* ──────→ Express API (Node.js)
         │                       │
         │                       ├─ Neon PostgreSQL
         │                       └─ 文件导出/处理
         │
         └─ /* ──────────→ Vue 3 Frontend
                                 (Vite构建的静态文件)
```

## 故障排查

### 问题1：数据库连接失败
- 检查Neon数据库连接字符串是否正确
- 确认Vercel环境变量`DATABASE_URL`已设置
- 查看Vercel部署日志

### 问题2：API请求跨域错误
- 检查`FRONTEND_URL`环境变量是否设置为正确的Vercel域名
- 确认后端CORS配置包含前端URL

### 问题3：前端静态文件404
- 确认Vercel构建成功（`npm run build`执行成功）
- 检查`vercel.json`中的路由配置

## 生产环境检查清单

- [ ] Neon数据库已创建并获取连接字符串
- [ ] GitHub仓库已创建并推送代码
- [ ] Vercel项目已导入
- [ ] 环境变量已全部配置（DATABASE_URL, JWT_SECRET, FRONTEND_URL）
- [ ] 部署成功，前端可访问
- [ ] API接口可正常调用
- [ ] 默认管理员可登录
- [ ] 修改默认管理员密码
