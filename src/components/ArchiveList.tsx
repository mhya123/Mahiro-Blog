import React, { useState, useMemo, useRef } from 'react';
import { Archive, BookOpen, Calendar, Trash2, X } from 'lucide-react';
import dayjs from 'dayjs';
import { toast, Toaster } from 'sonner';
import { useAuthStore } from '@/components/write/hooks/use-auth';
import { batchDeleteBlogs } from '@/components/write/services/batch-delete';
import { readFileAsText } from '@/lib/file-utils';

interface Post {
    slug: string;
    data: {
        title: string;
        pubDate: Date | string;
        description?: string;
    };
}

interface ArchiveListProps {
    posts: Post[];
    labels: {
        archivePage: string;
        post: string;
        posts: string;
        backToBlog: string;
        archivePageDescription: string;
        noPosts: string;
        months: string[];
    };
    dateFormat: string;
}

export default function ArchiveList({ posts, labels, dateFormat }: ArchiveListProps) {
    const { isAuth, setPrivateKey } = useAuthStore();
    const [editMode, setEditMode] = useState(false);
    const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const keyInputRef = useRef<HTMLInputElement>(null);

    const groupedPosts = useMemo(() => {
        const groups = new Map<string, Map<string, Post[]>>();

        posts.forEach(post => {
            const date = dayjs(post.data.pubDate);
            const year = date.format('YYYY');
            const month = date.format('M'); // 1-12

            if (!groups.has(year)) {
                groups.set(year, new Map());
            }
            const yearGroup = groups.get(year)!;

            if (!yearGroup.has(month)) {
                yearGroup.set(month, []);
            }
            yearGroup.get(month)!.push(post);
        });

        return groups;
    }, [posts]);

    const years = Array.from(groupedPosts.keys()).sort((a, b) => parseInt(b) - parseInt(a));

    const toggleEditMode = () => {
        setEditMode(!editMode);
        setSelectedSlugs(new Set());
    };

    const toggleSelect = (slug: string) => {
        const newSelected = new Set(selectedSlugs);
        if (newSelected.has(slug)) {
            newSelected.delete(slug);
        } else {
            newSelected.add(slug);
        }
        setSelectedSlugs(newSelected);
    };

    const executeDelete = async () => {
        try {
            setDeleting(true);
            await batchDeleteBlogs(Array.from(selectedSlugs));
            setEditMode(false);
            setSelectedSlugs(new Set());
            // 页面刷新由 batchDeleteBlogs 中的 toast 提示用户手动刷新
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || '删除失败');
        } finally {
            setDeleting(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedSlugs.size === 0) return;

        if (!confirm(`确定要删除选中的 ${selectedSlugs.size} 篇文章吗？此操作不可恢复。`)) {
            return;
        }

        if (!isAuth) {
            toast.info('请导入私钥以继续删除操作');
            keyInputRef.current?.click();
            return;
        }

        await executeDelete();
    };

    const handlePrivateKeySelection = async (file: File) => {
        try {
            const pem = await readFileAsText(file);
            setPrivateKey(pem);
            toast.success('密钥导入成功，正在继续删除...');
            await executeDelete();
        } catch (error) {
            console.error(error);
            toast.error('读取密钥失败');
        }
    };

    const getMonthName = (month: string) => {
        const index = parseInt(month) - 1;
        return labels.months[index] || month;
    };

    return (
        <>
            <Toaster
                richColors
                position="top-center"
                toastOptions={{
                    className: '!flex-row flex !items-center shadow-xl rounded-2xl border-2 border-primary/20 backdrop-blur-sm',
                    style: {
                        fontSize: '1rem',
                        padding: '14px 20px',
                        zIndex: '999999',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                        transition: 'all 0.3s ease-in-out',
                    },
                    classNames: {
                        title: 'text-lg font-semibold tracking-tight',
                        description: 'text-sm font-medium opacity-90',
                        error: 'bg-error/95 text-error-content border-error/30',
                        success: 'bg-success/95 text-success-content border-success/30',
                        warning: 'bg-warning/95 text-warning-content border-warning/30',
                        info: 'bg-info/95 text-info-content border-info/30',
                    },
                    duration: 5000,
                    closeButton: false,
                }}
            />
            <input
                ref={keyInputRef}
                type='file'
                accept='.pem'
                className='hidden'
                onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) await handlePrivateKeySelection(f);
                    if (e.currentTarget) e.currentTarget.value = '';
                }}
            />
            <div className="bg-base-100 rounded-2xl shadow-lg w-full p-4 sm:p-6 mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Archive className="w-6 h-6 text-accent" />
                        <h1 className="text-2xl md:text-3xl font-bold">{labels.archivePage}</h1>
                        <div className="badge badge-accent">
                            {posts.length} {posts.length === 1 ? labels.post : labels.posts}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {editMode ? (
                            <>
                                <button
                                    onClick={() => {
                                        // 全选/取消全选逻辑
                                        const allSlugs = new Set(posts.map(p => p.slug));
                                        if (selectedSlugs.size === allSlugs.size) {
                                            setSelectedSlugs(new Set());
                                        } else {
                                            setSelectedSlugs(allSlugs);
                                        }
                                    }}
                                    disabled={deleting || posts.length === 0}
                                    className="btn btn-outline btn-sm gap-2"
                                >
                                    <span>{selectedSlugs.size === posts.length ? '取消全选' : '全选'}</span>
                                </button>
                                <button
                                    onClick={handleBatchDelete}
                                    disabled={deleting || selectedSlugs.size === 0}
                                    className="btn btn-error btn-sm gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>删除 ({selectedSlugs.size})</span>
                                </button>
                                <button
                                    onClick={toggleEditMode}
                                    disabled={deleting}
                                    className="btn btn-ghost btn-sm gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    <span>取消</span>
                                </button>
                            </>
                        ) : (
                            <button onClick={toggleEditMode} className="btn btn-outline btn-error btn-sm gap-2">
                                <Trash2 className="w-4 h-4" />
                                <span>批量删除</span>
                            </button>
                        )}
                        <a href="/blog" className="btn btn-outline btn-sm gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{labels.backToBlog}</span>
                        </a>
                    </div>
                </div>
                <div className="divider my-2"></div>
                <p className="text-sm opacity-75">{labels.archivePageDescription}</p>
            </div>

            <div className="bg-base-100 rounded-2xl shadow-lg w-full p-4 sm:p-6">
                <div className="archives-container">
                    {years.length > 0 ? (
                        <div className="archives-timeline">
                            {years.map((year) => (
                                <div key={year} className="timeline-year">
                                    <div className="year-header">
                                        <div className="year-badge">{year}</div>
                                    </div>

                                    <div className="year-content">
                                        {Array.from(groupedPosts.get(year)!.entries())
                                            .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
                                            .map(([month, monthPosts]) => (
                                                <div key={month} className="timeline-month">
                                                    <h3 className="month-title">
                                                        <Calendar className="month-icon" />
                                                        <span>
                                                            {getMonthName(month)} {year}
                                                        </span>
                                                        <span className="month-count">{monthPosts.length}</span>
                                                    </h3>

                                                    <ul className="archive-posts">
                                                        {monthPosts.map((post) => (
                                                            <li key={post.slug} className="archive-item">
                                                                <div className="flex items-center gap-2 w-full">
                                                                    {editMode && (
                                                                        <input
                                                                            type="checkbox"
                                                                            className="checkbox checkbox-sm checkbox-error shrink-0"
                                                                            checked={selectedSlugs.has(post.slug)}
                                                                            onChange={() => toggleSelect(post.slug)}
                                                                        />
                                                                    )}
                                                                    <a
                                                                        href={`/blog/${post.slug}`}
                                                                        className={`archive-card flex-1 block ${editMode && selectedSlugs.has(post.slug) ? '!border-error !bg-error/5' : ''}`}
                                                                        onClick={e => {
                                                                            if (editMode) {
                                                                                e.preventDefault();
                                                                                toggleSelect(post.slug);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <time className="archive-date">{dayjs(post.data.pubDate).format(dateFormat)}</time>
                                                                        <h4 className="archive-title">{post.data.title}</h4>
                                                                        {post.data.description && <p className="archive-description">{post.data.description}</p>}
                                                                    </a>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">😢</div>
                            <p className="empty-text">{labels.noPosts}</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
