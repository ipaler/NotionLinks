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
        
        // 清除缓存，确保重新过滤
        this.clearCache();
        
        // 重新过滤书签
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

    // 切换标签选择状态
    toggleTag(tag) {
        if (this.currentTags.includes(tag)) {
            this.removeTag(tag);
        } else {
            this.addTag(tag);
        }
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
        let filtered = this.allBookmarks.filter(bookmark => {
            // 分类过滤
            const categoryMatch = this.currentCategory === 'all' || 
                bookmark.category === this.currentCategory;
            
            // 标签过滤（支持多标签OR逻辑）
            const tagMatch = this.currentTags.length === 0 || 
                (bookmark.tags && bookmark.tags.length > 0 && 
                 this.currentTags.some(tag => bookmark.tags.includes(tag)));
            
            // 搜索过滤
            const searchMatch = !this.searchQuery || 
                this.searchInBookmark(bookmark, this.searchQuery);
            
            return categoryMatch && tagMatch && searchMatch;
        });

        // 如果是"全部"分类，按分类分组
        if (this.currentCategory === 'all') {
            const grouped = this.groupBookmarksByCategory(filtered);
            this.filteredBookmarks = grouped;
        } else {
            // 对于特定分类，也使用分组格式，但只有一个分组
            this.filteredBookmarks = [{
                category: this.currentCategory,
                bookmarks: filtered
            }];
        }

        // 缓存结果
        this.cache.set(cacheKey, {
            data: [...this.filteredBookmarks],
            timestamp: Date.now()
        });

        // 清理过期缓存
        this.cleanExpiredCache();

        return this.filteredBookmarks;
    }

    // 按分类分组书签
    groupBookmarksByCategory(bookmarks) {
        const groups = {};
        
        // 初始化分组
        groups['未分类'] = [];
        
        bookmarks.forEach(bookmark => {
            const category = bookmark.category || '未分类';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(bookmark);
        });

        // 转换为数组格式，按分类名称排序
        const sortedCategories = Object.keys(groups).sort((a, b) => {
            if (a === '未分类') return 1;
            if (b === '未分类') return -1;
            return a.localeCompare(b, 'zh-CN');
        });

        return sortedCategories.map(category => ({
            category: category,
            bookmarks: groups[category]
        }));
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