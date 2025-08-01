// 安全的后端代理服务器
// 使用 Node.js + Express 创建代理服务，保护 Notion API 密钥

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Notion API 配置（从环境变量读取，不暴露给前端）
const NOTION_CONFIG = {
    token: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DATABASE_ID,
    apiUrl: 'https://api.notion.com/v1'
};

// 验证环境变量
if (!NOTION_CONFIG.token || !NOTION_CONFIG.databaseId) {
    console.error('错误: 请在 .env 文件中配置 NOTION_TOKEN 和 NOTION_DATABASE_ID');
    process.exit(1);
}

// API 路由：获取网站配置
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        data: {
            siteTitle: process.env.SITE_TITLE || 'NotionLinks'
        }
    });
});

// API 路由：获取书签数据
app.get('/api/bookmarks', async (req, res) => {
    try {
        // 调用 Notion API 获取数据，增加超时配置// 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONFIG.databaseId}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOTION_CONFIG.token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                page_size: 100
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Notion API 错误详情:', errorText);
            throw new Error(`Notion API 错误: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        // 处理数据格式
        const bookmarks = data.results.map(page => {
            const properties = page.properties;
            return {
                id: page.id,
                title: properties.Name?.title?.[0]?.plain_text || properties.标题?.title?.[0]?.plain_text || '无标题',
                url: properties.URL?.url || properties.链接?.url || '#',
                description: properties.Description?.rich_text?.[0]?.plain_text || properties.描述?.rich_text?.[0]?.plain_text || '',
                category: properties.Category?.select?.name || properties.分类?.select?.name || '未分类',
                tags: properties.Tags?.multi_select?.map(tag => tag.name) || properties.标签?.multi_select?.map(tag => tag.name) || [],
                favicon: `https://www.google.com/s2/favicons?domain=${new URL(properties.URL?.url || properties.链接?.url || 'https://example.com').hostname}&sz=32`,
                createdTime: page.created_time,
                lastEditedTime: page.last_edited_time
            };
        });
        
        res.json({
            success: true,
            data: bookmarks,
            count: bookmarks.length
        });
        
    } catch (error) {
            console.error('获取书签失败:', error);
            
            if (error.name === 'AbortError') {
                res.status(408).json({
                    success: false,
                    error: '请求超时',
                    message: '连接Notion API超时，请检查网络连接或增加超时时间'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: '获取书签数据失败',
                    message: error.message || '未知错误',
                    details: {
                        type: error.type,
                        code: error.code,
                        errno: error.errno
                    }
                });
            }
        }
});



// API 路由：健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 解析 Notion 数据
function parseNotionData(results) {
    return results.map(page => parseNotionPage(page));
}

function parseNotionPage(page) {
    const properties = page.properties;
    
    return {
        id: page.id,
        title: getPropertyValue(properties.标题 || properties.Title || properties.title, 'title'),
        url: getPropertyValue(properties.链接 || properties.URL || properties.url, 'url'),
        description: getPropertyValue(properties.描述 || properties.Description || properties.description, 'rich_text'),
        category: getPropertyValue(properties.分类 || properties.Category || properties.category, 'select'),
        tags: getPropertyValue(properties.标签 || properties.Tags || properties.tags, 'multi_select'),
        favicon: getFaviconUrl(getPropertyValue(properties.链接 || properties.URL || properties.url, 'url')),
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time
    };
}

// 获取属性值
function getPropertyValue(property, type) {
    if (!property) return '';
    
    switch (type) {
        case 'title':
            return property.title?.[0]?.plain_text || '';
        case 'rich_text':
            return property.rich_text?.[0]?.plain_text || '';
        case 'url':
            return property.url || '';
        case 'select':
            return property.select?.name || '';
        case 'multi_select':
            return property.multi_select?.map(tag => tag.name) || [];
        default:
            return '';
    }
}

// 获取网站图标 URL
function getFaviconUrl(url) {
    if (!url) return '';
    try {
        const domain = new URL(url).hostname;
        // 只使用Google和原站点的API
        const apis = [
            `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            `https://${domain}/favicon.ico`
        ];
        return apis[0]; // 默认使用第一个API
    } catch {
        return '';
    }
}

// 静态文件服务
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
    });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在',
        message: `路径 ${req.path} 未找到`
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器启动成功！`);
    console.log(`📱 本地访问: http://localhost:${PORT}`);
    console.log(`🔒 API 密钥已安全保护在服务器端`);
    console.log(`📊 API 端点: http://localhost:${PORT}/api/bookmarks`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('收到 SIGINT 信号，正在关闭服务器...');
    process.exit(0);
});

module.exports = app;