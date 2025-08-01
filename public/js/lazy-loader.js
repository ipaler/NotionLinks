// 懒加载工具模块 - 实现图片和内容的懒加载
class LazyLoader {
    constructor(options = {}) {
        this.options = {
            rootMargin: '50px',
            threshold: 0.1,
            imageSelector: 'img[data-src]',
            contentSelector: '[data-lazy]',
            loadingClass: 'lazy-loading',
            loadedClass: 'lazy-loaded',
            errorClass: 'lazy-error',
            ...options
        };
        
        this.observer = null;
        this.loadedImages = new Set();
        this.loadingImages = new Set();
        
        this.init();
    }

    // 初始化懒加载
    init() {
        if (!('IntersectionObserver' in window)) {
            console.warn('浏览器不支持 IntersectionObserver，回退到立即加载');
            this.fallbackLoad();
            return;
        }

        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                rootMargin: this.options.rootMargin,
                threshold: this.options.threshold
            }
        );

        this.observeElements();
    }

    // 观察需要懒加载的元素
    observeElements() {
        // 观察图片
        const images = document.querySelectorAll(this.options.imageSelector);
        images.forEach(img => {
            this.observer.observe(img);
        });

        // 观察内容元素
        const contents = document.querySelectorAll(this.options.contentSelector);
        contents.forEach(element => {
            this.observer.observe(element);
        });
    }

    // 处理元素进入视口
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const element = entry.target;
                
                if (element.tagName === 'IMG') {
                    this.loadImage(element);
                } else {
                    this.loadContent(element);
                }
                
                this.observer.unobserve(element);
            }
        });
    }

    // 加载图片
    async loadImage(img) {
        const src = img.dataset.src;
        if (!src || this.loadingImages.has(src) || this.loadedImages.has(src)) {
            return;
        }

        this.loadingImages.add(src);
        img.classList.add(this.options.loadingClass);

        try {
            // 预加载图片
            await this.preloadImage(src);
            
            // 设置图片源
            img.src = src;
            img.classList.remove(this.options.loadingClass);
            img.classList.add(this.options.loadedClass);
            
            // 移除 data-src 属性
            delete img.dataset.src;
            
            this.loadedImages.add(src);
            
        } catch (error) {
            console.error(`❌ 图片加载失败: ${src}`, error);
            img.classList.remove(this.options.loadingClass);
            img.classList.add(this.options.errorClass);
            
            // 设置错误占位图
            this.setErrorPlaceholder(img);
            
        } finally {
            this.loadingImages.delete(src);
        }
    }

    // 预加载图片
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            
            // 设置超时
            setTimeout(() => {
                reject(new Error(`Image load timeout: ${src}`));
            }, 10000);
            
            img.src = src;
        });
    }

    // 设置错误占位图
    setErrorPlaceholder(img) {
        // 创建SVG占位图
        const placeholder = this.createErrorPlaceholder();
        img.src = placeholder;
        img.alt = '图片加载失败';
    }

    // 创建错误占位图SVG
    createErrorPlaceholder() {
        const svg = `
            <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f8f9fa"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" 
                      fill="#6c757d" text-anchor="middle" dy=".3em">
                    图片加载失败
                </text>
            </svg>
        `;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    // 加载内容
    loadContent(element) {
        const lazyType = element.dataset.lazy;
        
        element.classList.add(this.options.loadingClass);
        
        try {
            switch (lazyType) {
                case 'fade-in':
                    this.fadeInContent(element);
                    break;
                case 'slide-up':
                    this.slideUpContent(element);
                    break;
                case 'scale':
                    this.scaleContent(element);
                    break;
                default:
                    this.showContent(element);
            }
            
            element.classList.remove(this.options.loadingClass);
            element.classList.add(this.options.loadedClass);
            
            // 移除 data-lazy 属性
            delete element.dataset.lazy;
            
        } catch (error) {
            console.error('内容加载失败:', error);
            element.classList.remove(this.options.loadingClass);
            element.classList.add(this.options.errorClass);
        }
    }

    // 淡入动画
    fadeInContent(element) {
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s ease-in-out';
        
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            // 确保opacity被正确设置
            setTimeout(() => {
                if (element.style.opacity !== '1') {
                    element.style.opacity = '1';
                }
            }, 50);
        });
    }

    // 上滑动画
    slideUpContent(element) {
        element.style.transform = 'translateY(20px)';
        element.style.opacity = '0';
        element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        
        requestAnimationFrame(() => {
            element.style.transform = 'translateY(0)';
            element.style.opacity = '1';
        });
    }

    // 缩放动画
    scaleContent(element) {
        element.style.transform = 'scale(0.9)';
        element.style.opacity = '0';
        element.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        
        requestAnimationFrame(() => {
            element.style.transform = 'scale(1)';
            element.style.opacity = '1';
        });
    }

    // 显示内容
    showContent(element) {
        element.style.visibility = 'visible';
        element.style.opacity = '1';
    }

    // 回退加载（不支持 IntersectionObserver 时）
    fallbackLoad() {
        // 立即加载所有图片
        const images = document.querySelectorAll(this.options.imageSelector);
        images.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                delete img.dataset.src;
            }
        });

        // 立即显示所有内容
        const contents = document.querySelectorAll(this.options.contentSelector);
        contents.forEach(element => {
            this.showContent(element);
            delete element.dataset.lazy;
        });
    }

    // 添加新元素到观察列表
    observe(element) {
        if (this.observer && element) {
            this.observer.observe(element);
        }
    }

    // 移除元素观察
    unobserve(element) {
        if (this.observer && element) {
            this.observer.unobserve(element);
        }
    }

    // 刷新观察列表
    refresh() {
        if (this.observer) {
            this.observer.disconnect();
            this.observeElements();
        }
    }

    // 获取加载统计
    getStats() {
        return {
            loadedImages: this.loadedImages.size,
            loadingImages: this.loadingImages.size,
            totalObserved: document.querySelectorAll(
                `${this.options.imageSelector}, ${this.options.contentSelector}`
            ).length
        };
    }

    // 预加载指定图片
    async preloadImages(urls) {
        const promises = urls.map(url => this.preloadImage(url));
        
        try {
            await Promise.all(promises);
        } catch (error) {
            console.warn('部分图片预加载失败:', error);
        }
    }

    // 销毁懒加载器
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        this.loadedImages.clear();
        this.loadingImages.clear();
    }
}

