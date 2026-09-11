# AI Chatbot - Copilot Instructions

> **Purpose**: Guidelines for AI assistance and developers working on this project.

---

## 🏗️ Project Overview

**Project Name**: AI Chatbot  
**Repository**: https://github.com/YOUR-USERNAME/ai-chatbot  
**Owner**: YOUR-USERNAME  
**Purpose**: AI-powered chatbot for ecommerce customer support and product Q&A  
**Status**: ✅ **COMPLETE - 100% PRODUCTION READY** (All 16 tasks finished, Phase 1-6.5 complete)

---

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **Module System**: ES Modules (`"type": "module"` in package.json)
- **Framework**: Express.js
- **AI Service**: OpenAI (default), with support for Dialogflow, Azure Bot Service
- **Deployment**: Vercel, Docker
- **Development**: ts-node with ESM loader (`node --loader ts-node/esm`)

---

## 📂 Project Structure

```
ai-chatbot/
├── .github/                      # GitHub config
├── src/
│   ├── bot/                     # Core chatbot logic
│   │   └── index.ts            # Main chatbot processor
│   ├── api/                     # Express server
│   │   └── index.ts            # API routes (/api/chat)
│   ├── integrations/            # External service integrations
│   │   ├── openai.ts           # OpenAI API client
│   │   └── shopify.ts          # Shopify API client
│   ├── utils/                   # Utility functions
│   └── types/                   # TypeScript types & interfaces
├── public/                       # Static files
│   └── chat-widget.js          # Embeddable chat widget
├── tests/                        # Test files
├── docs/                         # Documentation
│   └── architecture.md         # Architecture overview
├── deploy/                       # Deployment configs
│   └── vercel.json             # Vercel configuration
├── Dockerfile                    # Docker configuration
├── package.json                  # Dependencies & scripts
├── tsconfig.json                # TypeScript config (ESM support)
└── README.md                     # Project documentation
```

---

## 🚀 Getting Started

### Install Dependencies
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Server runs on `http://localhost:4000` with `POST /api/chat` endpoint.

### Build for Production
```bash
npm run build
npm start
```

---

## 🔑 API Routes

### POST /api/chat
Send a chat message and receive AI response.

**Request:**
```json
{
  "message": "What is the price of the blue t-shirt?"
}
```

**Response:**
```json
{
  "response": "The blue t-shirt is priced at $29.99..."
}
```

---

## 🌍 Environment Variables

**File**: `.env.local` (NOT committed to git)

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Shopify Configuration
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=...
SHOPIFY_ADMIN_API_TOKEN=...

# Server Configuration
PORT=4000
NODE_ENV=development
```

---

## 📝 Code Style & Standards

### TypeScript
- **Strict Mode**: Always enabled
- **Type Annotations**: Explicit for all function parameters and returns
- **Example**:
  ```typescript
  export async function getAIResponse(message: string): Promise<string> {
    const response: string = await openai.chat(message);
    return response;
  }
  ```

### ES Modules
- Use `.js` extension in imports (for ES module resolution)
- No CommonJS `require()` statements
- **Example**:
  ```typescript
  import express from 'express';
  import { getBotResponse } from '../bot/index.js';
  ```

### Imports
- Absolute imports from project root are preferred
- Use destructuring for clarity
- Group imports: third-party, then local

### Formatting
- 2-space indentation
- Semi-colons required
- No unused imports (use `npm run lint` to check)

---

## 🌿 Git Workflow

### Branch Strategy
```
main (production)
  ↑
dev (development)
  ↑
