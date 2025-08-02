// 事件管理模块 - 处理用户交互和事件监听
class EventManager {
    constructor(dataManager, uiManager, apiService, app) {
        this.dataManager = dataManager;
        this.uiManager = uiManager;
        this.apiService = apiService;
        this.app = app;
        
        // 配置选项
        this.config = {
            clearFiltersOnCategoryChange: true, // 切换分类时是否清空筛选条件
            showCategoryChangeMessage: true     // 是否显示分类切换提示消息
        };
        
        // 常量配置
        this.constants = {
            SEARCH_DEBOUNCE_DELAY: 300,
            RESIZE_DEBOUNCE_DELAY: 250,
            SCROLL_THROTTLE_DELAY: 16,
            SCROLL_TO_TOP_THRESHOLD: 300,
            MOBILE_BREAKPOINT: 768,
            TABLET_BREAKPOINT: 968,
            CARD_MIN_WIDTH: {
                DESKTOP: 320,
                MOBILE: 280
            },
            GRID_GAP: 24
        };
        
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
        if (!this.uiManager?.elements) {
            console.warn('EventManager: UIManager或elements未正确初始化');
            return;
        }
        
        const { elements } = this.uiManager;
        
        // 搜索输入事件（防抖）
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
        }

        // 搜索清除按钮点击事件
        if (elements.searchClear) {
            elements.searchClear.addEventListener('click', () => {
                this.handleSearchClear();
            });
            
            // 初始化时隐藏清除按钮
            this.uiManager.toggleSearchClearButton(false);
        }

        // 分类菜单点击事件（使用事件委托）
        if (elements.categoryMenu) {
            elements.categoryMenu.addEventListener('click', (e) => {
                this.handleCategoryClick(e);
            });
        }

        // 标签筛选栏点击事件
        if (elements.tagsFilterContent) {
            elements.tagsFilterContent.addEventListener('click', (e) => {
                this.handleFilterTagClick(e);
            });
        }

        // 展开标签按钮点击事件
        if (elements.expandTagsBtn) {
            elements.expandTagsBtn.addEventListener('click', () => {
                this.handleToggleTagsExpansion();
            });
            
            // 初始化时检查展开按钮状态
            setTimeout(() => {
                this.uiManager.checkTagsOverflow();
            }, 200);
        }

        // 清除标签按钮点击事件
        if (elements.clearTagsBtn) {
            elements.clearTagsBtn.addEventListener('click', () => {
                this.handleClearTags();
            });
        }

        // 书签网格点击事件（事件委托）
        if (elements.bookmarksGrid) {
            elements.bookmarksGrid.addEventListener('click', (e) => {
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
                    
                    // 显示加载消息
                    this.uiManager.showMessage('正在执行网络诊断...', 'info', 2000);
                    
                    const results = await this.uiManager.performNetworkDiagnosis();
                    this.uiManager.showNetworkDiagnosis(results);
                    
                    // 显示成功消息
                    this.uiManager.showMessage('网络诊断完成', 'success', 3000);
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

        // 清除键盘焦点样式
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.bookmark-card')) {
                const focusedCards = document.querySelectorAll('.bookmark-card.keyboard-focused');
                focusedCards.forEach(card => {
                    card.classList.remove('keyboard-focused');
                });
            }
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

    // 处理搜索（防抖 + 性能优化）
    handleSearchInput(query) {
        // 显示/隐藏清除按钮
        this.uiManager.toggleSearchClearButton(query.length > 0);
        
        // 性能优化：如果查询为空，立即清除
        if (!query.trim()) {
            clearTimeout(this.searchDebounceTimer);
            this.dataManager.setSearchQuery('');
            this.updateUI();
            return;
        }
        
        // 防抖处理搜索
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            // 性能优化：避免重复搜索相同内容
            if (this.dataManager.getSearchQuery() !== query) {
                this.dataManager.setSearchQuery(query);
                this.updateUI();
            }
        }, this.constants.SEARCH_DEBOUNCE_DELAY);
    }

    handleSearchClear() {
        this.clearSearchInput();
        
        // 移动端优化：提供触觉反馈（如果支持）
        if (navigator.vibrate && window.innerWidth <= this.constants.MOBILE_BREAKPOINT) {
            navigator.vibrate(50);
        }
    }

