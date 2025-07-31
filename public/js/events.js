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
        
        // 搜索输入事件（防抖）
        if (this.uiManager.elements.searchInput) {
            this.uiManager.elements.searchInput.addEventListener('input', (e) => {
                this.handleSearchDebounced(e.target.value);
            });
        }

        // 分类菜单点击事件
        if (this.uiManager.elements.categoryMenu) {
            this.uiManager.elements.categoryMenu.addEventListener('click', (e) => {
                this.handleCategoryClick(e);
            });
        }

        // 标签菜单点击事件
        if (this.uiManager.elements.tagMenu) {
            this.uiManager.elements.tagMenu.addEventListener('click', (e) => {
                this.handleTagClick(e);
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
        const menuItem = e.target.closest('.menu-item');
        if (!menuItem || !menuItem.dataset.category) return;

        // 更新选中状态
        this.uiManager.elements.categoryMenu.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        menuItem.classList.add('active');

        // 更新数据和UI
        this.dataManager.setCategory(menuItem.dataset.category);
        this.updateUI();

        // 移动端自动关闭菜单
        if (window.innerWidth <= 768) {
            this.uiManager.closeMobileMenu();
        }
    }

    // 处理标签点击
    handleTagClick(e) {
        const tagItem = e.target.closest('.tag-item');
        const clearTags = e.target.closest('#clearTags');

        if (clearTags) {
            this.dataManager.clearTags();
            this.updateUI();
            return;
        }

        if (!tagItem || !tagItem.dataset.tag) return;

        const tag = tagItem.dataset.tag;
        const isSelected = tagItem.classList.contains('selected');

        if (isSelected) {
            this.dataManager.removeTag(tag);
            tagItem.classList.remove('selected');
        } else {
            this.dataManager.addTag(tag);
            tagItem.classList.add('selected');
        }

        this.updateUI();
    }

    // 处理书签点击
    handleBookmarkClick(e) {
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
        const syncBtn = this.uiManager.elements.syncBtn;
        const originalHTML = syncBtn.innerHTML;
        
        try {
            // 显示加载状态
            syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            syncBtn.disabled = true;
            
            // 获取新数据
            const bookmarks = await this.apiService.getBookmarks();
            this.dataManager.setBookmarks(bookmarks);
            
            // 更新UI
            this.updateUI();
            
            // 显示成功消息
            this.uiManager.showMessage('数据同步成功！', 'success');
            
        } catch (error) {
            console.error('同步失败:', error);
            this.uiManager.showMessage('同步失败，请检查网络连接', 'error');
        } finally {
            // 恢复按钮状态
            syncBtn.innerHTML = originalHTML;
            syncBtn.disabled = false;
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
        console.log('🔍 EventManager.updateUI 开始执行');
        
        try {
            console.log('📊 获取过滤后的书签...');
            const filteredBookmarks = this.dataManager.getFilteredBookmarks();
            console.log('✅ 过滤后的书签:', filteredBookmarks);
            
            console.log('📊 获取统计信息...');
            const stats = this.dataManager.getStats();
            console.log('✅ 统计信息:', stats);
            
            // 渲染书签
            console.log('🎨 开始渲染书签...');
            this.uiManager.renderBookmarks(filteredBookmarks);
            console.log('✅ 书签渲染完成');
            
            // 更新分类菜单
            console.log('📂 更新分类菜单...');
            this.uiManager.updateCategoryMenu(
                this.dataManager.getAllBookmarks(),
                this.dataManager.getCurrentCategory()
            );
            console.log('✅ 分类菜单更新完成');
            
            // 更新标签菜单
            console.log('🏷️ 更新标签菜单...');
            this.uiManager.updateTagMenu(
                this.dataManager.getAllBookmarks(),
                this.dataManager.getCurrentTags()
            );
            console.log('✅ 标签菜单更新完成');
            
            // 更新页面标题
            console.log('📝 更新页面标题...');
            this.uiManager.updatePageTitle(
                this.dataManager.getCurrentCategory(),
                this.dataManager.getCurrentTags()
            );
            console.log('✅ 页面标题更新完成');
             
             // 更新结果统计
             console.log('📊 更新结果统计...');
             this.uiManager.updateResultsCount(stats.filtered, stats.total);
             console.log('✅ 结果统计更新完成');
             
             // 更新分类计数
             console.log('🔢 更新分类计数...');
             this.uiManager.updateCategoryCounts();
             console.log('✅ 分类计数更新完成');
             
         } catch (error) {
             console.error('❌ EventManager.updateUI 执行失败:', error);
             console.error('错误堆栈:', error.stack);
             throw error;
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