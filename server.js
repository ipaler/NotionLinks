// 安全的后端代理服务器
// 使用 Node.js + Express 创建代理服务，保护 Notion API 密钥

const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件配置
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
}));

// 请求大小限制
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 静态文件服务（带缓存控制）
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true
}));

// 请求日志中间件
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

// Notion API 配置（从环境变量读取，不暴露给前端）
const NOTION_CONFIG = {
    token: process.env.NOTION_TOKEN,
    databaseId: process.env.NOTION_DATABASE_ID,
    apiUrl: 'https://api.notion.com/v1'
};

// 请求频率限制存储
const rateLimitStore = new Map();
const RATE_LIMIT = {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 30 // 每分钟最多30次请求
};

// 数据缓存存储
const dataCache = new Map();
const CACHE_CONFIG = {
    duration: 5 * 60 * 1000, // 5分钟缓存
    maxSize: 1000, // 最大缓存条目数
    cleanupInterval: 10 * 60 * 1000 // 10分钟清理一次
};

// 增量同步存储
const syncState = {
    lastSyncTime: null,
    lastCursor: null,
    totalPages: 0,
    isSyncing: false
};

// 请求频率限制检查函数
function isRateLimited(clientIP) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    
    if (!rateLimitStore.has(clientIP)) {
        rateLimitStore.set(clientIP, []);
    }
    
    const requests = rateLimitStore.get(clientIP);
    
    // 清理过期的请求记录
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    rateLimitStore.set(clientIP, validRequests);
    
    // 检查是否超过限制
    if (validRequests.length >= RATE_LIMIT.maxRequests) {
        return true;
    }
    
    // 记录当前请求
    validRequests.push(now);
    return false;
}

// 定期清理过期的频率限制记录
setInterval(() => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.windowMs;
    
    for (const [clientIP, requests] of rateLimitStore.entries()) {
        const validRequests = requests.filter(timestamp => timestamp > windowStart);
        if (validRequests.length === 0) {
            rateLimitStore.delete(clientIP);
        } else {
            rateLimitStore.set(clientIP, validRequests);
        }
    }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 缓存管理函数
function getFromCache(key) {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.duration) {
        return cached.data;
    }
    dataCache.delete(key);
    return null;
}

function setCache(key, data) {
    // 清理过期缓存
    if (dataCache.size >= CACHE_CONFIG.maxSize) {
        const oldestKey = dataCache.keys().next().value;
        dataCache.delete(oldestKey);
    }
    
    dataCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

function clearCache() {
    dataCache.clear();
    console.log('🗑️ 缓存已清理');
}

// 定期清理缓存
setInterval(() => {
    const now = Date.now();
    for (const [key, cached] of dataCache.entries()) {
        if (now - cached.timestamp > CACHE_CONFIG.duration) {
            dataCache.delete(key);
        }
    }
}, CACHE_CONFIG.cleanupInterval);

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

// API 路由：获取书签数据（支持分页、缓存和增量同步）
app.get('/api/bookmarks', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // 解析查询参数
        const { 
            page = 1, 
            limit = 50, 
            force_refresh = false,
            incremental = false 
        } = req.query;
        
        const pageNum = parseInt(page);
        const pageSize = Math.min(parseInt(limit), 100); // 最大100条
        const isForceRefresh = force_refresh === 'true';
        const isIncremental = incremental === 'true';
        
        console.log(`📡 开始获取书签数据 (页码: ${pageNum}, 每页: ${pageSize}, 强制刷新: ${isForceRefresh}, 增量同步: ${isIncremental})`);
        
        // 请求频率限制检查
        const clientIP = req.ip || req.connection.remoteAddress;
        if (isRateLimited(clientIP)) {
            return res.status(429).json({
                success: false,
                error: 'RATE_LIMITED',
                message: '请求过于频繁，请稍后重试',
                responseTime: Date.now() - startTime
            });
        }
        
        // 检查缓存（非强制刷新时）
        if (!isForceRefresh) {
            const cacheKey = `bookmarks_${pageNum}_${pageSize}`;
            const cachedData = getFromCache(cacheKey);
            if (cachedData) {
                console.log(`📦 返回缓存数据 (页码: ${pageNum})`);
                return res.json({
                    success: true,
                    data: cachedData.bookmarks,
                    count: cachedData.count,
                    totalPages: cachedData.totalPages,
                    currentPage: pageNum,
                    hasMore: cachedData.hasMore,
                    fromCache: true,
                    responseTime: Date.now() - startTime
                });
            }
        }
        
        // 增量同步检查
        if (isIncremental && syncState.lastSyncTime) {
            const timeSinceLastSync = Date.now() - syncState.lastSyncTime;
            if (timeSinceLastSync < 60000) { // 1分钟内不重复同步
                console.log('⏭️ 跳过增量同步，距离上次同步时间过短');
                return res.status(304).json({
                    success: true,
                    message: '数据已是最新，无需同步',
                    lastSyncTime: syncState.lastSyncTime,
                    responseTime: Date.now() - startTime
                });
            }
        }
        
        // 防止并发同步
        if (syncState.isSyncing) {
            console.log('⏳ 同步进行中，请稍后重试');
            return res.status(409).json({
                success: false,
                error: 'SYNC_IN_PROGRESS',
                message: '数据同步进行中，请稍后重试',
                responseTime: Date.now() - startTime
            });
        }
        
        syncState.isSyncing = true;
        
        try {
            // 获取所有数据（分页处理）
            const allBookmarks = await fetchAllBookmarks();
            
            // 计算分页
            const totalCount = allBookmarks.length;
            const totalPages = Math.ceil(totalCount / pageSize);
            const startIndex = (pageNum - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const pageBookmarks = allBookmarks.slice(startIndex, endIndex);
            
            // 更新同步状态
            syncState.lastSyncTime = Date.now();
            syncState.totalPages = totalPages;
            syncState.isSyncing = false;
            
            const responseTime = Date.now() - startTime;
            console.log(`✅ 成功获取书签数据 (${responseTime}ms, 总计: ${totalCount} 条, 当前页: ${pageBookmarks.length} 条)`);
            
            // 缓存结果
            const cacheKey = `bookmarks_${pageNum}_${pageSize}`;
            setCache(cacheKey, {
                bookmarks: pageBookmarks,
                count: pageBookmarks.length,
                totalPages: totalPages,
                hasMore: pageNum < totalPages
            });
            
            res.json({
                success: true,
                data: pageBookmarks,
                count: pageBookmarks.length,
                totalCount: totalCount,
                totalPages: totalPages,
                currentPage: pageNum,
                hasMore: pageNum < totalPages,
                lastSyncTime: syncState.lastSyncTime,
                responseTime: responseTime
            });
            
        } catch (error) {
            syncState.isSyncing = false;
            throw error;
        }
        
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
                message: 'Notion 数据库不存在，请检查数据库ID',
                responseTime: responseTime
            });
        } else if (error.message.includes('频率超限')) {
            res.status(429).json({
                success: false,
                error: 'RATE_LIMITED',
                message: 'Notion API 请求频率超限，请稍后重试',
                responseTime: responseTime
            });
        } else if (error.message.includes('服务器暂时不可用')) {
            res.status(503).json({
                success: false,
                error: 'SERVICE_UNAVAILABLE',
                message: 'Notion 服务器暂时不可用，请稍后重试',
                responseTime: responseTime
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'UNKNOWN_ERROR',
                message: '获取书签数据时发生未知错误',
                responseTime: responseTime
            });
        }
    }
});

