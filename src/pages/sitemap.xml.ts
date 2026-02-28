import { getCollection } from "astro:content";
import { SITE_URL } from "@/config";

export async function GET(context: any) {
  const posts = await getCollection("blog");
  const sortedPosts = posts.sort((a: any, b: any) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime());

  // 使用配置中的站点由于或者退回默认
  const siteUrl = context.site?.href || SITE_URL;
  const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

  // 根据 robots.txt 优化的静态白名单路由（严格排除 /write, /config, /api 等后台路径）
  const staticPages = [
    '',          // 首页
    '/about',    // 关于
    '/friend',   // 友链
    '/music',    // 音乐
    '/project',  // 项目
  ];

  const staticUrls = staticPages.map(page => `  <url>
    <loc>${baseUrl}${page}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join("\n");

  const postUrls = sortedPosts.map((blog: any) => `  <url>
    <loc>${baseUrl}/blog/${blog.slug}/</loc>
    <lastmod>${new Date(blog.data.updatedDate || blog.data.pubDate).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join("\n");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${postUrls}
</urlset>`.trim();

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400"
    },
  });
}
