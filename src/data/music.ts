/**
 * 音乐数据层
 * 数据源优先级：
 *   1. music-ids.json 中的歌单导入 (type: "netease-playlist")
 *   2. music.json 作为手动歌单（本地直接填写歌曲信息）
 *
 * 性能优化：
 *   - 内存缓存，同一个 dev server 生命周期内只调一次 API
 *   - 多歌单并行请求
 */
import { MUSIC_CONFIG } from "@config";
import musicIds from './music-ids.json';
import musicJson from './music.json';

export interface MusicItem {
    title: string;
    artist: string;
    cover: string;
    url: string;
    lrc?: string;
    duration?: string;
    id?: string | number;
}

export interface Playlist {
    name: string;
    cover: string;
    songs: MusicItem[];
}

interface MetingResponse {
    name: string;
    artist: string;
    url: string;
    pic: string;
    lrc: string;
}

const API_BASE = MUSIC_CONFIG?.api || 'https://api.qijieya.cn/meting';

// ========== 内存缓存 ==========
let _cachedPlaylists: Playlist[] | null = null;

function metingToMusicItem(raw: MetingResponse): MusicItem {
    return {
        title: raw.name || 'Unknown',
        artist: raw.artist || 'Unknown',
        cover: raw.pic || '',
        url: raw.url || '',
        lrc: raw.lrc || '',
    };
}

async function fetchNeteasePlaylist(playlistId: string | number): Promise<MusicItem[]> {
    try {
        const res = await fetch(`${API_BASE}/?type=playlist&id=${playlistId}`);
        if (!res.ok) return [];
        const data: MetingResponse[] = await res.json();
        if (!data?.length) return [];
        return data.map(metingToMusicItem);
    } catch (error) {
        console.error(`[Music] 获取歌单 ${playlistId} 出错:`, error);
        return [];
    }
}

/**
 * 获取所有歌单（带缓存，多歌单并行请求）
 */
export async function getAllPlaylists(): Promise<Playlist[]> {
    if (_cachedPlaylists) return _cachedPlaylists;

    const entries = (musicIds as any).playlists || [];

    // 并行请求所有网易云歌单
    const neteaseEntries = entries.filter(
        (e: any) => e.type === 'netease-playlist' && e.neteaseId
    );
    const fetchResults = await Promise.allSettled(
        neteaseEntries.map((entry: any) => fetchNeteasePlaylist(entry.neteaseId))
    );

    const playlists: Playlist[] = [];
    for (let i = 0; i < neteaseEntries.length; i++) {
        const entry = neteaseEntries[i];
        const result = fetchResults[i];
        const songs = result.status === 'fulfilled' ? result.value : [];
        const cover = entry.cover || songs[0]?.cover || '';
        playlists.push({ name: entry.name, cover, songs });
        console.log(`[Music] 歌单「${entry.name}」: ${songs.length} 首`);
    }

    // music.json 作为本地歌单
    const localSongs = (musicJson as any[]) || [];
    if (localSongs.length > 0) {
        playlists.push({
            name: '本地歌单',
            cover: localSongs[0]?.cover || '',
            songs: localSongs as MusicItem[],
        });
        console.log(`[Music] 本地歌单: ${localSongs.length} 首`);
    }

    _cachedPlaylists = playlists;
    return playlists;
}

export async function getMusicList(): Promise<MusicItem[]> {
    const playlists = await getAllPlaylists();
    return playlists.flatMap(p => p.songs);
}
