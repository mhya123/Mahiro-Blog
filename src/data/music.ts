/**
 * 音乐数据层
 * 通过 Meting API 从网易云音乐解析歌曲信息
 * 支持多歌单管理
 */
import { MUSIC_CONFIG } from "@config";
import musicData from './music-ids.json';

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

interface SongIdEntry {
    id: string | number;
    comment?: string;
}

interface PlaylistEntry {
    name: string;
    cover?: string;
    songs: SongIdEntry[];
}

const API_BASE = MUSIC_CONFIG?.api || 'https://api.qijieya.cn/meting';

/**
 * 通过 Meting API 获取单首歌曲信息
 */
async function fetchSongById(id: string | number): Promise<MusicItem | null> {
    try {
        const res = await fetch(`${API_BASE}/?type=song&id=${id}`);
        if (!res.ok) {
            console.warn(`[Music] 获取歌曲 ${id} 失败: ${res.status}`);
            return null;
        }
        const data: MetingResponse[] = await res.json();
        if (!data || data.length === 0) {
            console.warn(`[Music] 歌曲 ${id} 返回空数据`);
            return null;
        }
        const song = data[0];
        return {
            title: song.name || 'Unknown',
            artist: song.artist || 'Unknown',
            cover: song.pic || '',
            url: song.url || '',
            lrc: song.lrc || '',
            id: id,
        };
    } catch (error) {
        console.error(`[Music] 获取歌曲 ${id} 出错:`, error);
        return null;
    }
}

/**
 * 获取所有歌单（含已解析的歌曲信息）
 */
export async function getAllPlaylists(): Promise<Playlist[]> {
    const entries = (musicData as any).playlists as PlaylistEntry[] || [];
    if (entries.length === 0) return [];

    console.log(`[Music] 正在解析 ${entries.length} 个歌单...`);

    const playlists: Playlist[] = [];

    for (const entry of entries) {
        const ids = entry.songs.map(s => s.id);
        const results = await Promise.allSettled(ids.map(id => fetchSongById(id)));

        const songs: MusicItem[] = [];
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                songs.push(result.value);
            }
        }

        // 歌单封面：优先用配置的，其次用第一首歌的封面
        const cover = entry.cover || (songs[0]?.cover || '');

        playlists.push({
            name: entry.name,
            cover,
            songs,
        });

        console.log(`[Music] 歌单「${entry.name}」: ${songs.length}/${ids.length} 首`);
    }

    return playlists;
}

/**
 * 获取所有歌曲的扁平列表（兼容 GlobalAudio）
 */
export async function getMusicList(): Promise<MusicItem[]> {
    const playlists = await getAllPlaylists();
    return playlists.flatMap(p => p.songs);
}

// 保持兼容
export const musicList: MusicItem[] = [];
