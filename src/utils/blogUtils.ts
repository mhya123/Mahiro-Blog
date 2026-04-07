import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import { BLOG_PAGINATION_ELLIPSIS_THRESHOLD } from "@config";

/**
 * 获取所有博客文章并根据环境过滤草稿
 * @returns 博客文章集合
 */
export async function getAllPosts(): Promise<CollectionEntry<"blog">[]> {
  // 强制重新加载所有博客文章，确保获取最新的badge信息
  const allBlogPosts = await getCollection("blog", () => true);

  // 在生产环境中过滤掉草稿文章
  return import.meta.env.PROD
    ? allBlogPosts.filter((post: CollectionEntry<"blog">) => !post.data.draft)
    : allBlogPosts;
}

/**
 * 按发布日期对文章进行排序（最新的排在前面）
 * @param posts 需要排序的文章
 * @returns 排序后的文章
 */
export function sortPostsByDate(posts: CollectionEntry<"blog">[]): CollectionEntry<"blog">[] {
  return [...posts].sort(
    (a: CollectionEntry<"blog">, b: CollectionEntry<"blog">) =>
      new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime(),
  );
}

/**
 * 将文章按置顶和日期排序
 * @param posts 需要排序的文章
 * @returns 排序后的文章 (置顶文章优先，然后是按日期排序)
 */
export function sortPostsByPinAndDate(posts: CollectionEntry<"blog">[]): CollectionEntry<"blog">[] {
  const topPosts = posts.filter((blog: CollectionEntry<"blog">) => blog.data.badge === "Pin");
  const otherPosts = posts.filter((blog: CollectionEntry<"blog">) => blog.data.badge !== "Pin");

  const sortedTopPosts = sortPostsByDate(topPosts);
  const sortedOtherPosts = sortPostsByDate(otherPosts);

  return [...sortedTopPosts, ...sortedOtherPosts];
}

/**
 * 获取所有文章标签并统计每个标签的数量
 * @param posts 文章集合
 * @returns 标签映射 (标签名 -> 计数)
 */
export function getTagsWithCount(posts: CollectionEntry<"blog">[]): Map<string, number> {
  const tagMap = new Map<string, number>();

  posts.forEach((post: CollectionEntry<"blog">) => {
    if (post.data.tags) {
      post.data.tags.forEach((tag: string) => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      });
    }
  });

  return tagMap;
}

/**
 * 获取所有文章分类并按分类对文章进行分组
 * @param posts 文章集合
 * @returns 分类映射 (分类名 -> 文章数组)
 */
export function getCategoriesWithPosts(posts: CollectionEntry<"blog">[]): Map<string, CollectionEntry<"blog">[]> {
  const categoryMap = new Map<string, CollectionEntry<"blog">[]>();

  posts.forEach((post: CollectionEntry<"blog">) => {
    if (post.data.categories) {
      post.data.categories.forEach((category: string) => {
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(post);
      });
    }
  });

  return categoryMap;
}

/**
 * 获取按年份和月份分组的文章
 * @param posts 文章集合
 * @returns 嵌套映射 (年份 -> (月份 -> 文章数组))
 */
export function getPostsByYearAndMonth(posts: CollectionEntry<"blog">[]): Map<string, Map<string, CollectionEntry<"blog">[]>> {
  const postsByDate = new Map<string, Map<string, CollectionEntry<"blog">[]>>();

  posts.forEach((post: CollectionEntry<"blog">) => {
    const date = new Date(post.data.pubDate);
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    if (!postsByDate.has(year)) {
      postsByDate.set(year, new Map<string, CollectionEntry<"blog">[]>());
    }

    const yearMap = postsByDate.get(year)!;
    if (!yearMap.has(month)) {
      yearMap.set(month, []);
    }

    yearMap.get(month)!.push(post);
  });

  return postsByDate;
}

/**
 * 为分页生成页面链接
 * @param totalPages 总页数
 * @returns 包含活动链接和隐藏链接的对象
 */
export function generatePageLinks(totalPages: number): {
  active: string[];
  hidden: string[];
} {
  return generatePageLinksByCurrent(totalPages, 1);
}

/**
 * 根据当前页生成分页链接（首尾 + 当前页邻近页 + 省略号）
 * @param totalPages 总页数
 * @param currentPage 当前页码（1-based）
 * @returns 包含活动链接和隐藏链接的对象
 */
