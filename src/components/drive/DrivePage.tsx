'use client'

import { DriveEntryList } from './DriveEntryList'
import { DrivePageControls } from './DrivePageControls'
import { DrivePageHero } from './DrivePageHero'
import { DrivePageOverlays } from './DrivePageOverlays'
import type { DrivePermissions } from './types'
import { useDrivePageController } from './useDrivePageController'

type DrivePageProps = {
    permissions?: Partial<DrivePermissions>
}

export default function DrivePage({ permissions }: DrivePageProps) {
    const controller = useDrivePageController({ permissions })

    return (
        <>
            <DrivePageOverlays controller={controller} />

            <div className="space-y-6">
                <DrivePageHero controller={controller} />
                <DrivePageControls controller={controller} />
                <DriveEntryList controller={controller} />
            </div>
        </>
    )
}
