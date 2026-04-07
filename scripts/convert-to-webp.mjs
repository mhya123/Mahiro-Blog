import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { glob } from 'glob';
import sharp from 'sharp';

const IMAGE_DIR = 'public/images';
const CONTENT_DIR = 'src/content/blog';

function normalizePath(p) {
    return p.replace(/\\/g, '/');
}

function parseArgs(argv) {
    const args = {
        quality: 85,
        effort: 6,
        dryRun: false,
        keepOriginal: false,
        concurrency: Math.max(2, Math.min(8, os.cpus().length || 4)),
    };

    for (const arg of argv) {
        if (arg === '--dry-run') args.dryRun = true;
        else if (arg === '--keep-original') args.keepOriginal = true;
        else if (arg.startsWith('--quality=')) {
            const n = Number(arg.split('=')[1]);
            if (Number.isFinite(n) && n >= 1 && n <= 100) args.quality = n;
        }
        else if (arg.startsWith('--effort=')) {
            const n = Number(arg.split('=')[1]);
            if (Number.isFinite(n) && n >= 0 && n <= 6) args.effort = n;
        }
        else if (arg.startsWith('--concurrency=')) {
            const n = Number(arg.split('=')[1]);
            if (Number.isFinite(n) && n >= 1) args.concurrency = Math.floor(n);
        }
    }

    return args;
}

function createLimiter(limit) {
    let active = 0;
    const queue = [];

    const runNext = () => {
        if (active >= limit || queue.length === 0) return;
        const { fn, resolve, reject } = queue.shift();
        active++;
        Promise.resolve(fn())
            .then(resolve)
            .catch(reject)
            .finally(() => {
                active--;
                runNext();
            });
    };

    return (fn) => new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        runNext();
    });
}

async function statSafe(filePath) {
    try {
        return await fs.stat(filePath);
    }
    catch {
        return null;
    }
}

function extractImageRel(p) {
    const normalized = normalizePath(p);
    const idx = normalized.indexOf('/images/');
    return idx >= 0 ? normalized.slice(idx) : null;
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    sharp.concurrency(options.concurrency);

    console.log('[WebP Converter] Scanning for PNG/JPG/JPEG images...');
    console.log(`[WebP Converter] Settings: quality=${options.quality}, effort=${options.effort}, concurrency=${options.concurrency}, dryRun=${options.dryRun}, keepOriginal=${options.keepOriginal}`);

    const images = (await glob(`${IMAGE_DIR}/**/*.{png,jpg,jpeg}`)).map(normalizePath);

    if (images.length === 0) {
        console.log('[WebP Converter] All clear! No non-WebP images found.');
        return;
    }

    const conversionMap = new Map();
    const limiter = createLimiter(options.concurrency);

    let converted = 0;
    let skipped = 0;
    let failed = 0;
    let bytesBefore = 0;
    let bytesAfter = 0;

    await Promise.all(images.map((imgPath) => limiter(async () => {
        const parsed = path.parse(imgPath);
        const newPath = normalizePath(path.join(parsed.dir, `${parsed.name}.webp`));

        const srcStat = await statSafe(imgPath);
        if (!srcStat) {
            skipped++;
            return;
        }

        const dstStat = await statSafe(newPath);
        if (dstStat && dstStat.mtimeMs >= srcStat.mtimeMs) {
            skipped++;
            return;
        }

        try {
            bytesBefore += srcStat.size;

            if (!options.dryRun) {
                await sharp(imgPath)
                    .webp({ quality: options.quality, effort: options.effort })
                    .toFile(newPath);

                const newStat = await statSafe(newPath);
                if (newStat)
                    bytesAfter += newStat.size;

                if (!options.keepOriginal) {
                    await fs.unlink(imgPath);
                }
            }

            const oldRel = extractImageRel(imgPath);
            const newRel = extractImageRel(newPath);
            if (oldRel && newRel)
                conversionMap.set(oldRel, newRel);

            converted++;
            console.log(`[WebP Converter] Converted: ${parsed.base} -> ${parsed.name}.webp`);
        }
        catch (e) {
            failed++;
            console.error(`[WebP Converter] Failed to convert ${imgPath}:`, e);
        }
    })));

    let filesUpdated = 0;
    if (conversionMap.size > 0) {
        console.log('[WebP Converter] Updating Markdown references...');
        const mdFiles = await glob(`${CONTENT_DIR}/**/*.{md,mdx}`);

        for (const mdFile of mdFiles) {
            let content = await fs.readFile(mdFile, 'utf-8');
            let changed = false;

            for (const [oldRel, newRel] of conversionMap.entries()) {
                if (content.includes(oldRel)) {
                    content = content.split(oldRel).join(newRel);
                    changed = true;
                }

                const oldBase = path.basename(oldRel);
                const newBase = path.basename(newRel);
                if (content.includes(oldBase)) {
                    const escapedOldBase = escapeRegExp(oldBase);
                    const regex = new RegExp(`(?<=[/'\"])${escapedOldBase}(?=[\\s)'\"])`, 'g');
                    const pre = content;
                    content = content.replace(regex, newBase);
                    if (pre !== content) changed = true;
                }
            }

            if (changed && !options.dryRun) {
                await fs.writeFile(mdFile, content, 'utf-8');
                filesUpdated++;
            }
    }
        console.log(`[WebP Converter] Updated ${filesUpdated} markdown file(s) with new .webp extensions.`);
    }

    const saved = Math.max(0, bytesBefore - bytesAfter);
    const savedMB = (saved / 1024 / 1024).toFixed(2);

    console.log(`[WebP Converter] Complete! converted=${converted}, skipped=${skipped}, failed=${failed}, markdownUpdated=${filesUpdated}, estSaved=${savedMB}MB`);
}

main().catch(e => {
    console.error('[WebP Converter] Fatal error:', e);
    process.exit(1);
});
