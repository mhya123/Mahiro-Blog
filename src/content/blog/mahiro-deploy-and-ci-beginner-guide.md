---
title: Mahiro-Blog 新手教程（四）：部署与自动发布（CI）
description: 从本地构建到线上部署，给新手一套可复用的发布路径，并附带自动化建议。
pubDate: 2026-04-07T14:10
aiModel: qwen3-coder-plus
image: /images/covers/mahiro-deploy-and-ci-beginner-guide.webp
draft: false
tags:
  - 部署
  - CI/CD
  - Vercel
  - Cloudflare Pages
  - 新手教程
categories:
  - 教程
---

前面三篇解决了“能写、能改、能跑”。

这一篇解决最后一步：**稳定上线**。

---

## 1. 发布前最小命令集

上线前至少跑这 3 条：

```bash
pnpm check
pnpm build
pnpm preview
```

意义：

- `check`：先过结构与类型
- `build`：验证生产构建链
- `preview`：模拟线上访问

---

## 2. 选择托管平台（新手优先级）

推荐顺序（仅作上手建议）：

1. Vercel：接入快、文档全
2. Cloudflare Pages：全球访问不错、免费策略友好
3. Netlify：老牌稳定

核心原则不是“哪个最强”，而是：

- 你能稳定看日志
- 你能快速回滚
- 你能少折腾环境

---

## 3. 自动部署的基本思路

建议把仓库主分支接到托管平台：

- 每次 push/merge 自动构建
- 构建失败直接在 PR 阶段暴露
- 成功后自动更新线上版本

这会让你的发布从“手动操作”变成“工程流程”。

---

## 4. 线上构建失败怎么排

按这个顺序看：

1. 平台构建日志第一条红字
2. Node 版本是否匹配
3. 包管理器是否一致（pnpm）
4. 是否缺少构建所需环境变量
5. 本地是否能复现同样失败

记住：**能本地复现的问题，最容易修**。

---

## 5. 一套可长期使用的发布策略

### 5.1 小改动直接主分支

适合：纯文案、纯内容、低风险修改。

### 5.2 功能改动走 PR

适合：样式重构、组件逻辑、配置结构调整。

PR 合并前固定跑：

- `pnpm check`
- `pnpm build`

---

## 6. 回滚策略（很重要）

新手最容易忽略的不是发布，而是回滚。

建议你至少准备两种回滚方式：

1. Git 回滚到上一个稳定 commit
2. 托管平台一键回滚到上次成功部署

有回滚，发布才敢快迭代。

---

## 7. 完整链路回顾

你现在已经有一条完整新手路径：

1. 看懂项目定位
2. 跑通开发与排错
3. 学会改配置
4. 学会发文章
5. 学会改主题和导航
6. 学会稳定上线

这套路径跑完，基本就从“会用模板”升级到“会维护博客系统”。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-theme-and-navbar-customization" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（三）：主题与导航栏定制</div>
      <div class="text-sm text-base-content/60">先把站点视觉与结构改成你的风格。</div>
    </div>
  </a>

  <a href="/blog/mahiro-comments-giscus-waline-beginner" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（五）：评论系统接入（Giscus / Waline）</div>
      <div class="text-sm text-base-content/60">继续完善站点互动能力。</div>
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
