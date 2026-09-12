# AI Chatbot

An intelligent, embeddable chatbot for Shopify stores. Built with the Strategy Pattern so you can swap chatbot personalities without touching core code.

- **Backend**: Express + TypeScript (Node 18+)
- **Integrations**: OpenAI API, Shopify Storefront + Admin APIs
- **Frontend**: Self-contained vanilla JS widget (`public/chat-widget.js` + `public/chat-widget.css`)
- **Deployment**: Vercel (serverless, always-on)

## Features

- **Ecommerce Strategy** — product search via Storefront API, order tracking via Admin API, pricing, cart/shipping guidance, Urdu/Roman-Urdu replies
- **Portfolio Strategy** — RAG-grounded assistant for portfolio sites (build-time semantic index)
- **Dual strategy pattern** — `portfolio`, `ecommerce`, `default` behavior strategies
- **Embeddable widget** — drop-in script, product cards, quick replies, teaser balloon, mobile full-screen
- **REST API** — `POST /api/chat` with strategy + session support
- **Tracing** — optional Langfuse integration for OpenAI call observability
- **CI/CD** — GitHub Actions (lint, type-check, tests, Docker) + auto-deploy to Vercel

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

```bash
OPENAI_API_KEY=sk-...
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
SHOPIFY_ADMIN_API_TOKEN=...

PORT=4000
NODE_ENV=development
```

> `.env.local` is gitignored. Never commit secrets.

### 3. Build the RAG index (portfolio strategy only)

```bash
bun run build:knowledge
```

Fetches portfolio content from `PORTFOLIO_JSON_URL`, embeds it, and writes `data/knowledge.json`. The `vercel-build` script does this automatically for production.

### 4. Start the dev server

```bash
bun run dev
```

Server runs on `http://localhost:4000`.

### 5. Test the API

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What products do you have?", "strategyType": "ecommerce"}'
```

## Embed on Shopify

Paste the block from `public/chat-widget-inline.liquid` just before `</body>` in the published theme's `layout/theme.liquid`, then update `apiUrl` to your deployed API:

```js
AIChatbot.init({
  apiUrl: 'https://YOUR-PROJECT.vercel.app', // production API, not localhost
  position: 'bottom-right',
  theme: 'light',
  strategyType: 'ecommerce',
});
```

`apiUrl` **must** point at the hosted backend (Vercel), not `window.location.origin` — otherwise the widget will call the store domain and fail.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message and get an AI reply (`message`, `conversationHistory`, `strategyType`, `sessionId`) |
| GET | `/api/health` | Health check |
| GET | `/api/strategies` | List available strategies |
| GET | `/api/strategy/:type` | Strategy info |
| GET | `/api/rate-limit` | Rate limit status |

## Development

```bash
bun run test        # unit + integration tests
bun run check       # lint + format (biome)
bun run check:fix   # auto-fix lint/format
bun run build       # compile TypeScript to dist/
bun start           # run compiled server
```

## Deploy to Vercel

The repo is already configured (`vercel.json` + `vercel-build` script).

1. Push to GitHub.
2. In Vercel: **Add New Project** → select this repo.
3. Set environment variables (`OPENAI_API_KEY`, Shopify tokens, `PORT`).
4. Deploy. Auto-deploy runs on every push to `main`.

Verify with `curl https://YOUR-PROJECT.vercel.app/api/health`.