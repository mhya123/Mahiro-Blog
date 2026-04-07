import { promises as fs } from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import sharp from 'sharp';
import yaml from 'js-yaml';

const DEFAULT_RANDOM_COVER_SOURCES = [
  'https://t.alcy.cc/ycy',
  'https://moe.jitsu.top/img/?sort=pc&size=mw2048',
];
const BLOG_DIR = 'src/content/blog';
const COVER_DIR = 'public/images/covers';
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|avif|gif)$/i;
const CONFIG_PATH = path.resolve('mahiro.config.yaml');

function parseArgs(argv) {
  const args = {
    sourceUrl: undefined,
    quality: 82,
    effort: 5,
    dryRun: false,
    force: false,
    limit: undefined,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--url=')) args.sourceUrl = arg.slice('--url='.length);
    else if (arg.startsWith('--quality=')) {
      const v = Number(arg.slice('--quality='.length));
      if (Number.isFinite(v) && v >= 1 && v <= 100) args.quality = v;
    }
    else if (arg.startsWith('--effort=')) {
      const v = Number(arg.slice('--effort='.length));
      if (Number.isFinite(v) && v >= 0 && v <= 6) args.effort = v;
    }
    else if (arg.startsWith('--limit=')) {
      const v = Number(arg.slice('--limit='.length));
      if (Number.isFinite(v) && v > 0) args.limit = Math.floor(v);
    }
  }

  return args;
}

function parseFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!match)
    return { data: {}, content: normalized, hasFrontmatter: false };

  return {
    data: yaml.load(match[1]) || {},
    content: match[2],
    hasFrontmatter: true,
  };
}

function stringifyFrontmatter(data, content) {
  return `---\n${yaml.dump(data)}---\n${content}`;
}

