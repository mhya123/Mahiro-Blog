---
title: Mahiro-Blog 新手教程（七）：Pagefind 搜索与索引实操
description: 从构建索引到搜索异常排查，系统讲清 Mahiro-Blog 的静态搜索工作方式。
pubDate: 2026-04-07T15:05
aiModel: qwen3-coder-plus
image: /images/covers/mahiro-pagefind-search-practical.webp
draft: false
tags:
  - Pagefind
  - 搜索
  - 静态站点
  - 构建
  - 新手教程
categories:
  - 教程
---

Mahiro-Blog 的搜索基于 Pagefind：构建时生成索引，线上无需额外搜索后端。

这意味着它有两个优点：快、便宜。但也意味着你要理解它的构建链路。

---

## 1. 搜索索引何时生成

根据当前脚本，`pnpm build` 会执行：

1. `astro build`
2. `pagefind --site dist`
3. 把索引拷贝到 `public/pagefind`

所以搜索问题大多发生在构建阶段，而不是运行时。

---

## 2. 你要掌握的两个命令

```bash
pnpm build
pnpm search:clean
```

使用建议：

- 正常更新：直接 `pnpm build`
- 索引异常：先 `pnpm search:clean` 再 `pnpm build`

---

## 3. 搜索不到新文章？

优先排查这 5 项：

1. 文章是否 `draft: false`
2. frontmatter 是否合法
3. 构建是否成功执行完 pagefind 步骤
4. `public/pagefind` 是否有新索引文件
5. 浏览器缓存是否干扰

---

## 4. 搜索关键词效果不理想

可从内容侧优化：

- 标题更明确
- 描述更准确
- 关键词自然出现在正文前段

静态搜索对“文案表达质量”很敏感。

---

## 5. 排错实战模板

当你遇到“本地能搜，线上不能搜”：

1. 本地 `pnpm build` 后是否可搜
2. 检查部署产物是否包含 `pagefind` 索引
3. 检查 CDN 缓存是否未刷新

当你遇到“旧内容还能搜到，新增搜不到”：

- 往往是索引没有重建或没有被正确上传。

---

## 6. 新手优化建议

- 每次发文后至少做一次构建验证
- 不要跳过 build 直接上线
- 将“搜索自检”加入发布 checklist

这样你可以持续保持搜索体验稳定。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-friend-auto-audit-workflow" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（六）：友链自动审核工作流实战</div>
      <div class="text-sm text-base-content/60">先看自动化运营，再补搜索体系。</div>
    </div>
  </a>

  <a href="/blog/mahiro-image-and-performance-basics" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（八）：图片与性能优化基础</div>
      <div class="text-sm text-base-content/60">最后完善加载速度与体验细节。</div>
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