// 工具函数：为书签卡片添加懒加载
function addLazyLoadingToBookmark(bookmarkElement, bookmark) {
    // 为网站图标添加懒加载
    const favicon = bookmarkElement.querySelector('.bookmark-favicon');
    if (favicon && bookmark.url) {
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`;
        favicon.setAttribute('data-src', faviconUrl);
        favicon.removeAttribute('src');
        
        // 添加加载占位符
        favicon.style.backgroundColor = '#f8f9fa';
        favicon.style.border = '1px solid #dee2e6';
    }
    
    // 为整个书签卡片添加懒加载动画
    bookmarkElement.setAttribute('data-lazy', 'fade-in');
    bookmarkElement.style.opacity = '0';
}

// 工具函数：批量处理书签懒加载
function setupBookmarksLazyLoading(bookmarks) {
    const bookmarkElements = document.querySelectorAll('.bookmark-card');
    
    bookmarkElements.forEach((element, index) => {
        if (bookmarks[index]) {
            addLazyLoadingToBookmark(element, bookmarks[index]);
        }
    });
    
    // 确保懒加载器被正确初始化
    if (window.lazyLoader) {
        window.lazyLoader.refresh();
    } else {
        // 如果没有懒加载器，立即显示所有卡片
        bookmarkElements.forEach(element => {
            element.style.opacity = '1';
            element.removeAttribute('data-lazy');
        });
    }
}

// 导出懒加载器
window.LazyLoader = LazyLoader;
window.addLazyLoadingToBookmark = addLazyLoadingToBookmark;
window.setupBookmarksLazyLoading = setupBookmarksLazyLoading;