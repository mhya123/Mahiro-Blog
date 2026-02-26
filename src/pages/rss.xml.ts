import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_LANGUAGE, SITE_TAB, SITE_TITLE, USER_NAME, USER_SITE } from "@config";
import { getCollection } from "astro:content";
import { marked } from "marked";

export async function GET(context: any) {
  const allPosts = await getCollection("blog");
  const posts = import.meta.env.PROD ? allPosts.filter((post) => !post.data.draft) : allPosts;
  const sortedPosts = posts.sort(
    (a: any, b: any) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  function replacePath(content: string, siteUrl: string): string {
    return content.replace(/(src|href)="([^"]+)"/g, (match, attr, src) => {
      if (!src.startsWith("http") && !src.startsWith("//") && !src.startsWith("data:") && !src.startsWith("#")) {
        return `${attr}="${new URL(src, siteUrl).toString()}"`;
      }
      return match;
    });
  }

  const items = await Promise.all(
    sortedPosts.map(async (blog: any) => {
      const { data, body, slug } = blog;
      const { title, description, pubDate, categories, tags, image } = data;

      // 渲染 Markdown 为 HTML
      let content = body
        ? replacePath(await marked(body), context.site)
        : "";

      // 如果有封面图，在内容头部添加
      if (image) {
        const imgSrc = typeof image === 'string'
          ? (image.startsWith('http') ? image : new URL(image, context.site).toString())
          : '';
        if (imgSrc) {
          content = `<p><img src="${imgSrc}" alt="${title}" style="max-width:100%;border-radius:8px;" /></p>${content}`;
        }
      }

      const postURL = new URL(`/blog/${slug}/`, context.site).toString();

      // 构建 category 标签（用于 RSS <category> 元素）
      const categoryList: string[] = [];
      if (categories && categories.length > 0) {
        categoryList.push(...categories);
      }
      if (tags && tags.length > 0) {
        categoryList.push(...tags);
      }

      return {
        title,
        description: description || "",
        link: postURL,
        guid: postURL,
        pubDate: new Date(pubDate),
        categories: categoryList,
        content: `<blockquote style="border-left:4px solid #6366f1;padding:0.5em 1em;margin:0 0 1em;color:#666;">本文通过 RSS 自动推送，可能存在排版差异。<a href="${postURL}" style="color:#6366f1;">阅读原文 →</a></blockquote>${content}`,
        customData: `
          <dc:creator><![CDATA[${USER_NAME}]]></dc:creator>
          ${image ? `<media:thumbnail url="${typeof image === 'string' && image.startsWith('http') ? image : ''}" />` : ''}
        `,
      };
    })
  );

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
      <atom:link href="${new URL('/rss.xml', context.site).toString()}" rel="self" type="application/rss+xml" />
    `,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      content: "http://purl.org/rss/1.0/modules/content/",
      atom: "http://www.w3.org/2005/Atom",
      media: "http://search.yahoo.com/mrss/",
    },
  });
}
