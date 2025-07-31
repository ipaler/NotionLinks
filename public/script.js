// API 配置 - 使用安全的后端代理
const API_CONFIG = {
    baseUrl: '/api',
    endpoints: {
        bookmarks: '/api/bookmarks',
        health: '/api/health',
        config: '/api/config'
    }
};

// 网站配置
let siteConfig = {
    siteTitle: 'NotionLinks'
};

// 全局变量
let allBookmarks = [];
let filteredBookmarks = [];
let currentCategory = 'all';
let currentTags = [];

// DOM 元素
const elements = {
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

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    loadSiteConfig();
    loadBookmarks();
    setupScrollToTop();
}

// 设置事件监听器
function setupEventListeners() {
    // 分类菜单点击
    elements.categoryMenu.addEventListener('click', handleCategoryClick);
    
    // 标签菜单点击
    elements.tagMenu.addEventListener('click', handleTagClick);
    
    // 搜索输入
    elements.searchInput.addEventListener('input', handleSearch);
    
    // 同步按钮
    elements.syncBtn.addEventListener('click', syncData);
    
    // 返回顶部
    elements.backToTop.addEventListener('click', scrollToTop);
    
    // 移动端菜单切换
    elements.menuToggle.addEventListener('click', toggleMobileMenu);
    elements.sidebarOverlay.addEventListener('click', closeMobileMenu);
    
    // 模态框关闭
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', function(e) {
        if (e.target === elements.modal) {
            closeModal();
        }
    });
    
    // ESC 键关闭模态框和移动端菜单
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeMobileMenu();
        }
    });
    
    // 窗口大小改变时关闭移动端菜单
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

// 从后端 API 加载网站配置
async function loadSiteConfig() {
    try {
        const response = await fetch(API_CONFIG.endpoints.config);
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                siteConfig = result.data;
                updateSiteTitle();
            }
        }
    } catch (error) {
        console.warn('加载网站配置失败，使用默认配置:', error);
    }
}

// 更新网站标题
function updateSiteTitle() {
    // 更新页面标题
    document.title = siteConfig.siteTitle;
    
    // 更新头部logo文字
    const logoSpan = document.querySelector('.logo span');
    if (logoSpan) {
        logoSpan.textContent = siteConfig.siteTitle;
    }
}

// 从后端 API 加载书签数据
async function loadBookmarks() {
    try {
        showLoading(true);
        
        // 从安全的后端 API 获取数据
        const response = await fetch(API_CONFIG.endpoints.bookmarks);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            allBookmarks = result.data;
        } else {
            throw new Error(result.message || '获取数据失败');
        }
        
        filteredBookmarks = [...allBookmarks];
        renderBookmarks();
        updateTagMenu();
        showLoading(false);
        
    } catch (error) {
        console.error('加载书签失败:', error);
        // 数据加载失败时显示空状态
        allBookmarks = [];
        filteredBookmarks = [];
        renderBookmarks();
        updateTagMenu();
        showLoading(false);
        showMessage('数据加载失败，请检查Notion配置', 'error');
    }
}

// 获取网站图标 URL
function getFaviconUrl(url) {
    if (!url) return '';
    try {
        const domain = new URL(url).hostname;
        // 只使用Google和原站点的API
        const apis = [
            `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            `https://${domain}/favicon.ico`
        ];
        return apis[0]; // 默认使用第一个API
    } catch {
        return '';
    }
}



// 渲染书签
function renderBookmarks() {
    if (filteredBookmarks.length === 0) {
        showEmptyState();
        return;
    }
    
    const bookmarksHTML = filteredBookmarks.map(bookmark => createBookmarkCard(bookmark)).join('');
    elements.bookmarksGrid.innerHTML = bookmarksHTML;
    
    // 添加点击事件
    elements.bookmarksGrid.addEventListener('click', handleBookmarkClick);
}

// 创建书签卡片
function createBookmarkCard(bookmark) {
    const tagsHTML = bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    const createdDate = new Date(bookmark.createdTime).toLocaleDateString('zh-CN');
    
    return `
        <div class="bookmark-card" data-id="${bookmark.id}">
            <div class="bookmark-header">
                <div class="bookmark-favicon">
                    ${bookmark.favicon ? 
                        `<img src="${bookmark.favicon}" alt="" onerror="this.style.display='none'">` : 
                        '<i class="fas fa-globe"></i>'
                    }
                </div>
                <div class="bookmark-info">
                    <div class="bookmark-title">${bookmark.title}</div>
                    <a href="${bookmark.url}" class="bookmark-url" target="_blank" onclick="event.stopPropagation()">
                        ${bookmark.url}
                    </a>
                </div>
            </div>
            
            ${bookmark.description ? `<div class="bookmark-description">${bookmark.description}</div>` : ''}
            
            ${bookmark.tags.length > 0 ? `<div class="bookmark-tags">${tagsHTML}</div>` : ''}
            
            <div class="bookmark-meta">
                <span class="bookmark-category">${bookmark.category}</span>
                <span class="bookmark-date">${createdDate}</span>
            </div>
        </div>
    `;
}

