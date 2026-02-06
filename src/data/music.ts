export interface MusicItem {
    title: string;
    artist: string;
    cover: string;
    url: string;
    lrc?: string;
    duration?: string;
}

/**
 * 此时歌曲数据源于 './music.json'.
 * 请在该文件中添加新歌曲.
 * 格式如下:
 * {
 *   "title": "新歌歌名",
 *   "artist": "歌手",
 *   "cover": "封面链接",
 *   "url": "音频链接",
 *   "lrc": "歌词链接(可选)",
 *   "duration": "00:00(将会自动抓取)"
 * }
 * 
 * 运行 `pnpm prefetch:music` 即可自动获取并填充 duration (时长) 字段.
 */
import musicData from './music.json';

export const musicList: MusicItem[] = musicData;