// 获取所有书签数据（分页处理）
async function fetchAllBookmarks() {
    const allBookmarks = [];
    let hasMore = true;
    let startCursor = null;
    let pageCount = 0;
    const maxPages = 50; // 最大获取50页，防止无限循环
    
    while (hasMore && pageCount < maxPages) {
        pageCount++;
        console.log(`📄 获取第 ${pageCount} 页数据...`);
        
        // 创建AbortController用于超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log('⏰ 请求超时，已取消');
        }, 30000); // 30秒超时
        
        try {
            const requestBody = {
                page_size: 100
            };
            
            if (startCursor) {
                requestBody.start_cursor = startCursor;
            }
            
            const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONFIG.databaseId}/query`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${NOTION_CONFIG.token}`,
                    'Content-Type': 'application/json',
                    'Notion-Version': '2022-06-28'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
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
            
            // 处理数据格式
            const pageBookmarks = data.results.map(page => {
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
            
            allBookmarks.push(...pageBookmarks);
            
            // 检查是否还有更多数据
            hasMore = data.has_more;
            startCursor = data.next_cursor;
            
            // 添加延迟避免API限制
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    console.log(`📊 总共获取 ${allBookmarks.length} 条书签数据 (${pageCount} 页)`);
    return allBookmarks;
}



// API 路由：健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString(),
        cacheSize: dataCache.size,
        lastSyncTime: syncState.lastSyncTime
    });
});

// API 路由：清理缓存
app.post('/api/cache/clear', (req, res) => {
    try {
        clearCache();
        res.json({
            success: true,
            message: '缓存已清理',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'CACHE_CLEAR_ERROR',
            message: '清理缓存失败',
            timestamp: new Date().toISOString()
        });
    }
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

// 优雅启动服务器
const server = app.listen(PORT, () => {
    console.log(`🚀 服务器启动成功！`);
    console.log(`📱 本地访问: http://localhost:${PORT}`);
    console.log(`🔒 API 密钥已安全保护在服务器端`);
    console.log(`📊 API 端点: http://localhost:${PORT}/api/bookmarks`);
    console.log(`⚡ 请求频率限制: ${RATE_LIMIT.maxRequests}次/${RATE_LIMIT.windowMs/1000}秒`);
});

// 优雅关闭处理
process.on('SIGTERM', () => {
    console.log('🛑 收到 SIGTERM 信号，正在优雅关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 收到 SIGINT 信号，正在优雅关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
    server.close(() => {
        console.log('🛑 服务器因异常而关闭');
        process.exit(1);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的 Promise 拒绝:', reason);
    server.close(() => {
        console.log('🛑 服务器因未处理的 Promise 拒绝而关闭');
        process.exit(1);
    });
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