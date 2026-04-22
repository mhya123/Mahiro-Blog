---
title: Mahiro-Blog 新手教程（五）：评论系统接入（Giscus / Waline）
description: 从配置项到页面验证，手把手接入 Giscus 或 Waline，并给出常见问题排查清单。
pubDate: 2026-04-07T14:30
aiModel: gpt-5.4-mini
image: /images/covers/mahiro-comments-giscus-waline-beginner.webp
draft: false
tags:
  - 评论系统
  - Giscus
  - Waline
  - 配置文件
  - 新手教程
categories:
  - 教程
---

> [!ai] ChatGPT-5.4-Mini
> Mahiro-Blog 通过 `mahiro.config.yaml` 接入评论系统，`comments.enable` 控制开关，`comments.type` 在 `giscus` 和 `waline` 间切换，渲染层会自动选择组件。Giscus 需在 giscus.app 生成参数，Waline 适合自部署并可先用最小配置验证。

评论系统是博客互动的核心功能之一。Mahiro-Blog 已经预留了 `Giscus` 和 `Waline` 两套接入能力，你只需要改配置即可启用。

---

## 1. 先看配置入口

核心配置在 `mahiro.config.yaml`：

- `comments.enable`：是否启用评论
- `comments.type`：`giscus` / `waline` / `none`
- `comments.giscus`：Giscus 参数
- `comments.waline`：Waline 参数

页面渲染层会根据这个 `type` 自动选择组件。

---

## 2. 接入 Giscus（最省心）

适合：你已使用 GitHub，并希望低运维。

配置示例：

```yaml
comments:
  enable: true
  type: giscus
  giscus:
    repo: yourname/yourrepo
    repoId: R_kgDOxxxxx
    category: General
    categoryId: DIC_kwDOxxxxx
    mapping: pathname
    lang: zh-CN
    inputPosition: top
    reactionsEnabled: '1'
    emitMetadata: '0'
    loading: lazy
```

你需要去 `giscus.app` 生成上述参数（尤其是 `repoId` 与 `categoryId`）。

---

## 3. 接入 Waline（更自由）

适合：你有自部署后端需求，希望评论能力更可控。

配置示例：

```yaml
comments:
  enable: true
  type: waline
  waline:
    serverURL: https://your-waline-server
    lang: zh-CN
    emoji:
      - https://unpkg.com/@waline/emojis@1.1.0/weibo
    meta:
      - nick
      - mail
      - link
    requiredMeta: []
    reaction: false
    pageview: false
```

建议先跑最小配置，确认能加载后再加高级选项。

---

## 4. 切换评论系统的正确姿势

只改一处：`comments.type`

- 从 `giscus` 切到 `waline`
- 或从 `waline` 切回 `giscus`

其余配置保留，不影响未来回切。

---

## 5. 常见问题排查

### 5.1 页面不显示评论区

按顺序查：

1. `comments.enable` 是否为 `true`
2. `comments.type` 是否拼写正确
3. 对应平台参数是否完整

### 5.2 Giscus 显示但无法发言

通常是仓库 Discussions 权限或分类配置错误，重点检查：

- 仓库是否开启 Discussions
- `repoId` / `categoryId` 是否匹配

### 5.3 Waline 接口报错

优先检查：

- `serverURL` 是否可访问
- 后端是否正常运行
- 跨域/证书配置是否正确

---

## 6. 新手建议

- 没有强烈自部署需求：优先 Giscus
- 有评论数据自治需求：再考虑 Waline

先把评论功能跑通，再做皮肤和交互微调。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-deploy-and-ci-beginner-guide" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（四）：部署与自动发布（CI）</div>
      <div class="text-sm text-base-content/60">先完成上线，再补互动能力。</div>
    </div>
  </a>

  <a href="/blog/mahiro-friend-auto-audit-workflow" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（六）：友链自动审核工作流</div>
      <div class="text-sm text-base-content/60">继续学习无人值守友链流程。</div>
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
  <div class="text-sm text-base-content/60">查看新手教程总览与推荐阅读顺序（持续更新）。</div>
    </div>
  </a>
</div>