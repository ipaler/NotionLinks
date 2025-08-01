// 主应用模块 - 整合所有模块并初始化应用
class BookmarkApp {
    constructor() {
        this.apiService = null;
        this.dataManager = null;
        this.uiManager = null;
        this.eventManager = null;
        
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // 性能监控
        this.performanceMetrics = {
            startTime: performance.now(),
            loadTime: null,
            renderTime: null
        };
    }

    // 初始化应用
    async init() {
        try {
            // 检查必要的DOM元素
            if (!this.checkRequiredElements()) {
                throw new Error('缺少必要的DOM元素');
            }

            // 初始化各个模块
            this.initializeModules();
            
            // 加载配置和数据
            await this.loadInitialData();
            
            // 标记为已初始化
            this.isInitialized = true;
            
            // 记录性能指标
            this.performanceMetrics.loadTime = performance.now() - this.performanceMetrics.startTime;
            
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.handleInitError(error);
        }
    }

    // 检查必要的DOM元素
    checkRequiredElements() {
        const requiredElements = [
            'bookmarksGrid',
            'categoryMenu',
            'searchInput',
            'pageTitle'
        ];
        
        const missingElements = [];
        
        for (const elementId of requiredElements) {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(`缺少必要元素: ${elementId}`);
                missingElements.push(elementId);
            }
        }
        
        if (missingElements.length > 0) {
            console.error('缺少以下必要元素:', missingElements);
            return false;
        }
        
