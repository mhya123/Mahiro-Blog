import type { APIRoute } from "astro";
import { SITE_URL } from "@/config";

function getRobotsTxt(sitemapURL: URL) {
  return `User-agent: *
Allow: /

# 禁止搜索引擎抓取私有路由及后台管理页
Disallow: /write/
Disallow: /config/
Disallow: /api/

# 禁止抓取框架编译生成的内部资源目录
Disallow: /_astro/
Disallow: /.vercel/

# 禁止抓取带有查询参数的动态链接，避免页面权重分散和重复收录
Disallow: /*?*

Sitemap: ${sitemapURL.href}`;
}

export const GET: APIRoute = ({ site }) => {
  // 自动回退域名兜底，且指向正确的自建 sitemap.xml
  const sitemapURL = new URL("sitemap.xml", site || SITE_URL);

  return new Response(getRobotsTxt(sitemapURL), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
};
