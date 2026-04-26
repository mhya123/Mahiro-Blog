/**
 * robots.txt 动态生成端点
 *
 * 功能：
 * - 动态生成标准 robots.txt，自动关联站点 Sitemap 地址
 * - 白名单策略：默认允许所有爬虫，仅精确屏蔽后台与敏感路径
 * - 屏蔽框架编译产物目录（/_astro/, /.vercel/）防止无意义索引
 * - 屏蔽带查询参数的动态链接，避免重复索引导致 SEO 权重稀释
 * - 额外屏蔽 AI 训练爬虫（GPTBot, CCBot 等），保护原创内容
 *
 * 路由: /robots.txt
 */

import type { APIRoute } from "astro";
import { SITE_URL } from "@/config";

function buildRobotsTxt(sitemapURL: URL): string {
  return `# ==========================================================
# Mahiro Blog - robots.txt
# 白名单策略：默认允许，精确屏蔽后台与敏感路径
# ==========================================================

# ── 通用爬虫规则 ──
User-agent: *
Allow: /

# 后台管理页面（写作台、配置面板、API 接口）
Disallow: /write/
Disallow: /config/
Disallow: /api/

# 框架编译产物与平台内部目录
Disallow: /_astro/
Disallow: /.vercel/
Disallow: /_image

# 带查询参数的动态链接（防止重复索引导致 SEO 权重稀释）
Disallow: /*?*

# ── AI 爬虫限制（保护原创内容不被未经授权地用于模型训练）──
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Bytespider
Disallow: /

# ── 站点地图 ──
Sitemap: ${sitemapURL.href}
`;
}

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap.xml", site || SITE_URL);

  return new Response(buildRobotsTxt(sitemapURL), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
};
