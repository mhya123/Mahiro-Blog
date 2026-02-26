import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { History, X, ExternalLink } from "lucide-react";
import { GITHUB_CONFIG } from "@/consts";
import { getAuthToken, hasAuth } from "@/lib/auth";

interface CommitHistoryProps {
    filePath: string;
}

interface CommitNode {
    sha: string;
    html_url: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        };
    };
    author?: {
        login: string;
        avatar_url: string;
        html_url: string;
    };
}

export default function CommitHistory({ filePath }: CommitHistoryProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [commits, setCommits] = useState<CommitNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCommits = async () => {
        if (commits.length > 0) return;

        setLoading(true);
        setError(null);

        try {
            const owner = GITHUB_CONFIG.OWNER;
            const repo = GITHUB_CONFIG.REPO;
            const targetPath = `src/content/blog/${filePath}`;

            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(targetPath)}`;

            const headers: Record<string, string> = {
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "Mahiro-Blog",
            };

            // 如果用户已经通过 PEM 认证，则使用 Installation Token 访问私有仓库
            const authenticated = await hasAuth();
            if (authenticated) {
                try {
                    const token = await getAuthToken();
                    headers["Authorization"] = `token ${token}`;
                } catch {
                    // 认证失败不阻塞请求，回退到公开请求
                    console.warn("Auth token not available, falling back to unauthenticated request");
                }
            }

            const response = await fetch(apiUrl, { headers });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("仓库未找到。请先导入 PEM 密钥以访问私有仓库的修订历史。");
                }
                if (response.status === 403) {
                    throw new Error("API 请求频率已达上限，请稍后重试。");
                }
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setCommits(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "发生未知错误。");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCommits();
        }
    }, [isOpen, filePath]);

    return (
        <>
            <button
                type="button"
                className="btn btn-outline btn-sm font-normal text-base-content/70 hover:text-base-content relative overflow-hidden group"
                onClick={() => setIsOpen(true)}
                aria-label="View Revision History"
            >
                <div className="absolute inset-0 bg-base-content/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <History className="w-4 h-4 relative z-10" />
                <span className="hidden sm:inline relative z-10 font-medium">
                    History
                </span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 transition-opacity">
                    <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-base-200 outline-none">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100/50 backdrop-blur shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-base-content">
                                <History className="w-5 h-5 text-primary" />
                                修订历史
                            </h3>
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:bg-base-200 hover:text-base-content transition-colors"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 overflow-y-auto overscroll-contain flex-1">
                            {loading && (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <span className="loading loading-spinner loading-lg text-primary"></span>
                                    <p className="text-sm text-base-content/60 font-medium animate-pulse">
                                        加载修订历史中...
                                    </p>
                                </div>
                            )}

                            {error && !loading && (
                                <div className="alert alert-error rounded-xl shadow-sm text-sm">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="stroke-current shrink-0 h-6 w-6"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            {!loading && !error && commits.length === 0 && (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <History className="w-8 h-8 text-base-content/30" />
                                    </div>
                                    <p className="text-base-content/60 font-medium">
                                        未找到该文件的修订历史。
                                    </p>
                                </div>
                            )}

                            {!loading && !error && commits.length > 0 && (
                                <ul className="relative border-l-2 border-base-300/50 ml-3 space-y-6 pb-2">
                                    {commits.map((node) => {
                                        const commitObj = node.commit;
                                        const authorObj = node.author;
                                        const msg = commitObj.message.split("\n")[0];

                                        return (
                                            <li
                                                key={node.sha}
                                                className="relative pl-6 sm:pl-8 group"
                                            >
                                                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-base-200 border-2 border-primary group-hover:bg-primary transition-colors shadow-sm z-10" />

                                                <div className="bg-base-200/50 hover:bg-base-200 rounded-xl p-4 transition-all duration-200 border border-transparent hover:border-base-300 shadow-sm hover:shadow-md">
                                                    <div className="flex items-start justify-between gap-4 mb-2">
                                                        <h4 className="font-semibold text-base-content/90 text-[15px] leading-tight break-all">
                                                            {msg}
                                                        </h4>
                                                        <a
                                                            href={node.html_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-mono bg-base-300 text-base-content/70 px-2 py-1 rounded-md hover:bg-primary/10 hover:text-primary transition-colors shrink-0 flex items-center gap-1 group/link"
                                                            title="View commit on GitHub"
                                                        >
                                                            {node.sha.substring(0, 7)}
                                                            <ExternalLink className="w-3 h-3 opacity-0 -ml-1 group-hover/link:opacity-100 group-hover/link:ml-0 transition-all" />
                                                        </a>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-3">
                                                        {authorObj && authorObj.avatar_url ? (
                                                            <img
                                                                src={authorObj.avatar_url}
                                                                alt={authorObj.login || commitObj.author.name}
                                                                className="w-6 h-6 rounded-full ring-2 ring-base-100 shadow-sm"
                                                                loading="lazy"
                                                            />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-base-100 uppercase">
                                                                {commitObj.author.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="text-xs flex items-center gap-2 text-base-content/60">
                                                            <span className="font-medium text-base-content/80">
                                                                {authorObj
                                                                    ? authorObj.login
                                                                    : commitObj.author.name}
                                                            </span>
                                                            <span className="w-1 h-1 rounded-full bg-base-300 block"></span>
                                                            <time
                                                                dateTime={commitObj.author.date}
                                                                className="tabular-nums"
                                                            >
                                                                {dayjs(commitObj.author.date).format(
                                                                    "YYYY-MM-DD HH:mm"
                                                                )}
                                                            </time>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}