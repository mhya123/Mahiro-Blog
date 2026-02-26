import React, { useState } from "react";
import dayjs from "dayjs";
import { History, X, ExternalLink } from "lucide-react";

export interface CommitData {
    sha: string;
    message: string;
    authorName: string;
    date: string;
    url: string;
}

interface CommitHistoryProps {
    commits: CommitData[];
    owner: string;
    repo: string;
}

export default function CommitHistory({ commits, owner, repo }: CommitHistoryProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!commits || commits.length === 0) return null;

    return (
        <div className="relative">
            <button
                type="button"
                className="btn btn-outline btn-sm font-normal text-base-content/70 hover:text-base-content relative overflow-hidden group"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="View Revision History"
            >
                <div className="absolute inset-0 bg-base-content/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <History className="w-4 h-4 relative z-10" />
                <span className="hidden sm:inline relative z-10 font-medium">
                    History
                </span>
                <span className="badge badge-sm badge-primary relative z-10">
                    {commits.length}
                </span>
            </button>

            {isOpen && (
                <>
                    {/* 点击外部关闭 */}
                    <div className="fixed inset-0 z-[99]" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-[100] w-[90vw] sm:w-[480px] max-h-[70vh] flex flex-col overflow-hidden bg-base-100 rounded-2xl shadow-2xl border border-base-200 outline-none">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100/50 backdrop-blur shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-base-content">
                                <History className="w-5 h-5 text-primary" />
                                修订历史
                                <span className="badge badge-primary badge-sm">
                                    {commits.length} 次提交
                                </span>
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Commit List */}
                        <div className="overflow-y-auto flex-1 p-4 custom-scrollbar">
                            <ul className="relative">
                                {/* 时间轴竖线 */}
                                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-base-200" />

                                {commits.map((commit, index) => (
                                    <li
                                        key={commit.sha}
                                        className="relative pl-8 pb-5 last:pb-0 group"
                                    >
                                        {/* 时间轴圆点 */}
                                        <div className={`absolute left-[6px] top-2 w-[12px] h-[12px] rounded-full border-2 z-10 transition-colors ${index === 0
                                                ? "bg-primary border-primary"
                                                : "bg-base-100 border-base-300 group-hover:border-primary"
                                            }`} />

                                        <div className="bg-base-200/30 rounded-xl p-3 hover:bg-base-200/50 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-base-content truncate">
                                                        {commit.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5 text-xs text-base-content/50">
                                                        <span>{commit.authorName}</span>
                                                        <span>·</span>
                                                        <span>{dayjs(commit.date).format("YYYY-MM-DD HH:mm")}</span>
                                                    </div>
                                                </div>
                                                {commit.url && (
                                                    <a
                                                        href={commit.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-xs shrink-0 text-base-content/40 hover:text-primary"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / 0.15);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: oklch(var(--bc) / 0.25);
                }
            `}</style>
        </div>
    );
}