---
title: Mahiro-Blog 新手教程（十）：导航页/项目页 JSON 数据维护与提交流程
description: 学会维护导航与项目 JSON 数据、组织字段结构，并通过标准流程提交更新。
pubDate: 2026-04-07T16:40
aiModel: gpt-5.4-mini
image: /images/covers/mahiro-navigation-project-json-workflow.webp
draft: false
tags:
  - JSON
  - 导航页
  - 项目页
  - 数据维护
  - 新手教程
categories:
  - 教程
---

> [!ai] ChatGPT-5.4-Mini
> 导航页和项目页的数据分别存放在 `src/data/navigation/*.json`、`src/data/projects/*.json`，建议统一字段；导航项至少包含名称、描述、链接、标签，项目项可包含 `name`、`avatar`、`description`、`url`、`badge`、`tags`、`author`、`github`。
> 更新 JSON 建议新建分支、小步修改、执行 `pnpm check`、预览页面并提交 PR；常见问题包括 JSON 语法错误、路径或字段名不匹配、内容过长导致样式错位，以及 CI 审核失败。

当你把站点搭起来后，下一步常见需求是：持续维护导航资源和项目展示。

Mahiro-Blog 已经把这部分做成 JSON 数据驱动，适合长期迭代。

---

## 1. 数据位置与结构

常见目录：

- 导航数据：`src/data/navigation/*.json`
- 项目数据：`src/data/projects/*.json`

每条数据都建议保持统一字段，便于自动审核与页面稳定渲染。

---

## 2. 导航数据建议字段

一个稳定的导航项，建议至少包含：

- 名称（name）
- 描述（description）
- 链接（url）
- 标签（可选）

字段统一后，后续检索、筛选、排序都会更好维护。

---

## 3. 项目数据建议字段

结合当前项目常用结构，建议包含：

- `name`
- `avatar`
- `description`
- `url`
- `badge`（可选）
- `tags`（可选）
- `author`（可选）
- `github`（可选）

新增字段前，先确认 schema 或页面是否支持。

---

## 4. 安全的更新流程

每次改 JSON 建议走这条线：

1. 新建分支
2. 小步编辑一个文件
3. 本地 `pnpm check`
4. 页面预览确认展示
5. 提交 PR

这样一旦格式错了，能快速定位到具体文件。

---

## 5. 常见报错与修复

### 5.1 页面不显示新项

- JSON 语法是否正确（逗号、引号）
- 文件是否放在正确目录
- 字段名是否与页面读取逻辑一致

### 5.2 卡片样式错位

通常是数据内容过长（标题/标签），可通过：

- 增加简短描述
- 控制标签数量
- 使用 tooltip 展示全称

### 5.3 CI 审核失败

重点看：

- 路径是否符合工作流规则
- 字段格式是否符合要求
- 外链可访问性是否通过

---

## 6. 新手长期维护建议

- 分类命名保持稳定
- JSON 文件按功能拆分，不要全塞一个文件
- 变更提交信息写清楚“新增/修复/下线”

数据维护要靠规范，不要靠记忆。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-music-player-config-practical" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手教程（九）：音乐播放器与歌单配置实战</div>
      <div class="text-sm text-base-content/60">先掌握音乐模块，再维护数据模块。</div>
    </div>
  </a>

  <a href="/blog/mahiro-beginner-tutorial-index" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">回到目录</div>
      <div class="font-semibold text-base">Mahiro-Blog 新手专栏目录：从 0 到可维护上线</div>
      <div class="text-sm text-base-content/60">查看全部教程并按需跳读。</div>
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