    // 清空搜索框
    clearSearchInput() {
        const { elements } = this.uiManager;
        
        // 清除搜索输入
        if (elements.searchInput) {
            elements.searchInput.value = '';
            elements.searchInput.focus();
            
                    // 移动端优化：确保输入框获得焦点
        if (window.innerWidth <= this.constants.MOBILE_BREAKPOINT) {
            setTimeout(() => {
                elements.searchInput.focus();
            }, 100);
        }
        }
        
        // 隐藏清除按钮
        this.uiManager.toggleSearchClearButton(false);
        
        // 清除搜索查询
        this.dataManager.setSearchQuery('');
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
        
        // 根据配置决定是否清空筛选条件
        if (this.config.clearFiltersOnCategoryChange) {
            // 清空搜索框
            this.clearSearchInput();
            
            // 清空标签筛选条件
            this.clearTagFilters();
        }
        
        // 切换分类
        this.dataManager.setCategory(category);
        
        // 更新UI
        this.updateUI();
        
        // 根据配置决定是否显示提示消息
        if (this.config.showCategoryChangeMessage) {
            const categoryName = category === 'all' ? '全部' : category;
            const message = this.config.clearFiltersOnCategoryChange 
                ? `已切换到"${categoryName}"分类，并清空筛选条件`
                : `已切换到"${categoryName}"分类`;
            this.uiManager.showMessage(message, 'info', 2000);
        }
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
        this.clearTagFilters();
        
        // 更新UI
        this.updateUI();
    }

    // 清空标签筛选条件
    clearTagFilters() {
        const { elements } = this.uiManager;
        
        // 清除所有选中的标签
        this.dataManager.clearTags();
        
        // 隐藏清除标签按钮
        if (elements.clearTagsBtn) {
            elements.clearTagsBtn.style.display = 'none';
        }
        
        // 重置标签展开状态
        if (elements.tagsFilterContent) {
            elements.tagsFilterContent.classList.remove('expanded');
        }
        
        // 更新展开按钮状态
        if (elements.expandTagsBtn) {
            elements.expandTagsBtn.classList.remove('expanded');
            elements.expandTagsBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>展开</span>';
        }
    }

    // 设置配置选项
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    // 获取配置选项
    getConfig() {
        return { ...this.config };
    }

    handleToggleTagsExpansion() {
        const content = this.uiManager.elements.tagsFilterContent;
        const expandBtn = this.uiManager.elements.expandTagsBtn;
        if (!content || !expandBtn) return;
        
        // 如果按钮被禁用，不执行操作
        if (expandBtn.disabled) return;
        
        const isExpanded = content.classList.contains('expanded');
        this.uiManager.toggleTagsExpansion(!isExpanded, true); // 标记为用户操作
        
        // 延迟检查是否需要显示展开按钮
        setTimeout(() => {
            this.uiManager.checkTagsOverflow();
        }, 300);
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
        // 防止重复点击
        if (this.uiManager.elements.syncBtn.disabled) {
            return;
        }

        // 检查app实例是否存在
        if (!this.app) {
            console.error('App实例未找到');
            this.uiManager.showMessage('应用未正确初始化，请刷新页面重试', 'error');
            return;
        }

        try {
            // 检查网络状态
            const networkStatus = this.apiService.checkNetworkStatus();
            if (!networkStatus.isOnline) {
                this.uiManager.showMessage('网络连接已断开，请检查网络设置', 'warning');
                return;
            }

            // 显示加载状态
            this.uiManager.elements.syncBtn.disabled = true;
            this.uiManager.elements.syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // 显示加载消息
            this.uiManager.showMessage('正在刷新数据...', 'info', 2000);

            // 重新加载数据
            await this.app.reload();
            
            // 显示成功消息
            this.uiManager.showMessage('数据刷新成功！', 'success', 3000);
            
        } catch (error) {
            console.error('同步数据失败:', error);
            
            // 根据错误类型显示不同消息
            let message = '数据刷新失败，请稍后重试';
            let type = 'error';
            
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                message = '请求超时，请检查网络连接';
                type = 'warning';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                message = '网络连接异常，请检查网络设置';
                type = 'warning';
            } else if (error.message.includes('HTTP 5')) {
                message = '服务器暂时不可用，请稍后重试';
                type = 'warning';
            } else if (error.message.includes('HTTP 4')) {
                message = '请求参数错误，请检查配置';
                type = 'warning';
            } else if (error.message.includes('Notion API')) {
                message = 'Notion API 连接失败，请检查配置';
                type = 'warning';
            } else if (error.message.includes('网络连接失败')) {
                message = '网络连接失败，请检查网络设置';
                type = 'warning';
            } else if (error.message.includes('Notion API 密钥无效')) {
                message = 'Notion API 配置错误，请联系管理员';
                type = 'error';
            } else if (error.message.includes('没有访问权限')) {
                message = '没有访问 Notion 数据库的权限';
                type = 'error';
            } else if (error.message.includes('数据库不存在')) {
                message = 'Notion 数据库不存在或ID错误';
                type = 'error';
            } else if (error.message.includes('请求频率超限')) {
                message = '请求过于频繁，请稍后重试';
                type = 'warning';
            } else {
                message = `刷新失败: ${error.message}`;
                type = 'error';
            }
            
            this.uiManager.showMessage(message, type);
            
        } finally {
            // 恢复按钮状态
            this.uiManager.elements.syncBtn.disabled = false;
            this.uiManager.elements.syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    }

