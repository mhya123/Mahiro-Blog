/**
 * 音乐数据层
 * 通过 Meting API 从网易云音乐解析歌曲信息
 * 在构建时执行，结果传递给组件作为静态 props
 */
import { MUSIC_CONFIG } from "@config";
import musicIds from './music-ids.json';

export interface MusicItem {
    title: string;
    artist: string;
    cover: string;
    url: string;
    lrc?: string;
    duration?: string;
    id?: string | number;
}

interface MetingResponse {
    name: string;
    artist: string;
    url: string;
    pic: string;
    lrc: string;
}

interface MusicIdEntry {
    id: string | number;
    comment?: string;
}

const API_BASE = MUSIC_CONFIG?.api || 'https://api.qijieya.cn/meting';

// 从 music-ids.json 获取 ID 列表，回退到 config
function getPlaylistIds(): (string | number)[] {
    const jsonIds = (musicIds as MusicIdEntry[]).map(entry => entry.id);
    if (jsonIds.length > 0) return jsonIds;
    return MUSIC_CONFIG?.playlist || [];
}

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
 * 批量获取播放列表
 * 从 mahiro.config.yaml 的 music.playlist 读取 ID 列表
 */
export async function fetchPlaylist(): Promise<MusicItem[]> {
    const ids = getPlaylistIds();
    if (ids.length === 0) {
        console.log('[Music] 播放列表为空');
        return [];
    }

    console.log(`[Music] 正在解析 ${ids.length} 首歌曲...`);

    const results = await Promise.allSettled(
        ids.map((id) => fetchSongById(id))
    );

    const songs: MusicItem[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            songs.push(result.value);
        }
    }

    console.log(`[Music] 成功解析 ${songs.length}/${ids.length} 首歌曲`);
    return songs;
}

// 保持兼容：如果有本地 music.json 数据则回退使用
let fallbackData: MusicItem[] = [];
try {
    const mod = await import('./music.json');
    fallbackData = mod.default || [];
} catch {
    // 无 music.json 文件
}

/**
 * 获取最终播放列表
 * 优先使用 Meting API（config 中有 playlist），否则回退到 music.json
 */
export async function getMusicList(): Promise<MusicItem[]> {
    const configIds = getPlaylistIds();
    if (configIds.length > 0) {
        return fetchPlaylist();
    }
    return fallbackData;
}

// 保持原来的导出兼容
export const musicList: MusicItem[] = fallbackData;
