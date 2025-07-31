// 数据管理模块 - 处理书签数据的过滤和状态管理
class DataManager {
    constructor() {
        this.allBookmarks = [];
        this.filteredBookmarks = [];
        this.currentCategory = 'all';
        this.currentTags = [];
        this.searchQuery = '';
        
        // 缓存管理
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    // 设置所有书签数据
    setBookmarks(bookmarks) {
        this.allBookmarks = bookmarks;
        this.filterBookmarks();
    }

    // 获取所有书签
    getAllBookmarks() {
        return this.allBookmarks;
    }

    // 获取过滤后的书签
    getFilteredBookmarks() {
        return this.filteredBookmarks;
    }

    // 设置当前分类
    setCategory(category) {
        this.currentCategory = category;
        this.filterBookmarks();
    }

    // 获取当前分类
    getCurrentCategory() {
        return this.currentCategory;
    }

    // 设置当前标签
    setTags(tags) {
        this.currentTags = Array.isArray(tags) ? tags : [tags];
        this.filterBookmarks();
    }

    // 添加标签
    addTag(tag) {
        if (!this.currentTags.includes(tag)) {
            this.currentTags.push(tag);
            this.filterBookmarks();
        }
    }

    // 移除标签
    removeTag(tag) {
        this.currentTags = this.currentTags.filter(t => t !== tag);
        this.filterBookmarks();
    }

    // 清除所有标签
    clearTags() {
        this.currentTags = [];
        this.filterBookmarks();
    }

    // 获取当前标签
    getCurrentTags() {
        return this.currentTags;
    }

    // 设置搜索查询
    setSearchQuery(query) {
        this.searchQuery = query.toLowerCase().trim();
        this.filterBookmarks();
    }

    // 获取搜索查询
    getSearchQuery() {
        return this.searchQuery;
    }

    // 过滤书签（核心方法）
    filterBookmarks() {
        // 生成缓存键
        const cacheKey = `${this.currentCategory}_${this.currentTags.join(',')}_${this.searchQuery}`;
        
        // 检查缓存
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.filteredBookmarks = cached.data;
                return this.filteredBookmarks;
            }
        }

        // 执行过滤
        this.filteredBookmarks = this.allBookmarks.filter(bookmark => {
            // 分类过滤
            const categoryMatch = this.currentCategory === 'all' || 
                bookmark.category === this.currentCategory;
            
            // 标签过滤（支持多标签AND逻辑）
            const tagMatch = this.currentTags.length === 0 || 
                (bookmark.tags && bookmark.tags.length > 0 && 
                 this.currentTags.every(tag => bookmark.tags.includes(tag)));
            
            // 搜索过滤
            const searchMatch = !this.searchQuery || 
                this.searchInBookmark(bookmark, this.searchQuery);
            
            return categoryMatch && tagMatch && searchMatch;
        });

        // 缓存结果
        this.cache.set(cacheKey, {
            data: [...this.filteredBookmarks],
            timestamp: Date.now()
        });

        // 清理过期缓存
        this.cleanExpiredCache();

        return this.filteredBookmarks;
    }

    // 在书签中搜索
    searchInBookmark(bookmark, query) {
        const searchFields = [
            bookmark.title,
            bookmark.description,
            bookmark.url,
            bookmark.category
        ];

        // 在基本字段中搜索
        const basicMatch = searchFields.some(field => 
            field && field.toLowerCase().includes(query)
        );

        // 在标签中搜索
        const tagMatch = bookmark.tags && bookmark.tags.some(tag => 
            tag.toLowerCase().includes(query)
        );

        return basicMatch || tagMatch;
    }

    // 获取所有分类
    getCategories() {
        const categories = new Set();
        this.allBookmarks.forEach(bookmark => {
            if (bookmark.category) {
                categories.add(bookmark.category);
            }
        });
        return Array.from(categories).sort();
    }

    // 获取所有标签及其计数
    getTagsWithCount() {
        const tagCounts = {};
        this.allBookmarks.forEach(bookmark => {
            if (bookmark.tags) {
                bookmark.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        
        return Object.entries(tagCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([tag, count]) => ({ tag, count }));
    }

    // 根据ID查找书签
    findBookmarkById(id) {
        return this.allBookmarks.find(bookmark => bookmark.id === id);
    }

    // 获取统计信息
    getStats() {
        return {
            total: this.allBookmarks.length,
            filtered: this.filteredBookmarks.length,
            categories: this.getCategories().length,
            tags: this.getTagsWithCount().length
        };
    }

    // 清理过期缓存
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    // 清空缓存
    clearCache() {
        this.cache.clear();
    }

    // 重置所有过滤条件
    resetFilters() {
        this.currentCategory = 'all';
        this.currentTags = [];
        this.searchQuery = '';
        this.filterBookmarks();
    }

    // 导出数据（用于备份）
    exportData() {
        return {
            bookmarks: this.allBookmarks,
            filters: {
                category: this.currentCategory,
                tags: this.currentTags,
                search: this.searchQuery
            },
            timestamp: Date.now()
        };
    }

    // 导入数据（用于恢复）
    importData(data) {
        if (data.bookmarks) {
            this.allBookmarks = data.bookmarks;
        }
        if (data.filters) {
            this.currentCategory = data.filters.category || 'all';
            this.currentTags = data.filters.tags || [];
            this.searchQuery = data.filters.search || '';
        }
        this.filterBookmarks();
    }
}

// 导出数据管理器
window.DataManager = DataManager;