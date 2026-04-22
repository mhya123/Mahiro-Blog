---
title: >-
  Mahiro-Blog 新手教程（十一）：mahiro.config.yaml 与 .env 在多平台部署（GitHub Pages /
  Cloudflare Pages / EdgeOne）
description: >-
  一篇讲清配置文件与环境变量分层的实操教程，覆盖本地、GitHub Pages、Cloudflare Pages、EdgeOne Pages
  的变量注入与排错。
pubDate: 2026-04-07T19:10
aiModel: gpt-5.4-mini
image: /images/covers/mahiro-config-env-multi-platform-pages.webp
draft: false
tags:
  - 配置文件
  - 环境变量
  - GitHub Pages
  - Cloudflare Pages
  - EdgeOne Pages
categories:
  - 教程
---

> [!ai] ChatGPT-5.4-Mini
> 将 `mahiro.config.yaml` 用于可公开、可版本化配置，`.env`/平台变量用于敏感或按环境变化的值；`POST_PASSWORD`、`OPENAI_API_KEY` 等放私密变量，`PUBLIC_UMAMI_*` 可公开。GitHub Pages 需在构建时注入变量，Cloudflare Pages 区分 Variables 与 Secrets，EdgeOne Pages 可直接粘贴 env 内容。

这篇是给“已经能跑起来，但部署时变量总出问题”的同学准备的。

核心目标：**把 `mahiro.config.yaml` 和 `.env` 的职责彻底分清楚**，然后一次性讲清楚三种 Pages 平台怎么配。

---

## 1. 先搞清楚：哪些值该放哪

建议用一句话记住：

- **可公开、可版本化的站点配置** → 放 `mahiro.config.yaml`
- **敏感信息或按环境变化的值** → 放 `.env` / 平台变量

在当前项目中，`src/config.ts` 已经做了这层读取：

- `POST_PASSWORD` 从 `process.env` 读取
- `PUBLIC_UMAMI_SHARE_ID` / `PUBLIC_UMAMI_WEBSITE_ID` 从 `import.meta.env` 读取
- 另外 `src/pages/api/ai/summary.ts` 还使用了 `OPENAI_*` 系列变量

---

## 2. 变量分层速查表（推荐直接照搬）

| 变量名 | 建议位置 | 是否可暴露到前端 | 用途 |
| --- | --- | --- | --- |
| `POST_PASSWORD` | `.env` / 平台 Secret | 否 | 文章加密密码 |
| `PUBLIC_UMAMI_SHARE_ID` | `.env` / 平台 Variable | 是 | Umami 分享统计 ID |
| `PUBLIC_UMAMI_WEBSITE_ID` | `.env` / 平台 Variable | 是 | Umami 网站 ID |
| `OPENAI_API_KEY` | `.env` / 平台 Secret | 否 | AI 摘要接口密钥 |
| `OPENAI_BASE_URL` | `.env` / 平台 Variable | 视情况 | AI 网关地址 |
| `OPENAI_TIMEOUT_MS` / `OPENAI_RETRIES` | `.env` / 平台 Variable | 否 | AI 接口请求策略 |

关键规则：**只有 `PUBLIC_` 前缀变量才会进入客户端构建结果**。

---

## 3. 本地开发怎么配

推荐在项目根目录维护 `.env`（不要提交到仓库）：

```env
POST_PASSWORD=your_post_password
PUBLIC_UMAMI_SHARE_ID=your_umami_share_id
PUBLIC_UMAMI_WEBSITE_ID=your_umami_website_id
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=30000
OPENAI_RETRIES=2
```

然后本地验证：

```bash
pnpm check
pnpm dev
```

---

## 4. GitHub Pages 怎么注入环境变量

> 重点：GitHub Pages 通常是纯静态托管，变量是“**构建时注入**”，不是运行时注入。

推荐做法：

1. 在仓库 `Settings -> Secrets and variables -> Actions` 添加变量
2. 在 GitHub Actions 构建步骤里通过 `env:` 注入
3. 构建完成后再发布静态产物

注意事项：

- `PUBLIC_*` 会被打进前端，请只放可公开值
- `OPENAI_API_KEY` 这类服务端密钥不应出现在前端
- 如果你部署目标是纯静态（无函数能力），`/api/*` 路由不会作为后端服务运行

---

## 5. Cloudflare Pages 怎么注入

在 Cloudflare Pages 项目里配置两类值：

- **Variables**：普通非敏感值
- **Secrets**：敏感值（如 `OPENAI_API_KEY`）

配置路径（控制台）：

- Project -> Settings -> Environment variables

建议为 `Preview` / `Production` 分开配置，避免测试变量污染生产。

---

## 6. EdgeOne Pages 怎么注入

EdgeOne Pages 可以直接将env文件内容粘贴到环境变量里面十分的方便

---

## 7. 多平台统一策略（强烈推荐）

为了减少平台差异，建议你在仓库里固定一份“变量字典”：

1. 变量名统一（本地/Cloudflare/EdgeOne/GitHub Actions 同名）
2. 公私分层统一（`PUBLIC_` vs Secret）
3. 环境区分统一（Preview 与 Production 分开）

这样迁移平台时几乎不用改代码。

---

## 8. 常见故障排查清单

### 8.1 本地有值，线上没值

优先看：平台是否真的配置了对应变量（名字是否完全一致）。

### 8.2 Umami 不生效

优先看：`PUBLIC_UMAMI_*` 是否配置在当前部署环境（不是另一个环境）。

### 8.3 加密文章失效

优先看：`POST_PASSWORD` 是否注入成功，是否在构建时可读。

### 8.4 AI 摘要接口报错

优先看：目标平台是否支持服务端函数；纯静态托管下 API 路由不会自动可用。

---

## 9. 推荐你现在就做的事

- 新建一份 `.env.example`（只放键名，不放真实值）
- 在部署平台按同名变量补齐
- 每次发布前跑 `pnpm check`

你会明显减少“本地正常、线上翻车”的概率。

---

## 系列导航

<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
  <a href="/blog/mahiro-navigation-project-json-workflow" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">上一篇</div>
      <div class="font-semibold text-base">新手教程（十）：导航页/项目页 JSON 数据维护与提交流程</div>
      <div class="text-sm text-base-content/60">先学数据维护，再学跨平台变量治理。</div>
    </div>
  </a>

  <a href="/blog/mahiro-secondary-dev-index" class="card bg-base-100 border border-base-300 hover:border-primary/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
    <div class="card-body p-4">
      <div class="text-xs text-base-content/50">进阶入口</div>
      <div class="font-semibold text-base">进入 Mahiro-Blog 二开实战总览</div>
      <div class="text-sm text-base-content/60">完成基础变量治理后，继续组件与架构级二开。</div>
    </div>
  </a>
</div>