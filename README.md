# AI Chatbot

An intelligent, embeddable chatbot with dual behavioral strategies and Shopify integration. Built with Strategy Pattern for extensible, customizable chatbot personalities.

**Status**: ✅ Production Ready — Portfolio Strategy now RAG-grounded  
**Strategies**: Portfolio v2.0.0 (RAG) + Ecommerce (Ready)  
**Documentation**: See [ROADMAP.md](docs/ROADMAP.md) for timeline | [INDEX.md](docs/INDEX.md) for complete guide | [docs/adr/](docs/adr/) for design decisions

## ✨ Features

### **Dual Behavioral Strategies**
- ✅ **Portfolio Strategy** — RAG-grounded assistant for personal portfolio websites. Answers grounded on a build-time semantic index (see below). See [ADR 001](docs/adr/001-portfolio-rag.md).
- ✅ **Ecommerce Strategy** — Shopping assistant with product search, order tracking via Shopify Admin API, customer lookup, and cart assistance
- ✅ **Strategy Pattern Architecture** — Easily extensible for new chatbot personalities without modifying core code

### **Portfolio RAG pipeline**
- ✅ **Semantic retrieval** — top-k cosine similarity over pre-embedded chunks; no live API calls at chat time
- ✅ **Single source** — portfolio projects + experiences fetched at build time from `PORTFOLIO_JSON_URL`.
- ✅ **Build-time indexing** — `bun run build:knowledge` fetches, chunks, embeds with `text-embedding-3-small`, writes `data/knowledge.json` (~$0.0002 per rebuild)
- ✅ **Capabilities guardrail** — the system prompt refuses to invent projects, features, or metrics not covered by retrieved context — no more confabulated "analytics dashboards" that don't exist

### **Core Capabilities**
- ✅ **OpenAI Integration** - GPT-4 and GPT-3.5-turbo with streaming and custom system prompts
- ✅ **Shopify Integration** - Storefront API (product search) + Admin API (order tracking, customer lookup)
- ✅ **Embeddable Chat Widget** - Self-contained JavaScript widget with strategy type support
- ✅ **Smart Bot Logic** - Intent recognition, context management, multi-turn conversations
- ✅ **REST API** - `/api/chat` endpoint with TypeScript types and strategy parameter
- ✅ **Comprehensive Tests** - 216 passing unit/integration tests, production-ready code
- ✅ **GitHub Actions CI/CD** - Automated testing, linting, building, deploying
- ✅ **Vercel Deployment** - Auto-deploy on main branch, preview deployments
- ✅ **Docker Containerization** - Multi-stage build with health checks, production-ready (v0.3.0)
- ✅ **Analytics Logging** - Structured JSON logs for conversation metrics (strategy, length, context, success)
- ✅ **Production Deployment** - Automated rollback, health checks, monitoring
- ✅ **Team Documentation** - Training materials, emergency procedures, runbooks

## Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy the example file:

```bash
cp .env.example .env.local
```

Then fill in your values:

```bash
OPENAI_API_KEY=sk-...
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
SHOPIFY_ADMIN_API_TOKEN=...

# Optional — point RAG at your portfolio snapshot (projects + experience JSON).
# Defaults fall back inside src/knowledge/build.ts when unset.
PORTFOLIO_JSON_URL=https://your-domain.com/data/portfolio.json

PORT=3000
NODE_ENV=development
```

**Complete Guide**: See [docs/ENVIRONMENT_CONFIGURATION.md](docs/ENVIRONMENT_CONFIGURATION.md)

### 2b. Build the RAG Index (portfolio strategy only)

```bash
bun run build:knowledge
```

Fetches projects + experiences from `PORTFOLIO_JSON_URL` (defaults to a hand-maintained snapshot; see `src/knowledge/build.ts`), chunks them, embeds each chunk with `text-embedding-3-small`, and writes `data/knowledge.json`. Commit that file — production deploys use whatever is checked in.

Rebuild whenever the source content changes.

### 3. Start Development Server

```bash
bun run dev
```

Server runs on `http://localhost:4000`

### 4. Test API Endpoint

```bash
curl -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What products do you have?"}'
```

## Embed Chat Widget

Add to any website with customizable strategy:

```html
<link rel="stylesheet" href="https://your-domain.com/chat-widget.css">
<script src="https://your-domain.com/chat-widget.js"></script>
<script>
  AIChatbot.init({
    apiUrl: 'https://your-api.com',
    position: 'bottom-right',
    theme: 'light',
    strategyType: 'portfolio' // 'portfolio', 'ecommerce', 'support', or 'default'
  });
</script>
```

