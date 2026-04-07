---
title: Mahiro-Blog 新手教程（三）：主题与导航栏定制
description: 从主题切换到导航菜单，教你把默认站点改成自己的视觉风格与信息结构。
pubDate: 2026-04-07T13:50
aiModel: qwen3-coder-plus
image: /home.webp
draft: false
tags:
  - 主题
  - 导航栏
  - DaisyUI
  - 新手教程
  - UI
categories:
  - 教程
---

写完几篇文章后，下一步通常是：**我想把站点改得更像自己**。

这篇就聚焦两个入口：主题系统 + 导航菜单。

---

## 1. 改主题：先会用，再谈自定义

Mahiro-Blog 基于 DaisyUI 主题体系，建议先完成这两步：

1. 在配置里确定默认主题
2. 在页面上测试明暗对比与阅读可读性

如果你经常写长文，优先保证这三点：

- 正文字号和行高舒服
- 代码块对比清晰
- 链接颜色有辨识度

---

## 2. 导航栏改造：信息架构优先

很多人一上来就加一堆菜单，结果反而更乱。

新手建议结构：

- 首页
- 博客
- 关于
- 项目
- 友链/导航（可选）

原则：

- 高频页面放前面
- 低频页面放下拉菜单
- 菜单文本尽量短

---

## 3. 一个实用的菜单设计模板

你可以按“内容流”排：

1. 发现内容（首页）
2. 浏览内容（博客/分类/标签）
3. 认识作者（关于）
4. 深入互动（友链/项目）

这比按“功能名词堆砌”更符合读者行为。

---

## 4. 改完 UI 后怎么验收

给你一个轻量验收清单：

- 桌面端导航是否溢出
- 移动端菜单是否可点
- active 状态是否准确
- 暗色主题下文字是否可读
- Banner 与 Navbar 是否冲突

改主题最怕“自己看着好看，读者看不清”。

---

## 5. 新手高频坑位

### 5.1 颜色太多

建议主色不超过 2~3 个，避免信息层级混乱。

### 5.2 hover 动画过重

动画只做“反馈”，不要喧宾夺主。

### 5.3 导航层级太深

最多两层。超过两层就该考虑换页面组织方式。

---

## 6. 建议你的迭代顺序

1. 先定主题（亮/暗可读性）
2. 再定导航（信息架构）
3. 最后补动画（细节打磨）

这个顺序会明显降低返工。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-first-post-mdx-workflow" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（二）：写第一篇 Markdown / MDX 文章</div>
      <div class="text-sm text-base-content/60">先把内容流程跑通，再改视觉层。</div>
    </div>
  </a>

  <a href="/blog/mahiro-deploy-and-ci-beginner-guide" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（四）：部署与自动发布</div>
      <div class="text-sm text-base-content/60">最后一步，把博客稳定发布到线上。</div>
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
