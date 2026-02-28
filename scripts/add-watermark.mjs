import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import sharp from 'sharp';

const CACHE_FILE = 'scripts/.watermark-cache.json';
const TARGET_DIR = 'public/images'; // 适配博客静态图片目录

// 博客链接配置
const DEFAULT_SITE_URL = 'https://www.mahiro.work';

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        } catch (e) {
            return {};
        }
    }
    return {};
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function generateWatermarkSvg(width, height, text) {
    const fontSize = Math.max(14, Math.floor(width / 35));
    const opacity = 0.15;
    const rotate = -30;
    const rotateRad = Math.abs(rotate * Math.PI / 180);

    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize;

    const bboxWidth = textWidth * Math.cos(rotateRad) + textHeight * Math.sin(rotateRad);
    const bboxHeight = textWidth * Math.sin(rotateRad) + textHeight * Math.cos(rotateRad);

    const stepX = bboxWidth * 1.1;
    const stepY = bboxHeight * 1.2;

    let svgContent = '';

    const diagonal = Math.sqrt(width * width + height * height);

    if (width < bboxWidth * 0.6 || height < bboxHeight * 0.6) {
        svgContent = `<text x="0" y="0" 
                fill="white" fill-opacity="${opacity}" 
                stroke="black" stroke-width="1" stroke-opacity="${opacity}"
                transform="rotate(${rotate})"
                font-family="Arial, sans-serif" 
                font-size="${fontSize}" 
                font-weight="bold"
                text-anchor="middle"
                dominant-baseline="middle"
            >${text}</text>`;
    } else {
        for (let y = -diagonal; y < diagonal; y += stepY) {
            const rowOffset = (Math.floor(y / stepY) % 2) * (stepX / 2);

            for (let x = -diagonal; x < diagonal; x += stepX) {
                const drawX = x + rowOffset;
                const drawY = y;

                svgContent += `<text x="${drawX}" y="${drawY}" 
                    fill="white" fill-opacity="${opacity}" 
                    stroke="black" stroke-width="1" stroke-opacity="${opacity}"
                    transform="rotate(${rotate}, ${drawX}, ${drawY})"
                    font-family="Arial, sans-serif" 
                    font-size="${fontSize}" 
                    font-weight="bold"
                    text-anchor="middle"
                    dominant-baseline="middle"
                >${text}</text>`;
            }
        }
    }

    return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(${width / 2}, ${height / 2})">
            ${svgContent}
        </g>
    </svg>
    `;
}

async function processImages() {
    const siteUrl = DEFAULT_SITE_URL;
    console.log(`[Watermark] Using watermark text: ${siteUrl}`);

    const cache = loadCache();
    // Use posix path matching for glob compatibility
    const files = await glob(`${TARGET_DIR}/**/*.{jpg,jpeg,png,webp,gif}`);

    console.log(`[Watermark] Found ${files.length} images in ${TARGET_DIR}.`);

    let processedCount = 0;

    for (const file of files) {
        const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');
        const stats = fs.statSync(file);
        const mtime = stats.mtimeMs;

        if (cache[relativePath] && cache[relativePath] === mtime) {
            continue;
        }

        console.log(`[Watermark] Processing ${relativePath}...`);

        try {
            const inputBuffer = fs.readFileSync(file);
            const image = sharp(inputBuffer);
            const metadata = await image.metadata();

            if (!metadata.width || !metadata.height) {
                console.warn(`[Watermark] Skipping ${relativePath}: Could not get dimensions`);
                continue;
            }

            const watermarkSvg = await generateWatermarkSvg(metadata.width, metadata.height, siteUrl);
            const svgBuffer = Buffer.from(watermarkSvg);

            const outputBuffer = await image
                .composite([{ input: svgBuffer, blend: 'over' }])
                .toBuffer();

            // Writes to the same file
            fs.writeFileSync(file, outputBuffer);

            const newStats = fs.statSync(file);
            cache[relativePath] = newStats.mtimeMs;
            processedCount++;

        } catch (error) {
            console.error(`[Watermark] Error processing ${relativePath}:`, error);
        }
    }

    saveCache(cache);
    console.log(`[Watermark] Done. Processed ${processedCount} new/modified images.`);
}

processImages();