**Available Strategies:**
- `portfolio` - Personal portfolio assistant with resume/project knowledge (✅ Production Ready)
- `ecommerce` - Shopping assistant with Shopify Admin API integration for order tracking and customer lookup (✅ Production Ready)
- `support` - Customer support agent (future enhancement)
- `default` - General purpose chatbot

**Strategy Capabilities:**

**Portfolio Strategy:**
- Resume and experience questions
- Project details and technical stack
- Skills and expertise lookup
- Contact information
- Career highlights

**Ecommerce Strategy:**
- Product search via Shopify Storefront API
- Order tracking via Shopify Admin API (with order number)
- Customer order history lookup (via email)
- Size, fit, and product guidance
- Cart and checkout assistance
- Shipping and return policy information
- Gift recommendations

See [docs/CHAT_WIDGET.md](docs/CHAT_WIDGET.md) for full configuration options and examples.

## Development

### Run Tests

```bash
bun test
```

### Lint & Format

```bash
bun run check       # report issues (used by CI + pre-commit)
bun run check:fix   # auto-fix formatting, import order, lint autofixes
```

Biome runs automatically on staged files via a `simple-git-hooks` pre-commit hook installed by `bun install`.

### Build for Production

```bash
bun run build
bun start
```

### Run with Docker

✅ **Production-ready Docker setup complete** - Multi-stage build with health checks

```bash
# Quick start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop container
docker-compose down
```

**Or manual Docker commands:**
```bash
# Build image
docker build -t ai-chatbot:0.3.0 .

# Run container
docker run -d \
  -e OPENAI_API_KEY=sk-... \
  -e SHOPIFY_STORE_DOMAIN=your-store.myshopify.com \
  -e SHOPIFY_STOREFRONT_ACCESS_TOKEN=... \
  -e SHOPIFY_ADMIN_API_TOKEN=... \
  -e PORT=4000 \
  -p 4000:4000 \
  ai-chatbot:0.3.0
```

**Docker Features:**
- ✅ Multi-stage build (optimized image size)
- ✅ Non-root user for security
- ✅ Health checks on `/api/health`
- ✅ Auto-restart policy
- ✅ Production environment variables
- ✅ Logs volume mounted for monitoring

## � Analytics

**Built-in conversation tracking** with structured JSON logs:

```typescript
// Automatic logging on every chat message
{
  "event": "chat_message",
  "timestamp": "2025-11-06T19:30:00.000Z",
  "strategy": "portfolio",
  "messageLength": 33,
  "historyLength": 2,
  "hasContext": true,
  "success": true
}
```

**View Analytics:**
- **Local**: Check terminal where `bun run dev` is running
- **Production**: https://vercel.com/YOUR-VERCEL-PROJECT/ai-chatbot/logs
- **Helper Script**: Run `.\view-analytics.ps1` for viewing info

**Metrics Tracked:**
- Strategy used (portfolio, ecommerce, default)
- Message and conversation length
- Context availability (product data, etc.)
- Success/error rates with error types

## �🔐 Security

- ✅ **Secret Management** - Environment variables only, never in code
- ✅ **Rate Limiting** - Prevent abuse and DDoS attacks
- ✅ **Request Timeouts** - 30-second timeout for all API calls
- ✅ **Input Validation** - Strict validation on all user input
- ✅ **Security Headers** - HTTPS, CSP, and other protections

**Complete Guide**: [docs/SECURITY_HARDENING.md](docs/SECURITY_HARDENING.md)



### Vercel (Recommended)
Deploy to production with **Vercel** (auto-deploy on main branch):

```bash
# Quick setup (5 minutes)
vercel link
vercel --prod
```

### Docker
Package for container deployment:

```bash
# Build image
docker build -t ai-chatbot:latest .

# Run locally
docker run -p 3000:3000 ai-chatbot:latest

# Push to registry
docker push yourusername/ai-chatbot:latest
```

**Complete Guides**:
- **[docs/VERCEL_QUICK_SETUP.md](docs/VERCEL_QUICK_SETUP.md)** - 5-minute setup
- **[docs/VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md)** - Complete guide

See [.github/BRANCHING_STRATEGY.md](.github/BRANCHING_STRATEGY.md) for CI/CD workflow.

