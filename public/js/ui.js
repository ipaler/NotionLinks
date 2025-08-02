// UI 组件模块 - 处理DOM操作和渲染
class UIManager {
    constructor() {
        // 安全获取DOM元素，避免null引用错误
        this.elements = {};
        
        // favicon缓存
        this.faviconCache = new Map();
        
        // 标签展开状态管理
        this.tagsExpansionState = {
            userExpanded: false, // 用户是否主动展开
            autoCollapse: false  // 是否允许自动收起
        };
        
        try {
            this.elements = {
                bookmarksGrid: document.getElementById('bookmarksGrid'),
                categoryMenu: document.getElementById('categoryMenu'),
                tagsFilterBar: document.getElementById('tagsFilterBar'),
                tagsFilterContent: document.getElementById('tagsFilterContent'),
                clearTagsBtn: document.getElementById('clearTagsBtn'),
                expandTagsBtn: document.getElementById('expandTagsBtn'),
                searchInput: document.getElementById('searchInput'),
                searchClear: document.getElementById('searchClear'),
                pageTitle: document.getElementById('pageTitle'),
                syncBtn: document.getElementById('syncBtn'),
                diagnoseBtn: document.getElementById('diagnoseBtn'),
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
            // 静默处理DOM元素获取失败
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
            return document.createElement('div');
        }
        
        // 限制标签显示数量为5个
        const allTags = bookmark.tags && Array.isArray(bookmark.tags) ? bookmark.tags : [];
        const displayTags = allTags.slice(0, 5);
        const hasMoreTags = allTags.length > 5;
        
        const tagsHTML = displayTags.map(tag => `<span class="tag">${tag}</span>`).join('');
        const tagsClass = hasMoreTags ? 'bookmark-tags has-more' : 'bookmark-tags';
        
        const card = document.createElement('div');
        card.className = 'bookmark-card';
        card.dataset.id = bookmark.id || '';
        card.tabIndex = 0; // 使卡片可以通过Tab键聚焦
        
        // 安全获取URL主机名
        let hostname = '';
        try {
            hostname = bookmark.url ? new URL(bookmark.url).hostname : '未知网站';
        } catch (e) {
            hostname = '未知网站';
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
                <div class="bookmark-actions">
                    <button class="bookmark-quick-access" title="快速访问" data-url="${bookmark.url || ''}">
                        <i class="fas fa-external-link-alt"></i>
                        <span>直达</span>
                    </button>
                </div>
            </div>
            <div class="bookmark-content">
                <p class="bookmark-description">${bookmark.description || '暂无描述'}</p>
                <div class="${tagsClass}">${tagsHTML}</div>
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
        if (!this.elements.bookmarksGrid) {
            console.error('bookmarksGrid元素不存在');
            return;
        }
        
        this.showLoading(false);
        
        if (!bookmarks || bookmarks.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // 使用文档片段提高性能
        const fragment = document.createDocumentFragment();
        
        // 检查是否为分组数据
        if (Array.isArray(bookmarks) && bookmarks.length > 0 && bookmarks[0].category && bookmarks[0].bookmarks) {
            // 分组数据
            bookmarks.forEach(group => {
                // 创建分组标题
                const groupHeader = document.createElement('div');
                groupHeader.className = 'bookmark-group-header';
                groupHeader.innerHTML = `
                    <h3 class="group-title">${group.category} <span class="group-count">${group.bookmarks.length} 个书签</span></h3>
                `;
                fragment.appendChild(groupHeader);
                
                // 创建分组容器
                const groupContainer = document.createElement('div');
                groupContainer.className = 'bookmark-group';
                
                // 添加书签卡片
                group.bookmarks.forEach(bookmark => {
                    const card = this.createBookmarkCard(bookmark);
                    groupContainer.appendChild(card);
                });
                
                fragment.appendChild(groupContainer);
            });
        } else {
            // 普通书签数组
            bookmarks.forEach(bookmark => {
                const card = this.createBookmarkCard(bookmark);
                fragment.appendChild(card);
            });
        }
        
        this.elements.bookmarksGrid.innerHTML = '';
        this.elements.bookmarksGrid.appendChild(fragment);
        
        // 重新绑定事件
        this.bindBookmarkEvents();
        
        // 紧急修复：确保所有卡片都能显示
        setTimeout(() => {
            const cards = this.elements.bookmarksGrid.querySelectorAll('.bookmark-card');
            cards.forEach(card => {
                if (card.style.opacity === '0' || card.style.opacity === '') {
                    card.style.opacity = '1';
                    card.removeAttribute('data-lazy');
                }
            });
        }, 100);
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
        
        // 更新标签筛选栏
        const filterTagsHtml = sortedTags.map(([tag, count]) => `
            <div class="filter-tag ${currentTags.includes(tag) ? 'selected' : ''}" data-tag="${tag}">
                <span>${tag}</span>
                <span class="tag-count">${count}</span>
            </div>
        `).join('');
        
        if (this.elements.tagsFilterContent) {
            this.elements.tagsFilterContent.innerHTML = filterTagsHtml;
        }
        
        // 更新清除按钮显示状态
        if (this.elements.clearTagsBtn) {
            this.elements.clearTagsBtn.style.display = currentTags.length > 0 ? 'flex' : 'none';
        }
        
        // 更新选中状态
        currentTags.forEach(tag => {
            const filterTagElement = this.elements.tagsFilterContent?.querySelector(`[data-tag="${tag}"]`);
            if (filterTagElement) {
                filterTagElement.classList.add('selected');
            }
        });
        
        // 优化标签布局并检查是否需要显示展开按钮
        setTimeout(() => {
            const wasExpanded = this.elements.tagsFilterContent.classList.contains('expanded');
            this.optimizeTagLayout();
            
            // 如果之前是展开状态，保持展开
            if (wasExpanded) {
                this.toggleTagsExpansion(true, false);
            } else {
                this.checkTagsOverflow();
            }
        }, 50);
    }

    // 显示书签详情
    showBookmarkDetails(bookmark) {
        if (!this.elements.modal || !this.elements.modalTitle || !this.elements.modalBody) {
            return;
        }
        
        // 安全获取URL主机名
        let hostname = '';
        try {
            hostname = bookmark.url ? new URL(bookmark.url).hostname : '未知网站';
        } catch (e) {
            hostname = '未知网站';
        }
        
        // 安全格式化日期
        let formattedDate = '未知日期';
        let lastEditedDate = '未知日期';
        try {
            if (bookmark.createdTime) {
                formattedDate = new Date(bookmark.createdTime).toLocaleString('zh-CN');
            }
            if (bookmark.lastEditedTime) {
                lastEditedDate = new Date(bookmark.lastEditedTime).toLocaleString('zh-CN');
            }
        } catch (e) {
            formattedDate = '未知日期';
            lastEditedDate = '未知日期';
        }
        
        const tagsHTML = bookmark.tags && Array.isArray(bookmark.tags) ? bookmark.tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('') : '';
        
        this.elements.modalTitle.textContent = bookmark.title || '无标题';
        this.elements.modalBody.innerHTML = `
            <div class="bookmark-detail-header">
                <div class="bookmark-detail-favicon">
                    <img alt="" class="favicon" 
                         src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23f0f0f0'/%3E%3C/svg%3E">
                    </div>
                <div class="bookmark-detail-info">
                    <h3>${bookmark.title || '无标题'}</h3>
                    <p class="bookmark-detail-url">
                        <a href="${bookmark.url || '#'}" target="_blank" rel="noopener noreferrer">
                            ${hostname}
                        </a>
                    </p>
                </div>
                    </div>
            <div class="bookmark-detail-content">
                <div class="detail-section">
                    <h4>描述</h4>
                    <p>${bookmark.description || '暂无描述'}</p>
                </div>
                <div class="detail-section">
                    <h4>分类</h4>
                    <p>${bookmark.category || '未分类'}</p>
                    </div>
                <div class="detail-section">
                    <h4>标签</h4>
                    <div class="bookmark-detail-tags">${tagsHTML}</div>
                </div>
                <div class="detail-section">
                    <h4>创建时间</h4>
                    <p>${formattedDate}</p>
                    </div>
                <div class="detail-section">
                    <h4>最后编辑</h4>
                    <p>${lastEditedDate}</p>
                </div>
            </div>
            <div class="bookmark-detail-actions">
                <button class="detail-action-btn primary" onclick="window.open('${bookmark.url || '#'}', '_blank')">
                    <i class="fas fa-external-link-alt"></i>
                    访问网站
                </button>
                <button class="detail-action-btn secondary" onclick="navigator.clipboard.writeText('${bookmark.url || ''}')">
                    <i class="fas fa-copy"></i>
                    复制链接
                </button>
            </div>
            <div class="usage-tips">
                <h4>💡 使用提示</h4>
                <ul>
                    <li><strong>快速访问：</strong>悬停卡片右上角会出现快速访问按钮</li>
                    <li><strong>双击卡片：</strong>直接在新标签页打开链接</li>
                    <li><strong>键盘导航：</strong>使用Tab键和方向键导航，Enter键快速访问</li>
                    <li><strong>搜索：</strong>按Ctrl+K快速聚焦搜索框</li>
                </ul>
            </div>
        `;
        
        // 异步加载favicon
        const faviconImg = this.elements.modalBody.querySelector('.favicon');
        if (faviconImg && bookmark.url) {
            this.loadFaviconWithFallback(faviconImg, bookmark.url);
        }
        
        this.elements.modal.style.display = 'flex';
        
        // 添加复制链接的成功提示
        const copyBtn = this.elements.modalBody.querySelector('.detail-action-btn.secondary');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                this.showMessage('链接已复制到剪贴板！', 'success');
            });
        }
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
            title = `${category}`;
        }
        