        return true;
    }

    // 初始化各个模块
    initializeModules() {
        try {
            // 检查必要的类是否存在
            if (!window.ApiService) {
                throw new Error('ApiService 类未找到');
            }
            if (!window.DataManager) {
                throw new Error('DataManager 类未找到');
            }
            if (!window.UIManager) {
                throw new Error('UIManager 类未找到');
            }
            if (!window.EventManager) {
                throw new Error('EventManager 类未找到');
            }
            
            // 初始化API服务
            this.apiService = new window.ApiService();
            
            // 初始化数据管理器
            this.dataManager = new window.DataManager();
            
            // 初始化UI管理器
            this.uiManager = new window.UIManager();
            
            // 初始化事件管理器
            this.eventManager = new window.EventManager(
                this.dataManager,
                this.uiManager,
                this.apiService
            );
            
            // 初始化懒加载器
            if (window.LazyLoader) {
                window.lazyLoader = new window.LazyLoader();
            } else {
                console.warn('LazyLoader 类未找到，懒加载功能将不可用');
            }
            
        } catch (error) {
            console.error('❌ 模块初始化失败:', error);
            throw error;
        }
    }

    // 加载初始数据
    async loadInitialData() {
        this.uiManager.showLoading(true);
        
        try {
            // 并行加载配置和书签数据
            const results = await Promise.all([
                this.loadSiteConfig(),
                this.loadBookmarks()
            ]);
            
            // 安全解构，确保results是数组
            if (!Array.isArray(results) || results.length < 2) {
                throw new Error('Promise.all 返回结果格式错误');
            }
            
            const [siteConfig, bookmarks] = results;
            
            // 设置网站配置
            if (siteConfig) {
                window.siteConfig = siteConfig;
                this.updateSiteTitle(siteConfig.siteTitle);
            }
            
            // 设置书签数据
            this.dataManager.setBookmarks(Array.isArray(bookmarks) ? bookmarks : []);
            
            // 初始渲染
            this.performInitialRender();
            
        } catch (error) {
            console.error('数据加载失败:', error);
            this.handleDataLoadError(error);
        } finally {
            this.uiManager.showLoading(false);
        }
    }

    // 加载网站配置
    async loadSiteConfig() {
        try {
            const config = await this.apiService.getSiteConfig();
            return config;
        } catch (error) {
            console.warn('⚠️ 网站配置加载失败，使用默认配置:', error);
            return { siteTitle: '书签管理系统' };
        }
    }

    // 加载书签数据
    async loadBookmarks() {
        try {
            const bookmarks = await this.apiService.getBookmarks();
            return bookmarks;
        } catch (error) {
            console.error('❌ 书签数据加载失败:', error);
            throw error;
        }
    }

    // 执行初始渲染
    performInitialRender() {
        try {
            // 记录渲染开始时间
            const renderStartTime = performance.now();
            
            // 执行UI更新
            this.eventManager.updateUI();
            
            // 记录渲染完成时间
            this.performanceMetrics.renderTime = performance.now() - renderStartTime;
            
        } catch (error) {
            console.error('❌ updateUI执行失败:', error);
            this.handleInitError(error);
        }
    }

    // 更新网站标题
    updateSiteTitle(title) {
        if (!title) return;
        
        // 更新页面标题
        document.title = title;
        
        // 更新头部Logo文字
        const logoSpan = document.querySelector('.logo span');
        if (logoSpan) {
            logoSpan.textContent = title;
        }
        
        // 更新footer中的网站名称
        const footerSiteName = document.getElementById('footerSiteName');
        if (footerSiteName) {
            footerSiteName.textContent = title;
        }
    }

    // 处理初始化错误
    handleInitError(error) {
        console.error('应用初始化失败:', error);
        
        // 显示错误信息
        const errorMessage = this.getErrorMessage(error);
        
        // 创建错误页面
        this.showErrorPage(errorMessage);
        
        // 如果还有重试次数，尝试重新初始化
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            console.log(`🔄 尝试重新初始化 (${this.retryCount}/${this.maxRetries})`);
            
            setTimeout(() => {
                this.init();
            }, 2000 * this.retryCount); // 递增延迟
        }
    }

    // 处理数据加载错误
    handleDataLoadError(error) {
        console.error('数据加载失败:', error);
        
        // 根据错误类型显示不同的提示
        let errorMessage = '数据加载失败，请稍后重试';
        let errorType = 'error';
        
        if (error.type === 'offline') {
            errorMessage = '网络连接已断开，请检查网络设置后重试';
            errorType = 'warning';
        } else if (error.type === 'timeout') {
            errorMessage = '请求超时，可能是网络较慢，正在自动重试...';
            errorType = 'info';
        } else if (error.type === 'server') {
            errorMessage = '服务器暂时不可用，正在自动重试...';
            errorType = 'warning';
        } else if (error.type === 'network') {
            errorMessage = '网络连接异常，正在自动重试...';
            errorType = 'warning';
        }
        
        this.uiManager.showMessage(errorMessage, errorType);
        
        // 设置空数据，显示空状态提示
        this.dataManager.setBookmarks([]);
        this.performInitialRender();
        
        // 如果是可重试的错误，尝试重新加载
        if (error.retryable && this.retryCount < this.maxRetries) {
            this.scheduleRetry();
        }
    }

    // 安排重试
    scheduleRetry() {
        this.retryCount++;
        const delay = Math.min(2000 * this.retryCount, 10000); // 最大10秒延迟
        
        console.log(`🔄 安排第${this.retryCount}次重试 (${delay}ms后)`);
        
        setTimeout(async () => {
            try {
                console.log(`🔄 开始第${this.retryCount}次重试`);
                await this.loadInitialData();
            } catch (error) {
                console.error(`❌ 第${this.retryCount}次重试失败:`, error);
                if (this.retryCount < this.maxRetries) {
                    this.scheduleRetry();
                } else {
                    this.uiManager.showMessage('多次重试失败，请检查网络连接或刷新页面', 'error');
                }
            }
        }, delay);
    }

    // 显示错误页面
    showErrorPage(message) {
        const bookmarksGrid = document.getElementById('bookmarksGrid');
        if (bookmarksGrid) {
            bookmarksGrid.innerHTML = `
                <div class="error-page">
                    <div class="error-content">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ff4757; margin-bottom: 16px;"></i>
                        <h2>应用加载失败</h2>
                        <p>${message}</p>
                    </div>
                </div>
            `;
        }
    }

    // 获取错误信息
    getErrorMessage(error) {
        if (this.isNetworkError(error)) {
            return '网络连接失败，请检查网络设置后重试';
        }
        
        if (error.message.includes('DOM')) {
            return '页面结构异常，请检查页面配置';
        }
        
        return error.message || '未知错误，请联系管理员';
    }

    // 判断是否为网络错误
    isNetworkError(error) {
        return error.name === 'TypeError' || 
               error.message.includes('fetch') ||
               error.message.includes('network') ||
               error.message.includes('Failed to fetch');
    }



    // 获取性能指标
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            isInitialized: this.isInitialized,
            retryCount: this.retryCount
        };
    }

    // 重新加载数据
    async reload() {
        if (!this.isInitialized) {
            console.warn('应用尚未初始化完成');
            return;
        }
        
        try {
            this.uiManager.showLoading(true);
            
            const bookmarks = await this.loadBookmarks();
            this.dataManager.setBookmarks(bookmarks);
            this.eventManager.updateUI();
            
            this.uiManager.showMessage('数据刷新成功！', 'success');
            
        } catch (error) {
            console.error('数据刷新失败:', error);
            this.uiManager.showMessage('数据刷新失败', 'error');
        } finally {
            this.uiManager.showLoading(false);
        }
    }

    // 销毁应用
    destroy() {
        if (this.eventManager) {
            this.eventManager.destroy();
        }
        
        if (this.dataManager) {
            this.dataManager.clearCache();
        }
        
        this.isInitialized = false;
        console.log('🗑️ 应用已销毁');
    }
}

// 全局应用实例
// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
    if (window.bookmarkApp) {
        window.bookmarkApp.destroy();
    }
});

// 导出应用类
window.BookmarkApp = BookmarkApp;