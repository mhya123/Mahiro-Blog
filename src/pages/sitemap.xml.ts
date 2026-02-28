import { getCollection } from "astro:content";

export async function GET(context: any) {
  const posts = await getCollection("blog");
  const sortedPosts = posts.sort((a: any, b: any) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime());

  // 使用配置中的站点由于或者退回默认
  const siteUrl = context.site?.href || "https://www.mahiro.work";

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${sortedPosts.map((blog: any) => `  <url>
    <loc>${new URL(`blog/${blog.slug}/`, siteUrl).href}</loc>
    <lastmod>${new Date(blog.data.updatedDate || blog.data.pubDate).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join("\n")}
</urlset>`.trim();

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600"
    },
  });
}
