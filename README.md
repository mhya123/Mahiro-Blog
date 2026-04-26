# Mahiro Blog

基于 Astro 构建的个人博客系统，当前版本已经扩展为：

- 静态博客前端
- 独立部署的 Node.js 后端
- 站内网盘页面
- 全站翻译能力
- AI 文章总结
- 写作台 / 配置页

## 主要特性

- 博客内容使用 `Markdown / MDX`
- 前端基于 `Astro + React + Tailwind CSS + DaisyUI`
- 支持全站翻译与 AI 文章总结
- **高性能毛玻璃系统 (Glassmorphism v3)**：纯 CSS 变量驱动，完美适配亮暗模式且无性能负担
- **极简柔和交互 (Smooth Interactions)**：基于 Compositor 线程驱动的 60fps 动效，物理阻尼感悬浮反馈
- 支持文章加密显示
- 支持站内网盘浏览、预览、下载与 AList 代理
- 环境自适应：支持超过 30 种 DaisyUI 主题切换
- SEO 优化与静态搜索索引构建

## 当前架构

项目现在分为两部分：

### 1. 前端站点

- 目录：仓库根目录
- 构建产物：`./dist`
- 默认对接外部后端：`https://back.mahiro.work`
- 本地开发时可通过代理访问后端接口

### 2. 独立后端

- 目录：`./server`
- 运行入口：`server/index.mjs`
- 用于提供：
  - AList 网盘接口代理与权限控制
  - AI 文章总结接口
  - AI 翻译接口

## 目录结构

```text
.
├─ public/                  # 静态资源
├─ scripts/                 # 构建脚本、AI 摘要脚本等
├─ server/                  # 独立后端
│  ├─ index.mjs
│  ├─ .env.example
│  └─ *.mjs
├─ src/
│  ├─ components/           # 页面与组件
│  ├─ content/              # 博客文章
│  ├─ data/                 # 项目等数据
│  ├─ layouts/              # 布局
│  ├─ pages/                # 路由页面
│  └─ styles/               # 样式
├─ astro.config.mjs
├─ mahiro.config.yaml
└─ package.json
```

## 前端环境变量

根目录使用 `.env`，可参考 `.env.example`：

```env
PUBLIC_SITE_API_BASE_URL=https://back.mahiro.work
PUBLIC_GITHUB_OWNER=your_github_owner
PUBLIC_GITHUB_REPO=your_repository_name
PUBLIC_GITHUB_BRANCH=main
PUBLIC_GITHUB_APP_ID=your_github_app_id
PUBLIC_UMAMI_WEBSITE_ID=your_umami_website_id
PUBLIC_UMAMI_SHARE_ID=your_umami_share_id
POST_PASSWORD=your_post_password
```

说明：

- `PUBLIC_SITE_API_BASE_URL` 是前端请求的后端地址
- 本地开发时也可以通过 Astro 代理访问外部或本地后端

## 后端环境变量

后端使用 `server/.env`，可参考 `server/.env.example`。

关键配置包括：

```env
PORT=3000
ALLOWED_ORIGINS=*

ALIST_BASE_URL=https://s.mahiro.work
ALIST_USERNAME=mahiro
ALIST_PASSWORD=mahiro
ALIST_ROOT_PATH=/
ALIST_TIMEOUT_MS=45000
ALIST_PERMISSIONS=upload,mkdir,view,download,rename,copy,move,remove

OPENAI_API_KEY=your_summary_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=60000
OPENAI_RETRIES=3

AI_TRANSLATE_API_KEY=your_translate_api_key
AI_TRANSLATE_BASE_URL=https://api.openai.com/v1
AI_TRANSLATE_TIMEOUT_MS=60000
AI_TRANSLATE_RETRIES=3
```

## 本地开发

### 安装依赖

```bash
pnpm install
```

### 启动前端

```bash
pnpm run dev
```

### 启动后端

```bash
npm --prefix server start
```

如果前后端都在本地运行，可以把根目录 `.env` 中的接口地址改到你的本地后端，或者使用项目里的本地代理配置。

## 构建

### 构建前端静态站点

```bash
pnpm run build
```

产物输出到：

```text
dist/
```

### 构建搜索索引

```bash
pnpm run build:search
```

### 完整检查与构建

```bash
pnpm run build:full
```

## AI 功能

### AI Summary

- 支持本地脚本批量为文章生成总结
- 也支持通过独立后端提供 AI 总结接口

脚本：

```bash
pnpm run ai:summary
```

### AI Translation

- 由独立后端提供接口
- 可配置独立的翻译模型、API Key、Base URL
- 用于站内全站翻译能力

## 网盘页面

站内网盘页面位于：

```text
/drive
```

能力包括：

- 文件夹浏览
- 搜索
- 下载
- 站内预览
- 复制下载链接
- PotPlayer 外部播放
- 后端权限控制
- 前端配置权限 + 后端二次校验

> [!IMPORTANT]
> **权限同步说明**：如需修改网盘权限（如开启上传/移动），必须同时修改以下 **3 个地方** 才能完全生效：
> 1.  `mahiro.config.yaml`：控制前端 UI 按钮的显示与隐藏。
> 2.  `server/.env`：控制后端 API 接口的实际执行权限。
> 3.  **AList 官方后台**：控制源端（AList 服务）是否允许该用户进行相关操作。

## 交互与视觉
### 1. 毛玻璃系统 (v3)
- **原理**：利用 CSS 变量 `--glassmorphism-blur` 在 `:root` 层级下发强度，配合 `backdrop-filter` 实现全站范围（卡片、导航栏、弹窗）的磨砂玻璃效果。
- **性能**：去除了所有 JS 轮询，由浏览器原生渲染引擎处理，理论零性能延迟。
- **自适应**：通过注入 `--tw-bg-opacity` 确保在任何自定义主题下均保持通透感。

### 2. 柔和动效
- **合成器驱动**：导航栏显隐等高频操作完全托管于合成器线程，避免主线程阻塞导致的 UI 掉帧。
- **物理反馈**：基于 `anime.js` 实现具有物理阻尼感的悬浮位移与图片点击缩放反馈，提升整体操作的“肉感”与高级感。

## 部署建议

### 前端

- 部署静态产物 `dist/`
- 可部署到 Vercel、Cloudflare Pages、Netlify 等静态平台

### 后端

- 单独部署 `server/`
- 确保配置好 `server/.env`
- 将前端 `.env` 中的 `PUBLIC_SITE_API_BASE_URL` 指向你的后端地址

## 常用命令

```bash
pnpm run dev
pnpm run check
pnpm run build
pnpm run build:search
pnpm run build:full
pnpm run ai:summary
npm --prefix server start
```

## License

[MIT](./LICENSE)
