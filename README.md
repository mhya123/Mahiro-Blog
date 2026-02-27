# ✨ Mahiro Blog

基于 **Astro** 构建的现代化个人博客系统。整体设计追求优雅、极简与高度可定制，在保证极致加载性能的同时，提供流畅、沉浸式的阅读体验。

融合当前主流前端生态（React / Preact / Tailwind CSS / DaisyUI 等），既保留静态站点的性能优势，也具备现代应用级的交互能力。

---

## 🌟 核心特性

### ⚡ 极速体验

* 基于 **Astro 混合构建模式**（SSG + ViewTransitions）
* 页面切换流畅自然，几乎无感知等待
* 结构清晰，首屏加载极致优化

### 🎨 主题系统

* 集成 **DaisyUI** 主题体系
* 优雅排版与暗色模式支持
* 可快速扩展与自定义视觉风格

### 📝 Markdown / MDX 支持

* 原生支持现代 Markdown
* 支持在 MDX 中嵌入交互组件
* 内容与逻辑自然融合

### 🔍 本地搜索

* 基于 `pagefind` 的静态全文搜索
* 无需后端，构建即生成
* 轻量且响应迅速

### 🎵 全局悬浮音乐播放器

* 独立可拖拽组件
* 支持沉浸式播放体验
* 极客向设计，UI 高度定制

### 🤝 友链全自动审核闭环

* 集成 GitHub Action 自动化流程
* 支持一键 PR 提交
* 自动存活检测 + 反链校验
* 审核通过自动 Squash Merge
* 全流程无人值守发布

### ⏰ Git MetaData 自动归档

* 构建期间自动提取 Git 历史
* 归档最后更新时间与 Commit Message
* 在文章底部呈现时间脉络

---

## 🛠 技术栈概览

| 类别   | 技术                            |
| ---- | ----------------------------- |
| 核心框架 | **Astro 4 🚀**                |
| 交互组件 | **React + Preact**            |
| 样式系统 | **Tailwind CSS + DaisyUI**    |
| 内容系统 | **MDX**                       |
| 搜索引擎 | **Pagefind**                  |
| 部署平台 | **Vercel / Cloudflare Pages** |
| 包管理器 | **pnpm** 📦                   |

---

## 📂 项目目录结构

```
Mahiro-Blog/
├── .github/workflows/    # GitHub Action 自动化流程 (Auto-PR 等)
├── public/               # 静态资源与 Favicon
├── scripts/              # 构建前数据抓取与元数据生成脚本
├── src/
│   ├── components/       # 公共组件 (React / Astro)
│   ├── config.ts         # 全局配置
│   ├── content/          # 博客文章 (md / mdx)
│   ├── data/
│   │   ├── friends/      # 友链 JSON 数据 (PR 自动审核入口)
│   │   └── music/        # 音乐播放器配置
│   ├── layouts/          # 页面布局模板
│   ├── pages/            # 路由页面 (/, /posts, /friend, /about 等)
│   ├── styles/           # Tailwind 与 DaisyUI 自定义样式
│   └── lib/              # 工具函数与数据处理逻辑
├── package.json
└── astro.config.mjs
```

---

## 🚀 快速开始（本地开发）

请确保已安装：

* Node.js（推荐 v20+）
* pnpm（建议全局安装）

### 1️⃣ 安装依赖

```bash
pnpm install
# 如未安装 pnpm:
npm install -g pnpm
```

### 2️⃣ 启动开发服务器

```bash
pnpm run dev
```

> 开发环境已分离构建期元数据钩子，专注于实现快速热更新。

### 3️⃣ 构建前数据预处理

为保证 SSR / SSG 正常运行，需要提前生成部分静态缓存数据：

```bash
pnpm run prefetch:music
pnpm run git
```

若未执行此步骤，构建阶段可能报错。

---

## ✨ 进阶功能说明

## 🤝 如何加入友链？

本站提供一套完整的无人值守友链交换流程：

### 第一步

确认您的网站页面已包含本站域名 `mahiro.work` 的双向超链接。

### 第二步

访问友链页面：
👉 [https://www.mahiro.work/friend](https://www.mahiro.work/friend)

### 第三步

点击页面底部 “提交 PR 申请” 按钮。
系统将自动跳转至 GitHub 对应目录：

```
/new/main/.../friends
```

### 第四步

* 将 `你的名字.json` 改为您的名称
* 完善 JSON 字段信息
* 如反链不在主页，请填写 `backlink` 字段

### 第五步

提交 PR 后将自动触发：

* 存活检测
* 反链校验
* 自动审核
* 自动 Squash Merge

审核通过后约 3 分钟即可公开展示 🎉

---