    // 处理键盘事件
    handleKeyboardEvents(e) {
        // ESC 键处理
        if (e.key === 'Escape') {
            // 如果搜索框有内容，优先清除搜索
            if (this.uiManager.elements.searchInput && this.uiManager.elements.searchInput.value.trim()) {
                e.preventDefault();
                this.handleSearchClear();
                return;
            }
            
            // 关闭模态框
            if (this.uiManager.elements.modal.style.display === 'flex') {
                this.uiManager.closeModal();
            }
            
            // 关闭移动端菜单
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
            let currentCard = document.activeElement.closest('.bookmark-card');
            
            // 如果没有当前选中的卡片，选择第一个卡片
            if (!currentCard) {
                const firstCard = document.querySelector('.bookmark-card');
                if (firstCard) {
                    firstCard.focus();
                    currentCard = firstCard;
                }
            }
            
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
        
        // 获取网格容器
        const gridContainer = document.querySelector('.bookmarks-grid');
        if (!gridContainer || cards.length === 0) return;
        
        // 计算实际的列数（基于容器宽度和响应式布局）
        const containerWidth = gridContainer.offsetWidth;
        const cardMinWidth = window.innerWidth <= this.constants.TABLET_BREAKPOINT 
            ? this.constants.CARD_MIN_WIDTH.MOBILE 
            : this.constants.CARD_MIN_WIDTH.DESKTOP;
        const cols = Math.max(1, Math.floor((containerWidth + this.constants.GRID_GAP) / (cardMinWidth + this.constants.GRID_GAP)));
        
        // 计算行数和当前位置
        const rows = Math.ceil(cards.length / cols);
        const currentRow = Math.floor(currentIndex / cols);
        const currentCol = currentIndex % cols;
        
        // 根据方向计算下一个索引
        switch (direction) {
            case 'ArrowUp':
                nextIndex = currentRow > 0 ? currentIndex - cols : currentIndex;
                break;
            case 'ArrowDown':
                nextIndex = currentRow < rows - 1 ? currentIndex + cols : currentIndex;
                break;
            case 'ArrowLeft':
                nextIndex = currentCol > 0 ? currentIndex - 1 : currentIndex;
                break;
            case 'ArrowRight':
                nextIndex = (currentCol < cols - 1 && currentIndex < cards.length - 1) ? currentIndex + 1 : currentIndex;
                break;
        }
        
        // 确保索引在有效范围内并更新焦点
        nextIndex = Math.max(0, Math.min(nextIndex, cards.length - 1));
        
        if (nextIndex !== currentIndex && cards[nextIndex]) {
            cards[currentIndex].blur();
            cards[currentIndex].classList.remove('keyboard-focused');
            
            cards[nextIndex].focus();
            cards[nextIndex].classList.add('keyboard-focused');
            cards[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // 处理窗口大小变化（防抖）
    handleResizeDebounced() {
        clearTimeout(this.resizeDebounceTimer);
        this.resizeDebounceTimer = setTimeout(() => {
                    // 大屏幕时自动关闭移动端菜单
        if (window.innerWidth > this.constants.MOBILE_BREAKPOINT) {
            this.uiManager.closeMobileMenu();
        }
            
            // 重新优化标签布局和检查溢出，保持展开状态
            const wasExpanded = this.uiManager.elements.tagsFilterContent?.classList.contains('expanded');
            this.uiManager.optimizeTagLayout();
            
            if (wasExpanded) {
                this.uiManager.toggleTagsExpansion(true, false);
            } else {
                this.uiManager.checkTagsOverflow();
            }
        }, this.constants.RESIZE_DEBOUNCE_DELAY);
    }

    // 处理滚动事件
    handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const backToTop = this.uiManager.elements.backToTop;
        
        // 显示/隐藏回到顶部按钮
        if (backToTop) {
            backToTop.style.display = scrollTop > this.constants.SCROLL_TO_TOP_THRESHOLD ? 'flex' : 'none';
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
            throw error; // 重新抛出错误，让调用者处理
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
        // 清理定时器
        clearTimeout(this.searchDebounceTimer);
        clearTimeout(this.resizeDebounceTimer);
        
        // 移除全局事件监听器
        window.removeEventListener('resize', this.handleResizeDebounced);
        window.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('keydown', this.handleKeyboardEvents);
        
        // 清理下拉刷新指示器
        const indicator = document.querySelector('.pull-refresh-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // 清理键盘焦点样式
        const focusedCards = document.querySelectorAll('.bookmark-card.keyboard-focused');
        focusedCards.forEach(card => {
            card.classList.remove('keyboard-focused');
        });
    }
}

// 导出事件管理器
window.EventManager = EventManager;