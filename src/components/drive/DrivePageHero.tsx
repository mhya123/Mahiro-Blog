import { HardDrive, House, ShieldCheck } from 'lucide-react'
import { getPermissionLabel } from './page-utils'
import type { DrivePermissions } from './types'
import type { DrivePageController } from './useDrivePageController'

type DrivePageHeroProps = {
    controller: DrivePageController
}

function renderPermissionBadges(permissions: DrivePermissions) {
    return Object.entries(permissions).map(([key, allowed]) => (
        <span
            key={key}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${
                allowed
                    ? 'border-success/25 bg-success/15 text-base-content'
                    : 'border-base-300/70 bg-base-200/85 text-base-content/55'
            }`}
        >
            <span
                className={`h-2 w-2 rounded-full ${
                    allowed ? 'bg-success' : 'bg-base-content/25'
                }`}
                aria-hidden="true"
            />
            {getPermissionLabel(key as keyof DrivePermissions)}
        </span>
    ))
}

export function DrivePageHero({ controller }: DrivePageHeroProps) {
    const { status, currentPath, items, effectivePermissions } = controller

    return (
        <section className="rounded-[2rem] border border-white/10 bg-base-100/90 p-5 shadow-2xl shadow-primary/5 backdrop-blur-xl md:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                        <HardDrive className="h-4 w-4" />
                        站内网盘
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-base-content md:text-4xl">
                            Mahiro Drive
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-7 text-base-content/70 md:text-base">
                            Mahiro 网盘。本页不对任何文件的安全性做保证，请在下载或运行前自行核验，风险自担。
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-success/20 bg-success/10 p-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-success">
                            <ShieldCheck className="h-4 w-4" />
                            连接状态
                        </div>
                        <div className="mt-2 text-lg font-bold text-base-content">
                            {status?.connected ? '已连接' : status?.configured ? '待检查' : '未配置'}
                        </div>
                        <div className="mt-1 text-xs text-base-content/60">
                            {status?.baseHost || '等待后端响应'}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-primary/20 bg-primary/10 p-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-primary">
                            <House className="h-4 w-4" />
                            当前目录
                        </div>
                        <div className="mt-2 break-all text-lg font-bold text-base-content">
                            {currentPath}
                        </div>
                        <div className="mt-1 text-xs text-base-content/60">
                            {items.length} 个项目
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
                {renderPermissionBadges(effectivePermissions)}
            </div>

            {!status?.configured && (
                <div className="mt-5 rounded-3xl border border-warning/20 bg-warning/10 p-4 text-sm leading-7 text-base-content/80">
                    当前后端还没有配置 AList。请在 `server/.env` 中补充 `ALIST_BASE_URL`、`ALIST_USERNAME`
                    和 `ALIST_PASSWORD`。
                </div>
            )}

            {status?.error && (
                <div className="mt-5 rounded-3xl border border-error/20 bg-error/10 p-4 text-sm leading-7 text-base-content/80">
                    最近一次连接检查失败：{status.error}
                </div>
            )}

            {!effectivePermissions.view && status?.configured && (
                <div className="mt-5 rounded-3xl border border-warning/20 bg-warning/10 p-4 text-sm leading-7 text-base-content/80">
                    当前权限不允许查看网盘内容。你仍然可以按配置保留其它操作权限，但通常建议至少开启 `view`。
                </div>
            )}
        </section>
    )
}
