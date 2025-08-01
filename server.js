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
    const startTime = Date.now();
    
    try {
        console.log('📡 开始获取书签数据...');
        
        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('⏰ 请求超时，已取消');
        }, 30000); // 30秒超时
        
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
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Notion API 错误 (${response.status}):`, errorText);
            
            // 根据HTTP状态码分类错误
            if (response.status === 401) {
                throw new Error('Notion API 密钥无效或已过期');
            } else if (response.status === 403) {
                throw new Error('没有访问 Notion 数据库的权限');
            } else if (response.status === 404) {
                throw new Error('Notion 数据库不存在或ID错误');
            } else if (response.status === 429) {
                throw new Error('Notion API 请求频率超限，请稍后重试');
            } else if (response.status >= 500) {
                throw new Error('Notion 服务器暂时不可用，请稍后重试');
            } else {
                throw new Error(`Notion API 错误: ${response.status} ${response.statusText}`);
            }
        }

        const data = await response.json();
        console.log(`✅ 成功获取书签数据 (${responseTime}ms, ${data.results?.length || 0} 条记录)`);
        
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
                favicon: getFaviconUrl(properties.URL?.url || properties.链接?.url || ''),
                createdTime: page.created_time,
                lastEditedTime: page.last_edited_time
            };
        });
        
        res.json({
            success: true,
            data: bookmarks,
            count: bookmarks.length,
            responseTime: responseTime
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`❌ 获取书签失败 (${responseTime}ms):`, error.message);
        
        // 根据错误类型返回不同的响应
        if (error.name === 'AbortError') {
            res.status(408).json({
                success: false,
                error: 'REQUEST_TIMEOUT',
                message: '请求超时，请检查网络连接或稍后重试',
                responseTime: responseTime
            });
        } else if (error.message.includes('fetch')) {
            res.status(503).json({
                success: false,
                error: 'NETWORK_ERROR',
                message: '网络连接失败，请检查网络设置',
                responseTime: responseTime
            });
        } else if (error.message.includes('Notion API 密钥')) {
            res.status(401).json({
                success: false,
                error: 'INVALID_TOKEN',
                message: 'Notion API 密钥无效，请检查配置',
                responseTime: responseTime
            });
        } else if (error.message.includes('权限')) {
            res.status(403).json({
                success: false,
                error: 'PERMISSION_DENIED',
                message: '没有访问权限，请检查数据库权限设置',
                responseTime: responseTime
            });
        } else if (error.message.includes('数据库不存在')) {
            res.status(404).json({
                success: false,
                error: 'DATABASE_NOT_FOUND',
                message: '数据库不存在或ID错误，请检查配置',
                responseTime: responseTime
            });
        } else if (error.message.includes('频率超限')) {
            res.status(429).json({
                success: false,
                error: 'RATE_LIMITED',
                message: '请求频率超限，请稍后重试',
                responseTime: responseTime
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'SERVER_ERROR',
                message: error.message || '服务器内部错误',
                responseTime: responseTime
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
        return `https://${domain}/favicon.ico`;
    } catch (error) {
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