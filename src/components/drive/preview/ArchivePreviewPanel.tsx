'use client'

import type { DrivePreviewState } from './types'

type ArchivePreviewPanelProps = {
    previewState: DrivePreviewState
}

export function ArchivePreviewPanel({ previewState }: ArchivePreviewPanelProps) {
    return (
        <div className="flex h-full flex-col gap-4 p-5">
            <div className="rounded-2xl border border-base-300/70 bg-base-100 px-4 py-3 text-sm text-base-content/70 shadow-inner">
                {previewState.archiveSummary || '压缩包内容预览'}
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-base-300/70 bg-base-100 shadow-inner">
                <table className="table table-zebra table-pin-rows">
                    <thead>
                        <tr>
                            <th>Path</th>
                            <th>Type</th>
                            <th>Size</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(previewState.archiveEntries || []).map((entry) => (
                            <tr key={`${previewState.item.path}-${entry.path}`}>
                                <td className="break-all">{entry.path}</td>
                                <td>{entry.isDir ? 'Directory' : 'File'}</td>
                                <td>{entry.isDir ? '--' : entry.sizeLabel}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
