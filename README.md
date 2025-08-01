# NotionLinks

一个基于 Notion API 的个人书签管理系统，采用 Notion 风格的简洁设计，支持分类管理、标签过滤和搜索功能。

## 功能特性

- 🎨 **Notion 风格设计** - 简洁优雅的界面设计
- 📱 **响应式布局** - 支持桌面端和移动端
- 🔍 **智能搜索** - 支持标题、描述、URL 和标签搜索
- 🏷️ **分类管理** - 按工作、学习、娱乐、工具等分类
- 🔖 **标签系统** - 灵活的多标签管理
- 🔄 **实时同步** - 与 Notion 数据库实时同步
- 📋 **详情查看** - 点击卡片查看详细信息
- ⬆️ **返回顶部** - 便捷的页面导航

## 项目结构

```
NotionLinks/
├── .env                    # 环境配置文件（需要创建）
├── .env.example           # 环境配置模板
├── .gitignore             # Git 忽略文件
├── package.json           # 项目依赖配置
├── server.js              # Node.js 后端服务器
├── public/                # 前端静态文件
│   ├── index.html         # 主页面
│   ├── styles.css         # 样式文件
│   ├── script.js          # 兼容性脚本
│   └── js/                # JavaScript 模块
│       ├── api.js         # API 服务模块
│       ├── app.js         # 主应用模块
│       ├── data.js        # 数据管理模块
│       ├── events.js      # 事件处理模块
│       ├── lazy-loader.js # 懒加载模块
│       └── ui.js          # UI 管理模块
└── README.md              # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
# 克隆项目到本地
git clone https://github.com/ipaler/NotionLinks.git
cd NotionLinks

# 安装 Node.js 依赖
npm install

# 创建环境配置文件
npm run setup
```

### 2. 配置 Notion 集成

#### 创建 Notion 集成
1. 访问 [Notion Integrations](https://www.notion.so/my-integrations)
2. 点击 "+ New integration" 创建新集成
3. 填写集成名称（如："NotionLinks"）
4. 选择关联的工作区
5. 复制生成的 "Internal Integration Token"

#### 复制模板数据库
1. 访问 Notion 模板：[NotionLinks](https://kpify.notion.site/NotionLinks-242619361f5281e28ed2e33668cdbf17)
2. 点击右上角的 "复制" 按钮，将模板复制到你的工作区
3. 将复制后的数据库与你的集成共享
4. 复制数据库页面的 URL，提取其中的 32 位 ID

#### 配置环境变量
1. 打开 `.env` 文件（由 `npm run setup` 创建）
2. 将 Integration Token 填入 `NOTION_TOKEN`
3. 将数据库 ID 填入 `NOTION_DATABASE_ID`

```env
NOTION_TOKEN=secret_your_integration_token_here
NOTION_DATABASE_ID=your_database_id_here
PORT=3000
```

### 3. 运行项目

```bash
# 开发模式（自动重启）
npm run dev

# 或生产模式
npm start
```

然后在浏览器中访问 `http://localhost:3000`

## 使用说明

### 基本操作

1. **浏览书签** - 在主界面查看所有书签卡片
2. **分类筛选** - 点击左侧菜单的分类进行筛选
3. **标签筛选** - 点击左侧菜单的标签进行筛选（支持多选）
4. **搜索功能** - 在右上角搜索框输入关键词
5. **查看详情** - 点击书签卡片查看详细信息
6. **访问网站** - 点击书签卡片中的链接直接访问
7. **同步数据** - 点击右上角的同步按钮更新数据

### 数据管理

- 在 Notion 数据库中添加、编辑或删除书签
- 点击系统中的 "同步数据" 按钮获取最新数据
- 系统会自动解析 Notion 数据并显示

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+ 模块化)
- **后端**: Node.js, Express.js
- **API**: Notion API v1 (通过后端代理)
- **依赖**: cors, dotenv, node-fetch
- **开发工具**: nodemon (开发模式)
- **图标**: Font Awesome 6
- **设计**: Notion 风格的简洁设计
- **安全**: 环境变量保护 API 密钥，后端代理隐藏敏感信息

## 浏览器兼容性

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 安全特性

✅ **API 密钥保护**: Integration Token 存储在服务器端环境变量中，不会暴露给前端

✅ **后端代理**: 前端通过安全的后端 API 访问 Notion 数据，避免直接暴露 API 密钥

✅ **环境变量**: 使用 `.env` 文件管理敏感配置，并已添加到 `.gitignore`

✅ **CORS 解决**: 后端服务器处理跨域问题，前端无需担心 CORS 限制

## 部署指南

### Vercel 部署

本项目已配置支持 Vercel 一键部署：

1. **Fork 项目到你的 GitHub**
2. **在 Vercel 中导入项目**
3. **配置环境变量**（重要！）：
   - `NOTION_TOKEN`: 你的 Notion 集成令牌
   - `NOTION_DATABASE_ID`: 你的 Notion 数据库 ID
   - `NODE_ENV`: production
   - `SITE_TITLE`: NotionLinks（可选）

4. **部署完成后访问你的网站**

> ⚠️ **重要提醒**: 由于 `.env` 文件被 `.gitignore` 忽略，部署到 Vercel 后必须在 Vercel Dashboard 中手动配置环境变量，否则会出现"无法读取环境变量配置文件"的错误。

详细的 Vercel 部署指南请参考：[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)

### 其他平台部署

- **Heroku**: 支持，需要配置环境变量
- **Railway**: 支持，需要配置环境变量
- **Render**: 支持，需要配置环境变量

## 注意事项

1. **环境配置**: 确保 `.env` 文件已正确配置且不要提交到版本控制

2. **API 限制**: Notion API 有请求频率限制，后端已实现适当的错误处理

3. **生产部署**: 生产环境中建议使用环境变量或密钥管理服务，而不是 `.env` 文件

4. **网络安全**: 建议在生产环境中使用 HTTPS 和适当的安全头

5. **Vercel 部署**: 部署后必须在 Vercel Dashboard 中配置环境变量

## 故障排除

### 常见问题

1. **Vercel 部署后无法读取环境变量**
   - 检查 Vercel Dashboard 中是否已配置所有必需的环境变量
   - 确认环境变量名称拼写正确（区分大小写）
   - 重新部署项目以应用新的环境变量配置
   - 访问 `/api/health` 端点检查服务器状态

2. **数据加载失败**
   - 检查 `.env` 文件中的 Notion API 配置是否正确（本地开发）
   - 检查 Vercel Dashboard 中的环境变量配置（生产环境）
   - 确认数据库已与集成共享
   - 检查服务器是否正常运行 (`npm start`)
   - 查看服务器控制台输出的错误信息

3. **服务器启动失败**
   - 确认已安装 Node.js 依赖 (`npm install`)
   - 检查端口 3000 是否被占用
   - 验证 `.env` 文件是否存在且配置正确

4. **样式显示异常**
   - 确认静态文件服务正常
   - 检查浏览器是否支持 CSS Grid
   - 清除浏览器缓存

5. **功能不工作**
   - 检查浏览器控制台是否有 JavaScript 错误
   - 确认所有模块文件加载正常
   - 验证 API 接口是否响应正常

## 许可证

MIT License - 详见 LICENSE 文件

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

如果你觉得这个项目有用，请给它一个 ⭐️！