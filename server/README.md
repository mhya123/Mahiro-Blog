# Mahiro Blog Backend

[🇨🇳 Read in Chinese (中文)](./README_zh-cn.md)

This directory contains the standalone backend extracted from the Astro site.
It is self-contained and can be started independently.
The static frontend calls this service for AI summary, AI translation, and the AList-powered drive page.

## Endpoints

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

## Start

Requirements:

- Node.js 20+

Create the env file first:

```bash
cp .env.example .env
```

Then start the service from inside `server/`:

```bash
npm start
```

Default listen address:

```text
[http://0.0.0.0:3000](http://0.0.0.0:3000)
```

You can also start it from the repo root:

```bash
npm run server:start
```

## Self-Contained Files

Everything required by the backend is inside `server/`:

- `index.mjs`
- `.env` / `.env.example`
- `ai-models.json`
- `translation-models.json`
- `package.json`

## Env File

The server now reads `server/.env` automatically on startup.

Template file:

```text
.env.example
```

Main variables:

```env
PORT=3000
ALIST_BASE_URL=[https://s.mahiro.work](https://s.mahiro.work)
ALIST_USERNAME=mahiro
ALIST_PASSWORD=mahiro
ALIST_PERMISSIONS=view,download
OPENAI_API_KEY=your_summary_api_key
OPENAI_BASE_URL=[https://api.openai.com/v1](https://api.openai.com/v1)
OPENAI_TIMEOUT_MS=60000
OPENAI_RETRIES=3
AI_TRANSLATE_API_KEY=your_translate_api_key
AI_TRANSLATE_BASE_URL=[https://api.openai.com/v1](https://api.openai.com/v1)
AI_TRANSLATE_TIMEOUT_MS=60000
AI_TRANSLATE_RETRIES=3
```

The drive page uses the AList env block above. If you prefer token auth, you can set `ALIST_TOKEN` and omit `ALIST_USERNAME` / `ALIST_PASSWORD`.

`ALIST_PERMISSIONS` is the backend enforcement switch for the drive page. Supported values:

- `upload`
- `mkdir`
- `view`
- `download`
- `rename`
- `copy`
- `move`
- `remove`

Example:

```env
ALIST_PERMISSIONS=view,download
```

That example keeps the drive readable but disables all write operations.

> [!CAUTION]
> **Permission Synchronization**: To modify drive permissions (e.g., enabling upload), you must synchronize settings in **3 locations**:
> 1.  `mahiro.config.yaml` (Frontend): Controls visibility of UI buttons.
> 2.  `server/.env` (Backend): Enforces actual API execution permissions.
> 3.  **AList Admin Panel**: The source provider must also allow these operations for the configured user.

## Frontend Integration

The static frontend should point to this backend with:

```env
PUBLIC_SITE_API_BASE_URL=[https://back.mahiro.work](https://back.mahiro.work)
```

The frontend build output remains:

```text
./dist
```

## AI Summary Channels For Article Files

The article summary writer script supports two channels:

- `local`: the script calls the model API directly with root `.env` `OPENAI_*`
- `service`: the script calls an external backend `POST /api/ai/summary` and still writes the result back into local article files

Examples:

```bash
node scripts/generate-ai-summary.mjs --all --channel local
```

```bash
node scripts/generate-ai-summary.mjs --all --channel service --service-url [https://back.mahiro.work](https://back.mahiro.work)
```

## Deployment Notes

- Frontend stays as static `dist`
- Backend can be deployed separately with the `server/` directory only
- Bind your reverse proxy or platform domain to this Node service
- Make sure the backend accepts requests from your frontend domain