function shouldAssignRandomCover(image, sourceUrl, force) {
  if (force) return true;
  if (!image) return true;
  if (image === '/home.webp') return true;
  if (typeof image === 'string' && sourceUrl.some(url => image.startsWith(url))) return true;
  return false;
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(url => typeof url === 'string' && /^https?:\/\//i.test(url)))];
}

async function loadCoverSourcesFromConfig() {
  try {
    const text = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = yaml.load(text) || {};
    const configUrls = parsed?.site?.blog?.randomCoverSources;
    if (Array.isArray(configUrls)) {
      const urls = uniqueUrls(configUrls);
      if (urls.length > 0) return urls;
    }
  } catch {
    // ignore config parse errors and use defaults
  }
  return [...DEFAULT_RANDOM_COVER_SOURCES];
}

function isRemoteUrl(image) {
  return typeof image === 'string' && /^https?:\/\//i.test(image);
}

function normalizeLocalPublicPath(image) {
  if (typeof image !== 'string' || !image.startsWith('/')) return null;
  return path.resolve('public', image.slice(1));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadRandomCover(url, outputPath, quality, effort) {
  const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_seed=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetch(requestUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mahiro-Blog-Cover-Cacher/1.0',
      Accept: 'image/*,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('image')) {
    throw new Error(`Unexpected content-type: ${contentType || 'unknown'}`);
  }

  const arr = await res.arrayBuffer();
  const buffer = Buffer.from(arr);

  await sharp(buffer)
    .webp({ quality, effort })
    .toFile(outputPath);
}

async function downloadRandomCoverWithFallback(sources, outputPath, quality, effort) {
  let lastError = null;

  for (const source of sources) {
    try {
      await downloadRandomCover(source, outputPath, quality, effort);
      return source;
    } catch (error) {
      lastError = error;
      console.warn(`[Random Cover] Source failed: ${source} -> ${error?.message || error}`);
    }
  }

  throw lastError || new Error('All random cover sources failed');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFirstImageInPostFolder(slug) {
  const postImageDir = path.resolve('public/images', slug);
  try {
    const entries = await fs.readdir(postImageDir, { withFileTypes: true });
    const file = entries
      .filter(entry => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b))[0];

    if (!file) return null;
    return `/images/${slug}/${file}`;
  }
  catch {
    return null;
  }
}

async function isFrontmatterLocalImageMissing(image) {
  const localPath = normalizeLocalPublicPath(image);
  if (!localPath)
    return false;
  return !(await fileExists(localPath));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configSources = await loadCoverSourcesFromConfig();
  const sourceUrls = uniqueUrls(args.sourceUrl ? [args.sourceUrl, ...configSources] : configSources);

  console.log('[Random Cover] Start caching random covers for blog posts...');
  console.log(`[Random Cover] sources=${sourceUrls.join(' -> ')}, quality=${args.quality}, effort=${args.effort}, dryRun=${args.dryRun}, force=${args.force}${args.limit ? `, limit=${args.limit}` : ''}`);

  await ensureDir(COVER_DIR);

  let postFiles = await glob(`${BLOG_DIR}/**/*.{md,mdx}`);
  postFiles = postFiles.sort((a, b) => a.localeCompare(b));
  if (args.limit)
    postFiles = postFiles.slice(0, args.limit);

  let scanned = 0;
  let downloaded = 0;
  let reused = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let repairedMissing = 0;

  for (const file of postFiles) {
    scanned++;
    const raw = await fs.readFile(file, 'utf8');
    const { data, content, hasFrontmatter } = parseFrontmatter(raw);

    if (!hasFrontmatter) {
      skipped++;
      continue;
    }

    const currentImage = data.image;
    const localImageMissing = await isFrontmatterLocalImageMissing(currentImage);
    const needRandomCover =
      shouldAssignRandomCover(currentImage, sourceUrls, args.force)
      || localImageMissing;

    if (localImageMissing) {
      console.log(`[Random Cover] Missing local image, will repair: ${file} -> ${currentImage}`);
    }

    // 对远程第三方 URL 不做存在性校验，也不强制替换（除非 --force）
    if (!needRandomCover && isRemoteUrl(currentImage)) {
      skipped++;
      continue;
    }

    if (!needRandomCover) {
      skipped++;
      continue;
    }

    const slug = path.basename(file, path.extname(file));
    const localCoverRel = `/images/covers/${slug}.webp`;
    const localCoverAbs = path.resolve(COVER_DIR, `${slug}.webp`);

    try {
      // 防止多次调用随机图床：先复用文章目录中已有图片
      const existingPostImage = await findFirstImageInPostFolder(slug);
      if (existingPostImage) {
        reused++;
        if (localImageMissing)
          repairedMissing++;
        if (data.image !== existingPostImage) {
          data.image = existingPostImage;
          if (!args.dryRun) {
            const next = stringifyFrontmatter(data, content);
            await fs.writeFile(file, next, 'utf8');
          }
          updated++;
        }
        continue;
      }

      const exists = await fileExists(localCoverAbs);
      if (!exists || args.force) {
        let usedSource = sourceUrls[0] || DEFAULT_RANDOM_COVER_SOURCES[0];
        if (!args.dryRun) {
          usedSource = await downloadRandomCoverWithFallback(sourceUrls, localCoverAbs, args.quality, args.effort);
        }
        downloaded++;
        console.log(`[Random Cover] ${args.dryRun ? '[dry-run] ' : ''}downloaded: ${slug}.webp${args.dryRun ? '' : ` (source: ${usedSource})`}`);
      } else {
        reused++;
        if (localImageMissing)
          repairedMissing++;
      }

      if (data.image !== localCoverRel) {
        data.image = localCoverRel;
        if (!args.dryRun) {
          const next = stringifyFrontmatter(data, content);
          await fs.writeFile(file, next, 'utf8');
        }
        updated++;
      }
    } catch (error) {
      failed++;
      console.error(`[Random Cover] failed: ${file}`, error?.message || error);
    }
  }

  console.log(`[Random Cover] Done. scanned=${scanned}, downloaded=${downloaded}, reused=${reused}, repairedMissing=${repairedMissing}, frontmatterUpdated=${updated}, skipped=${skipped}, failed=${failed}`);
}

main().catch((error) => {
  console.error('[Random Cover] fatal:', error);
  process.exit(1);
});
