# Vercel 部署指南

## 环境变量配置问题解决方案

在 Vercel 部署后无法读取环境变量配置文件的问题，是因为 `.env` 文件被 `.gitignore` 忽略，不会上传到 Vercel。

### 解决步骤

#### 1. 在 Vercel Dashboard 中配置环境变量

登录 [Vercel Dashboard](https://vercel.com/dashboard)，进入你的项目设置：

1. 点击项目名称进入项目详情
2. 点击 "Settings" 标签
3. 点击左侧菜单的 "Environment Variables"
4. 添加以下环境变量：

```
NOTION_TOKEN=你的Notion集成令牌
NOTION_DATABASE_ID=你的Notion数据库ID
PORT=3000
NODE_ENV=production
SITE_TITLE=NotionLinks
```

#### 2. 重新部署

配置完环境变量后，需要重新部署项目：

1. 在 Vercel Dashboard 中点击 "Deployments" 标签
2. 点击最新部署右侧的三个点菜单
3. 选择 "Redeploy"

或者推送新的代码到 GitHub 触发自动部署。

#### 3. 验证部署

部署完成后，访问你的网站：
- 检查 `/api/health` 端点是否正常
- 检查 `/api/config` 端点是否返回正确配置
- 检查 `/api/bookmarks` 端点是否能正常获取数据

### 重要说明

1. **安全性**：永远不要将 `.env` 文件提交到 Git 仓库
2. **环境变量作用域**：确保为 Production、Preview 和 Development 环境都配置了相应的环境变量
3. **Notion API 限制**：确保你的 Notion 集成有访问目标数据库的权限

### 常见问题

#### Q: 部署后显示 "错误: 请在 .env 文件中配置 NOTION_TOKEN 和 NOTION_DATABASE_ID"
A: 这说明环境变量没有正确配置，请检查 Vercel Dashboard 中的环境变量设置。

#### Q: API 调用超时
A: Vercel 免费版有 10 秒的函数执行时间限制，如果 Notion API 响应慢，可能会超时。已在 `vercel.json` 中设置了 30 秒的最大执行时间。

#### Q: 静态文件无法访问
A: 检查 `vercel.json` 中的路由配置是否正确。

### 本地开发

本地开发时仍然使用 `.env` 文件：

1. 复制 `.env.example` 为 `.env`
2. 填入你的 Notion API 配置
3. 运行 `npm run dev`

### 文件说明

- `vercel.json`: Vercel 部署配置文件
- `.env.example`: 环境变量模板文件
- `server.js`: 后端服务器，处理 API 请求和环境变量验证