import type { DriveEntry, DriveItemPayload } from './types'

const EXTENSION_LABELS: Record<string, string> = {
    '.txt': 'TXT',
    '.md': 'Markdown',
    '.mdx': 'MDX',
    '.rtf': 'RTF',
    '.doc': 'DOC',
    '.docx': 'DOCX',
    '.xls': 'XLS',
    '.xlsx': 'XLSX',
    '.ppt': 'PPT',
    '.pptx': 'PPTX',
    '.odt': 'ODT',
    '.pages': 'Pages',
    '.pdf': 'PDF',
    '.tsv': 'TSV',
    '.json': 'JSON',
    '.csv': 'CSV',
    '.xml': 'XML',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.toml': 'TOML',
    '.ini': 'INI',
    '.conf': 'CONF',
    '.cfg': 'CFG',
    '.log': 'LOG',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.jsx': 'React JSX',
    '.tsx': 'React TSX',
    '.astro': 'Astro',
    '.py': 'Python',
    '.java': 'Java',
    '.php': 'PHP',
    '.sh': 'Shell',
    '.bat': 'Batch',
    '.ps1': 'PowerShell',
    '.sql': 'SQL',
    '.go': 'Go',
    '.rs': 'Rust',
    '.c': 'C',
    '.cpp': 'C++',
    '.h': 'C Header',
    '.hpp': 'C++ Header',
    '.png': 'PNG',
    '.jpg': 'JPEG',
    '.jpeg': 'JPEG',
    '.gif': 'GIF',
    '.webp': 'WebP',
    '.svg': 'SVG',
    '.avif': 'AVIF',
    '.bmp': 'BMP',
    '.ico': 'ICO',
    '.heic': 'HEIC',
    '.heif': 'HEIF',
    '.psd': 'PSD',
    '.mp4': 'MP4',
    '.webm': 'WebM',
    '.flv': 'FLV',
    '.mkv': 'MKV',
    '.mov': 'MOV',
    '.avi': 'AVI',
    '.wmv': 'WMV',
    '.m4v': 'M4V',
    '.rmvb': 'RMVB',
    '.rm': 'RM',
    '.mpeg': 'MPEG',
    '.mpg': 'MPG',
    '.3gp': '3GP',
    '.mp3': 'MP3',
    '.aac': 'AAC',
    '.ogg': 'OGG',
    '.wma': 'WMA',
    '.flac': 'FLAC',
    '.alac': 'ALAC',
    '.m4a': 'M4A',
    '.ape': 'APE',
    '.wav': 'WAV',
    '.aiff': 'AIFF',
    '.midi': 'MIDI',
    '.mid': 'MIDI',
    '.amr': 'AMR',
    '.zip': 'ZIP',
    '.7z': '7Z',
    '.rar': 'RAR',
    '.tar': 'TAR',
    '.gz': 'GZ',
    '.tgz': 'TGZ',
    '.bz2': 'BZ2',
    '.xz': 'XZ',
    '.exe': 'EXE',
    '.msi': 'MSI',
    '.apk': 'APK',
    '.ipa': 'IPA',
    '.dmg': 'DMG',
    '.iso': 'ISO',
    '.img': 'IMG',
    '.pkg': 'PKG',
    '.deb': 'DEB',
    '.rpm': 'RPM',
    '.jar': 'JAR',
    '.war': 'WAR',
    '.ear': 'EAR',
    '.dll': 'DLL',
    '.ttf': 'TTF',
    '.otf': 'OTF',
    '.woff': 'WOFF',
    '.woff2': 'WOFF2',
}

const CATEGORY_LABELS: Record<string, string> = {
    folder: '文件夹',
    image: '图片',
    video: '视频',
    audio: '音频',
    archive: '压缩包',
    pdf: 'PDF',
    text: '文本',
    file: '文件',
}

function getExtension(name: string) {
    const normalized = String(name || '').trim().toLowerCase()
    const index = normalized.lastIndexOf('.')
    if (index <= 0) {
        return ''
    }
    return normalized.slice(index)
}

type DriveFileLike = Pick<DriveEntry, 'isDir' | 'name' | 'type'> | Pick<DriveItemPayload, 'isDir' | 'name' | 'type'>

export function getDriveFileTypeLabel(file: DriveFileLike) {
    if (file.isDir) {
        return '文件夹'
    }

    const extension = getExtension(file.name)
    if (extension && EXTENSION_LABELS[extension]) {
        return EXTENSION_LABELS[extension]
    }

    if (extension) {
        return extension.slice(1).toUpperCase()
    }

    const normalizedType = String(file.type || '').trim().toLowerCase()
    if (normalizedType && CATEGORY_LABELS[normalizedType]) {
        return CATEGORY_LABELS[normalizedType]
    }

    return '文件'
}
