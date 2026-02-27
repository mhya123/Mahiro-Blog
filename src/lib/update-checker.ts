/**
 * 文章更新检测器
 * 客户端工具，通过获取 RSS 并与 localStorage 缓存对比来检测文章变更
 */

const CACHE_KEY = 'blog-articles-cache';
const CHANGES_KEY = 'blog-articles-changes';
const LAST_CHECK_KEY = 'blog-last-check';

export interface CachedArticle {
    guid: string;
    title: string;
    description: string;
    pubDate: string;
    link: string;
}

export interface ArticleChange {
    guid: string;
    title: string;
    link: string;
    type: 'new' | 'update';
    oldTitle?: string;
    oldDescription?: string;
    newDescription?: string;
    detectedAt: string;
}

/**
 * 解析 RSS XML 为文章列表
 */
function parseRSS(xmlText: string): CachedArticle[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = doc.querySelectorAll('item');
    const articles: CachedArticle[] = [];

    items.forEach((item) => {
        const guid = item.querySelector('guid')?.textContent || item.querySelector('link')?.textContent || '';
        const title = item.querySelector('title')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';

        if (guid) {
            articles.push({ guid, title, description, pubDate, link });
        }
    });

    return articles;
}

/**
 * 获取缓存的文章列表
 */
function getCache(): CachedArticle[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * 保存缓存
 */
function setCache(articles: CachedArticle[]): void {
    localStorage.setItem(CACHE_KEY, JSON.stringify(articles));
}

/**
 * 获取已检测到的变更列表
 */
export function getChanges(): ArticleChange[] {
    try {
        const raw = localStorage.getItem(CHANGES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * 保存变更列表
 */
function setChanges(changes: ArticleChange[]): void {
    localStorage.setItem(CHANGES_KEY, JSON.stringify(changes));
}

/**
 * 获取上次检查时间
 */
export function getLastCheckTime(): string | null {
    return localStorage.getItem(LAST_CHECK_KEY);
}

/**
 * 清空所有变更，将当前 RSS 标记为已读
 */
export async function markAllRead(): Promise<void> {
    setChanges([]);
    // 重新获取最新 RSS 并缓存，确保下次对比用最新数据
    try {
        const res = await fetch('/rss.xml');
        if (res.ok) {
            const xml = await res.text();
            const articles = parseRSS(xml);
            setCache(articles);
        }
    } catch {
        // 忽略错误
    }
}

/**
 * 获取 RSS 并与缓存对比，返回变更列表
 */
export async function fetchAndCompare(): Promise<ArticleChange[]> {
    try {
        const res = await fetch('/rss.xml', { cache: 'no-store' });
        if (!res.ok) return getChanges();

        const xml = await res.text();
        const latestArticles = parseRSS(xml);
        const cached = getCache();
        const now = new Date().toISOString();

        localStorage.setItem(LAST_CHECK_KEY, now);

        // 首次访问：初始化缓存，不产生任何变更
        if (cached.length === 0) {
            setCache(latestArticles);
            return [];
        }

        // 建立缓存索引
        const cachedMap = new Map<string, CachedArticle>();
        cached.forEach((a) => cachedMap.set(a.guid, a));

        // 保留已有的、仍然有效的变更
        const existingChanges = getChanges();
        const existingMap = new Map<string, ArticleChange>();
        existingChanges.forEach((c) => existingMap.set(c.guid, c));

        const newChanges: ArticleChange[] = [];

        for (const article of latestArticles) {
            const old = cachedMap.get(article.guid);

            if (!old) {
                // 新文章
                if (!existingMap.has(article.guid)) {
                    newChanges.push({
                        guid: article.guid,
                        title: article.title,
                        link: article.link,
                        type: 'new',
                        detectedAt: now,
                    });
                } else {
                    newChanges.push(existingMap.get(article.guid)!);
                }
            } else {
                // 检查是否有变化
                const titleChanged = old.title !== article.title;
                const descChanged = old.description !== article.description;
                const dateChanged = old.pubDate !== article.pubDate;

                if (titleChanged || descChanged || dateChanged) {
                    newChanges.push({
                        guid: article.guid,
                        title: article.title,
                        link: article.link,
                        type: 'update',
                        oldTitle: titleChanged ? old.title : undefined,
                        oldDescription: descChanged ? old.description : undefined,
                        newDescription: descChanged ? article.description : undefined,
                        detectedAt: existingMap.get(article.guid)?.detectedAt || now,
                    });
                }
            }
        }

        setChanges(newChanges);
        // 注意：不更新缓存，直到用户点击"标记已读"

        return newChanges;
    } catch (error) {
        console.warn('Update check failed:', error);
        return getChanges();
    }
}