        this.elements.pageTitle.textContent = title;
        document.title = `${title} - ${window.siteConfig?.siteTitle || '书签管理'}`;
    }

    // 显示消息提示
    showMessage(message, type = 'info', duration = 5000) {
        // 移除现有的消息
        const existingMessage = document.querySelector('.message-toast');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建消息元素
        const messageElement = document.createElement('div');
        messageElement.className = `message-toast message-${type}`;
        
        // 根据类型设置图标
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        else if (type === 'error') icon = 'exclamation-triangle';
        else if (type === 'warning') icon = 'exclamation-circle';
        
        messageElement.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
            <button class="message-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // 添加到页面
        document.body.appendChild(messageElement);

        // 显示动画
        setTimeout(() => {
            messageElement.classList.add('show');
        }, 10);

        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                this.hideMessage(messageElement);
            }, duration);
        }

        // 点击关闭
        const closeBtn = messageElement.querySelector('.message-close');
        closeBtn.addEventListener('click', () => {
            this.hideMessage(messageElement);
        });

        return messageElement;
    }

    // 隐藏消息提示
    hideMessage(messageElement) {
        if (messageElement && messageElement.parentNode) {
            messageElement.classList.remove('show');
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
    }

    // 显示网络状态
    showNetworkStatus(status) {
        const statusElement = document.querySelector('.network-status');
        if (statusElement) {
            statusElement.remove();
        }

        const element = document.createElement('div');
        element.className = `network-status network-${status.isOnline ? 'online' : 'offline'}`;
        
        element.innerHTML = `
            <i class="fas fa-${status.isOnline ? 'wifi' : 'wifi-slash'}"></i>
            <span>${status.isOnline ? '网络已连接' : '网络已断开'}</span>
        `;

        document.body.appendChild(element);

        // 3秒后自动隐藏
        setTimeout(() => {
            this.hideNetworkStatus(element);
        }, 3000);

        return element;
    }

    // 隐藏网络状态
    hideNetworkStatus(statusElement) {
        if (statusElement && statusElement.parentNode) {
            statusElement.classList.add('fade-out');
            setTimeout(() => {
                if (statusElement.parentNode) {
                    statusElement.remove();
                }
            }, 300);
        }
    }

    // 管理搜索清除按钮的显示/隐藏
    toggleSearchClearButton(show) {
        if (this.elements.searchClear) {
            if (show) {
                this.elements.searchClear.style.display = 'flex';
                this.elements.searchClear.style.opacity = '1';
                this.elements.searchClear.style.pointerEvents = 'auto';
                
                // 移动端优化：确保按钮可见且可点击
                if (window.innerWidth <= 768) {
                    this.elements.searchClear.style.zIndex = '10';
                }
            } else {
                this.elements.searchClear.style.opacity = '0';
                this.elements.searchClear.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (this.elements.searchClear) {
                        this.elements.searchClear.style.display = 'none';
                        this.elements.searchClear.style.zIndex = '2';
                    }
                }, 300);
            }
        }
    }

    // 管理标签展开状态
    toggleTagsExpansion(expanded, isUserAction = false) {
        if (this.elements.tagsFilterContent) {
            if (expanded) {
                this.elements.tagsFilterContent.classList.add('expanded');
                this.elements.tagsFilterContent.style.maxHeight = 'none';
                // 展开时显示所有标签
                const tags = this.elements.tagsFilterContent.querySelectorAll('.filter-tag');
                tags.forEach(tag => {
                    tag.style.display = 'flex';
                });
                
                // 如果是用户操作，标记为用户展开
                if (isUserAction) {
                    this.tagsExpansionState.userExpanded = true;
                    this.tagsExpansionState.autoCollapse = false;
                }
            } else {
                this.elements.tagsFilterContent.classList.remove('expanded');
                // 收起时重新优化布局
                this.optimizeTagLayout();
                
                // 如果是用户操作，重置状态
                if (isUserAction) {
                    this.tagsExpansionState.userExpanded = false;
                    this.tagsExpansionState.autoCollapse = true;
                }
                
                // 延迟检查，避免立即触发自动收起
                setTimeout(() => {
                    this.checkTagsOverflow();
                }, 100);
            }
        }
        
        if (this.elements.expandTagsBtn) {
            if (expanded) {
                this.elements.expandTagsBtn.style.display = 'flex';
                this.elements.expandTagsBtn.classList.add('expanded');
                this.elements.expandTagsBtn.innerHTML = '<i class="fas fa-chevron-up"></i><span>收起</span>';
                this.elements.expandTagsBtn.disabled = false;
                this.elements.expandTagsBtn.style.opacity = '1';
            } else {
                this.elements.expandTagsBtn.classList.remove('expanded');
                this.elements.expandTagsBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>展开</span>';
                this.elements.expandTagsBtn.disabled = false;
                this.elements.expandTagsBtn.style.opacity = '1';
                // 收起时检查是否需要隐藏按钮
                setTimeout(() => {
                    this.checkTagsOverflow();
                }, 50);
            }
        }
    }

    // 优化标签布局
    optimizeTagLayout() {
        if (!this.elements.tagsFilterContent) return;
        
        const content = this.elements.tagsFilterContent;
        const tags = content.querySelectorAll('.filter-tag');
        
        if (tags.length === 0) return;
        
        // 计算容器宽度和标签间距
        const containerWidth = content.offsetWidth;
        const gap = 6; // CSS中设置的gap值
        
        // 计算每个标签的宽度（包括间距）
        let totalWidth = 0;
        const tagWidths = [];
        
        tags.forEach(tag => {
            const tagWidth = tag.offsetWidth;
            tagWidths.push(tagWidth);
            totalWidth += tagWidth + gap;
        });
        
        // 如果总宽度超过容器宽度，需要调整
        if (totalWidth > containerWidth) {
            // 计算可以容纳的标签数量
            let currentWidth = 0;
            let visibleCount = 0;
            
            for (let i = 0; i < tagWidths.length; i++) {
                if (currentWidth + tagWidths[i] + gap <= containerWidth) {
                    currentWidth += tagWidths[i] + gap;
                    visibleCount++;
                } else {
                    break;
                }
            }
            
            // 隐藏超出第一行的标签
            tags.forEach((tag, index) => {
                if (index >= visibleCount) {
                    tag.style.display = 'none';
                } else {
                    tag.style.display = 'flex';
                }
            });
        } else {
            // 显示所有标签
            tags.forEach(tag => {
                tag.style.display = 'flex';
            });
        }
    }

    // 检查是否需要显示展开按钮
    checkTagsOverflow() {
        if (!this.elements.tagsFilterContent || !this.elements.expandTagsBtn) return;
        
        const content = this.elements.tagsFilterContent;
        const isExpanded = content.classList.contains('expanded');
        
        // 计算一行的高度（标签高度 + gap）
        const firstTag = content.querySelector('.filter-tag');
        if (!firstTag) {
            // 如果没有标签，隐藏展开按钮
            this.elements.expandTagsBtn.style.display = 'none';
            return;
        }
        
        const tagHeight = firstTag.offsetHeight;
        const gap = 6; // CSS中设置的gap值
        const singleLineHeight = tagHeight + gap;
        
        // 设置默认状态下的max-height为一行高度
        if (!isExpanded) {
            content.style.maxHeight = singleLineHeight + 'px';
        }
        
        // 检查是否有隐藏的标签
        const tags = content.querySelectorAll('.filter-tag');
        const hiddenTags = Array.from(tags).filter(tag => tag.style.display === 'none');
        
        if (isExpanded) {
            // 如果已展开，只有在允许自动收起且内容确实不需要展开时才自动收起
            if (this.tagsExpansionState.autoCollapse) {
                const containerWidth = content.offsetWidth;
                let totalWidth = 0;
                tags.forEach(tag => {
                    totalWidth += tag.offsetWidth + gap;
                });
                
                // 只有当所有标签都能在一行显示时才自动收起
                if (totalWidth <= containerWidth) {
                    this.toggleTagsExpansion(false);
                }
            }
        } else {
            // 如果未展开，检查是否需要展开按钮
            if (hiddenTags.length === 0) {
                // 没有隐藏的标签，检查是否所有标签都能在一行显示
                const containerWidth = content.offsetWidth;
                let totalWidth = 0;
                tags.forEach(tag => {
                    totalWidth += tag.offsetWidth + gap;
                });
                
                if (totalWidth <= containerWidth) {
                    // 所有标签都能在一行显示，隐藏按钮
                    this.elements.expandTagsBtn.style.display = 'none';
                } else {
                    // 标签超过一行但被隐藏了，显示"无更多"
                    this.elements.expandTagsBtn.style.display = 'flex';
                    this.elements.expandTagsBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>无更多</span>';
                    this.elements.expandTagsBtn.disabled = true;
                    this.elements.expandTagsBtn.style.opacity = '0.5';
                }
            } else {
                // 有隐藏的标签，显示"展开"
                this.elements.expandTagsBtn.style.display = 'flex';
                this.elements.expandTagsBtn.innerHTML = '<i class="fas fa-chevron-down"></i><span>展开</span>';
                this.elements.expandTagsBtn.disabled = false;
                this.elements.expandTagsBtn.style.opacity = '1';
            }
        }
    }
    
    // 智能favicon加载，支持多个API备用，不阻止页面渲染
    loadFaviconWithFallback(imgElement, url) {
        if (!imgElement || !url) return;
        
        try {
            const domain = new URL(url).hostname;
            
            // 检查缓存
            if (this.faviconCache.has(domain)) {
                const cachedFavicon = this.faviconCache.get(domain);
                imgElement.src = cachedFavicon;
                imgElement.classList.add('favicon-loaded');
                return;
            }
            
            // 异步加载，不阻止页面渲染
            setTimeout(() => {
                try {
                    // 多个favicon源，按优先级尝试
                    const faviconSources = [
                        `https://${domain}/favicon.ico`,
                        `https://${domain}/favicon.png`,
                        `https://${domain}/apple-touch-icon.png`
                    ];
                    
                    let loadTimeout;
                    let currentSourceIndex = 0;
                    let isCompleted = false;
                    
                    const setDefaultIcon = () => {
                        if (isCompleted) return;
                        isCompleted = true;
                        clearTimeout(loadTimeout);
                        // 使用本站的favicon.svg作为默认图标
                        const defaultIcon = '/favicon-simple.svg';
                        this.faviconCache.set(domain, defaultIcon);
                        imgElement.src = defaultIcon;
                        imgElement.classList.add('favicon-loaded');
                    };
                    
                    const tryNextSource = () => {
                        if (isCompleted) return;
                        
                        if (currentSourceIndex >= faviconSources.length) {
                            // 所有源都尝试失败，使用默认图标
                            setDefaultIcon();
                            return;
                        }
                        
                        const faviconUrl = faviconSources[currentSourceIndex];
                        currentSourceIndex++;
                        
                        const testImg = new Image();
                        testImg.onload = () => {
                            if (isCompleted) return;
                            isCompleted = true;
                            clearTimeout(loadTimeout);
                            // 缓存成功的favicon
                            this.faviconCache.set(domain, faviconUrl);
                            imgElement.src = faviconUrl;
                            imgElement.classList.add('favicon-loaded');
                        };
                        testImg.onerror = () => {
                            // 尝试下一个源
                            setTimeout(tryNextSource, 100); // 添加小延迟避免过快请求
                        };
                        testImg.src = faviconUrl;
                    };
                    
                    // 设置加载超时（5秒，避免长时间等待）
                    loadTimeout = setTimeout(() => {
                        setDefaultIcon();
                    }, 5000);
                    
                    // 开始尝试第一个源
                    tryNextSource();
                    
                } catch (error) {
                    // 静默处理favicon加载失败
                    // 使用本站的favicon.svg作为默认图标
                    const defaultIcon = '/favicon-simple.svg';
                    this.faviconCache.set(domain, defaultIcon);
                    imgElement.src = defaultIcon;
                    imgElement.classList.add('favicon-loaded');
                }
            }, 0); // 异步执行，不阻止页面渲染
            
        } catch (error) {
            // 静默处理favicon加载失败
            // 使用本站的favicon.svg作为默认图标
            imgElement.src = '/favicon-simple.svg';
            imgElement.classList.add('favicon-loaded');
        }
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
    
    // 更新分类菜单
    updateCategoryMenu(allBookmarks, currentCategory) {
        if (!this.elements.categoryMenu) {
            console.error('categoryMenu元素不存在');
            return;
        }
        
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
            </li>
        `;
        
        sortedCategories.forEach(category => {
            categoryMenuHtml += `
                <li class="menu-item ${currentCategory === category ? 'active' : ''}" data-category="${category}">
                    <i class="fas fa-folder"></i>
                    <span>${category}</span>
                </li>
            `;
        });
        
        // 保存当前滚动位置
        const scrollTop = this.elements.categoryMenu.scrollTop;
        
        this.elements.categoryMenu.innerHTML = categoryMenuHtml;
        
        // 恢复滚动位置
        this.elements.categoryMenu.scrollTop = scrollTop;
    }

    // 网络诊断
    async performNetworkDiagnosis() {
        const results = {
            browserOnline: navigator.onLine,
            timestamp: new Date().toISOString(),
            tests: []
        };

        // 测试1: 基本网络连接
        try {
            const startTime = Date.now();
            const response = await fetch('/api/health', { 
                method: 'GET',
                cache: 'no-cache'
            });
            const endTime = Date.now();
            
            results.tests.push({
                name: '本地服务器连接',
                success: response.ok,
                latency: endTime - startTime,
                status: response.status,
                error: response.ok ? null : `HTTP ${response.status}`
            });
        } catch (error) {
            results.tests.push({
                name: '本地服务器连接',
                success: false,
                latency: null,
                status: null,
                error: error.message
            });
        }

        // 测试2: Notion API 连接
        try {
            const startTime = Date.now();
            const response = await fetch('/api/bookmarks', { 
                method: 'GET',
                cache: 'no-cache'
            });
            const endTime = Date.now();
            
            results.tests.push({
                name: 'Notion API 连接',
                success: response.ok,
                latency: endTime - startTime,
                status: response.status,
                error: response.ok ? null : `HTTP ${response.status}`
            });
        } catch (error) {
            results.tests.push({
                name: 'Notion API 连接',
                success: false,
                latency: null,
                status: null,
                error: error.message
            });
        }



        return results;
    }

    // 显示网络诊断结果
    showNetworkDiagnosis(results) {
        const modal = document.getElementById('bookmarkModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        if (!modal || !modalTitle || !modalBody) return;

        modalTitle.textContent = '网络诊断结果';
        
        const successCount = results.tests.filter(test => test.success).length;
        const totalCount = results.tests.length;
        
        modalBody.innerHTML = `
            <div class="diagnosis-summary">
                <div class="diagnosis-header">
                    <h3>诊断概览</h3>
                    <div class="diagnosis-status ${successCount === totalCount ? 'success' : 'warning'}">
                        <i class="fas fa-${successCount === totalCount ? 'check-circle' : 'exclamation-triangle'}"></i>
                        <span>${successCount}/${totalCount} 项测试通过</span>
                    </div>
                </div>
                
                <div class="diagnosis-details">
                    <div class="diagnosis-item">
                        <strong>浏览器网络状态:</strong>
                        <span class="${results.browserOnline ? 'success' : 'error'}">
                            <i class="fas fa-${results.browserOnline ? 'wifi' : 'wifi-slash'}"></i>
                            ${results.browserOnline ? '在线' : '离线'}
                        </span>
                    </div>
                    <div class="diagnosis-item">
                        <strong>诊断时间:</strong>
                        <span>${new Date(results.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="diagnosis-tests">
                <h4>详细测试结果</h4>
                ${results.tests.map(test => `
                    <div class="test-item ${test.success ? 'success' : 'error'}">
                        <div class="test-header">
                            <span class="test-name">${test.name}</span>
                            <span class="test-status">
                                <i class="fas fa-${test.success ? 'check' : 'times'}"></i>
                                ${test.success ? '通过' : '失败'}
                            </span>
                        </div>
                        <div class="test-details">
                            ${test.latency ? `<span>延迟: ${test.latency}ms</span>` : ''}
                            ${test.status ? `<span>状态: ${test.status}</span>` : ''}
                            ${test.error ? `<span class="error">错误: ${test.error}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="diagnosis-actions">
                <button class="diagnosis-retry" id="diagnosisRetryBtn">
                    <i class="fas fa-redo"></i>
                    重新诊断
                </button>
                <button class="diagnosis-close" id="diagnosisCloseBtn">
                    <i class="fas fa-times"></i>
                    关闭
                </button>
            </div>
        `;

        // 绑定重新诊断按钮事件
        const retryBtn = modalBody.querySelector('#diagnosisRetryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', async () => {
                await this.handleDiagnosisRetry(retryBtn);
            });
        }

        // 绑定关闭按钮事件
        const closeBtn = modalBody.querySelector('#diagnosisCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        modal.classList.add('show');
    }

    // 处理重新诊断
    async handleDiagnosisRetry(retryBtn) {
        try {
            // 显示加载状态
            retryBtn.disabled = true;
            retryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 诊断中...';
            
            // 显示加载消息
            this.showMessage('正在执行网络诊断...', 'info', 2000);
            
            // 执行诊断
            const results = await this.performNetworkDiagnosis();
            
            // 更新诊断结果
            this.showNetworkDiagnosis(results);
            
            // 显示成功消息
            this.showMessage('网络诊断完成', 'success', 3000);
            
        } catch (error) {
            console.error('重新诊断失败:', error);
            this.showMessage('重新诊断失败，请稍后重试', 'error');
            
            // 恢复按钮状态
            retryBtn.disabled = false;
            retryBtn.innerHTML = '<i class="fas fa-redo"></i> 重新诊断';
        }
    }
    
    // 绑定书签事件
    bindBookmarkEvents() {
        // 为所有书签卡片添加点击事件（包括分组中的卡片）
        const cards = this.elements.bookmarksGrid.querySelectorAll('.bookmark-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是快速访问按钮，不显示详情
                if (e.target.closest('.bookmark-quick-access')) {
                    return;
                }
                
                const bookmarkId = card.dataset.id;
                if (bookmarkId && this.showBookmarkDetails) {
                    // 这里需要从数据管理器获取书签详情
                    // 暂时使用卡片数据
                    const bookmarkData = {
                        id: bookmarkId,
                        title: card.querySelector('.bookmark-title')?.textContent || '无标题',
                        url: card.querySelector('.bookmark-quick-access')?.dataset.url || '#',
                        description: card.querySelector('.bookmark-description')?.textContent || '暂无描述',
                        tags: Array.from(card.querySelectorAll('.tag')).map(tag => tag.textContent)
                    };
                    this.showBookmarkDetails(bookmarkData);
                }
            });
        });
    }
}

// 导出UI管理器
window.UIManager = UIManager;