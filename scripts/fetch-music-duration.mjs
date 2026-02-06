
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseBuffer } from 'music-metadata';

const MUSIC_DATA_PATH = path.resolve('src/data/music.json');

// Helper to format duration in MM:SS
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function fetchMusicDuration() {
  try {
    const data = await fs.readFile(MUSIC_DATA_PATH, 'utf-8');
    const musicList = JSON.parse(data);
    let hasChanges = false;

    console.log('🎵 Starting music duration fetch...');

    for (const item of musicList) {
      if (item.url && !item.duration) {
        console.log(`Processing: ${item.title} - ${item.artist}`);
        try {
            // Fetch only the first 500KB - typically enough for metadata
            // Adjust range if metadata is at the end (like some ID3v1), but many valid FLAC/MP3 have it at start or we read enough.
            // For remote files, we can use Range header to be efficient.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(item.url, {
                headers: {
                    'Range': 'bytes=0-500000', // First 500KB
                    'User-Agent': 'RyuChan-Build-Script/1.0' 
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok && response.status !== 206) {
                console.warn(`Failed to fetch ${item.url}: ${response.status} ${response.statusText}`);
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Using parseBuffer since we have a chunk. 
            // Note: If metadata is outside this chunk, this might fail or return undefined.
            // For reliable results on variable inputs, we might need a tokenizer that can read from a web stream.
            // But parseBuffer is simplest for a script.
            const metadata = await parseBuffer(buffer, { mimeType: response.headers.get('content-type') });
            
            if (metadata && metadata.format && metadata.format.duration) {
                const durationStr = formatDuration(metadata.format.duration);
                item.duration = durationStr;
                hasChanges = true;
                console.log(`  -> Duration: ${durationStr}`);
            } else {
                console.warn(`  -> Could not determine duration from first 500KB`);
            }

        } catch (error) {
           console.error(`  -> Error processing ${item.title}:`, error.message);
        }
      }
    }

    if (hasChanges) {
      await fs.writeFile(MUSIC_DATA_PATH, JSON.stringify(musicList, null, 4), 'utf-8');
      console.log('✅ Music data updated with durations.');
    } else {
      console.log('✨ No changes needed.');
    }

  } catch (error) {
    console.error('Fatal error in music script:', error);
    process.exit(1);
  }
}

fetchMusicDuration();