feature/* (feature branches)
```

### Conventional Commits
**Format**: `type(scope): description`

**Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `chore:` - Maintenance
- `refactor:` - Code refactoring

**Example**:
```bash
git commit -m "feat(bot): implement OpenAI integration

- Add OpenAI API client
- Support gpt-4 and gpt-3.5-turbo models
- Add error handling and rate limiting

Refs #1"
```

### Workflow Steps
1. Create feature branch from `dev`: `git checkout -b feat/feature-name`
2. Make changes and commit with conventional format
3. Push to GitHub: `git push -u origin feat/feature-name`
4. Create PR from `feat/feature-name` → `dev`
5. After approval, merge to `dev`
6. Create PR from `dev` → `main` for production
7. After approval and CI/CD passes, merge to `main`

### Pull Request Guidelines
- ✅ **KEEP PRS CONCISE**: Target 5 minute read time (~750 words max)
  - Focus on "what changed" and "why", not implementation details
  - Use bullet points for changes
  - Link to issues for context
  - Code speaks for itself - don't duplicate in description
- ✅ **PR Description Template**:
  ```
  ## Changes
  - Bullet list of changes (3-5 max)
  
  ## Issue
  Fixes #123 (or link to issue)
  
  ## Testing
  ✅ What was tested
  ```
- ⚠️ **DO NOT** write essay-style PR descriptions
- ⚠️ **DO NOT** include detailed implementation explanations
- ⚠️ **DO NOT** paste large code snippets (code is in the diff)

---

## 🔐 Integrations

### OpenAI Integration (`src/integrations/openai.ts`)

**Setup**:
1. Sign up at https://platform.openai.com
2. Create API key
3. Add to `.env.local`: `OPENAI_API_KEY=sk-...`

**Usage**:
```typescript
import { getAIResponse } from '../integrations/openai.js';

const response = await getAIResponse("User question");
```

**Models Supported**:
- gpt-4 (recommended for complex queries)
- gpt-3.5-turbo (faster, cheaper)

### Shopify Integration (`src/integrations/shopify.ts`)

**Setup**:
1. Create Shopify store or use existing
2. Generate access tokens in admin
3. Add to `.env.local`

**Usage**:
```typescript
import { getProductInfo } from '../integrations/shopify.js';

const product = await getProductInfo("product-id");
```

**Available Methods**:
- `getProductInfo(productId)` - Fetch product details
- `searchProducts(query)` - Search products
- `getOrderStatus(orderId)` - Check order status

---

## 🧪 Testing

### Run Tests
```bash
npm test
```

### Test Coverage
```bash
npm test -- --coverage
```

### Test Locally Before Merge
**Setup**: Open 2 terminals
1. **Terminal 1**: Run dev server in background
   ```bash
   npm run dev
   ```
2. **Terminal 2**: Test with PowerShell script
   ```bash
   .\chat-test.ps1
   # or for production testing:
   .\chat-test-prod.ps1
   ```

### E2E Tests (Future)
```bash
npm run test:e2e
```

---

## 🚢 Deployment

### Vercel Deployment
Production deployment is automatic on `main` branch merge.

**Configuration**: `deploy/vercel.json`

```bash
vercel --prod
```

### Docker Deployment
```bash
docker build -t ai-chatbot .
docker run -p 4000:4000 ai-chatbot
```

---

## 📋 Development Checklist

When starting work on a feature:

- [ ] Create feature branch: `git checkout -b feat/xxx`
- [ ] Install dependencies: `npm install`
- [ ] Start dev server: `npm run dev`
- [ ] Make changes with TypeScript strict mode
- [ ] Test locally: `npm test`
- [ ] Lint and format: `npm run lint`
- [ ] Commit with conventional format
- [ ] Push and create PR to `dev`
- [ ] Wait for CI/CD to pass
- [ ] Request code review
- [ ] Merge after approval

---

## 🆘 Common Issues

### Issue: "Cannot find module 'express'"
**Solution**: Run `npm install` first

### Issue: TypeScript errors with ES modules
**Solution**: Ensure imports use `.js` extension and tsconfig.json has `"module": "ESNext"`

### Issue: `npm run dev` fails with deprecation warnings
**Solution**: Warnings are expected with ts-node/esm. They don't affect functionality.

### Issue: Port 4000 already in use
**Solution**: Change PORT in `.env.local` or kill process on port 4000

---

## 📚 Resources

- **OpenAI Docs**: https://platform.openai.com/docs
- **Shopify API**: https://shopify.dev/api
- **Express.js**: https://expressjs.com
- **TypeScript**: https://www.typescriptlang.org
- **Vercel Docs**: https://vercel.com/docs
- **Node.js ESM**: https://nodejs.org/api/esm.html

---

## 🤖 AI Assistant Context

### What AI Should Know

**When working with this project:**
1. All code must be TypeScript with strict mode
2. Use ES modules exclusively (no CommonJS)
3. Import paths must include `.js` extension
4. Follow conventional commit format
5. Always add type annotations to function parameters and returns
6. Use `.env.local` for sensitive data (never commit)
7. Run `npm run dev` to test changes locally

**Common Tasks:**
- **New Feature**: Create `feat/xxx` branch, implement in TypeScript, test, commit, push, create PR
- **Bug Fix**: Create `fix/xxx` branch, reproduce, fix, test, commit, push, create PR
- **API Route**: Add to `src/api/index.ts`, implement handler, add types, test
- **Integration**: Create new file in `src/integrations/xxx.ts`, add types, export functions, test
- **Deployment**: Merge to `main`, Vercel auto-deploys
- **Documentation**: Always create in `docs/` folder, NOT in root directory

**Documentation Rules:**
- ⚠️ **DO NOT** create markdown files in root directory
- ⚠️ **DO NOT** create phase summaries, completion reports, or session summaries
- ⚠️ **DO NOT** create temporary planning documents (use ROADMAP.md instead)
- ⚠️ **DO NOT** create duplicate setup/deployment guides
- ✅ **DO** create feature documentation in `docs/` folder (e.g., CHAT_WIDGET.md)
- ✅ **DO** create setup guides for integrations (e.g., OPENAI_SETUP.md)
- ✅ **DO** create operational runbooks (e.g., PRODUCTION_RUNBOOK.md)
- ✅ **KEEP MARKDOWN FILES CONCISE**: No markdown file should take longer than 10 minutes to read (target ~1,500 words max)
  - Break long docs into multiple files
  - Use clear headings, bullet points, and tables
- Root should only have: `README.md`, `ROADMAP.md`, `INDEX.md`
- Organize docs by category: `docs/api/`, `docs/architecture/`, `docs/guides/`, etc.
- Archive old docs in `docs/archive/` before deleting

**Project Status Tracking:**
- ⚠️ **DO NOT** create separate phase/completion/summary reports
- ⚠️ **DO NOT** create status dashboard files (use GitHub Projects instead)
- ✅ **DO** update `ROADMAP.md` for project status and milestones
- ✅ **DO** use commit messages to document work (conventional commit format with detailed body)
- ✅ **DO** use PR descriptions for detailed change summaries
- After work completes: Update `ROADMAP.md` only, don't create new report files

**Files NOT to Modify**:
- `.env.local` (user-specific, not in git)
- `node_modules/` (generated)
- `dist/` (build output)
- `.vercel/` (deployment cache)

---

## 📞 Support

**GitHub Issues**: https://github.com/YOUR-USERNAME/ai-chatbot/issues  
**Documentation**: See `docs/` folder  

---

**Last Updated**: November 3, 2025  
**Status**: Initial scaffold complete, ready for feature development
