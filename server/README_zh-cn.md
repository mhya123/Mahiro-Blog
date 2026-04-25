# Mahiro 博客后端

这个目录包含了从 Astro 网站项目中独立出来的后端服务。它是自包含的，可以独立启动。静态前端会调用此服务以实现 AI 摘要、AI 翻译，以及由 AList 提供支持的网盘页面。

## 接口路由 (Endpoints)

- `POST /api/ai/summary`
- `POST /api/ai/translate`
- `GET /api/drive/status`
- `GET /api/drive/list`
- `GET /api/drive/item`
- `GET /api/drive/raw`
- `POST /api/drive/search`
- `POST /api/drive/mkdir`
- `POST /api/drive/rename`
- `POST /api/drive/remove`
- `POST /api/drive/move`
- `POST /api/drive/copy`
- `POST /api/drive/upload`
- `GET /health`

## 启动指南

环境要求：

- Node.js 20 或更高版本

首先创建环境变量文件：

```bash
cp .env.example .env
```

然后进入 `server/` 目录启动服务：

```bash
npm start
```

默认监听地址：

```text
http://0.0.0.0:3000
```

你也可以在仓库根目录直接启动：

```bash
npm run server:start
```

## 独立运行文件

后端运行所需的所有文件都位于 `server/` 目录下：

- `index.mjs`
- `.env` / `.env.example`
- `ai-models.json`
- `translation-models.json`
- `package.json`

## 环境变量文件

服务器在启动时会自动读取 `server/.env` 文件。

模板文件：

```text
.env.example
```

核心环境变量：

```env
PORT=3000
ALIST_BASE_URL=https://s.mahiro.work
ALIST_USERNAME=mahiro
ALIST_PASSWORD=mahiro
ALIST_PERMISSIONS=view,download
OPENAI_API_KEY=your_summary_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=60000
OPENAI_RETRIES=3
AI_TRANSLATE_API_KEY=your_translate_api_key
AI_TRANSLATE_BASE_URL=https://api.openai.com/v1
AI_TRANSLATE_TIMEOUT_MS=60000
AI_TRANSLATE_RETRIES=3
```

网盘页面使用上述 AList 相关的环境变量。如果你更倾向于使用 Token 认证，可以设置 `ALIST_TOKEN`，并省略 `ALIST_USERNAME` 和 `ALIST_PASSWORD`。

`ALIST_PERMISSIONS` 是网盘页面的后端权限开关，用于限制用户的操作。支持的权限值包括：

- `upload`（上传）
- `mkdir`（新建文件夹）
- `view`（查看）
- `download`（下载）
- `rename`（重命名）
- `copy`（复制）
- `move`（移动）
- `remove`（删除）

示例：

```env
ALIST_PERMISSIONS=view,download
```

上述示例会保持网盘的读取权限，但禁用了所有的写入和修改操作。

## 前端集成

静态前端应该通过以下环境变量配置指向该后端：

```env
PUBLIC_SITE_API_BASE_URL=https://back.mahiro.work
```

前端的构建输出目录依然为：

```text
./dist
```

## 文章文件的 AI 摘要渠道

用于生成文章摘要的脚本支持两种调用渠道：

- `local`（本地）：脚本通过读取根目录 `.env` 中的 `OPENAI_*` 变量，直接调用大模型 API。
- `service`（服务）：脚本调用外部后端接口 `POST /api/ai/summary`，随后仍会将结果写回本地的文章文件中。

运行示例：

```bash
# 使用本地渠道
node scripts/generate-ai-summary.mjs --all --channel local

# 使用服务渠道
node scripts/generate-ai-summary.mjs --all --channel service --service-url https://back.mahiro.work
```

## 部署注意事项

- 前端依然作为静态文件（`dist` 目录）部署。
- 后端可以仅提取 `server/` 目录进行独立部署。
- 请将你的反向代理配置或平台域名绑定到此 Node 服务上。
- 请确保后端配置了正确的 CORS，允许接收来自你前端域名的请求。