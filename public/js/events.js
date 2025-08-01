// 事件管理模块 - 处理用户交互和事件监听
class EventManager {
    constructor(dataManager, uiManager, apiService) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.apiService = apiService;
        
        // 防抖定时器
        this.searchDebounceTimer = null;
        this.resizeDebounceTimer = null;
        
        // 下拉刷新相关
        this.pullToRefresh = {
            startY: 0,
            currentY: 0,
            isDragging: false,
            threshold: 80,
            isRefreshing: false
        };
        
        this.setupEventListeners();
        this.setupScrollToTop();
        this.setupPullToRefresh();
    }

    // 设置所有事件监听器
    setupEventListeners() {
        // 安全检查uiManager和elements
        if (!this.uiManager || !this.uiManager.elements) {
            console.warn('EventManager: UIManager或elements未正确初始化');
            return;
        }
        
        // 设置事件监听器
        
        // 搜索输入事件（防抖）
        if (this.uiManager.elements.searchInput) {
            this.uiManager.elements.searchInput.addEventListener('input', (e) => {
                this.handleSearchDebounced(e.target.value);
            });
        }

        // 分类菜单点击事件（使用事件委托）
        if (this.uiManager.elements.categoryMenu) {
            this.uiManager.elements.categoryMenu.addEventListener('click', (e) => {
                this.handleCategoryClick(e);
            });
        } else {
            console.error('categoryMenu元素不存在！');
        }

        // 标签筛选栏点击事件
        if (this.uiManager.elements.tagsFilterContent) {
            this.uiManager.elements.tagsFilterContent.addEventListener('click', (e) => {
                this.handleFilterTagClick(e);
            });
        }

        // 清除标签按钮点击事件
        if (this.uiManager.elements.clearTagsBtn) {
            this.uiManager.elements.clearTagsBtn.addEventListener('click', () => {
                this.handleClearTags();
            });
        }

        // 书签网格点击事件（事件委托）
        if (this.uiManager.elements.bookmarksGrid) {
            this.uiManager.elements.bookmarksGrid.addEventListener('click', (e) => {
                this.handleBookmarkClick(e);
            });
        }

        // 同步按钮点击事件
        if (this.uiManager.elements.syncBtn) {
            this.uiManager.elements.syncBtn.addEventListener('click', () => {
                this.handleSyncData();
            });
        }

        // 网络诊断按钮点击事件
        if (this.uiManager.elements.diagnoseBtn) {
            this.uiManager.elements.diagnoseBtn.addEventListener('click', async () => {
                try {
                    this.uiManager.elements.diagnoseBtn.disabled = true;
                    this.uiManager.elements.diagnoseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    
                    const results = await this.uiManager.performNetworkDiagnosis();
                    this.uiManager.showNetworkDiagnosis(results);
                } catch (error) {
                    console.error('网络诊断失败:', error);
                    this.uiManager.showMessage('网络诊断失败，请稍后重试', 'error');
                } finally {
                    this.uiManager.elements.diagnoseBtn.disabled = false;
                    this.uiManager.elements.diagnoseBtn.innerHTML = '<i class="fas fa-network-wired"></i>';
                }
            });
        }

        // 模态框关闭事件
        if (this.uiManager.elements.modalClose) {
            this.uiManager.elements.modalClose.addEventListener('click', () => {
                this.uiManager.closeModal();
            });
        }

        // 模态框背景点击关闭
        if (this.uiManager.elements.modal) {
            this.uiManager.elements.modal.addEventListener('click', (e) => {
                if (e.target === this.uiManager.elements.modal) {
                    this.uiManager.closeModal();
                }
            });
        }

        // 移动端菜单切换
        if (this.uiManager.elements.menuToggle) {
            this.uiManager.elements.menuToggle.addEventListener('click', () => {
                this.uiManager.toggleMobileMenu();
            });
        }

        // 侧边栏遮罩点击关闭
        if (this.uiManager.elements.sidebarOverlay) {
            this.uiManager.elements.sidebarOverlay.addEventListener('click', () => {
                this.uiManager.closeMobileMenu();
            });
        }

        // 回到顶部按钮
        if (this.uiManager.elements.backToTop) {
            this.uiManager.elements.backToTop.addEventListener('click', () => {
                this.scrollToTop();
            });
        }

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardEvents(e);
        });

        // 窗口大小变化事件（防抖）
        window.addEventListener('resize', () => {
            this.handleResizeDebounced();
        });

        // 滚动事件（节流）
        let scrollTimeout = null;
        window.addEventListener('scroll', () => {
            if (!scrollTimeout) {
                scrollTimeout = setTimeout(() => {
                    this.handleScroll();
                    scrollTimeout = null;
                }, 16); // 约60fps
            }
        });

        // 网络状态监听
        this.setupNetworkListeners();

        // 设置下拉刷新（移动端）
        this.setupPullToRefresh();
    }

    // 设置网络状态监听
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            const status = this.apiService.checkNetworkStatus();
            this.uiManager.showNetworkStatus(status);
            this.uiManager.showMessage('网络连接已恢复', 'success', 3000);
        });

        window.addEventListener('offline', () => {
            const status = this.apiService.checkNetworkStatus();
            this.uiManager.showNetworkStatus(status);
            this.uiManager.showMessage('网络连接已断开，请检查网络设置', 'warning', 0);
        });
    }

    // 处理搜索（防抖）
    handleSearchDebounced(query) {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.dataManager.setSearchQuery(query);
            this.updateUI();
        }, 300);
    }

    // 处理分类点击
    handleCategoryClick(e) {
        // 更精确的事件目标查找
        let categoryItem = e.target.closest('.menu-item[data-category]');
        
        // 如果没找到，尝试查找父元素
        if (!categoryItem) {
            categoryItem = e.target.closest('li[data-category]');
        }
        
        // 如果还是没找到，检查点击的元素本身
        if (!categoryItem && e.target.classList.contains('menu-item')) {
            categoryItem = e.target;
        }
        
        if (!categoryItem) {
            return;
        }
        
        e.preventDefault();
        e.stopPropagation();
        
        const category = categoryItem.dataset.category;
        
        if (!category) {
            console.error('分类项的data-category属性为空');
            return;
        }
        
        // 移除所有active类
        const allMenuItems = this.uiManager.elements.categoryMenu.querySelectorAll('.menu-item');
        allMenuItems.forEach(item => item.classList.remove('active'));
        
        // 添加active类到当前项
        categoryItem.classList.add('active');
        
        // 切换分类
        this.dataManager.setCategory(category);
        
        // 更新UI
        this.updateUI();
    }

    // 处理标签筛选栏点击
    handleFilterTagClick(e) {
        const filterTag = e.target.closest('.filter-tag');
        if (!filterTag) return;
        
        e.preventDefault();
        
        const tag = filterTag.dataset.tag;
        if (!tag) return;
        
        // 切换标签选择状态
        this.dataManager.toggleTag(tag);
        
        // 更新UI
        this.updateUI();
    }

    // 处理清除标签
    handleClearTags() {
        // 清除所有选中的标签
        this.dataManager.clearTags();
        
        // 更新UI
        this.updateUI();
    }

    // 处理书签点击
    handleBookmarkClick(e) {
        // 检查是否点击了快速访问按钮
        if (e.target.closest('.bookmark-quick-access')) {
            e.preventDefault();
            e.stopPropagation();
            
            const button = e.target.closest('.bookmark-quick-access');
            const url = button.dataset.url;
            
            if (url) {
                // 添加点击反馈
                button.style.transform = 'scale(0.9)';
                button.style.background = 'rgba(46, 170, 220, 0.8)';
                
                setTimeout(() => {
                    button.style.transform = '';
                    button.style.background = '';
                }, 150);
                
                // 在新标签页打开链接
                window.open(url, '_blank');
                
                // 显示成功消息
                this.uiManager.showMessage('正在打开链接...', 'success');
            } else {
                this.uiManager.showMessage('链接地址无效', 'error');
            }
            return;
        }
        
        // 检查是否点击了链接
        if (e.target.tagName === 'A') {
            return; // 让链接正常跳转
        }

        const card = e.target.closest('.bookmark-card');
        if (!card || !card.dataset.id) return;

        const bookmark = this.dataManager.findBookmarkById(card.dataset.id);
        if (bookmark) {
            // 检查是否是双击（快速打开链接）
            if (e.detail === 2) {
                window.open(bookmark.url, '_blank');
            } else {
                // 单击显示详情
                setTimeout(() => {
                    if (e.detail === 1) {
                        this.uiManager.showBookmarkDetails(bookmark);
                    }
                }, 200);
            }
        }
    }

    // 处理同步数据
    async handleSyncData() {
        try {
            // 检查网络状态
            const networkStatus = this.apiService.checkNetworkStatus();
            if (!networkStatus.isOnline) {
                this.uiManager.showMessage('网络连接已断开，请检查网络设置', 'warning');
                return;
            }

            // 显示加载状态
            this.uiManager.elements.syncBtn.disabled = true;
            const originalText = this.uiManager.elements.syncBtn.innerHTML;
            this.uiManager.elements.syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // 测试网络连接
            const connectionTest = await this.apiService.testConnection();
            if (!connectionTest.success) {
                this.uiManager.showMessage(`网络连接测试失败: ${connectionTest.error}`, 'error');
                return;
            }

            // 重新加载数据
            await this.app.reload();
            
            // 显示成功消息
            this.uiManager.showMessage('数据刷新成功！', 'success');
            
        } catch (error) {
            console.error('同步数据失败:', error);
            
            // 根据错误类型显示不同消息
            let message = '数据刷新失败，请稍后重试';
            let type = 'error';
            
            if (error.type === 'timeout') {
                message = '请求超时，请检查网络连接';
                type = 'warning';
            } else if (error.type === 'network') {
                message = '网络连接异常，请检查网络设置';
                type = 'warning';
            } else if (error.type === 'server') {
                message = '服务器暂时不可用，请稍后重试';
                type = 'warning';
            }
            
            this.uiManager.showMessage(message, type);
            
        } finally {
            // 恢复按钮状态
            this.uiManager.elements.syncBtn.disabled = false;
            this.uiManager.elements.syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i><span class="sync-text">刷新</span>';
        }
    }

    // 处理键盘事件
    handleKeyboardEvents(e) {
        // ESC 键关闭模态框
        if (e.key === 'Escape') {
            if (this.uiManager.elements.modal.style.display === 'flex') {
                this.uiManager.closeModal();
            }
            if (this.uiManager.elements.sidebar.classList.contains('active')) {
                this.uiManager.closeMobileMenu();
            }
        }

        // Ctrl/Cmd + K 聚焦搜索框
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.uiManager.elements.searchInput?.focus();
        }

        // Ctrl/Cmd + R 刷新数据
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            this.handleSyncData();
        }
        
        // Enter 键快速访问当前选中的书签
        if (e.key === 'Enter' && document.activeElement.classList.contains('bookmark-card')) {
            e.preventDefault();
            const card = document.activeElement;
            const bookmark = this.dataManager.findBookmarkById(card.dataset.id);
            if (bookmark && bookmark.url) {
                window.open(bookmark.url, '_blank');
                this.uiManager.showMessage('正在打开链接...', 'success');
            }
        }
        
        // 方向键导航书签卡片
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            const currentCard = document.activeElement.closest('.bookmark-card');
            if (currentCard) {
                e.preventDefault();
                this.navigateBookmarks(e.key, currentCard);
            }
        }
    }
    
    // 书签卡片导航
    navigateBookmarks(direction, currentCard) {
        const cards = Array.from(document.querySelectorAll('.bookmark-card'));
        const currentIndex = cards.indexOf(currentCard);
        let nextIndex = currentIndex;
        
        const cols = Math.floor(document.querySelector('.bookmarks-grid').offsetWidth / 320); // 估算列数
        
        switch (direction) {
            case 'ArrowUp':
                nextIndex = Math.max(0, currentIndex - cols);
                break;
            case 'ArrowDown':
                nextIndex = Math.min(cards.length - 1, currentIndex + cols);
                break;
            case 'ArrowLeft':
                nextIndex = Math.max(0, currentIndex - 1);
                break;
            case 'ArrowRight':
                nextIndex = Math.min(cards.length - 1, currentIndex + 1);
                break;
        }
        
        if (nextIndex !== currentIndex) {
            cards[currentIndex].blur();
            cards[nextIndex].focus();
            cards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // 处理窗口大小变化（防抖）
    handleResizeDebounced() {
        clearTimeout(this.resizeDebounceTimer);
        this.resizeDebounceTimer = setTimeout(() => {
            // 大屏幕时自动关闭移动端菜单
            if (window.innerWidth > 768) {
                this.uiManager.closeMobileMenu();
            }
        }, 250);
    }

    // 处理滚动事件
    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 显示/隐藏回到顶部按钮
        if (this.uiManager.elements.backToTop) {
            if (scrollTop > 300) {
                this.uiManager.elements.backToTop.style.display = 'flex';
            } else {
                this.uiManager.elements.backToTop.style.display = 'none';
            }
        }
    }

    // 设置回到顶部功能
    setupScrollToTop() {
        // 创建回到顶部按钮（如果不存在）
        if (!this.uiManager.elements.backToTop) {
            const backToTopBtn = document.createElement('button');
            backToTopBtn.id = 'backToTop';
            backToTopBtn.className = 'back-to-top';
            backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
            backToTopBtn.style.cssText = `
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 50px;
                height: 50px;
                background: #2eaadc;
                color: white;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                display: none;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                transition: all 0.3s ease;
            `;
            
            document.body.appendChild(backToTopBtn);
            this.uiManager.elements.backToTop = backToTopBtn;
            
            // 添加悬停效果
            backToTopBtn.addEventListener('mouseenter', () => {
                backToTopBtn.style.transform = 'scale(1.1)';
                backToTopBtn.style.background = '#2691d9';
            });
            
            backToTopBtn.addEventListener('mouseleave', () => {
                backToTopBtn.style.transform = 'scale(1)';
                backToTopBtn.style.background = '#2eaadc';
            });
        }
    }

    // 滚动到顶部
    scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    // 更新UI（统一的UI更新方法）
    updateUI() {
        try {
            // 获取过滤后的书签
            const filteredBookmarks = this.dataManager.getFilteredBookmarks();
            
            // 获取统计信息
            const stats = this.dataManager.getStats();
            
            // 渲染书签
            this.uiManager.renderBookmarks(filteredBookmarks);
            
            // 更新分类菜单
            this.uiManager.updateCategoryMenu(
                this.dataManager.getAllBookmarks(),
                this.dataManager.getCurrentCategory()
            );
            
            // 更新标签菜单
            this.uiManager.updateTagMenu(
                this.dataManager.getAllBookmarks(),
                this.dataManager.getCurrentTags()
            );
            
            // 更新页面标题
            this.uiManager.updatePageTitle(
                this.dataManager.getCurrentCategory(),
                this.dataManager.getCurrentTags()
            );
            
        } catch (error) {
            console.error('❌ EventManager.updateUI 执行失败:', error);
            console.error('错误堆栈:', error.stack);
        }
    }

    // 设置下拉刷新功能（仅移动端）
    setupPullToRefresh() {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        
        if (!isMobile) return;
        
        const container = document.querySelector('.main-content') || document.body;
        
        // 触摸开始
        container.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0 && !this.pullToRefresh.isRefreshing) {
                this.pullToRefresh.startY = e.touches[0].clientY;
                this.pullToRefresh.isDragging = true;
            }
        }, { passive: true });
        
        // 触摸移动
        container.addEventListener('touchmove', (e) => {
            if (!this.pullToRefresh.isDragging || this.pullToRefresh.isRefreshing) return;
            
            this.pullToRefresh.currentY = e.touches[0].clientY;
            const deltaY = this.pullToRefresh.currentY - this.pullToRefresh.startY;
            
            if (deltaY > 0 && window.scrollY === 0) {
                e.preventDefault();
                this.updatePullToRefreshUI(deltaY);
            }
        }, { passive: false });
        
        // 触摸结束
        container.addEventListener('touchend', () => {
            if (!this.pullToRefresh.isDragging) return;
            
            const deltaY = this.pullToRefresh.currentY - this.pullToRefresh.startY;
            
            if (deltaY > this.pullToRefresh.threshold && !this.pullToRefresh.isRefreshing) {
                this.triggerPullToRefresh();
            } else {
                this.resetPullToRefresh();
            }
            
            this.pullToRefresh.isDragging = false;
        }, { passive: true });
    }
    
    // 更新下拉刷新UI
    updatePullToRefreshUI(deltaY) {
        const progress = Math.min(deltaY / this.pullToRefresh.threshold, 1);
        const header = document.querySelector('.header');
        
        if (header) {
            header.style.transform = `translateY(${Math.min(deltaY * 0.5, 40)}px)`;
            header.style.transition = 'none';
        }
        
        // 显示刷新提示
        this.showPullToRefreshIndicator(progress >= 1);
    }
    
    // 显示下拉刷新指示器
    showPullToRefreshIndicator(canRefresh) {
        let indicator = document.querySelector('.pull-refresh-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'pull-refresh-indicator';
            indicator.innerHTML = `
                <div class="pull-refresh-content">
                    <i class="fas fa-arrow-down pull-refresh-icon"></i>
                    <span class="pull-refresh-text">下拉刷新</span>
                </div>
            `;
            document.body.appendChild(indicator);
        }
        
        const icon = indicator.querySelector('.pull-refresh-icon');
        const text = indicator.querySelector('.pull-refresh-text');
        
        if (canRefresh) {
            icon.className = 'fas fa-sync-alt pull-refresh-icon';
            text.textContent = '释放刷新';
            indicator.classList.add('can-refresh');
        } else {
            icon.className = 'fas fa-arrow-down pull-refresh-icon';
            text.textContent = '下拉刷新';
            indicator.classList.remove('can-refresh');
        }
        
        indicator.style.display = 'flex';
    }
    
    // 触发下拉刷新
    async triggerPullToRefresh() {
        this.pullToRefresh.isRefreshing = true;
        
        const indicator = document.querySelector('.pull-refresh-indicator');
        if (indicator) {
            const icon = indicator.querySelector('.pull-refresh-icon');
            const text = indicator.querySelector('.pull-refresh-text');
            icon.className = 'fas fa-spinner fa-spin pull-refresh-icon';
            text.textContent = '正在刷新...';
        }
        
        try {
            // 执行刷新逻辑
            const bookmarks = await this.apiService.getBookmarks();
            this.dataManager.setBookmarks(bookmarks);
            this.updateUI();
            this.uiManager.showMessage('刷新成功！', 'success');
        } catch (error) {
            console.error('下拉刷新失败:', error);
            this.uiManager.showMessage('刷新失败，请检查网络连接', 'error');
        }
        
        // 延迟重置，让用户看到刷新完成
        setTimeout(() => {
            this.resetPullToRefresh();
        }, 500);
    }
    
    // 重置下拉刷新状态
    resetPullToRefresh() {
        const header = document.querySelector('.header');
        const indicator = document.querySelector('.pull-refresh-indicator');
        
        if (header) {
            header.style.transform = '';
            header.style.transition = 'transform 0.3s ease';
        }
        
        if (indicator) {
            indicator.style.display = 'none';
        }
        
        this.pullToRefresh.isRefreshing = false;
        this.pullToRefresh.startY = 0;
        this.pullToRefresh.currentY = 0;
    }



    // 销毁事件监听器（清理方法）
    destroy() {
        clearTimeout(this.searchDebounceTimer);
        clearTimeout(this.resizeDebounceTimer);
        
        // 移除所有事件监听器
        // 注意：这里只是示例，实际项目中可能需要更详细的清理
        window.removeEventListener('resize', this.handleResizeDebounced);
        window.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('keydown', this.handleKeyboardEvents);
        
        // 清理下拉刷新指示器
        const indicator = document.querySelector('.pull-refresh-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}

// 导出事件管理器
window.EventManager = EventManager;