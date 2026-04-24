export type DriveEntry = {
    name: string
    path: string
    parentPath: string | null
    isDir: boolean
    size: number
    sizeLabel: string
    modified: string
    provider: string
    sign: string
    thumb: string
    type: string
}

export type DrivePermissions = {
    upload: boolean
    mkdir: boolean
    view: boolean
    download: boolean
    rename: boolean
    copy: boolean
    move: boolean
    remove: boolean
}

export type DriveStatus = {
    configured: boolean
    connected: boolean
    baseUrl: string
    baseHost: string
    defaultRoot: string
    authMode: string
    username: string | null
    permissions?: DrivePermissions
    error?: string
}

export type DriveListPayload = {
    path: string
    parentPath: string | null
    total: number
    write: boolean
    provider: string
    items: DriveEntry[]
}

export type DriveItemPayload = {
    path: string
    name: string
    rawUrl: string
    resolvedUrl: string
    provider: string
    sign: string
    type: string
    size: number
    sizeLabel: string
    modified: string
    isDir: boolean
}
