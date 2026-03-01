import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import sharp from 'sharp';
import yaml from 'js-yaml';

// ─── 配置 ────────────────────────────────────────────
const CACHE_FILE  = 'scripts/.watermark-cache.json';
const TARGET_DIR  = 'public/images';
const CONCURRENCY = 8;                    // 并行处理数
const SUPPORTED   = '{jpg,jpeg,png,webp}'; // gif 不做水印（会丢帧）

// ─── 字符 → SVG path 映射（等宽简化字形，不依赖任何系统字体）───
// 每个字形基于 10×14 的网格绘制，字符间距由渲染时的 translate 控制
const GLYPH_PATHS = {
  'h': 'M2 0V14 M2 6Q2 4 5 4Q8 4 8 6V14',
  't': 'M5 0V14 M2 4H8',
  'p': 'M2 4V14 M2 4Q2 2 5 2H6Q9 2 9 5V6Q9 9 6 9H5Q2 9 2 7Z',
  's': 'M8 5Q8 3 5 3Q2 3 2 5Q2 6.5 5 7Q8 7.5 8 9Q8 11 5 11Q2 11 2 9',
  ':': 'M5 4V5 M5 9V10',
  '/': 'M8 0L2 14',
  '.': 'M5 12A1 1 0 1 0 5 14',
  'w': 'M1 4L3 14L5 8L7 14L9 4',
  'm': 'M1 4V14 M1 7Q1 4 3.5 4Q5 4 5 7V14 M5 7Q5 4 7.5 4Q9 4 9 7V14',
  'a': 'M8 4V11 M8 5Q8 4 5 4Q2 4 2 7.5Q2 11 5 11Q8 11 8 9',
  'i': 'M5 1V2 M5 4V14',
  'r': 'M2 4V14 M2 7Q2 4 5 4H7',
  'o': 'M5 4Q2 4 2 7V8Q2 11 5 11Q8 11 8 8V7Q8 4 5 4Z',
  'k': 'M2 0V14 M8 4L2 9L8 14',
  'e': 'M8 7H2V6Q2 4 5 4Q8 4 8 6V7Q2 8 2 10Q2 11 5 11Q8 11 8 10',
  'n': 'M2 4V14 M2 6Q2 4 5 4Q8 4 8 6V14',
  'b': 'M2 0V14 M2 5Q2 3 5 3H6Q9 3 9 6V8Q9 11 6 11H5Q2 11 2 9Z',
  'l': 'M5 0V14',
  'g': 'M8 4V11Q8 14 5 14Q2 14 2 12 M8 4H5Q2 4 2 7V8Q2 11 5 11H8',
  'c': 'M8 5Q8 4 5 4Q2 4 2 7V8Q2 11 5 11Q8 11 8 10',
  'u': 'M2 4V11Q2 14 5 14Q8 14 8 11V4',
  'x': 'M2 4L8 14 M8 4L2 14',
  'y': 'M2 4L5 9 M8 4L2 16',
  'd': 'M8 0V14 M8 5Q8 3 5 3Q2 3 2 6V8Q2 11 5 11Q8 11 8 9Z',
  '-': 'M2 7H8',
  '_': 'M0 14H10',
  '0': 'M5 2Q2 2 2 5V9Q2 12 5 12Q8 12 8 9V5Q8 2 5 2Z M3 11L7 3',
  '1': 'M3 4L5 2V14 M3 14H7',
  '2': 'M2 4Q2 2 5 2Q8 2 8 4V5Q8 7 2 11V12H8',
  '3': 'M2 3Q2 2 5 2Q8 2 8 4V5Q8 7 5 7Q8 7 8 9V10Q8 12 5 12Q2 12 2 11',
  '4': 'M7 2V14 M7 8H2V2L7 8',
  '5': 'M8 2H2V7H5Q8 7 8 9V10Q8 12 5 12Q2 12 2 10',
  '6': 'M7 2H5Q2 2 2 5V9Q2 12 5 12Q8 12 8 9V8Q8 6 5 6H2',
  '7': 'M2 2H8L4 14',
  '8': 'M5 2Q2 2 2 4V5Q2 7 5 7Q8 7 8 9V10Q8 12 5 12Q2 12 2 10V9Q2 7 5 7Q8 7 8 5V4Q8 2 5 2Z',
  '9': 'M3 12H5Q8 12 8 9V5Q8 2 5 2Q2 2 2 5V6Q2 8 5 8H8',
};

// 从 mahiro.config.yaml 读取站点 URL，回退到默认值
function getSiteUrl() {
    try {
        const raw = fs.readFileSync('mahiro.config.yaml', 'utf-8');
        const cfg = yaml.load(raw);
        return cfg?.site?.url || 'https://www.mahiro.work';
    } catch {
        return 'https://www.mahiro.work';
    }
}

