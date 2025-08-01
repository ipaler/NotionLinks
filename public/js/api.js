// API 模块 - 处理所有API调用
class ApiService {
    constructor() {
        this.config = {
            baseUrl: '/api',
            endpoints: {
                bookmarks: '/api/bookmarks',
                health: '/api/health',
                config: '/api/config'
            },
            retry: {
                maxRetries: 3,
                retryDelay: 1000,
                backoffMultiplier: 2
            },
            timeout: 30000 // 30秒超时
        };
        
        this.networkStatus = {
            isOnline: navigator.onLine,
            lastCheck: Date.now()
        };
        
        // 监听网络状态变化
        this.setupNetworkListeners();
    }

    // 设置网络状态监听
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.networkStatus.isOnline = true;
            this.networkStatus.lastCheck = Date.now();
            console.log('🌐 网络连接已恢复');
        });

        window.addEventListener('offline', () => {
            this.networkStatus.isOnline = false;
            this.networkStatus.lastCheck = Date.now();
            console.log('❌ 网络连接已断开');
        });
    }

    // 检查网络状态
    checkNetworkStatus() {
        return {
            isOnline: this.networkStatus.isOnline,
            lastCheck: this.networkStatus.lastCheck,
            timeSinceLastCheck: Date.now() - this.networkStatus.lastCheck
        };
    }

    // 带重试的fetch请求
    async fetchWithRetry(url, options = {}, retryCount = 0) {
        try {
            // 检查网络状态
            if (!this.networkStatus.isOnline) {
                throw new Error('网络连接已断开，请检查网络设置');
            }

            // 创建AbortController用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;

        } catch (error) {
            // 分类错误类型
            const errorInfo = this.classifyError(error);
            
            // 如果是可重试的错误且未超过最大重试次数
            if (errorInfo.retryable && retryCount < this.config.retry.maxRetries) {
                const delay = this.config.retry.retryDelay * Math.pow(this.config.retry.backoffMultiplier, retryCount);
                
                console.log(`🔄 第${retryCount + 1}次重试 (${delay}ms后): ${errorInfo.message}`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.fetchWithRetry(url, options, retryCount + 1);
            }

            // 抛出分类后的错误
            throw errorInfo;
        }
    }

    // 错误分类
    classifyError(error) {
        const errorInfo = {
            type: 'unknown',
            message: error.message || '未知错误',
            retryable: false,
            userMessage: '网络连接异常，请稍后重试'
        };

        if (error.name === 'AbortError') {
            errorInfo.type = 'timeout';
            errorInfo.message = '请求超时';
            errorInfo.retryable = true;
            errorInfo.userMessage = '请求超时，正在重试...';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorInfo.type = 'network';
            errorInfo.message = '网络连接失败';
            errorInfo.retryable = true;
            errorInfo.userMessage = '网络连接失败，正在重试...';
        } else if (error.message.includes('HTTP 5')) {
            errorInfo.type = 'server';
            errorInfo.message = '服务器错误';
            errorInfo.retryable = true;
            errorInfo.userMessage = '服务器暂时不可用，正在重试...';
        } else if (error.message.includes('HTTP 4')) {
            errorInfo.type = 'client';
            errorInfo.message = '请求错误';
            errorInfo.retryable = false;
            errorInfo.userMessage = '请求参数错误，请检查配置';
        } else if (error.message.includes('网络连接已断开')) {
            errorInfo.type = 'offline';
            errorInfo.message = '网络连接已断开';
            errorInfo.retryable = false;
            errorInfo.userMessage = '网络连接已断开，请检查网络设置';
        }

        return errorInfo;
    }

    // 获取网站配置
    async getSiteConfig() {
        try {
            const response = await this.fetchWithRetry(this.config.endpoints.config);
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
            const response = await this.fetchWithRetry(this.config.endpoints.bookmarks);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || '获取数据失败');
            }
            
            return data.data || [];
        } catch (error) {
            console.error('获取书签数据失败:', error);
            throw error;
        }
    }

    // 健康检查
    async healthCheck() {
        try {
            const response = await this.fetchWithRetry(this.config.endpoints.health);
            return response.ok;
        } catch (error) {
            console.error('健康检查失败:', error);
            return false;
        }
    }

    // 测试网络连接
    async testConnection() {
        try {
            const startTime = Date.now();
            const response = await this.fetchWithRetry(this.config.endpoints.health);
            const endTime = Date.now();
            
            return {
                success: true,
                latency: endTime - startTime,
                status: response.status
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                type: error.type
            };
        }
    }
}

// 导出API服务实例
window.ApiService = ApiService;