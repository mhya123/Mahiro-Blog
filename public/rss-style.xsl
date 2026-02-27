<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> — RSS 订阅</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&amp;display=swap" rel="stylesheet"/>
        <style type="text/css">
          :root {
            --bg: #e8e3db;
            --card-bg: #ffffff;
            --text: #1f2937;
            --text-muted: #6b7280;
            --text-faint: #9ca3af;
            --border: #e5e7eb;
            --primary: #6366f1;
            --primary-soft: rgba(99, 102, 241, 0.08);
            --tag-bg: #f0edf9;
            --tag-text: #6366f1;
            --radius: 1rem;
            --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
            --shadow-lg: 0 4px 6px rgba(0,0,0,0.04), 0 10px 15px rgba(0,0,0,0.06);
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #282a36;
              --card-bg: #1e1f29;
              --text: #f8f8f2;
              --text-muted: #9ca3af;
              --text-faint: #6272a4;
              --border: #44475a;
              --primary: #bd93f9;
              --primary-soft: rgba(189, 147, 249, 0.1);
              --tag-bg: rgba(189, 147, 249, 0.15);
              --tag-text: #bd93f9;
              --shadow: 0 1px 3px rgba(0,0,0,0.2);
              --shadow-lg: 0 4px 6px rgba(0,0,0,0.15), 0 10px 15px rgba(0,0,0,0.2);
            }
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.7;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
          }

          /* Banner - 模仿主站 Banner */
          .banner {
            position: relative;
            height: 40vh;
            min-height: 260px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            overflow: hidden;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .banner::after {
            content: '';
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.25);
          }
          .banner-content {
            position: relative;
            z-index: 10;
            padding: 0 1.5rem;
          }
          .banner h1 {
            font-size: 2.5rem;
            font-weight: 800;
            color: #fff;
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
            letter-spacing: -0.02em;
          }
          .banner p {
            color: rgba(255,255,255,0.9);
            font-size: 1rem;
            margin-top: 0.5rem;
            text-shadow: 0 1px 4px rgba(0,0,0,0.2);
          }
          .banner .count-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-top: 1rem;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(12px);
            color: #fff;
            padding: 0.4rem 1.2rem;
            border-radius: 2rem;
            font-size: 0.85rem;
            font-weight: 500;
          }
          /* 波浪 */
          .wave-container {
            position: absolute;
            bottom: -1px;
            left: 0;
            width: 100%;
            z-index: 11;
            line-height: 0;
          }
          .wave-container svg {
            width: 100%;
            height: 60px;
          }
          .wave-container svg path {
            fill: var(--bg);
          }

          /* 主体容器 - 模仿主站双栏布局 */
          .main-wrapper {
            max-width: 768px;
            margin: -1.5rem auto 3rem;
            padding: 0 1rem;
            position: relative;
            z-index: 20;
          }

          /* 信息卡片 */
          .info-card {
            background: var(--card-bg);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            padding: 1.25rem 1.5rem;
            margin-bottom: 1rem;
            font-size: 0.85rem;
            color: var(--text-muted);
            line-height: 1.8;
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
          }
          .info-card .icon {
            font-size: 1.5rem;
            flex-shrink: 0;
            margin-top: 0.1rem;
          }
          .info-card a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 500;
          }
          .info-card a:hover {
            text-decoration: underline;
          }

          /* 文章卡片 - 模仿主站 PostCard */
          .post-card {
            background: var(--card-bg);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            margin-bottom: 0.75rem;
            overflow: hidden;
            transition: box-shadow 0.2s, transform 0.2s;
          }
          .post-card:hover {
            box-shadow: var(--shadow-lg);
            transform: translateY(-2px);
          }
          .post-inner {
            padding: 1.25rem 1.5rem;
          }
          .post-title {
            font-size: 1.1rem;
            font-weight: 700;
            line-height: 1.4;
            margin-bottom: 0.5rem;
          }
          .post-title a {
            color: var(--text);
            text-decoration: none;
            transition: color 0.15s;
          }
          .post-title a:hover {
            color: var(--primary);
          }
          /* 元信息行 - 模仿 PostInfo */
          .post-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.78rem;
            color: var(--text-faint);
            margin-bottom: 0.6rem;
          }
          .post-meta span {
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
          }
          /* 标签 */
          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
            margin-bottom: 0.6rem;
          }
          .tag {
            display: inline-block;
            background: var(--tag-bg);
            color: var(--tag-text);
            padding: 0.15rem 0.65rem;
            border-radius: 2rem;
            font-size: 0.72rem;
            font-weight: 500;
            transition: opacity 0.15s;
          }
          .tag:hover { opacity: 0.8; }
          /* 摘要 */
          .post-desc {
            font-size: 0.88rem;
            color: var(--text-muted);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.7;
          }

          /* 页脚 */
          .footer {
            text-align: center;
            padding: 2rem 1rem;
            font-size: 0.8rem;
            color: var(--text-faint);
          }
          .footer a {
            color: var(--primary);
            text-decoration: none;
          }

          @media (max-width: 640px) {
            .banner { height: 30vh; min-height: 200px; }
            .banner h1 { font-size: 1.75rem; }
            .post-inner { padding: 1rem; }
            .main-wrapper { margin-top: -1rem; }
          }
        </style>
      </head>
      <body>
        <!-- Banner -->
        <div class="banner">
          <div class="banner-content">
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <p><xsl:value-of select="/rss/channel/description"/></p>
            <div class="count-badge">✨ 共 <xsl:value-of select="count(/rss/channel/item)"/> 篇文章</div>
          </div>
          <div class="wave-container">
            <svg viewBox="0 0 1440 60" preserveAspectRatio="none">
              <path d="M0,30 C240,50 480,10 720,30 C960,50 1200,10 1440,30 L1440,60 L0,60 Z"/>
            </svg>
          </div>
        </div>

        <!-- 内容区 -->
        <div class="main-wrapper">
          <!-- 订阅说明 -->
          <div class="info-card">
            <span class="icon">📖</span>
            <div>
              这是一个 <strong>RSS 订阅源</strong>，将此页面 URL 复制到 RSS 阅读器即可订阅。推荐使用
              <a href="https://netnewswire.com/" target="_blank">NetNewsWire</a> ·
              <a href="https://feedly.com/" target="_blank">Feedly</a> ·
              <a href="https://www.inoreader.com/" target="_blank">Inoreader</a>
            </div>
          </div>

          <!-- 文章列表 -->
          <xsl:for-each select="/rss/channel/item">
            <div class="post-card">
              <div class="post-inner">
                <div class="post-title">
                  <a>
                    <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                    <xsl:value-of select="title"/>
                  </a>
                </div>
                <div class="post-meta">
                  <span>📅 <xsl:value-of select="substring(pubDate, 1, 16)"/></span>
                  <xsl:if test="dc:creator">
                    <span>✍️ <xsl:value-of select="dc:creator"/></span>
                  </xsl:if>
                </div>
                <xsl:if test="category">
                  <div class="tags">
                    <xsl:for-each select="category">
                      <span class="tag"><xsl:value-of select="."/></span>
                    </xsl:for-each>
                  </div>
                </xsl:if>
                <div class="post-desc">
                  <xsl:value-of select="description"/>
                </div>
              </div>
            </div>
          </xsl:for-each>
        </div>

        <div class="footer">
          Powered by <a href="https://github.com/mhya123/Mahiro-Blog" target="_blank">Mahiro Blog</a> · RSS Feed
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