export function generatePageLinksByCurrent(
  totalPages: number,
  currentPage: number,
): {
  active: string[];
  hidden: string[];
} {
  const pages = {
    active: [] as string[],
    hidden: [] as string[],
  };

  if (totalPages <= 0) {
    return pages;
  }

  const current = Math.min(Math.max(currentPage || 1, 1), totalPages);

  // 页数小于阈值时，全部展示；达到阈值后开始使用省略模式
  if (totalPages < BLOG_PAGINATION_ELLIPSIS_THRESHOLD) {
    for (let i = 1; i <= totalPages; i++) {
      pages.active.push(i.toString());
    }
    return pages;
  }

  // 中间窗口：按阈值动态决定展示宽度（阈值越小，越容易出现省略号）
  const minInner = 2;
  const maxInner = totalPages - 1;
  const innerSlots = Math.max(1, BLOG_PAGINATION_ELLIPSIS_THRESHOLD - 2);

  let windowStart = current - Math.floor(innerSlots / 2);
  let windowEnd = windowStart + innerSlots - 1;

  if (windowStart < minInner) {
    windowStart = minInner;
    windowEnd = Math.min(maxInner, windowStart + innerSlots - 1);
  }

  if (windowEnd > maxInner) {
    windowEnd = maxInner;
    windowStart = Math.max(minInner, windowEnd - innerSlots + 1);
  }

  // 首项
  pages.active.push("1");

  // 左侧间隙：只要存在间隙就显示省略号（超过阈值时强制体现压缩）
  if (windowStart > 2) {
    pages.active.push("...");
  }

  for (let i = windowStart; i <= windowEnd; i++) {
    pages.active.push(i.toString());
  }

  // 右侧间隙：只要存在间隙就显示省略号（超过阈值时强制体现压缩）
  if (windowEnd < totalPages - 1) {
    pages.active.push("...");
  }

  // 末项
  pages.active.push(totalPages.toString());

  // 生成 hidden（用于下拉跳转）
  const visibleNumbers = new Set<number>(
    pages.active.filter((item) => item !== "...").map((item) => Number(item)),
  );

  for (let i = 2; i <= totalPages - 1; i++) {
    if (!visibleNumbers.has(i)) {
      pages.hidden.push(i.toString());
    }
  }

  return pages;
}

/**
 * 获取文章并添加阅读时间和字数统计
 * @param posts 文章集合
 * @returns 带有统计信息的文章集合
 */
export async function getPostsWithStats(posts: CollectionEntry<"blog">[]): Promise<any[]> {
  return Promise.all(
    posts.map(async (blog: CollectionEntry<"blog">) => {
      const { remarkPluginFrontmatter } = await blog.render();
      return {
        ...blog,
        data: {
          ...blog.data,
        },
        remarkPluginFrontmatter: {
          readingTime: remarkPluginFrontmatter.readingTime,
          totalCharCount: remarkPluginFrontmatter.totalCharCount,
        },
      };
    }),
  );
}

/**
 * 获取标签的颜色类，基于标签频率
 * @param count 标签计数
 * @param max 最大计数
 * @returns 颜色类名
 */
export function getTagColorClass(count: number, max: number): string {
  const ratio = count / max;
  if (ratio > 0.8)
    return "tag-high";
  if (ratio > 0.6)
    return "tag-medium-high";
  if (ratio > 0.4)
    return "tag-medium";
  if (ratio > 0.2)
    return "tag-medium-low";
  return "tag-low";
}

/**
 * 计算标签的字体大小，基于标签频率
 * @param count 标签计数
 * @param max 最大计数
 * @param min 最小计数
 * @returns 字体大小 (rem)
 */
export function getTagFontSize(count: number, max: number, min: number): number {
  // 将计数值规范化到 0-1 之间
  const normalized = (count - min) / (max - min || 1);
  // 映射到 0.9rem 到 2rem 之间的字体大小
  return 0.9 + normalized * 1.1;
}

/**
 * 生成分类的颜色类
 * @param index 分类索引
 * @returns 颜色类名
 */
export function getCategoryColorClass(index: number): string {
  const colorClasses = [
    "category-primary",
    "category-secondary",
    "category-accent",
    "category-info",
    "category-success",
    "category-warning",
    "category-error",
  ];
  return colorClasses[index % colorClasses.length];
}
