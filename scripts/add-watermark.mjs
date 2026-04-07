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
const WATERMARK_FONT_PATH = 'public/watermarkfont/HFSimpleElegance-2.ttf';

let cachedFontDataUri = undefined;

function getFontMimeByExt(fontPath) {
    const ext = path.extname(fontPath).toLowerCase();
    if (ext === '.ttf') return 'font/ttf';
    if (ext === '.otf') return 'font/otf';
    if (ext === '.woff') return 'font/woff';
    if (ext === '.woff2') return 'font/woff2';
    return 'application/octet-stream';
}

function loadWatermarkFontDataUri() {
    if (cachedFontDataUri !== undefined) return cachedFontDataUri;
    const absFontPath = path.resolve(process.cwd(), WATERMARK_FONT_PATH);

    try {
        if (!fs.existsSync(absFontPath)) {
            cachedFontDataUri = null;
            return cachedFontDataUri;
        }
        const base64 = fs.readFileSync(absFontPath).toString('base64');
        cachedFontDataUri = `data:${getFontMimeByExt(absFontPath)};base64,${base64}`;
        return cachedFontDataUri;
    } catch {
        cachedFontDataUri = null;
        return cachedFontDataUri;
    }
}

function escapeXml(input) {
    return String(input)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}


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
const FILE_ARG_INDEX = args.indexOf('--file');
const SINGLE_FILE_ARG = FILE_ARG_INDEX >= 0 ? args[FILE_ARG_INDEX + 1] : null;

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

function generateWatermarkSvgWithFont(width, height, text, fontDataUri) {
        const safeText = escapeXml(text);
        const fontSize = Math.max(18, Math.floor(Math.min(width, height) / 22));
        const opacity = 0.1;
        const rotate = -30;

        const tileW = Math.round(fontSize * Math.max(18, safeText.length * 0.9));
        const tileH = Math.round(fontSize * 4.8);
        const x = Math.round(tileW * 0.1);
        const y = Math.round(tileH * 0.55);

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
        <style>
            @font-face {
                font-family: 'WatermarkFont';
                src: url('${fontDataUri}') format('truetype');
                font-display: block;
            }
            .wm-text {
                font-family: 'WatermarkFont', sans-serif;
                font-size: ${fontSize}px;
                fill: rgba(255,255,255,${opacity});
                letter-spacing: 0.04em;
            }
        </style>
        <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
                         patternTransform="rotate(${rotate})">
            <text class="wm-text" x="${x}" y="${y}">${safeText}</text>
        </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;
}

function generateWatermarkSvg(width, height, text) {
    const fontDataUri = loadWatermarkFontDataUri();
    if (!fontDataUri) {
        throw new Error(`未找到水印字体文件：${WATERMARK_FONT_PATH}`);
    }
    return generateWatermarkSvgWithFont(width, height, text, fontDataUri);
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
    const fontReady = Boolean(loadWatermarkFontDataUri());
    if (!fontReady) {
        throw new Error(`缺少水印字体，请确认文件存在：${WATERMARK_FONT_PATH}`);
    }

    console.log(`\n🖼  Watermark Script`);
    console.log(`   Text : ${siteUrl}`);
    console.log(`   Font : ${WATERMARK_FONT_PATH}`);
    console.log(`   Dir  : ${TARGET_DIR}/`);
    if (SINGLE_FILE_ARG) console.log(`   File : ${SINGLE_FILE_ARG}`);
    if (FORCE) console.log('   Mode : --force (ignore cache)');
    if (DRY)   console.log('   Mode : --dry-run');

    let files = [];
    if (SINGLE_FILE_ARG) {
        const resolvedFile = path.resolve(process.cwd(), SINGLE_FILE_ARG);
        if (!fs.existsSync(resolvedFile)) {
            throw new Error(`指定文件不存在: ${SINGLE_FILE_ARG}`);
        }

        const ext = path.extname(resolvedFile).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            throw new Error(`不支持的图片格式: ${ext}`);
        }
        files = [resolvedFile];
    } else {
        files = await glob(`${TARGET_DIR}/**/*.${SUPPORTED}`);
    }

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
