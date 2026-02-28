import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Trash2, HelpCircle, ExternalLink, Rss } from 'lucide-react';
import gsap from 'gsap';
import {
    fetchAndCompare,
    getChanges,
    markAllRead,
    getLastCheckTime,
    type ArticleChange,
} from '@/lib/update-checker';

export default function UpdateNotifier() {
    const [changes, setChanges] = useState<ArticleChange[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isRendered, setIsRendered] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState<string | null>(null);

    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const bellRef = useRef<HTMLButtonElement>(null);

    // Initialization
    useEffect(() => {
        console.log('[UpdateNotifier] 组件已挂载');

        try {
            const cached = getChanges();
            console.log('[UpdateNotifier] 缓存中的变更:', cached.length);
            if (cached.length > 0) {
                setChanges(cached);
            }
            setLastCheck(getLastCheckTime());
        } catch (e) {
            console.error('[UpdateNotifier] 读取缓存出错:', e);
        }

        const timer = setTimeout(async () => {
            try {
                setIsChecking(true);
                console.log('[UpdateNotifier] 开始检查更新...');
                const result = await fetchAndCompare();
                setIsChecking(false);
                setLastCheck(getLastCheckTime());
                console.log('[UpdateNotifier] 检查完成, 发现变更:', result.length, result);

                setChanges(result);
            } catch (e) {
                console.error('[UpdateNotifier] 检查更新出错:', e);
                setIsChecking(false);
            }
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const handleClearAll = useCallback(async () => {
        await markAllRead();
        setChanges([]);
        setIsOpen(false);
    }, []);

    // 统计
    const hasChanges = changes.length > 0;
    const newCount = changes.filter((c) => c.type === 'new').length;
    const updateCount = changes.filter((c) => c.type === 'update').length;

    // 当发现变更时，给铃铛一个弹出的 GSAP 动画
    useEffect(() => {
        if (hasChanges && bellRef.current) {
            gsap.fromTo(
                bellRef.current,
                { scale: 0.8, rotation: -20 },
                { scale: 1, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' }
            );
        }
    }, [hasChanges]);

    // Handle GSAP open & close unmount lifecycles
    useEffect(() => {
        if (isOpen) {
            setIsRendered(true);
        } else if (isRendered) {
            const tl = gsap.timeline({
                onComplete: () => setIsRendered(false)
            });
            if (overlayRef.current) tl.to(overlayRef.current, { opacity: 0, duration: 0.3 }, 0);
            if (panelRef.current) tl.to(panelRef.current, { y: 20, opacity: 0, scale: 0.95, duration: 0.3, ease: 'power2.in' }, 0);
        }
    }, [isOpen, isRendered]);

    // Handle initial mount GSAP animation
    useEffect(() => {
        if (isRendered && isOpen) {
            if (overlayRef.current) gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
            if (panelRef.current) gsap.fromTo(panelRef.current, { y: 20, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.2)' });
        }
    }, [isRendered, isOpen]);

    const panel = isRendered
        ? createPortal(
            <div className="fixed inset-0 z-[9998]">
                <div
                    ref={overlayRef}
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setIsOpen(false)}
                />
                {/* 面板 */}
                <div ref={panelRef} className="absolute bottom-20 right-4 w-[calc(100vw-2rem)] max-w-[420px] max-h-[70vh] flex flex-col bg-base-100 rounded-2xl shadow-2xl border border-base-200 overflow-hidden sm:right-6">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-200 shrink-0">
                        <h3 className="font-bold text-base flex items-center gap-2 text-base-content">
                            <Rss className="w-5 h-5 text-primary" />
                            {newCount > 0 ? '发现新文章' : '文章有更新'}
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="btn btn-ghost btn-xs btn-circle text-base-content/40"
                            >
                                <HelpCircle className="w-3.5 h-3.5" />
                            </button>
                        </h3>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleClearAll}
                                className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-error"
                                title="标记全部已读"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* 帮助文字 */}
                    {showHelp && (
                        <div className="px-5 py-3 bg-base-200/30 text-xs text-base-content/60 border-b border-base-200">
                            系统通过 RSS 订阅源自动检测文章变更。
                            <span className="text-success font-bold"> 新文章 </span>
                            表示新发布的内容，
                            <span className="text-info font-bold"> 更新 </span>
                            表示已有文章有修改。点击 🗑️ 可标记全部已读。
                        </div>
                    )}

                    {/* 时间信息 */}
                    <div className="px-5 py-2 text-xs text-base-content/40 border-b border-base-200">
                        发现更新
                        {lastCheck && (
                            <span className="ml-1">
                                {new Date(lastCheck).toLocaleString('zh-CN')}
                            </span>
                        )}
                    </div>

                    {/* 文章列表 */}
                    <div className="overflow-y-auto flex-1">
                        {changes.map((change) => (
                            <a
                                key={change.guid}
                                href={change.link}
                                className="flex items-center justify-between px-5 py-3 hover:bg-base-200/30 transition-colors border-b border-base-200/50 group"
                            >
                                <span className="text-sm font-medium text-base-content truncate mr-3 group-hover:text-primary transition-colors">
                                    {change.title}
                                </span>
                                <span
                                    className={`badge badge-sm shrink-0 font-bold ${change.type === 'new'
                                        ? 'badge-success text-success-content'
                                        : 'badge-info text-info-content'
                                        }`}
                                >
                                    {change.type === 'new' ? '新文章' : '更新'}
                                </span>
                            </a>
                        ))}
                    </div>

                    {/* 底部统计 */}
                    <div className="px-5 py-2.5 border-t border-base-200 text-xs text-base-content/40 flex items-center gap-3 shrink-0">
                        {newCount > 0 && (
                            <span>
                                <span className="text-success font-bold">{newCount}</span> 篇新文章
                            </span>
                        )}
                        {updateCount > 0 && (
                            <span>
                                <span className="text-info font-bold">{updateCount}</span> 篇更新
                            </span>
                        )}
                    </div>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <>
            {/* 铃铛按钮 - 固定右下角 */}
            <button
                ref={bellRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 z-[9997] btn btn-circle btn-primary shadow-xl hover:scale-110 active:scale-95 transition-transform`}
                aria-label="查看文章更新"
            >
                <div className="relative">
                    <Bell className="w-5 h-5" />
                    {changes.length > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-error text-error-content text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-base-100">
                            {changes.length > 9 ? '9+' : changes.length}
                        </span>
                    )}
                </div>
            </button>

            {panel}
        </>
    );
}
