import * as Diff from 'diff';

const DB_NAME = 'mahiro-rss-store';
const DB_VERSION = 1;
const STORE_NAME = 'posts';

const CHANGES_KEY = 'blog-articles-changes';
const LAST_CHECK_KEY = 'blog-last-check';

export interface CachedArticle {
    guid: string;
    title: string;
    description: string;
    pubDate: string;
    link: string;
    content: string;
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
    diff?: any; // The diff payload if any
}

// 初始化并打开数据库
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'guid' });
            }
        };
    });
}

// 读取数据库中的文章
function getStoredPosts(db: IDBDatabase, storeName: string): Promise<CachedArticle[]> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 写入数据库文章
function setStoredPosts(db: IDBDatabase, storeName: string, posts: CachedArticle[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        posts.forEach(post => store.put(post));

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function fetchRSSRaw(): Promise<CachedArticle[]> {
    try {
        const response = await fetch('/rss.xml', { cache: 'no-store' });
        const text = await response.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');

        const items = Array.from(xml.querySelectorAll('item'));

        return items.map(item => {
            const title = item.querySelector('title')?.textContent || '';
            const link = (item.querySelector('link')?.textContent || '').trim();
            const guid = (item.querySelector('guid')?.textContent || link).trim();
            const description = item.querySelector('description')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';

            // 兼容多种 RSS 格式的正文提取
            let contentEncoded = item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0]?.textContent;
            let content = contentEncoded ||
                item.getElementsByTagName('content:encoded')[0]?.textContent ||
                item.querySelector('content')?.textContent || '';

            return { title, link, guid, description, pubDate, content };
        });
    } catch (e) {
        console.error('Failed to fetch RSS:', e);
        return [];
    }
}

function computeDiff(oldText: string, newText: string) {
    if (!oldText || !newText) return null;

    // 清洗和标准化 HTML 内容
    const normalizeForDiffHtml = (html: string) => {
        const s = String(html || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${s}</div>`, "text/html");
        const root = doc.body.firstElementChild;
        if (!root) return s;

        const lines: string[] = [];
        for (const el of Array.from(root.children)) {
            const htmlLine = String(el.outerHTML || "")
                .replace(/\r\n/g, "\n")
                .replace(/\r/g, "\n")
                .replace(/\n+/g, " ")
                .replace(/[ \t]+/g, " ")
                .trim();
            if (htmlLine) lines.push(htmlLine);
        }
        return lines.join("\n");
    };

    const cleanOld = normalizeForDiffHtml(oldText);
    const cleanNew = normalizeForDiffHtml(newText);

    if (!cleanOld || !cleanNew) return null;

    // 使用 Diff 库进行逐行比对
    const diffs = Diff.diffLines(cleanOld, cleanNew);
    const hasChanges = diffs.some((part: any) => part.added || part.removed);

    return hasChanges ? diffs : null;
}

export function getChanges(): ArticleChange[] {
    try {
        const raw = localStorage.getItem(CHANGES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function setChanges(changes: ArticleChange[]): void {
    localStorage.setItem(CHANGES_KEY, JSON.stringify(changes));
}

export function getLastCheckTime(): string | null {
    return localStorage.getItem(LAST_CHECK_KEY);
}

export async function markAllRead(): Promise<void> {
    setChanges([]);
    try {
        const articles = await fetchRSSRaw();
        if (articles.length > 0) {
            const db = await openDB();
            await setStoredPosts(db, STORE_NAME, articles);
        }
    } catch (e) {
        console.error('Failed to mark all read:', e);
    }
}

export async function fetchAndCompare(): Promise<ArticleChange[]> {
    try {
        const res = await fetch('/rss.xml', { cache: 'no-store', method: 'HEAD' });
        if (!res.ok) return getChanges();

        const currentPosts = await fetchRSSRaw();
        if (currentPosts.length === 0) return getChanges();

        const db = await openDB();
        const storedPosts = await getStoredPosts(db, STORE_NAME);
        const now = new Date().toISOString();

        localStorage.setItem(LAST_CHECK_KEY, now);

        if (storedPosts.length === 0) {
            await setStoredPosts(db, STORE_NAME, currentPosts);
            return [];
        }

        const storedMap = new Map<string, CachedArticle>();
        storedPosts.forEach(a => storedMap.set(a.guid, a));

        const existingChanges = getChanges();
        const existingMap = new Map<string, ArticleChange>();
        existingChanges.forEach(c => existingMap.set(c.guid, c));

        const detectedChanges: ArticleChange[] = [];

        currentPosts.forEach(post => {
            const stored = storedMap.get(post.guid);

            if (!stored) {
                if (!existingMap.has(post.guid)) {
                    detectedChanges.push({
                        guid: post.guid,
                        title: post.title,
                        link: post.link,
                        type: 'new',
                        detectedAt: now
                    });
                } else {
                    detectedChanges.push(existingMap.get(post.guid)!);
                }
            } else {
                const titleChanged = post.title !== stored.title;
                const descriptionChanged = post.description !== stored.description;
                const contentChanged = post.content !== stored.content;

                if (titleChanged || descriptionChanged || contentChanged) {
                    const result: any = {};
                    let hasChanges = false;
                    let existingChange = existingMap.get(post.guid);

                    if (contentChanged) {
                        const d = computeDiff(stored.content, post.content);
                        if (d) {
                            result.content = d;
                            hasChanges = true;
                        }
                    }

                    if (hasChanges || titleChanged || descriptionChanged) {
                        detectedChanges.push({
                            guid: post.guid,
                            title: post.title,
                            link: post.link,
                            type: 'update',
                            oldTitle: titleChanged ? stored.title : (existingChange?.oldTitle || undefined),
                            oldDescription: descriptionChanged ? stored.description : (existingChange?.oldDescription || undefined),
                            newDescription: descriptionChanged ? post.description : (existingChange?.newDescription || undefined),
                            detectedAt: existingChange?.detectedAt || now,
                            diff: hasChanges ? result.content : undefined
                        });
                    }
                }
            }
        });

        setChanges(detectedChanges);
        return detectedChanges;

    } catch (e) {
        console.warn('Update check failed:', e);
        return getChanges();
    }
}
