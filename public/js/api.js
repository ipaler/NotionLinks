// API 模块 - 处理所有API调用
class ApiService {
    constructor() {
        this.config = {
            baseUrl: '/api',
            endpoints: {
                bookmarks: '/api/bookmarks',
                health: '/api/health',
                config: '/api/config'
            }
        };
    }

    // 获取网站配置
    async getSiteConfig() {
        try {
            const response = await fetch(this.config.endpoints.config);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.success ? data.data : null;
        } catch (error) {
            console.error('获取网站配置失败:', error);
            return null;
        }
    }

    // 获取书签数据
    async getBookmarks() {
        try {
            const response = await fetch(this.config.endpoints.bookmarks);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error('获取书签数据失败:', error);
            throw error;
        }
    }

    // 健康检查
    async healthCheck() {
        try {
            const response = await fetch(this.config.endpoints.health);
            return response.ok;
        } catch (error) {
            console.error('健康检查失败:', error);
            return false;
        }
    }
}

// 导出API服务实例
window.ApiService = ApiService;