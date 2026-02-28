import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import sharp from 'sharp';

const IMAGE_DIR = 'public/images';
const CONTENT_DIR = 'src/content/blog';

async function main() {
    console.log('[WebP Converter] Scanning for PNG/JPG/JPEG images...');

    // Using glob to match non-webp images
    const images = glob.sync(`${IMAGE_DIR}/**/*.{png,jpg,jpeg}`).map(p => p.replace(/\\/g, '/'));

    if (images.length === 0) {
        console.log('[WebP Converter] All clear! No non-WebP images found.');
        return;
    }

    const conversionMap = new Map();

    let count = 0;
    for (const imgPath of images) {
        const parsed = path.parse(imgPath);
        const newPath = path.join(parsed.dir, `${parsed.name}.webp`).replace(/\\/g, '/');

        try {
            await sharp(imgPath)
                .webp({ quality: 85, effort: 6 }) // effort 6 for better compression ratio
                .toFile(newPath);

            // Delete the original bloated image
            fs.unlinkSync(imgPath);

            // Store mapping to update the markdown posts
            // Extract the relative path like '/images/xxx/yyy.png'
            const oldRel = imgPath.substring(imgPath.indexOf('/images/'));
            const newRel = newPath.substring(newPath.indexOf('/images/'));

            conversionMap.set(oldRel, newRel);
            count++;
            console.log(`[WebP Converter] Converted: ${parsed.base} -> ${parsed.name}.webp`);
        } catch (e) {
            console.error(`[WebP Converter] Failed to convert ${imgPath}:`, e);
        }
    }

    if (conversionMap.size > 0) {
        console.log('[WebP Converter] Updating Markdown references...');
        const mdFiles = glob.sync(`${CONTENT_DIR}/**/*.{md,mdx}`);
        let filesUpdated = 0;

        for (const mdFile of mdFiles) {
            let content = fs.readFileSync(mdFile, 'utf-8');
            let changed = false;

            for (const [oldRel, newRel] of conversionMap.entries()) {
                // Replace root-relative paths like /images/path.png
                if (content.includes(oldRel)) {
                    content = content.split(oldRel).join(newRel);
                    changed = true;
                }

                // Also try replacing relative paths like path.png assuming just filename matches
                const oldBase = path.basename(oldRel);
                const newBase = path.basename(newRel);
                if (content.includes(oldBase)) {
                    // Use a safe regex to only replace the exact filename if it hasn't been completely covered
                    const regex = new RegExp(`(?<=[/'"])${oldBase}(?=[\\s)'"])`, 'g');
                    const pre = content;
                    content = content.replace(regex, newBase);
                    if (pre !== content) changed = true;
                }
            }

            if (changed) {
                fs.writeFileSync(mdFile, content, 'utf-8');
                filesUpdated++;
            }
        }
        console.log(`[WebP Converter] Updated ${filesUpdated} markdown file(s) with new .webp extensions.`);
    }

    console.log(`[WebP Converter] Complete! ${count} images successfully modernized to WebP format 🚀`);
}

main().catch(e => {
    console.error('[WebP Converter] Fatal error:', e);
    process.exit(1);
});
