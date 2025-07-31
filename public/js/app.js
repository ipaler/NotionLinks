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
            console.log('🚀 初始化书签应用...');
            
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
            
            console.log(`✅ 应用初始化完成 (${this.performanceMetrics.loadTime.toFixed(2)}ms)`);
            
            // 显示应用就绪消息
            //this.uiManager.showMessage('应用加载完成！', 'success');
            
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
            'tagMenu',
            'searchInput',
            'pageTitle'
        ];
        
        for (const elementId of requiredElements) {
            if (!document.getElementById(elementId)) {
                console.error(`缺少必要元素: ${elementId}`);
                return false;
            }
        }
        
        return true;
    }

    // 初始化各个模块
    initializeModules() {
        console.log('📦 初始化模块...');
        
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
            console.log('初始化 ApiService...');
            this.apiService = new window.ApiService();
            
            // 初始化数据管理器
            console.log('初始化 DataManager...');
            this.dataManager = new window.DataManager();
            
            // 初始化UI管理器
            console.log('初始化 UIManager...');
            this.uiManager = new window.UIManager();
            
            // 初始化事件管理器
            console.log('初始化 EventManager...');
            this.eventManager = new window.EventManager(
                this.dataManager,
                this.uiManager,
                this.apiService
            );
            
            console.log('✅ 所有模块初始化完成');
        } catch (error) {
            console.error('❌ 模块初始化失败:', error);
            throw error;
        }
    }

    // 加载初始数据
    async loadInitialData() {
        console.log('📊 加载初始数据...');
        
        this.uiManager.showLoading(true);
        
        try {
            // 并行加载配置和书签数据
            const results = await Promise.all([
                this.loadSiteConfig(),
                this.loadBookmarks()
            ]);
            
            console.log('Promise.all results:', results);
            
            // 安全解构，确保results是数组
            if (!Array.isArray(results) || results.length < 2) {
                throw new Error('Promise.all 返回结果格式错误');
            }
            
            const [siteConfig, bookmarks] = results;
            
            console.log('siteConfig:', siteConfig);
            console.log('bookmarks:', bookmarks);
            
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
            console.log('✅ 网站配置加载完成');
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
            console.log(`✅ 书签数据加载完成 (${bookmarks.length} 条)`);
            return bookmarks;
        } catch (error) {
            console.error('❌ 书签数据加载失败:', error);
            
            // 数据加载失败时返回空数组，显示空状态提示
            console.log('📭 显示空状态提示...');
            return [];
        }
    }

    // 执行初始渲染
    performInitialRender() {
        const renderStart = performance.now();
        
        // 更新UI
        console.log('🔍 开始执行updateUI');
        console.log('📊 dataManager状态:', {
            allBookmarks: this.dataManager.getAllBookmarks(),
            filteredBookmarks: this.dataManager.getFilteredBookmarks(),
            currentCategory: this.dataManager.getCurrentCategory()
        });
        
        try {
            this.eventManager.updateUI();
            console.log('✅ updateUI执行成功');
        } catch (error) {
            console.error('❌ updateUI执行失败:', error);
            throw error;
        }
        
        // 记录渲染时间
        this.performanceMetrics.renderTime = performance.now() - renderStart;
        
        console.log(`🎨 初始渲染完成 (${this.performanceMetrics.renderTime.toFixed(2)}ms)`);
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
        this.uiManager.showMessage('数据加载失败，请检查Notion配置', 'error');
        
        // 设置空数据，显示空状态提示
        this.dataManager.setBookmarks([]);
        this.performInitialRender();
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
let bookmarkApp = null;

// DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📱 DOM 加载完成，开始初始化应用...');
    
    // 创建应用实例
    bookmarkApp = new BookmarkApp();
    
    // 初始化应用
    await bookmarkApp.init();
    
    // 将应用实例暴露到全局（用于调试）
    window.bookmarkApp = bookmarkApp;
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
    if (bookmarkApp) {
        bookmarkApp.destroy();
    }
});

// 导出应用类
window.BookmarkApp = BookmarkApp;