// UI 组件模块 - 处理DOM操作和渲染
class UIManager {
    constructor() {
        // 安全获取DOM元素，避免null引用错误
        this.elements = {};
        
        try {
            this.elements = {
                bookmarksGrid: document.getElementById('bookmarksGrid'),
                categoryMenu: document.getElementById('categoryMenu'),
                tagMenu: document.getElementById('tagMenu'),
                searchInput: document.getElementById('searchInput'),
                pageTitle: document.getElementById('pageTitle'),
                syncBtn: document.getElementById('syncBtn'),
                backToTop: document.getElementById('backToTop'),
                loading: document.getElementById('loading'),
                modal: document.getElementById('bookmarkModal'),
                modalTitle: document.getElementById('modalTitle'),
                modalBody: document.getElementById('modalBody'),
                modalClose: document.getElementById('modalClose'),
                menuToggle: document.getElementById('menuToggle'),
                sidebar: document.getElementById('sidebar'),
                sidebarOverlay: document.getElementById('sidebarOverlay')
            };
        } catch (error) {
            console.warn('UIManager: 部分DOM元素获取失败:', error);
        }
        
        this.lazyLoadObserver = null;
        this.initLazyLoading();
    }

    // 初始化懒加载
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.lazyLoadObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            this.lazyLoadObserver.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
        }
    }

    // 显示加载状态
    showLoading(show = true) {
        if (this.elements.loading) {
            this.elements.loading.style.display = show ? 'flex' : 'none';
        }
    }

    // 创建书签卡片
    createBookmarkCard(bookmark) {
        // 安全检查
        if (!bookmark || typeof bookmark !== 'object') {
            console.warn('createBookmarkCard: 无效的书签数据', bookmark);
            return document.createElement('div');
        }
        
        const tagsHTML = bookmark.tags && Array.isArray(bookmark.tags) ? bookmark.tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('') : '';
        
        const card = document.createElement('div');
        card.className = 'bookmark-card';
        card.dataset.id = bookmark.id || '';
        
        // 安全获取URL主机名
        let hostname = '';
        try {
            hostname = bookmark.url ? new URL(bookmark.url).hostname : '未知网站';
        } catch (e) {
            hostname = '未知网站';
        }
        
        // 安全格式化日期
        let formattedDate = '未知日期';
        try {
            if (bookmark.createdTime) {
                formattedDate = new Date(bookmark.createdTime).toLocaleDateString('zh-CN');
            }
        } catch (e) {
            formattedDate = '未知日期';
        }
        
        card.innerHTML = `
            <div class="bookmark-header">
                <div class="bookmark-favicon">
                    <img alt="" class="favicon" 
                         src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23f0f0f0'/%3E%3C/svg%3E">
                </div>
                <div class="bookmark-info">
                    <h3 class="bookmark-title">${bookmark.title || '无标题'}</h3>
                    <p class="bookmark-url">${hostname}</p>
                </div>
            </div>
            <div class="bookmark-content">
                <p class="bookmark-description">${bookmark.description || '暂无描述'}</p>
                <div class="bookmark-tags">${tagsHTML}</div>
            </div>
            <div class="bookmark-footer">
                <span class="bookmark-category">${bookmark.category || '未分类'}</span>
                <span class="bookmark-date">${formattedDate}</span>
            </div>
        `;
        
        // 异步加载favicon，不阻塞卡片渲染
        const faviconImg = card.querySelector('.favicon');
        if (faviconImg && bookmark.url) {
            // 立即返回卡片，favicon异步加载
            requestAnimationFrame(() => {
                this.loadFaviconWithFallback(faviconImg, bookmark.url);
            });
        }
        
        return card;
    }

    // 渲染书签网格
    renderBookmarks(bookmarks) {
        if (!this.elements.bookmarksGrid) return;
        
        this.showLoading(false);
        
        if (bookmarks.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // 使用文档片段提高性能
        const fragment = document.createDocumentFragment();
        
        bookmarks.forEach(bookmark => {
            const card = this.createBookmarkCard(bookmark);
            fragment.appendChild(card);
        });
        
        this.elements.bookmarksGrid.innerHTML = '';
        this.elements.bookmarksGrid.appendChild(fragment);
        
        // 重新绑定事件
        this.bindBookmarkEvents();
        
        // 应用懒加载（如果可用）
        if (window.setupBookmarksLazyLoading) {
            window.setupBookmarksLazyLoading(bookmarks);
        }
    }

    // 显示空状态
    showEmptyState() {
        this.elements.bookmarksGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bookmark"></i>
                <h3>暂无书签数据</h3>
                <p>请检查 Notion 数据库配置，或在数据库中添加书签内容。</p>
            </div>
        `;
    }

    // 更新标签菜单
    updateTagMenu(allBookmarks, currentTags) {
        const tagCounts = {};
        allBookmarks.forEach(bookmark => {
            if (bookmark.tags) {
                bookmark.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        
        const sortedTags = Object.entries(tagCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);
        
        const tagMenuHtml = sortedTags.map(([tag, count]) => `
            <li class="menu-item tag-item" data-tag="${tag}">
                <i class="fas fa-tag"></i>
                <span>${tag}</span>
                <span class="tag-count">${count}</span>
            </li>
        `).join('');
        
        const clearAllHtml = currentTags.length > 0 ? `
            <li class="menu-item" id="clearTags">
                <i class="fas fa-times-circle"></i>
                <span>清除选择</span>
            </li>
        ` : '';
        
        this.elements.tagMenu.innerHTML = clearAllHtml + tagMenuHtml;
        
        // 更新选中状态
        currentTags.forEach(tag => {
            const tagElement = this.elements.tagMenu.querySelector(`[data-tag="${tag}"]`);
            if (tagElement) {
                tagElement.classList.add('selected');
            }
        });
    }

    // 显示书签详情模态框
    showBookmarkDetails(bookmark) {
        this.elements.modalTitle.textContent = bookmark.title;
        
        const tagsHTML = bookmark.tags ? bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : '';
        const createdDate = new Date(bookmark.createdTime).toLocaleString('zh-CN');
        const editedDate = new Date(bookmark.lastEditedTime).toLocaleString('zh-CN');
        
        this.elements.modalBody.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div class="bookmark-favicon">
                        <img src="${this.getFaviconUrl(bookmark.url)}" alt="" class="favicon">
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">${bookmark.title}</h3>
                        <a href="${bookmark.url}" target="_blank" style="color: #2eaadc; text-decoration: none; font-size: 14px;">
                            ${bookmark.url}
                        </a>
                    </div>
                </div>
                
                ${bookmark.description ? `
                    <div style="margin-bottom: 16px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">描述</h4>
                        <p style="margin: 0; line-height: 1.6;">${bookmark.description}</p>
                    </div>
                ` : ''}
                
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">分类</h4>
                    <span class="category-tag">${bookmark.category || '未分类'}</span>
                </div>
                
                ${bookmark.tags && bookmark.tags.length > 0 ? `
                    <div style="margin-bottom: 16px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">标签</h4>
                        <div class="bookmark-tags">${tagsHTML}</div>
                    </div>
                ` : ''}
                
                <div style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px;">
                    <div>创建时间: ${createdDate}</div>
                    <div>最后编辑: ${editedDate}</div>
                </div>
            </div>
        `;
        
        this.elements.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // 关闭模态框
    closeModal() {
        this.elements.modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    // 更新页面标题
    updatePageTitle(category, tags) {
        let title = '全部书签';
        
        if (category !== 'all') {
            title = `${category} 书签`;
        }
        
        if (tags.length > 0) {
            const tagText = tags.join(', ');
            title += ` · ${tagText}`;
        }
        
        this.elements.pageTitle.textContent = title;
        document.title = `${title} - ${window.siteConfig?.siteTitle || '书签管理'}`;
    }

    // 更新结果统计
    updateResultsCount(filteredCount, totalCount) {
        const existingCount = document.querySelector('.results-count');
        if (existingCount) {
            existingCount.remove();
        }
        
        if (filteredCount !== totalCount) {
            const countElement = document.createElement('span');
            countElement.className = 'results-count';
            countElement.textContent = `(${filteredCount}/${totalCount})`;
            countElement.style.cssText = 'color: #666; font-size: 14px; margin-left: 8px;';
            this.elements.pageTitle.appendChild(countElement);
        }
    }

    // 显示消息提示
    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        messageDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : '#3742fa'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    // 获取网站图标URL
    getFaviconUrl(url) {
        try {
            const domain = new URL(url).hostname;
            // 只使用Google和原站点的API
            const apis = [
                `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
                `https://${domain}/favicon.ico`
            ];
            return apis[0]; // 默认使用第一个API
        } catch {
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"%3E%3Crect width="16" height="16" fill="%23ddd"/%3E%3C/svg%3E';
        }
    }
    
    // 智能favicon加载，支持多个API备用，不阻止页面渲染
    loadFaviconWithFallback(imgElement, url) {
        if (!imgElement || !url) return;
        
        // 异步加载，不阻止页面渲染
        setTimeout(() => {
            try {
                const domain = new URL(url).hostname;
                const apis = [
                    `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
                    `https://${domain}/favicon.ico`
                ];
                
                let currentApiIndex = 0;
                let loadTimeout;
                
                const setDefaultIcon = () => {
                    imgElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"%3E%3Crect width="16" height="16" fill="%23ddd"/%3E%3C/svg%3E';
                    imgElement.classList.add('favicon-loaded');
                };
                
                const tryNextApi = () => {
                    // 清除之前的超时
                    if (loadTimeout) {
                        clearTimeout(loadTimeout);
                    }
                    
                    if (currentApiIndex >= apis.length) {
                        // 所有API都失败，使用默认图标
                        setDefaultIcon();
                        return;
                    }
                    
                    // 设置加载超时（2秒，避免长时间等待）
                     loadTimeout = setTimeout(() => {
                         currentApiIndex++;
                         tryNextApi();
                     }, 2000);
                    
                    const testImg = new Image();
                    testImg.onload = () => {
                        clearTimeout(loadTimeout);
                        imgElement.src = apis[currentApiIndex];
                        imgElement.classList.add('favicon-loaded');
                    };
                    testImg.onerror = () => {
                        clearTimeout(loadTimeout);
                        currentApiIndex++;
                        tryNextApi();
                    };
                    testImg.src = apis[currentApiIndex];
                };
                
                // 开始尝试加载
                tryNextApi();
                
            } catch (error) {
                console.warn('Favicon加载失败:', error);
                imgElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="16" height="16"%3E%3Crect width="16" height="16" fill="%23ddd"/%3E%3C/svg%3E';
                imgElement.classList.add('favicon-loaded');
            }
        }, 0); // 异步执行，不阻止页面渲染
    }

    // 切换移动端菜单
    toggleMobileMenu() {
        if (this.elements.sidebar && this.elements.sidebarOverlay) {
            this.elements.sidebar.classList.toggle('active');
            this.elements.sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = this.elements.sidebar.classList.contains('active') ? 'hidden' : '';
        }
    }

    // 关闭移动端菜单
    closeMobileMenu() {
        if (this.elements.sidebar && this.elements.sidebarOverlay) {
            this.elements.sidebar.classList.remove('active');
            this.elements.sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    // 更新分类计数
    // 更新分类菜单
    updateCategoryMenu(allBookmarks, currentCategory) {
        if (!this.elements.categoryMenu) return;
        
        // 获取所有分类
        const categories = new Set();
        allBookmarks.forEach(bookmark => {
            if (bookmark.category) {
                categories.add(bookmark.category);
            }
        });
        
        const sortedCategories = Array.from(categories).sort();
        
        // 生成分类菜单HTML
        let categoryMenuHtml = `
            <li class="menu-item ${currentCategory === 'all' ? 'active' : ''}" data-category="all">
                <i class="fas fa-home"></i>
                <span>全部</span>
                <span class="item-count">${allBookmarks.length}</span>
            </li>
        `;
        
        sortedCategories.forEach(category => {
            const count = allBookmarks.filter(bookmark => bookmark.category === category).length;
            categoryMenuHtml += `
                <li class="menu-item ${currentCategory === category ? 'active' : ''}" data-category="${category}">
                    <i class="fas fa-folder"></i>
                    <span>${category}</span>
                    <span class="item-count">${count}</span>
                </li>
            `;
        });
        
        this.elements.categoryMenu.innerHTML = categoryMenuHtml;
    }

    updateCategoryCounts() {
        // 获取所有分类元素并隐藏计数显示
        const categoryElements = document.querySelectorAll('[data-category]');
        
        // 隐藏所有计数显示
        categoryElements.forEach(element => {
            const countElement = element.querySelector('.item-count');
            if (countElement) {
                countElement.textContent = '';
            }
        });
    }

    // 初始化事件监听器
    initEventListeners() {
        // 搜索功能
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', this.debounce((e) => {
                if (this.filterBookmarks) {
                    this.filterBookmarks(e.target.value);
                }
            }, 300));
            
            // 清除按钮功能
            const clearBtn = document.querySelector('.search-clear');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    this.elements.searchInput.value = '';
                    if (this.filterBookmarks) {
                        this.filterBookmarks('');
                    }
                    this.elements.searchInput.focus();
                });
            }
        }
        
        // 分类切换和二级分类支持
        const categoryItems = document.querySelectorAll('.menu-item[data-category]');
        categoryItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const category = item.dataset.category;
                this.switchCategory(category);
            });
        });
        
        // 二级分类切换按钮
        const categoryToggles = document.querySelectorAll('.category-toggle');
        categoryToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentItem = toggle.closest('.category-parent');
                const submenu = parentItem.querySelector('.submenu');
                const isExpanded = parentItem.classList.contains('expanded');
                
                if (isExpanded) {
                    parentItem.classList.remove('expanded');
                    submenu.style.maxHeight = '0';
                } else {
                    parentItem.classList.add('expanded');
                    submenu.style.maxHeight = submenu.scrollHeight + 'px';
                }
            });
        });
        
        // 子分类点击
        const submenuItems = document.querySelectorAll('.submenu-item');
        submenuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const category = item.dataset.category;
                this.switchCategory(category);
            });
        });
        
        // 移动端菜单切换
        if (this.elements.menuToggle) {
            this.elements.menuToggle.addEventListener('click', () => {
                this.toggleMobileMenu();
            });
        }
        
        if (this.elements.sidebarOverlay) {
            this.elements.sidebarOverlay.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        }
        
        // 模态框关闭
        if (this.elements.modalClose) {
            this.elements.modalClose.addEventListener('click', () => {
                this.closeModal();
            });
        }
        
        // 点击模态框背景关闭
        if (this.elements.modal) {
            this.elements.modal.addEventListener('click', (e) => {
                if (e.target === this.elements.modal) {
                    this.closeModal();
                }
            });
        }
        
        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modal.style.display === 'flex') {
                this.closeModal();
            }
        });
    }
    
    // 绑定书签事件
    bindBookmarkEvents() {
        // 这个方法用于绑定书签卡片的事件
        // 由于事件处理已经通过事件委托在EventManager中处理
        // 这里保持空实现以避免错误
    }
    
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// 导出UI管理器
window.UIManager = UIManager;