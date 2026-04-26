/**
 * RSS 2.0 订阅源生成端点
 *
 * 功能：
 * - 自动抓取所有已发布文章，生成标准 RSS 2.0 XML
 * - 生产环境自动过滤草稿文章（draft: true）
 * - 将 Markdown 正文渲染为 HTML 全文输出（支持阅读器内直接阅读）
 * - 相对路径资源自动转为绝对 URL，确保图片/链接在阅读器中正常加载
 * - 支持封面图嵌入、Dublin Core 作者标注、Media RSS 缩略图
 *
 * 路由: /rss.xml
 */

import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_LANGUAGE, SITE_TITLE, USER_NAME } from "@config";
import { getCollection } from "astro:content";
import { marked } from "marked";

/**
 * 将 HTML 内容中所有相对路径资源（src/href）转换为基于站点根路径的绝对 URL
 * @param content - 原始 HTML 字符串
 * @param siteUrl - 站点根 URL（如 https://www.mahiro.work）
 */
function resolveRelativePaths(content: string, siteUrl: string): string {
  return content.replace(/(src|href)="([^"]+)"/g, (match, attr, src) => {
    const isAbsolute = src.startsWith("http") || src.startsWith("//") || src.startsWith("data:") || src.startsWith("#");
    return isAbsolute ? match : `${attr}="${new URL(src, siteUrl).toString()}"`;
  });
}

/**
 * 生成封面图 HTML 片段（置于文章内容顶部）
 * @param image - 封面图源（可能为本地路径或完整 URL）
 * @param title - 文章标题（用于 alt 属性）
 * @param siteUrl - 站点根 URL
 */
function buildCoverHtml(image: unknown, title: string, siteUrl: string): string {
  if (!image || typeof image !== "string") return "";
  const imgSrc = image.startsWith("http") ? image : new URL(image, siteUrl).toString();
  return `<p><img src="${imgSrc}" alt="${title}" style="max-width:100%;border-radius:8px;" /></p>`;
}

export async function GET(context: any) {
  // ── 数据获取与排序 ──
  const allPosts = await getCollection("blog");
  const publishedPosts = import.meta.env.PROD
    ? allPosts.filter((post) => !post.data.draft)
    : allPosts;
  const sortedPosts = publishedPosts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  // ── 构建 RSS Item 列表 ──
  const items = await Promise.all(
    sortedPosts.map(async (post) => {
      const { data, body, slug } = post;
      const { title, description, pubDate, categories, tags, image } = data;
      const postURL = new URL(`/blog/${slug}/`, context.site).toString();

      // 渲染 Markdown → HTML，并将相对路径转为绝对路径
      const renderedBody = body
        ? resolveRelativePaths(await marked(body), context.site)
        : "";

      // 拼接封面图 + 正文 + 原文引导提示
      const coverHtml = buildCoverHtml(image, title, context.site);
      const readerNotice = `<blockquote style="border-left:4px solid #6366f1;padding:0.5em 1em;margin:0 0 1em;color:#666;">本文通过 RSS 自动推送，可能存在排版差异。<a href="${postURL}" style="color:#6366f1;">阅读原文 →</a></blockquote>`;
      const fullContent = `${readerNotice}${coverHtml}${renderedBody}`;

      // 合并分类与标签为 RSS <category> 元素
      const categoryList = [
        ...(categories?.length ? categories : []),
        ...(tags?.length ? tags : []),
      ];

      // 封面图绝对 URL（用于 Media RSS 缩略图）
      const coverAbsoluteUrl = image && typeof image === "string" && image.startsWith("http") ? image : "";

      return {
        title,
        description: description || "",
        link: postURL,
        guid: postURL,
        pubDate: new Date(pubDate),
        categories: categoryList,
        content: fullContent,
        customData: `
          <dc:creator><![CDATA[${USER_NAME}]]></dc:creator>
          ${coverAbsoluteUrl ? `<media:thumbnail url="${coverAbsoluteUrl}" />` : ""}
        `,
      };
    })
  );

  // ── 输出 RSS Feed ──
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    stylesheet: "/rss-style.xsl",
    items,
    customData: `
      <language>${SITE_LANGUAGE}</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Mahiro Blog</generator>
      <webMaster>${USER_NAME}</webMaster>
      <atom:link href="${new URL("/rss.xml", context.site).toString()}" rel="self" type="application/rss+xml" />
    `,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      content: "http://purl.org/rss/1.0/modules/content/",
      atom: "http://www.w3.org/2005/Atom",
      media: "http://search.yahoo.com/mrss/",
    },
  });
}
