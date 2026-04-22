# Mahiro Blog Backend

This directory contains the standalone backend extracted from the Astro site.
The static frontend calls this service for AI summary and AI translation.

## Endpoints

- `POST /api/ai/summary`
- `POST /api/ai/translate`
- `GET /health`

## Start

Requirements:

- Node.js 20+

Create the env file first:

```bash
cp server/.env.example server/.env
```

Then start the service:

```bash
npm run server:start
```

Default listen address:

```text
http://0.0.0.0:3000
```

## Env File

The server now reads `server/.env` automatically on startup.

Template file:

```text
server/.env.example
```

Main variables:

```env
PORT=3000
OPENAI_API_KEY=your_summary_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_MS=60000
OPENAI_RETRIES=3
AI_TRANSLATE_API_KEY=your_translate_api_key
AI_TRANSLATE_BASE_URL=https://api.openai.com/v1
AI_TRANSLATE_TIMEOUT_MS=60000
AI_TRANSLATE_RETRIES=3
```

## Frontend Integration

The static frontend should point to this backend with:

```env
PUBLIC_SITE_API_BASE_URL=https://back.mahiro.work
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
node scripts/generate-ai-summary.mjs --all --channel service --service-url https://back.mahiro.work
```

## Deployment Notes

- Frontend stays as static `dist`
- Backend is deployed separately with entry `server/index.mjs`
- Bind your reverse proxy or platform domain to this Node service
- Make sure the backend accepts requests from your frontend domain
