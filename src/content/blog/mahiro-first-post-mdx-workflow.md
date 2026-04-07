---
title: Mahiro-Blog 新手教程（二）：写第一篇 Markdown / MDX 文章
description: 从 frontmatter 到图片、标签分类、发布流程，带你完成第一篇可发布文章。
pubDate: 2026-04-07T13:30
aiModel: qwen3-coder-plus
image: /images/covers/mahiro-first-post-mdx-workflow.webp
draft: false
tags:
  - Markdown
  - MDX
  - 内容创作
  - 新手教程
  - Astro
categories:
  - 教程
---

这一篇专门解决“我该怎么开始写第一篇文”。

目标很简单：**30 分钟内发布一篇完整文章**。

---

## 1. 文章应该放哪里？

目录固定在：`src/content/blog/`

建议文件名风格：

- 全小写
- 单词用 `-` 连接
- 语义清晰

例如：`my-first-post.md`

---

## 2. frontmatter 最小可用模板

```md
---
title: 我的第一篇 Mahiro-Blog 文章
description: 这是一篇用于测试发布流程的文章
pubDate: 2026-04-07T13:30
image: /home.webp
draft: false
tags:
  - 入门
  - 教程
categories:
  - 教程
---
```

然后在下面写正文即可。

---

## 3. Markdown 和 MDX 怎么选？

- 只写文字、代码块、图片：用 `.md`
- 要插入交互组件：用 `.mdx`

建议新手先用 `.md`，把流程跑通后再上 MDX。

---

## 4. 图片怎么放最省事

推荐做法：

1. 把图片放到 `public/` 下（例如 `public/image/xxx.webp`）
2. 在文章里用绝对路径引用：`/image/xxx.webp`

这样构建路径最稳定，不容易因为相对路径出错。

---

## 5. 标签和分类怎么规划

### 标签（tags）

- 用来描述主题关键词
- 可以多一点，便于检索

### 分类（categories）

- 用来控制栏目结构
- 建议数量少且稳定

新手建议先定 3~5 个主分类，后续只增不乱改。

---

## 6. 发布前自检清单

至少检查这 6 项：

- 标题是否清晰
- 摘要是否准确
- 时间是否正确
- 图片路径是否可访问
- `draft` 是否为 `false`
- 标签分类是否是数组

然后运行：

```bash
pnpm check
pnpm dev
```

确认无误后再提交。

---

## 7. 常见问题

### Q1：文章没显示在首页

先看：`draft` 是否还是 `true`。

### Q2：日期显示异常

先看：`pubDate` 是否合法（建议 ISO 格式）。

### Q3：标签页找不到文章

先看：`tags` 是否写成了字符串而非数组。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-config-zero-to-one" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（一）：从 0 到 1 改配置文件</div>
      <div class="text-sm text-base-content/60">先把配置改明白，再写内容更顺手。</div>
    </div>
  </a>

  <a href="/blog/mahiro-theme-and-navbar-customization" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（三）：主题与导航栏定制</div>
      <div class="text-sm text-base-content/60">继续把博客改成你自己的风格。</div>
    </div>
  </a>
</div>

---

## 新手专栏目录入口

<div class="mt-4">
  <a href="/blog/mahiro-beginner-tutorial-index" class="card bg-base-100 border border-primary/30 hover:border-primary transition-all duration-300 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">专栏目录</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手专栏：完整学习路径</div>
      <div class="text-sm text-base-content/60">查看 1~10 篇教程总览与推荐阅读顺序。</div>
    </div>
  </a>
</div>