// ─── CLI 参数 ─────────────────────────────────────────
const args = process.argv.slice(2);
const FORCE  = args.includes('--force');   // 忽略缓存，全部重新处理
const DRY    = args.includes('--dry-run'); // 仅列出将要处理的文件

// ─── 缓存：基于文件内容 hash，比 mtime 更可靠 ─────────
function loadCache() {
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveCache(cache) {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function fileHash(buf) {
    return crypto.createHash('md5').update(buf).digest('hex');
}

// ─── SVG 水印生成（用 path 绘制文字，不依赖系统字体）──────
function generateWatermarkSvg(width, height, text) {
    const baseFontSize = Math.max(14, Math.floor(Math.min(width, height) / 30));
    const opacity   = 0.15;
    const rotate    = -30;

    // 每个字形基于 10×14 网格，按 fontSize 缩放
    const glyphW = 10;
    const glyphH = 16; // 留余量给 descender (g, y, p 等)
    const scale  = baseFontSize / 14;  // 14 是字形设计高度
    const charW  = glyphW * scale;
    const gap    = charW * 0.15; // 字间距

    // 构建文字 path 组
    const chars = text.toLowerCase().split('');
    let pathsGroup = '';
    let cursorX = 0;
    for (const ch of chars) {
        const d = GLYPH_PATHS[ch];
        if (d) {
            pathsGroup += `<path d="${d}" transform="translate(${cursorX.toFixed(1)},0) scale(${scale.toFixed(3)})"/>`;
        }
        cursorX += charW + gap;
    }
    const textTotalW = cursorX;
    const textTotalH = glyphH * scale;

    // 瓦片尺寸（带间距）
    const tileW = Math.round(textTotalW * 1.5);
    const tileH = Math.round(textTotalH * 5);

    // 居中偏移
    const offsetX = (tileW - textTotalW) / 2;
    const offsetY = (tileH - textTotalH) / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
             patternTransform="rotate(${rotate})">
      <g transform="translate(${offsetX.toFixed(1)},${offsetY.toFixed(1)})"
         fill="none"
         stroke="white" stroke-opacity="${opacity}" stroke-width="${Math.max(1, scale * 1.2).toFixed(1)}"
         stroke-linecap="round" stroke-linejoin="round">
        ${pathsGroup}
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;
}

// ─── 并发控制器 ───────────────────────────────────────
async function parallelLimit(tasks, limit) {
    const results = [];
    let idx = 0;
    async function run() {
        while (idx < tasks.length) {
            const i = idx++;
            results[i] = await tasks[i]();
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => run()));
    return results;
}

// ─── 单张图片处理 ─────────────────────────────────────
async function processOne(file, siteUrl, cache) {
    const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');

    const inputBuffer = fs.readFileSync(file);
    const hash = fileHash(inputBuffer);

    // 缓存命中 → 跳过
    if (!FORCE && cache[relPath] === hash) return null;

    if (DRY) {
        console.log(`  [dry-run] ${relPath}`);
        return null;
    }

    const image    = sharp(inputBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
        console.warn(`  ⚠ Skip (no dimensions): ${relPath}`);
        return null;
    }

    const svgBuf = Buffer.from(generateWatermarkSvg(metadata.width, metadata.height, siteUrl));

    const outputBuffer = await image
        .composite([{ input: svgBuf, blend: 'over' }])
        .toBuffer();

    fs.writeFileSync(file, outputBuffer);

    // 更新缓存为处理后的 hash
    cache[relPath] = fileHash(outputBuffer);
    return relPath;
}

// ─── 主流程 ───────────────────────────────────────────
async function main() {
    const siteUrl = getSiteUrl();
    const t0 = performance.now();

    console.log(`\n🖼  Watermark Script`);
    console.log(`   Text : ${siteUrl}`);
    console.log(`   Dir  : ${TARGET_DIR}/`);
    if (FORCE) console.log('   Mode : --force (ignore cache)');
    if (DRY)   console.log('   Mode : --dry-run');

    const files = await glob(`${TARGET_DIR}/**/*.${SUPPORTED}`);
    console.log(`   Found: ${files.length} images\n`);

    if (files.length === 0) return;

    const cache = FORCE ? {} : loadCache();
    let processed = 0;
    let skipped   = 0;
    let errors    = 0;

    const tasks = files.map(file => async () => {
        try {
            const result = await processOne(file, siteUrl, cache);
            if (result) {
                processed++;
                console.log(`  ✔ ${result}`);
            } else {
                skipped++;
            }
        } catch (err) {
            errors++;
            const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
            console.error(`  ✖ ${rel}: ${err.message}`);
        }
    });

    await parallelLimit(tasks, CONCURRENCY);

    if (!DRY) saveCache(cache);

    const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
    console.log(`\n   Done in ${elapsed}s — processed: ${processed}, skipped: ${skipped}, errors: ${errors}\n`);
}

main();
