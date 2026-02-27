import React, { useState } from "react";
import { createPortal } from "react-dom";
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

export default function CommitHistory({ commits }: CommitHistoryProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!commits || commits.length === 0) return null;

    const modal = isOpen
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
                {/* 背景遮罩 */}
                <div
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setIsOpen(false)}
                />
                {/* 弹窗面板 */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[480px] max-h-[70vh] flex flex-col overflow-hidden bg-base-100 rounded-2xl shadow-2xl border border-base-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-200 shrink-0">
                        <h3 className="font-bold text-base flex items-center gap-2 text-base-content">
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
                    <div className="overflow-y-auto flex-1 p-4 commit-scrollbar">
                        <ul className="relative">
                            <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-base-200" />

                            {commits.map((commit, index) => (
                                <li
                                    key={commit.sha}
                                    className="relative pl-8 pb-4 last:pb-0 group"
                                >
                                    <div
                                        className={`absolute left-[6px] top-2 w-[12px] h-[12px] rounded-full border-2 z-10 transition-colors ${index === 0
                                                ? "bg-primary border-primary"
                                                : "bg-base-100 border-base-300 group-hover:border-primary"
                                            }`}
                                    />

                                    <div className="bg-base-200/30 rounded-xl p-3 hover:bg-base-200/50 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-base-content line-clamp-2">
                                                    {commit.message}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-xs text-base-content/50">
                                                    <span>{commit.authorName}</span>
                                                    <span>·</span>
                                                    <span>
                                                        {dayjs(commit.date).format(
                                                            "YYYY-MM-DD HH:mm"
                                                        )}
                                                    </span>
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
            </div>,
            document.body
        )
        : null;

    return (
        <>
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
            {modal}

            <style>{`
                .commit-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .commit-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .commit-scrollbar::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / 0.15);
                    border-radius: 3px;
                }
                .commit-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: oklch(var(--bc) / 0.25);
                }
            `}</style>
        </>
    );
}