import { LoaderCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import { DrivePreviewModal } from './preview/DrivePreviewModal'
import type { DrivePageController } from './useDrivePageController'

type DrivePageOverlaysProps = {
    controller: DrivePageController
}

export function DrivePageOverlays({ controller }: DrivePageOverlaysProps) {
    return (
        <>
            <Toaster
                richColors
                theme={controller.toastTheme}
                position="top-center"
                offset={112}
                visibleToasts={6}
                expand={true}
                toastOptions={{
                    className: '!flex-row flex !items-center shadow-xl rounded-2xl border-2 border-primary/20 backdrop-blur-sm',
                    style: {
                        fontSize: '1rem',
                        padding: '14px 20px',
                        zIndex: '999999',
                        borderRadius: '14px',
                    },
                    duration: 5000,
                    closeButton: false,
                }}
            />

            <input
                ref={controller.uploadInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    void controller.handleUpload(event.target.files)
                }}
            />

            {controller.previewState && (
                <DrivePreviewModal
                    previewState={controller.previewState}
                    onClose={() => controller.setPreviewState(null)}
                    onDownload={() => {
                        void controller.downloadFileEntry(controller.previewState!.entry)
                    }}
                    onCopyDownloadLink={() => {
                        void controller.copyItemDownloadLink(controller.previewState!.item)
                    }}
                    onOpenInPotPlayer={() => {
                        controller.openItemInPotPlayer(controller.previewState!.item)
                    }}
                />
            )}

            {controller.previewLoading && !controller.previewState && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 backdrop-blur-sm">
                    <div className="rounded-3xl border border-white/10 bg-base-100/95 px-6 py-5 shadow-2xl">
                        <div className="flex items-center gap-3 text-base-content/75">
                            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                            正在打开预览...
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