## 🤖 Automated CI/CD

Fully automated pipeline on every push:

- ✅ **Type Checking** - TypeScript strict mode verification
- ✅ **Testing** - 215+ tests with 99.5% pass rate
- ✅ **Linting** - Code quality and style checks
- ✅ **Docker Build** - Multi-stage container image (main only)
- ✅ **Vercel Deploy** - Automatic production deployment
- ✅ **Health Checks** - Verify deployment success

**Complete Guides**:
- **[docs/CI_CD_QUICK_REFERENCE.md](docs/CI_CD_QUICK_REFERENCE.md)** - Quick lookup
- **[docs/CI_CD_PIPELINE_GUIDE.md](docs/CI_CD_PIPELINE_GUIDE.md)** - Complete guide
- **.github/workflows/ci-cd.yml** - Pipeline configuration

---

## Architecture

- **Backend**: Express.js + TypeScript + Node.js 18+
- **Integrations**: OpenAI API, Shopify GraphQL API
- **Frontend**: Embeddable vanilla JavaScript widget
- **Deployment**: Vercel (auto-deploy on main branch)

See [docs/architecture.md](docs/architecture.md) for detailed architecture overview.

## 📚 Documentation

**Start Here**: [INDEX.md](docs/INDEX.md) - Complete documentation map with reading paths by role

### Core Documentation

| Document | Purpose |
|----------|---------|
| **[docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md)** | Project overview - Start here! |
| **[docs/TEST_ARCHITECTURE.md](docs/TEST_ARCHITECTURE.md)** | Test structure & patterns |
| **[docs/DELIVERABLES.md](docs/DELIVERABLES.md)** | Complete file listing |
| **[docs/CHAT_WIDGET.md](docs/CHAT_WIDGET.md)** | Chat widget documentation |

**Status**: ✅ 216 tests passing (100%) | ~20 second execution time | Production-ready

### Deployment Documentation (✅ COMPLETE)

| Document | Purpose | Status |
|----------|---------|--------|
| **[docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md)** | Deployment procedures | ✅ Complete |
| **[docs/ROLLBACK_PROCEDURES.md](docs/ROLLBACK_PROCEDURES.md)** | Rollback automation | ✅ Complete |
| **[docs/POST_DEPLOYMENT_CHECKS.md](docs/POST_DEPLOYMENT_CHECKS.md)** | Verification checklist | ✅ Complete |
| **[docs/PRODUCTION_RUNBOOK.md](docs/PRODUCTION_RUNBOOK.md)** | On-call guide & emergency procedures | ✅ Complete |
| **[docs/TEAM_PROCEDURES.md](docs/TEAM_PROCEDURES.md)** | Team training & execution | ✅ Complete |
| **[docs/DOCKER_SETUP_GUIDE.md](docs/DOCKER_SETUP_GUIDE.md)** | Complete Docker guide | ✅ Complete |
| **[docs/DOCKER_QUICK_REFERENCE.md](docs/DOCKER_QUICK_REFERENCE.md)** | Quick Docker reference | ✅ Complete |
| **[docs/VERCEL_QUICK_SETUP.md](docs/VERCEL_QUICK_SETUP.md)** | 5-minute Vercel setup | ✅ Complete |
| **[docs/VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md)** | Complete Vercel guide | ✅ Complete |
| **[docs/ENVIRONMENT_CONFIGURATION.md](docs/ENVIRONMENT_CONFIGURATION.md)** | Environment variables guide (2,400+ lines) | ✅ Complete |
| **[docs/SECURITY_HARDENING.md](docs/SECURITY_HARDENING.md)** | Security best practices (2,800+ lines) | ✅ Complete |
| **[docs/DATABASE_CONFIGURATION.md](docs/DATABASE_CONFIGURATION.md)** | Database setup guide (2,900+ lines) | ✅ Complete |
| **[docs/CI_CD_QUICK_REFERENCE.md](docs/CI_CD_QUICK_REFERENCE.md)** | CI/CD quick reference | ✅ Complete |
| **[docs/CI_CD_PIPELINE_GUIDE.md](docs/CI_CD_PIPELINE_GUIDE.md)** | Complete CI/CD guide (800+ lines) | ✅ Complete |

**Phase 6 Status**: ✅ **ALL COMPLETE** (6.1 Docker ✅ | 6.2 Vercel ✅ | 6.3 Environment ✅ | 6.4 CI/CD ✅ | 6.5 Production Deployment ✅)