// 显示空状态
function showEmptyState() {
    elements.bookmarksGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-bookmark"></i>
            <h3>暂无书签</h3>
            <p>请在 Notion 数据库中添加书签，或检查搜索条件</p>
        </div>
    `;
}

// 处理分类点击
function handleCategoryClick(e) {
    const menuItem = e.target.closest('.menu-item');
    if (!menuItem) return;
    
    // 更新活动状态
    elements.categoryMenu.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    menuItem.classList.add('active');
    
    // 更新当前分类
    currentCategory = menuItem.dataset.category;
    
    // 更新页面标题
    updatePageTitle();
    
    // 过滤书签
    filterBookmarks();
}

// 更新页面标题
function updatePageTitle() {
    let title = '';
    
    // 分类标题
    if (currentCategory === 'all') {
        title = '全部书签';
    } else {
        title = `${currentCategory}书签`;
    }
    
    // 添加标签信息
    if (currentTags.length > 0) {
        const tagText = currentTags.length === 1 ? 
            `标签: ${currentTags[0]}` : 
            `标签: ${currentTags.slice(0, 2).join(', ')}${currentTags.length > 2 ? ` +${currentTags.length - 2}` : ''}`;
        title += ` · ${tagText}`;
    }
    
    elements.pageTitle.textContent = title;
}

// 更新结果统计
function updateResultsCount(filteredCount, totalCount) {
    const existingCount = document.querySelector('.results-count');
    if (existingCount) {
        existingCount.remove();
    }
    
    if (filteredCount !== totalCount) {
        const countElement = document.createElement('span');
        countElement.className = 'results-count';
        countElement.textContent = `(${filteredCount}/${totalCount})`;
        elements.pageTitle.appendChild(countElement);
    }
}

// 处理标签点击
function handleTagClick(e) {
    const tagItem = e.target.closest('.menu-item');
    if (!tagItem) return;
    
    // 处理清除选择
    if (tagItem.id === 'clearTags') {
        currentTags = [];
        updateTagMenu();
        filterBookmarks();
        updatePageTitle();
        return;
    }
    
    if (!tagItem.dataset.tag) return;
    
    const tag = tagItem.dataset.tag;
    
    // 切换标签选择状态（支持多选）
    if (currentTags.includes(tag)) {
        currentTags = currentTags.filter(t => t !== tag);
        tagItem.classList.remove('selected');
    } else {
        currentTags.push(tag);
        tagItem.classList.add('selected');
    }
    
    // 更新菜单显示
    updateTagMenu();
    
    // 过滤书签
    filterBookmarks();
    
    // 更新页面标题
    updatePageTitle();
}

// 处理搜索
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    filterBookmarks(query);
}

// 过滤书签
function filterBookmarks(searchQuery = '') {
    filteredBookmarks = allBookmarks.filter(bookmark => {
        // 分类过滤
        const categoryMatch = currentCategory === 'all' || bookmark.category === currentCategory;
        
        // 标签过滤（支持多标签AND逻辑）
        const tagMatch = currentTags.length === 0 || 
            (bookmark.tags && bookmark.tags.length > 0 && 
             currentTags.every(tag => bookmark.tags.includes(tag)));
        
        // 搜索过滤
        const searchMatch = !searchQuery || 
            bookmark.title.toLowerCase().includes(searchQuery) ||
            (bookmark.description && bookmark.description.toLowerCase().includes(searchQuery)) ||
            bookmark.url.toLowerCase().includes(searchQuery) ||
            (bookmark.tags && bookmark.tags.some(tag => tag.toLowerCase().includes(searchQuery)));
        
        return categoryMatch && tagMatch && searchMatch;
    });
    
    renderBookmarks();
    
    // 更新结果统计
    updateResultsCount(filteredBookmarks.length, allBookmarks.length);
}

// 更新标签菜单
function updateTagMenu() {
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
        .slice(0, 20); // 限制显示前20个标签
    
    const tagMenuHtml = sortedTags.map(([tag, count]) => `
        <li class="menu-item tag-item" data-tag="${tag}">
            <i class="fas fa-tag"></i>
            <span>${tag}</span>
            <span class="tag-count">${count}</span>
        </li>
    `).join('');
    
    // 添加清除标签选择的选项
    const clearAllHtml = currentTags.length > 0 ? `
        <li class="menu-item" id="clearTags">
            <i class="fas fa-times-circle"></i>
            <span>清除选择</span>
        </li>
    ` : '';
    
    elements.tagMenu.innerHTML = clearAllHtml + tagMenuHtml;
    
    // 更新选中状态
    currentTags.forEach(tag => {
        const tagElement = elements.tagMenu.querySelector(`[data-tag="${tag}"]`);
        if (tagElement) {
            tagElement.classList.add('selected');
        }
    });
}

// 处理书签点击
function handleBookmarkClick(e) {
    const card = e.target.closest('.bookmark-card');
    if (!card) return;
    
    const bookmarkId = card.dataset.id;
    const bookmark = allBookmarks.find(b => b.id === bookmarkId);
    
    if (bookmark) {
        showBookmarkDetails(bookmark);
    }
}

// 显示书签详情
function showBookmarkDetails(bookmark) {
    elements.modalTitle.textContent = bookmark.title;
    
    const tagsHTML = bookmark.tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    const createdDate = new Date(bookmark.createdTime).toLocaleString('zh-CN');
    const editedDate = new Date(bookmark.lastEditedTime).toLocaleString('zh-CN');
    
    elements.modalBody.innerHTML = `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div class="bookmark-favicon">
                    ${bookmark.favicon ? 
                        `<img src="${bookmark.favicon}" alt="" onerror="this.style.display='none'">` : 
                        '<i class="fas fa-globe"></i>'
                    }
                </div>
                <a href="${bookmark.url}" target="_blank" style="color: #2eaadc; text-decoration: none; font-weight: 500;">
                    ${bookmark.url}
                </a>
            </div>
            
            ${bookmark.description ? `<p style="color: #6f6e69; line-height: 1.5; margin-bottom: 16px;">${bookmark.description}</p>` : ''}
            
            <div style="margin-bottom: 16px;">
                <strong style="color: #37352f;">分类：</strong>
                <span class="bookmark-category">${bookmark.category}</span>
            </div>
            
            ${bookmark.tags.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <strong style="color: #37352f;">标签：</strong>
                    <div style="margin-top: 8px;">${tagsHTML}</div>
                </div>
            ` : ''}
            
            <div style="font-size: 12px; color: #9b9a97; border-top: 1px solid #e9e9e7; padding-top: 16px;">
                <div>创建时间：${createdDate}</div>
                <div>更新时间：${editedDate}</div>
            </div>
        </div>
    `;
    
    elements.modal.classList.add('show');
}

// 关闭模态框
function closeModal() {
    elements.modal.classList.remove('show');
}

// 同步数据
async function syncData() {
    elements.syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    elements.syncBtn.disabled = true;
    
    try {
        await loadBookmarks();
        showMessage('数据同步成功！', 'success');
    } catch (error) {
        showMessage('数据同步失败，请稍后重试', 'error');
    } finally {
        elements.syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        elements.syncBtn.disabled = false;
    }
}

// 设置返回顶部功能
function setupScrollToTop() {
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            elements.backToTop.classList.add('show');
        } else {
            elements.backToTop.classList.remove('show');
        }
    });
}

// 返回顶部
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 显示加载状态
function showLoading(show) {
    if (show) {
        elements.loading.style.display = 'flex';
    } else {
        elements.loading.style.display = 'none';
    }
}

// 显示错误信息
function showError(message) {
    elements.bookmarksGrid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>加载失败</h3>
            <p>${message}</p>
        </div>
    `;
}

// 显示消息提示
function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    messageEl.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#2eaadc'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 3000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s;
    `;
    
    document.body.appendChild(messageEl);
    
    // 显示动画
    setTimeout(() => {
        messageEl.style.transform = 'translateX(0)';
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        messageEl.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(messageEl);
        }, 300);
    }, 3000);
}

// 移动端菜单切换
function toggleMobileMenu() {
    const isOpen = elements.sidebar.classList.contains('show');
    if (isOpen) {
        closeMobileMenu();
    } else {
        openMobileMenu();
    }
}

// 打开移动端菜单
function openMobileMenu() {
    elements.sidebar.classList.add('show');
    elements.sidebarOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// 关闭移动端菜单
function closeMobileMenu() {
    elements.sidebar.classList.remove('show');
    elements.sidebarOverlay.classList.remove('show');
    document.body.style.overflow = '';
}