import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';
import sharp from 'sharp';
import yaml from 'js-yaml';
import opentype from 'opentype.js';

// ─── 配置 ────────────────────────────────────────────
const CACHE_FILE  = 'scripts/.watermark-cache.json';
const SOURCE_DIR  = 'public/images-original';
const TARGET_DIR  = 'public/images';
const CONCURRENCY = 8;                    // 并行处理数
const SUPPORTED   = '{jpg,jpeg,png,webp}'; // gif 不做水印（会丢帧）
const WATERMARK_FONT_PATH = 'public/watermarkfont/HFSimpleElegance-2.ttf';

let cachedFontBuffer = undefined;
let cachedParsedFont = undefined;

function loadWatermarkFontBuffer() {
    if (cachedFontBuffer !== undefined) return cachedFontBuffer;
    const absFontPath = path.resolve(process.cwd(), WATERMARK_FONT_PATH);

    try {
        if (!fs.existsSync(absFontPath)) {
            cachedFontBuffer = null;
            return cachedFontBuffer;
        }
        cachedFontBuffer = fs.readFileSync(absFontPath);
        return cachedFontBuffer;
    } catch {
        cachedFontBuffer = null;
        return cachedFontBuffer;
    }
}

function loadParsedFont() {
    if (cachedParsedFont !== undefined) return cachedParsedFont;
    const fontBuffer = loadWatermarkFontBuffer();
    if (!fontBuffer) {
        cachedParsedFont = null;
        return cachedParsedFont;
    }

    try {
        const arrayBuffer = fontBuffer.buffer.slice(
            fontBuffer.byteOffset,
            fontBuffer.byteOffset + fontBuffer.byteLength,
        );
        cachedParsedFont = opentype.parse(arrayBuffer);
        return cachedParsedFont;
    } catch {
        cachedParsedFont = null;
        return cachedParsedFont;
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

function generateWatermarkSvgWithFont(width, height, text, font) {
    const fontSize = Math.max(18, Math.floor(Math.min(width, height) / 22));
    const opacity = 0.1;
    const rotate = -30;

    const glyphPath = font.getPath(text, 0, fontSize, fontSize, { kerning: true });
    const pathD = glyphPath.toPathData(2);

    const metrics = glyphPath.getBoundingBox();
    const textWidth = Math.max(1, metrics.x2 - metrics.x1);
    const textHeight = Math.max(1, metrics.y2 - metrics.y1);

    const tileW = Math.round(textWidth + fontSize * 10);
    const tileH = Math.round(textHeight + fontSize * 3.2);
    const offsetX = Math.round((tileW - textWidth) / 2 - metrics.x1);
    const offsetY = Math.round((tileH - textHeight) / 2 - metrics.y1);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse"
             patternTransform="rotate(${rotate})">
      <g transform="translate(${offsetX},${offsetY})">
        <path d="${escapeXml(pathD)}" fill="rgba(255,255,255,${opacity})" />
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;
}

function generateWatermarkSvg(width, height, text) {
    const font = loadParsedFont();
    if (!font) {
        throw new Error(`未找到水印字体文件：${WATERMARK_FONT_PATH}`);
    }
    return generateWatermarkSvgWithFont(width, height, text, font);
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
function ensureDirForFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sourceToTargetPath(sourceFile) {
    const sourceAbs = path.resolve(process.cwd(), SOURCE_DIR);
    const targetAbs = path.resolve(process.cwd(), TARGET_DIR);
    const relative = path.relative(sourceAbs, sourceFile);
    return path.join(targetAbs, relative);
}

function normalizeFileArgToSourcePath(fileArg) {
    const resolved = path.resolve(process.cwd(), fileArg);
    const sourceAbs = path.resolve(process.cwd(), SOURCE_DIR);
    const targetAbs = path.resolve(process.cwd(), TARGET_DIR);

    if (resolved.startsWith(sourceAbs)) return resolved;

    if (resolved.startsWith(targetAbs)) {
        const relative = path.relative(targetAbs, resolved);
        return path.join(sourceAbs, relative);
    }

    return resolved;
}

async function processOne(sourceFile, siteUrl, cache) {
    const sourceRelPath = path.relative(process.cwd(), sourceFile).replace(/\\/g, '/');
    const targetFile = sourceToTargetPath(sourceFile);
    const targetRelPath = path.relative(process.cwd(), targetFile).replace(/\\/g, '/');
    const cacheKey = `${sourceRelPath}=>${targetRelPath}`;

    const inputBuffer = fs.readFileSync(sourceFile);
    const hash = fileHash(inputBuffer);

    // 缓存命中 → 跳过
    if (!FORCE && cache[cacheKey] === hash) return null;

    if (DRY) {
        console.log(`  [dry-run] ${sourceRelPath} -> ${targetRelPath}`);
        return null;
    }

    const image    = sharp(inputBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
        console.warn(`  ⚠ Skip (no dimensions): ${sourceRelPath}`);
        return null;
    }

    const svgBuf = Buffer.from(generateWatermarkSvg(metadata.width, metadata.height, siteUrl));

    const outputBuffer = await image
        .composite([{ input: svgBuf, blend: 'over' }])
        .toBuffer();

    ensureDirForFile(targetFile);
    fs.writeFileSync(targetFile, outputBuffer);

    // 更新缓存为处理后的 hash
    cache[cacheKey] = hash;
    return targetRelPath;
}

// ─── 主流程 ───────────────────────────────────────────
async function main() {
    const siteUrl = getSiteUrl();
    const t0 = performance.now();
    const fontReady = Boolean(loadParsedFont());
    if (!fontReady) {
        throw new Error(`缺少水印字体，请确认文件存在：${WATERMARK_FONT_PATH}`);
    }

    console.log(`\n🖼  Watermark Script`);
    console.log(`   Text : ${siteUrl}`);
    console.log(`   Font : ${WATERMARK_FONT_PATH}`);
    console.log(`   From : ${SOURCE_DIR}/`);
    console.log(`   To   : ${TARGET_DIR}/`);
    if (SINGLE_FILE_ARG) console.log(`   File : ${SINGLE_FILE_ARG}`);
    if (FORCE) console.log('   Mode : --force (ignore cache)');
    if (DRY)   console.log('   Mode : --dry-run');

    let files = [];
    if (SINGLE_FILE_ARG) {
        const resolvedFile = normalizeFileArgToSourcePath(SINGLE_FILE_ARG);
        if (!fs.existsSync(resolvedFile)) {
            throw new Error(`指定文件不存在（原图目录）: ${SINGLE_FILE_ARG}`);
        }

        const ext = path.extname(resolvedFile).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            throw new Error(`不支持的图片格式: ${ext}`);
        }
        files = [resolvedFile];
    } else {
        files = await glob(`${SOURCE_DIR}/**/*.${SUPPORTED}`);
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
