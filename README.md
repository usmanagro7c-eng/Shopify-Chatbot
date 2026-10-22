# AI Chatbot

An intelligent, embeddable chatbot for Shopify stores. Built with the Strategy Pattern so you can swap chatbot personalities without touching core code.

- **Backend**: Express + TypeScript (Node 18+)
- **Integrations**: OpenAI API, Shopify Storefront + Admin APIs
- **Frontend**: Self-contained vanilla JS widget (`public/chat-widget.js` + `public/chat-widget.css`)
- **Deployment**: Vercel (serverless, always-on)

## Features

- **Ecommerce Strategy** — product search via Storefront API, order tracking via Admin API, pricing, cart/shipping guidance
- **English-only replies** — the assistant understands Roman Urdu/Urdu but always answers in clear English (UI text included)
- **Intent-aware routing** — greetings, order tracking, store policy, discounts and off-topic questions are handled without a wasteful catalog search, and only real product questions show product cards
- **Typo-tolerant search** — "pufer jaket" resolves to "puffer jacket" using the store's own catalog words
- **No-hallucination guardrails** — the assistant can only name products, prices, sizes and links that exist in the live catalog, and says so plainly when it does not know
- **Portfolio Strategy** — RAG-grounded assistant for portfolio sites (build-time semantic index)
- **Dual strategy pattern** — `portfolio`, `ecommerce`, `default` behavior strategies
- **Embeddable widget** — drop-in script, product cards, quick replies, teaser balloon, mobile full-screen
- **Mobile-first responsive UI** — safe areas, dynamic viewport units, 40–44px touch targets, landscape support, reduced-motion support
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

Or, instead of a static Admin token, use the **client-credentials** grant
(Dev Dashboard app) — this is the recommended, self-rotating option:

```bash
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
```

When `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` are set they are used for
Admin API access and the static Admin token becomes optional. The token is
fetched automatically and refreshed before it expires.

Optional:

```bash
SHOPIFY_API_VERSION=2026-07   # Shopify retires versions after 12 months
STORE_FRONT_URL=https://yourstore.com   # custom domain used for product links
```

> `.env.local` is gitignored. Never commit secrets.
>
> The Admin token needs the `read_products` and `read_orders` scopes, otherwise
> product search and order tracking silently return nothing. See
> [Shopify credentials](#shopify-credentials-troubleshooting).

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

`public/chat-widget-inline.liquid` is the self-contained snippet to paste into
the published theme. It is **generated** from `public/chat-widget.css` and
`public/chat-widget.js` — never edit it by hand.

```bash
bun run sync:embed   # regenerate public/chat-widget-inline.liquid
```

Paste the block from `public/chat-widget-inline.liquid` just before `</body>` in
the published theme's `layout/theme.liquid`, then update `apiUrl` to your
deployed API:

```js
AIChatbot.init({
  apiUrl: 'https://shopify-chatbot-seven.vercel.app', // production API, not localhost
  position: 'bottom-right',
  theme: 'light',
  strategyType: 'ecommerce',
});
```

`apiUrl` **must** point at the hosted backend (Vercel), not `window.location.origin` — otherwise the widget will call the store domain and fail. The generated embed already points at
`https://shopify-chatbot-seven.vercel.app`; change it in
`scripts/sync-embed.mjs` (`embed.apiUrl`) and re-run `bun run sync:embed`
if you deploy somewhere else.

Run `bun run sync:embed` after any change to the widget CSS/JS, otherwise the
embed keeps shipping the old code.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send a message and get an AI reply (`message`, `conversationHistory`, `strategyType`, `sessionId`) |
| GET | `/api/health` | Health check (includes live Shopify catalog connectivity) |
| GET | `/api/strategies` | List available strategies |
| GET | `/api/strategy/:type` | Strategy info |
| GET | `/api/rate-limit` | Rate limit status |

## Shopify credentials (troubleshooting)

The assistant can only answer product questions from the live Shopify catalog.
If the catalog cannot be read, it tells the customer the catalog is unavailable
rather than inventing products, prices or links.

`GET /api/health` reports exactly what is wrong:

```json
{
  "status": "degraded",
  "shopify": {
    "apiVersion": "2026-07",
    "adminConfigured": true,
    "storefrontConfigured": false,
    "reachable": false,
    "issues": [
      "SHOPIFY_STOREFRONT_ACCESS_TOKEN is missing or still the .env.example placeholder.",
      "Shopify rejected the configured credential (401 Unauthorized). ..."
    ]
  }
}
```

Common causes:

| Symptom | Fix |
|---------|-----|
| `401 Unauthorized` on the Admin API | The token was revoked/expired or belongs to another app. Recreate it in **Shopify Admin → Settings → Apps and sales channels → Develop apps**. |
| Admin API works but products are empty | The app is missing the `read_products` scope. Add it and reinstall the app. |
| Order tracking always fails | The app is missing the `read_orders` scope. |
| `storefrontConfigured: false` | `SHOPIFY_STOREFRONT_ACCESS_TOKEN` is still the `.env.example` placeholder. Create a Storefront API token with `unauthenticated_read_product_listings`. |
| Works locally, fails on Vercel | Add the same env vars in the Vercel project settings and redeploy. |

## Development

```bash
bun run test        # unit + integration tests
bun run check       # lint + format (biome)
bun run check:fix   # auto-fix lint/format
bun run build       # compile TypeScript to dist/
bun run sync:embed  # regenerate public/chat-widget-inline.liquid
bun run qa          # end-to-end chat QA against the live store
bun start           # run compiled server
```

### Local preview

```bash
bun run dev
# then open http://localhost:3000/widget-preview.html
```

The preview page accepts an `?apiUrl=` query parameter so you can point it at a
local backend: `widget-preview.html?apiUrl=http://localhost:3000`.

### Chat QA harness

`bun run qa` fires ~27 realistic customer questions (English + Roman Urdu) at
the running API and checks every answer against the **live** Shopify catalog:

- the reply is in English (no Roman Urdu leakage)
- every link, price and product name mentioned actually exists in the store
- no invented product categories ("we also sell sports bras")
- policy questions return the real contact details and no product cards
- order questions never invent an order status
- product questions do produce product cards

It needs a running server (`bun run dev`) and a working Shopify credential.
The full report is written to `qa-report.json` (gitignored).

```
RESULT: 27/27 passed
```

## Deploy to Vercel

The repo is already configured (`vercel.json` + `vercel-build` script).

1. Push to GitHub.
2. In Vercel: **Add New Project** → select this repo.
3. Set environment variables (`OPENAI_API_KEY`, Shopify tokens, `PORT`).
4. Deploy. Auto-deploy runs on every push to `main`.

Verify with `curl https://shopify-chatbot-seven.vercel.app/api/health`.