| Document | Purpose | Status |
|----------|---------|--------|
| **[docs/DOCKER_SETUP_GUIDE.md](docs/DOCKER_SETUP_GUIDE.md)** | Complete Docker guide | ✅ Complete |
| **[docs/DOCKER_QUICK_REFERENCE.md](docs/DOCKER_QUICK_REFERENCE.md)** | Quick Docker reference | ✅ Complete |
| **[docs/VERCEL_QUICK_SETUP.md](docs/VERCEL_QUICK_SETUP.md)** | 5-minute Vercel setup | ✅ Complete |
| **[docs/VERCEL_DEPLOYMENT_GUIDE.md](docs/VERCEL_DEPLOYMENT_GUIDE.md)** | Complete Vercel guide | ✅ Complete |
| **[docs/ENVIRONMENT_CONFIGURATION.md](docs/ENVIRONMENT_CONFIGURATION.md)** | Environment variables guide | ✅ Complete |
| **[docs/SECURITY_HARDENING.md](docs/SECURITY_HARDENING.md)** | Security best practices | ✅ Complete |
| **[docs/DATABASE_CONFIGURATION.md](docs/DATABASE_CONFIGURATION.md)** | Database setup guide | ✅ Complete |
| **[docs/CI_CD_QUICK_REFERENCE.md](docs/CI_CD_QUICK_REFERENCE.md)** | CI/CD quick reference | ✅ **NEW** |
| **[docs/CI_CD_PIPELINE_GUIDE.md](docs/CI_CD_PIPELINE_GUIDE.md)** | Complete CI/CD guide | ✅ **NEW** |
| **[.env.example](.env.example)** | Environment template | ✅ Enhanced |
| **[.env.production.example](.env.production.example)** | Production env template | ✅ Complete |
| **[.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml)** | GitHub Actions workflow | ✅ **NEW** |

**Phase 6 Progress**: 6.1 Docker ✅ | 6.2 Vercel ✅ | 6.3 Environment ✅ | 6.4 CI/CD (CURRENT)

### Quick Links

| Need | Read This |
|------|-----------|
| **Project Overview** | [INDEX.md](docs/INDEX.md) (master index) |
| **Project Timeline** | [ROADMAP.md](docs/ROADMAP.md) |
| **Testing Info** | [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md) |
| **Architecture** | [docs/architecture.md](docs/architecture.md) |
| **Code Review** | [/docs/code-review/](docs/code-review/) (4 documents) |

### By Role

- **👤 New to Project** → Start with [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md) → [INDEX.md](docs/INDEX.md)
- **👨‍💻 Developer** → [docs/TEST_ARCHITECTURE.md](docs/TEST_ARCHITECTURE.md) → [docs/architecture.md](docs/architecture.md)
- **🧪 QA/Tester** → [docs/TEST_ARCHITECTURE.md](docs/TEST_ARCHITECTURE.md) → [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md)
- **🔍 Code Reviewer** → [/docs/code-review/PR_5_OVERVIEW.md](docs/code-review/PR_5_OVERVIEW.md)
- **📊 Stakeholder** → [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md) → [ROADMAP.md](docs/ROADMAP.md)

## Project Status

**🎉 PROJECT COMPLETE**: All 16 Tasks Finished (Phase 1-6.5 Complete) - 216 tests passing | Production-ready

| Component | Status | Version | Tests |
|-----------|--------|---------|-------|
| Foundation | ✅ Complete | v0.1.0 | 12 |
| Core Integration | ✅ Complete | v0.2.0 | 34 |
| Chat Widget | ✅ Complete | v0.2.0 | 0 |
| Bot Logic | ✅ Complete | v0.2.1 | 0 |
| Testing & QA | ✅ Complete | Phase 5 | 170+ |
| **Deployment (All 6 Subtasks)** | ✅ **Complete** | **v0.4.0** | **N/A** |

**Latest**: Phase 6.5 Production Deployment Complete (1,650+ lines of documentation, PR #13 merged)  
**Overall Status**: ✅ **100% COMPLETE** (16 of 16 tasks) - Ready for production launch  
**Timeline**: 2 days from start to completion (Nov 3-5, 2025)  
**Code**: 797 lines of production code + 2,530 lines of test code + 8,500+ lines of deployment docs  
**Next Phase**: Optional Phase 7 - Enhancements (planned for future)