import {
    ChevronRight,
    Copy,
    FolderPlus,
    House,
    LoaderCircle,
    Move,
    RefreshCw,
    Search,
    Trash2,
    Upload,
} from 'lucide-react'
import { PER_PAGE_OPTIONS } from './page-utils'
import type { DrivePageController } from './useDrivePageController'

type DrivePageControlsProps = {
    controller: DrivePageController
}

export function DrivePageControls({ controller }: DrivePageControlsProps) {
    const {
        breadcrumbs,
        currentPath,
        searchInput,
        loading,
        searching,
        busy,
        status,
        effectivePermissions,
        writeEnabled,
        totalCount,
        startIndex,
        endIndex,
        perPage,
        currentPage,
        totalPages,
        visiblePages,
        isSearchMode,
        searchKeyword,
        selectedEntries,
        setSearchInput,
    } = controller

    return (
        <section className="rounded-[2rem] border border-white/10 bg-base-100/90 p-4 shadow-2xl shadow-base-300/20 backdrop-blur-xl md:p-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    {breadcrumbs.map((crumb, index) => (
                        <button
                            key={crumb.path}
                            type="button"
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 transition ${
                                crumb.path === currentPath
                                    ? 'bg-primary text-primary-content'
                                    : 'bg-base-200/80 text-base-content/70 hover:bg-primary/10 hover:text-primary'
                            }`}
                            onClick={() => {
                                void controller.loadDirectory(crumb.path, { silent: false })
                            }}
                        >
                            {index === 0 ? <House className="h-4 w-4" /> : null}
                            <span>{crumb.label}</span>
                            {index < breadcrumbs.length - 1 ? <ChevronRight className="h-4 w-4 opacity-60" /> : null}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-1 items-center gap-2 rounded-[1.5rem] border border-base-300/60 bg-base-200/40 px-4 py-3">
                        <Search className="h-4 w-4 text-base-content/50" />
                        <input
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    void controller.runSearch({ page: 1 })
                                }
                            }}
                            className="w-full bg-transparent text-sm outline-none placeholder:text-base-content/40"
                            placeholder="搜索当前目录中的文件和文件夹"
                        />
                        <button
                            type="button"
                            className="btn btn-primary btn-sm rounded-full"
                            disabled={loading || searching || busy || !status?.configured}
                            onClick={() => {
                                void controller.runSearch({ page: 1 })
                            }}
                        >
                            {searching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : '搜索'}
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn btn-ghost rounded-full"
                            disabled={loading || busy || currentPath === '/' || !status?.configured || !effectivePermissions.view}
                            onClick={controller.goToParentDirectory}
                        >
                            <ChevronRight className="h-4 w-4 rotate-180" />
                            上一级
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost rounded-full"
                            disabled={loading || busy || !status?.configured || !effectivePermissions.view}
                            onClick={controller.refreshCurrentDirectory}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            刷新
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary rounded-full"
                            disabled={loading || busy || !writeEnabled || !status?.configured || !effectivePermissions.mkdir}
                            onClick={() => {
                                void controller.handleCreateFolder()
                            }}
                        >
                            <FolderPlus className="h-4 w-4" />
                            新建文件夹
                        </button>
                        <button
                            type="button"
                            className="btn btn-accent rounded-full"
                            disabled={loading || busy || !writeEnabled || !status?.configured || !effectivePermissions.upload}
                            onClick={() => controller.uploadInputRef.current?.click()}
                        >
                            <Upload className="h-4 w-4" />
                            上传
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-[1.25rem] border border-base-300/50 bg-base-200/25 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-base-content/70">
                        {totalCount > 0
                            ? `当前显示 ${startIndex}-${endIndex} / 共 ${totalCount} 项`
                            : '当前没有可显示的数据'}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 text-sm text-base-content/70">
                            <span>每页</span>
                            <select
                                value={perPage}
                                className="select select-sm select-bordered rounded-full"
                                onChange={(event) => {
                                    controller.changePerPage(Number(event.target.value) || 20)
                                }}
                            >
                                {PER_PAGE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                            <span>条</span>
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-ghost btn-sm rounded-full"
                                disabled={loading || searching || currentPage <= 1}
                                onClick={() => controller.changePage(currentPage - 1)}
                            >
                                上一页
                            </button>

                            {visiblePages.map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    className={`btn btn-sm rounded-full ${page === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                                    disabled={loading || searching || page === currentPage}
                                    onClick={() => controller.changePage(page)}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                type="button"
                                className="btn btn-ghost btn-sm rounded-full"
                                disabled={loading || searching || currentPage >= totalPages}
                                onClick={() => controller.changePage(currentPage + 1)}
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                </div>

                {controller.pageError && (
                    <div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-sm leading-7 text-base-content/80">
                        {controller.pageError}
                    </div>
                )}

                {isSearchMode && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-base-content/80">
                        搜索结果：当前目录下匹配 “{searchKeyword}” 的项目共 {totalCount} 个。
                        <button
                            type="button"
                            className="ml-3 font-semibold text-primary"
                            onClick={controller.clearSearchMode}
                        >
                            返回目录视图
                        </button>
                    </div>
                )}

                {selectedEntries.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-[1.5rem] border border-primary/20 bg-primary/10 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="text-sm font-semibold text-base-content">
                            已选择 {selectedEntries.length} 个项目
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="btn btn-sm rounded-full"
                                disabled={busy || !effectivePermissions.move}
                                onClick={() => {
                                    void controller.handleMoveOrCopy('move', selectedEntries)
                                }}
                            >
                                <Move className="h-4 w-4" />
                                批量移动
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm rounded-full"
                                disabled={busy || !effectivePermissions.copy}
                                onClick={() => {
                                    void controller.handleMoveOrCopy('copy', selectedEntries)
                                }}
                            >
                                <Copy className="h-4 w-4" />
                                批量复制
                            </button>
                            <button
                                type="button"
                                className="btn btn-error btn-sm rounded-full"
                                disabled={busy || !effectivePermissions.remove}
                                onClick={() => {
                                    void controller.handleDelete(selectedEntries)
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                                批量删除
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}
