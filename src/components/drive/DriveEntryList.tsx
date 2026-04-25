import {
    ArrowUpRight,
    Copy,
    Download,
    Folder,
    LoaderCircle,
    Move,
    PencilLine,
    Trash2,
} from 'lucide-react'
import { formatTime, getFileIcon } from './page-utils'
import type { DrivePageController } from './useDrivePageController'
import { getDriveFileTypeLabel } from './file-meta'

type DriveEntryListProps = {
    controller: DrivePageController
}

export function DriveEntryList({ controller }: DriveEntryListProps) {
    const {
        loading,
        items,
        effectivePermissions,
        selectedPaths,
        resolvingPath,
        busy,
        writeEnabled,
    } = controller

    return (
        <section className="rounded-[2rem] border border-white/10 bg-base-100/90 p-3 shadow-2xl shadow-base-300/20 backdrop-blur-xl md:p-4">
            {loading ? (
                <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-base-content/60">
                    <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-sm">正在加载网盘内容...</div>
                </div>
            ) : items.length === 0 ? (
                <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center text-base-content/60">
                    <Folder className="h-10 w-10 text-base-content/45" />
                    <div className="text-lg font-bold">
                        {effectivePermissions.view ? '这个目录现在是空的' : '当前无可显示内容'}
                    </div>
                    <div className="max-w-md text-sm leading-7">
                        {effectivePermissions.view
                            ? '你可以上传文件、创建文件夹，或者切换到其它目录继续查看。'
                            : '当前权限未开启查看能力，所以目录内容不会在页面中展示。'}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map((entry) => {
                        const Icon = getFileIcon(entry)
                        const active = selectedPaths.has(entry.path)
                        const isResolvingCurrent = resolvingPath === entry.path

                        return (
                            <div
                                key={entry.path}
                                className={`grid gap-3 rounded-[1.5rem] border p-4 transition md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center ${
                                    active
                                        ? 'border-primary/40 bg-primary/10 shadow-lg shadow-primary/10'
                                        : 'border-base-300/50 bg-base-200/30 hover:border-primary/25 hover:bg-base-200/50'
                                }`}
                            >
                                <label className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary checkbox-sm"
                                        checked={active}
                                        onChange={() => controller.toggleSelected(entry.path)}
                                    />
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                                        entry.isDir
                                            ? 'border-base-300/80 bg-base-200/85 text-base-content/72'
                                            : 'border-primary/10 bg-primary/10 text-primary'
                                    }`}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                </label>

                                <button
                                    type="button"
                                    className="min-w-0 text-left"
                                    onClick={() => controller.openEntry(entry)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="truncate text-base font-bold text-base-content md:text-lg">
                                            {entry.name}
                                        </div>
                                        {entry.isDir ? (
                                            <span className="rounded-full border border-base-300/80 bg-base-200/85 px-2 py-1 text-[11px] font-bold text-base-content/68">
                                                文件夹
                                            </span>
                                        ) : (
                                            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">
                                                {getDriveFileTypeLabel(entry)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-6 text-base-content/60 md:text-sm">
                                        <span>大小：{entry.sizeLabel}</span>
                                        <span>修改：{formatTime(entry.modified)}</span>
                                        {entry.provider ? <span>存储：{entry.provider}</span> : null}
                                        <span className="break-all">路径：{entry.path}</span>
                                    </div>
                                </button>

                                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm rounded-full"
                                        disabled={isResolvingCurrent || !effectivePermissions.view}
                                        onClick={() => controller.openEntry(entry)}
                                    >
                                        {isResolvingCurrent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                                        {entry.isDir ? '打开' : '查看'}
                                    </button>
                                    {!entry.isDir && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm rounded-full"
                                            disabled={isResolvingCurrent || !effectivePermissions.download}
                                            onClick={() => {
                                                void controller.downloadFileEntry(entry)
                                            }}
                                        >
                                            {isResolvingCurrent ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            下载
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm rounded-full"
                                        disabled={busy || !writeEnabled || !effectivePermissions.rename}
                                        onClick={() => {
                                            void controller.handleRename(entry)
                                        }}
                                    >
                                        <PencilLine className="h-4 w-4" />
                                        重命名
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm rounded-full"
                                        disabled={busy || !writeEnabled || !effectivePermissions.copy}
                                        onClick={() => {
                                            void controller.handleMoveOrCopy('copy', [entry])
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                        复制
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm rounded-full"
                                        disabled={busy || !writeEnabled || !effectivePermissions.move}
                                        onClick={() => {
                                            void controller.handleMoveOrCopy('move', [entry])
                                        }}
                                    >
                                        <Move className="h-4 w-4" />
                                        移动
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-error btn-outline btn-sm rounded-full"
                                        disabled={busy || !writeEnabled || !effectivePermissions.remove}
                                        onClick={() => {
                                            void controller.handleDelete([entry])
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        删除
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
