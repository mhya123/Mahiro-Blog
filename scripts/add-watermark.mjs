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

// ─── SVG 水印生成（瓦片复用，体积小得多）──────────────
function generateWatermarkSvg(width, height, text) {
    const fontSize  = Math.max(14, Math.floor(Math.min(width, height) / 30));
    const opacity   = 0.15;
    const rotate    = -30;

    // 单个文字的估算宽高
    const tw = text.length * fontSize * 0.6;
    const th = fontSize * 1.2;

    // 瓦片尺寸（带间距）
    const tileW = Math.round(tw * 1.6);
    const tileH = Math.round(th * 5);

    // 用 <pattern> 平铺，SVG 体积固定不随图片尺寸增长
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
             patternTransform="rotate(${rotate})">
      <text x="${tileW / 2}" y="${tileH / 2}"
            fill="white" fill-opacity="${opacity}"
            stroke="black" stroke-width="0.8" stroke-opacity="${opacity * 0.6}"
            font-family="Arial,Helvetica,sans-serif"
            font-size="${fontSize}" font-weight="bold"
            text-anchor="middle" dominant-baseline="central">${text}</text>
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
