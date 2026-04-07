export interface DiffLikeChange {
  type?: string;
  link?: string;
  guid?: string;
  diff?: unknown;
}

export function normalizePathname(pathname: string): string {
  const p = String(pathname || '');
  if (!p) return '/';
  const noQueryHash = p.split('#')[0].split('?')[0];
  if (noQueryHash.length > 1) return noQueryHash.replace(/\/+$/, '');
  return '/';
}

export function getRelativePath(absoluteUrl: string): string {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(absoluteUrl, base);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return String(absoluteUrl || '');
  }
}

export function isSameArticlePath(a: string, b: string): boolean {
  const left = normalizePathname(a);
  const right = normalizePathname(b);
  if (left === right) return true;
  if (`${left}/` === right) return true;
  if (`${right}/` === left) return true;
  return false;
}

export function findMatchedUpdatedChange(
  changes: DiffLikeChange[],
  pathname: string,
): DiffLikeChange | undefined {
  const currentPath = normalizePathname(pathname);

  return (Array.isArray(changes) ? changes : []).find((post) => {
    if (post?.type !== 'update' || !post?.diff) return false;
    const linkPath = normalizePathname(getRelativePath(post.link || ''));
    const guidPath = normalizePathname(getRelativePath(post.guid || post.link || ''));
    return [linkPath, guidPath].filter(Boolean).some((candidate) => isSameArticlePath(candidate, currentPath));
  });
}

export function buildDiffArticleHref(link: string, withHash = true): string {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(link, base);
    url.searchParams.set('diff', '1');
    if (withHash) url.hash = 'post-diff';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const raw = String(link || '');
    const hash = withHash ? '#post-diff' : '';
    if (!raw) return hash ? `?diff=1${hash}` : '?diff=1';
    const [basePart, oldHash = ''] = raw.split('#');
    const separator = basePart.includes('?') ? '&' : '?';
    const fallbackHash = withHash ? '#post-diff' : oldHash ? `#${oldHash}` : '';
    return `${basePart}${separator}diff=1${fallbackHash}`;
  }
}
