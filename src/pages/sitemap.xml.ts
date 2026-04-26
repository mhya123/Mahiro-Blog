/**
 * Sitemap XML 生成端点
 *
 * 功能：
 * - 自动生成符合 sitemap.org 协议的 XML 站点地图
 * - 包含静态白名单页面（首页、关于、友链等）和所有博客文章
 * - 严格排除后台管理页面（/write, /config, /api）避免索引泄露
 * - 根据页面类型自动设定优先级（priority）和更新频率（changefreq）
 * - 文章 lastmod 优先使用 updatedDate，回退使用 pubDate
 *
 * 路由: /sitemap.xml
 */

import { getCollection } from "astro:content";
import { SITE_URL } from "@/config";

/** 静态页面定义（严格排除 /write, /config, /api 等后台路径） */
const STATIC_PAGES = [
  { path: "",            changefreq: "daily",  priority: "1.0" },  // 首页
  { path: "/about",      changefreq: "monthly", priority: "0.8" }, // 关于
  { path: "/friend",     changefreq: "weekly",  priority: "0.7" }, // 友链
  { path: "/music",      changefreq: "monthly", priority: "0.5" }, // 音乐
  { path: "/project",    changefreq: "weekly",  priority: "0.7" }, // 项目
  { path: "/navigation", changefreq: "weekly",  priority: "0.6" }, // 导航
  { path: "/drive",      changefreq: "weekly",  priority: "0.5" }, // 网盘
] as const;

/**
 * 生成单个 <url> XML 节点
 */
function buildUrlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET(context: any) {
  // ── 站点基础 URL 归一化 ──
  const siteUrl = context.site?.href || SITE_URL;
  const baseUrl = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  const now = new Date().toISOString();

  // ── 静态页面 URL 条目 ──
  const staticEntries = STATIC_PAGES.map((page) =>
    buildUrlEntry(`${baseUrl}${page.path}/`, now, page.changefreq, page.priority)
  );

  // ── 博客文章 URL 条目 ──
  const posts = await getCollection("blog");
  const sortedPosts = posts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  const postEntries = sortedPosts.map((post) => {
    const lastmod = new Date(post.data.updated || post.data.pubDate).toISOString();
    return buildUrlEntry(`${baseUrl}/blog/${post.slug}/`, lastmod, "weekly", "0.6");
  });

  // ── 组装完整 Sitemap XML ──
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join("\n")}
${postEntries.join("\n")}
</urlset>`.trim();

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
