---
title: Mahiro-Blog 新手教程（六）：友链自动审核工作流实战
description: 读懂友链 PR/Issue 自动审核机制，学会配置、排错与维护这套无人值守流程。
pubDate: 2026-04-07T14:45
aiModel: qwen3-coder-plus
image: /images/covers/mahiro-friend-auto-audit-workflow.webp
draft: false
tags:
  - GitHub Actions
  - 友链
  - 自动化
  - 工作流
  - 新手教程
categories:
  - 教程
---

Mahiro-Blog 的一大亮点是友链自动审核：提交 PR 后，机器人自动检查并处理。对站长来说，这能大幅降低维护负担。

---

## 1. 相关工作流在哪

主要看这几个文件：

- `.github/workflows/auto-pr.yml`
- `.github/workflows/auto-issue.yml`
- `.github/workflows/deploy.yml`

它们共同构成“申请 → 审核 → 合并/部署”的链路。

---

## 2. 自动审核会检查什么

从规则设计上，通常包含：

- 文件路径是否合法（必须在指定目录）
- JSON 格式是否合法
- 网站可访问性
- 是否存在反链

这几条能过滤掉大多数无效申请。

---

## 3. 友链数据怎么组织最稳

建议保持“一个站点一个 JSON 文件”，并统一字段：

- `name`
- `avatar`
- `description`
- `url`
- `backlink`（可选）
- `badge`

统一结构能让自动化脚本简单且稳定。

---

## 4. 申请失败时怎么定位

按这个顺序看：

1. PR 检查日志第一条失败原因
2. JSON 字段是否缺失
3. 链接是否可访问
4. 反链地址是否正确

不要只看“失败”二字，要看 workflow 输出的具体错误项。

---

## 5. 如何优化审核体验

可以从三点入手：

1. 提供清晰的 PR 模板
2. 失败时给出可复制的修复示例
3. 通过标签区分“格式错误 / 访问失败 / 反链失败”

这样申请者更容易一次通过。

---

## 6. 新手维护建议

- 规则不要一次加太多
- 优先保证“误杀少”
- 每次调整 workflow 都先在测试分支演练

自动化系统的目标不是“严格”，而是“稳定可维护”。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-comments-giscus-waline-beginner" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（五）：评论系统接入（Giscus / Waline）</div>
      <div class="text-sm text-base-content/60">先完成互动组件，再看自动化运营。</div>
    </div>
  </a>

  <a href="/blog/mahiro-pagefind-search-practical" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">下一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（七）：Pagefind 搜索与索引</div>
      <div class="text-sm text-base-content/60">继续完善站内检索体验。</div>
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
