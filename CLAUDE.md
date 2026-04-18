# CLAUDE.md

## Project: Creatrbase
Creator commercial intelligence platform. Solo founder (Anthony). Fastify + React SPA + PostgreSQL + Redis + Prisma.

---

## CRITICAL: What exists and must NOT be rebuilt

Everything below is deployed and live at https://creatrbase.com. Do not rebuild, redesign, or re-architect any of it unless explicitly asked.

### Design System (v2 - complete)
- Light mode default (cream #FAF6EF), dark mode via `data-theme="dark"` on `<html>`
- Tokens in `client/src/styles/tokens.css` - single source of truth
- Marketing: Lilita One display, sticker shadows, cream/navy/mint
- Product: Outfit display, soft shadows, cream surfaces
- Body: DM Sans. Mono: JetBrains Mono.
- Theme toggle in product user dropdown and admin user dropdown

### Public Pages (all pre-rendered, all live)
- Landing page (`/`) with 13 sections, BrandCheck form, interactive demo tabs
- Blog index + 10 articles (`/blog`, `/blog/:slug`)
- Scoring methodology (`/scoring-explained`)
- Pricing with billing toggle (`/pricing`)
- Honesty page (`/honesty`)
- Score form (`/score`) - redirects to server-rendered score card
- Author page (`/author/anthony-saulderson`)
- Static pages (`/privacy`, `/terms`)
- Comparison page infrastructure (`/compare/:competitor`) - 0 published
- Programmatic pages infrastructure (`/niche/:slug`, `/rates/:country/:niche`, `/threshold/:metric`, `/research/:slug`) - 0 published

### Product UI (all restyled to v2)
- Dashboard, Gap Tracker, Tasks, Connections, Outreach, Negotiations
- AppLayout with sidebar nav, theme-aware logo
- Free/Core/Pro tier system with requireTier middleware
- UpgradeGate component for locked features

### Admin Platform (`/admin`)
- Auth: `cfo_access_level >= 100` on users table
- Cheeky 404 for non-admins (RequireAdmin component)
- Dashboard with 6 status cards
- Editorial module: session page, voice memory CRUD, skills viewer
- Placeholder pages for: Subscribers, Creators, Agents, System, Revenue

### Newsletter Infrastructure
- Listmonk running in Docker on VPS (port 9000)
- 3 segments: creator-economy, ai-for-creators, editorial
- `POST /api/newsletter/subscribe` with attribution tracking
- RSS ingestion (10 sources, Bull worker every 4h)
- Newsletter signup forms on landing, blog articles, product signup

### Editorial Agents
- 12 skills in `/skills/` directory
- Creator Economy Digest agent (Mondays 8am UK, Bull worker)
- AI for Creators Digest agent (Thursdays 8am UK, Bull worker)
- Editorial Composer (conversational, via admin API)
- Agent runner with Anthropic SDK tool_use loop
- Voice memory table for editorial positions

### SEO / Pre-rendering
- Puppeteer pre-renders all public routes post-deploy
- Pre-rendered HTML served via `onRequest` hook before static files
- Sitemap dynamically includes all page types
- robots.txt with explicit AI crawler allow rules
- `/llms.txt` for AI crawler content discovery
- Plausible analytics live
- GSC + Bing verified, sitemaps submitted
- Person author schema on blog articles
- Organization + SoftwareApplication schema on homepage/pricing

---

## Code Conventions (non-negotiable)

- **Auth middleware:** `req.user.userId`, `req.user.tenantId` (NOT `req.actor.person_id`)
- **Database:** Prisma ORM (`getPrisma()`) for most queries, raw `getPool()` for complex SQL
- **Framework:** Fastify (NOT Express). Middleware = `preHandler` hooks.
- **Tier checking:** `resolveTier(tenantId)` from `src/services/tierResolver.js`
- **Admin checking:** `requireAdmin` middleware, returns 404 not 401
- **Tier gating:** `requireTier('core')` or `requireTier('pro')` preHandler
- **Agent runs:** `agent_run` table, status values: `queued`/`running`/`complete`/`failed` (NEVER `completed`)
- **Model string:** `claude-sonnet-4-6`
- **CSS:** Module CSS (`.module.css`), use tokens from `tokens.css`, no hardcoded colours
- **Copy:** UK English, no em-dashes, no en-dashes

---

## Key File Locations

### Backend
```
src/app.js                          — Fastify app, route registration, static serving, workers
src/middleware/authenticate.js      — JWT auth, sets req.user
src/middleware/requireAdmin.js      — Admin check (cfo_access_level >= 100), cheeky 404
src/middleware/requireTier.js       — Tier gating (free/core/pro)
src/services/tierResolver.js        — resolveTier(tenantId) -> {tier, status, features}
src/services/listmonkClient.js      — Listmonk API wrapper
src/services/scoringEngine.js       — DO NOT MODIFY - scoring engine
src/services/publicScoring.js       — Public scoring adapter
src/lib/prisma.js                   — getPrisma() singleton
src/lib/dimensionLevels.js          — getDimensionLevel(score) utility
src/db/pool.js                      — getPool() raw PostgreSQL
src/domains/auth/                   — Login, signup, OAuth, /api/auth/me
src/domains/billing/                — Stripe, checkout, subscriptions, start-trial
src/domains/admin/                  — Admin dashboard, editorial session, voice memory, agent runs
src/domains/public/                 — Sitemap, score cards, claim flow, OG images
src/domains/blog/                   — Blog CRUD
src/domains/compare/                — Comparison pages CRUD
src/domains/programmatic/           — Niche, rate, threshold, research pages
src/domains/newsletter/             — Subscribe endpoint
src/agents/newsletter/              — Agent runner, tools, skills-loader, digest agents, editorial composer
src/jobs/workers/                   — Bull workers (platform sync, ingestion, digests, etc.)
src/templates/scoreCard.js          — Server-rendered score card HTML
```

### Frontend
```
client/src/App.jsx                  — All routes
client/src/styles/tokens.css        — Design tokens (THE source of truth)
client/src/styles/global.css        — Global styles
client/src/styles/reset.css         — CSS reset + scroll-padding
client/src/layouts/AppLayout/       — Product app shell (sidebar, topbar, theme toggle)
client/src/layouts/AuthLayout/      — Login/signup layout (cream left, navy right)
client/src/components/PublicNav/    — Marketing nav (v1 dark, v2 cream)
client/src/components/MarketingFooter/ — Shared footer for all marketing pages
client/src/components/UpgradeGate/  — Tier gating UI component
client/src/components/NewsletterSignup/ — Newsletter form (4 variants)
client/src/lib/AuthContext.jsx      — Auth state (user, tier, loading)
client/src/lib/RequireAuth.jsx      — Redirect to login if not authenticated
client/src/lib/RequireAdmin.jsx     — Cheeky 404 if not admin
client/src/lib/api.js               — API client (fetch wrapper)
```

### Skills
```
skills/creatrbase-voice/SKILL.md
skills/creatrbase-copy-rules/SKILL.md
skills/newsletter-curation/SKILL.md
skills/newsletter-summarisation/SKILL.md
skills/newsletter-subject-lines/SKILL.md
skills/editorial-question-generation/SKILL.md
skills/editorial-drafting/SKILL.md
skills/voice-memory-protocol/SKILL.md
skills/listmonk-posting/SKILL.md
skills/source-credibility-tiering/SKILL.md
skills/digest-creator-economy/SKILL.md
skills/digest-ai-for-creators/SKILL.md
```

### Scripts
```
scripts/deploy-live.sh              — Full deploy: push, build, restart, pre-render
scripts/prerender.js                — Puppeteer pre-rendering (runs post-deploy)
scripts/migrate.js                  — Sequential SQL migration runner
scripts/audit-internal-links.js     — Internal linking audit tool
```

### Migrations
```
migrations/001-030                  — 30 migrations, all applied on production
```

### Config
```
docker-compose.yml                  — Listmonk + its Postgres
listmonk/config.toml                — Listmonk config
client/vite.config.js               — Vite build config
prisma/schema.prisma                — Prisma schema (30+ models)
```

---

## Deploy Process

```bash
# Full deploy (from local machine):
bash scripts/deploy-live.sh

# What it does:
# 1. git push origin main
# 2. SSH to VPS: pull, npm install, client build, pm2 restart
# 3. Wait 3 seconds for server to start
# 4. Run pre-render script (Puppeteer crawls all public routes)

# If you added a new migration:
ssh root@153.92.208.28 "cd /root/creatrbase-v2 && node scripts/migrate.js"
# IMPORTANT: new migrations must be added to the FILES array in scripts/migrate.js
# Migration SQL must NOT include INSERT INTO schema_migrations (the runner does that)

# Manual pre-render (if needed):
ssh root@153.92.208.28 "cd /root/creatrbase-v2 && node scripts/prerender.js"
```

### VPS Details
- **Host:** 153.92.208.28
- **App directory:** `/root/creatrbase-v2/` (NOT `/var/www/creatrbase/`)
- **PM2 process:** `creatrbase`
- **Listmonk:** Docker container on port 9000
- **Nginx:** reverse proxy, port 443 -> Node port 3000

---

## Do's and Don'ts

### DO
- Use v2 tokens from `tokens.css` for all colours, spacing, shadows
- Test both light and dark themes visually before deploying
- Deploy and test live after every meaningful change
- Run migrations separately after deploy if new ones were added
- Add new public routes to `STATIC_ROUTES` in `scripts/prerender.js`
- Add new public routes to `STATIC_PAGES` in `src/domains/public/publicRoutes.js` for sitemap
- Use `requireTier('core')` or `requireTier('pro')` on paid endpoints
- Use `requireAdmin` on admin endpoints (returns 404, not 401)
- Keep `--neon-mint` for text on cream (resolves to dark shade #4FB893 in light mode)

### DON'T
- Don't modify the scoring engine (`src/services/scoringEngine.js`)
- Don't use Express patterns (no `app.use()`, no `req.user.id` - it's `req.user.userId`)
- Don't add `INSERT INTO schema_migrations` in migration SQL files
- Don't use sticker shadows in product UI (soft shadows only)
- Don't use Lilita One in product UI (Outfit only)
- Don't hardcode colours - always use token variables
- Don't use `rgba(255,255,255,0.xx)` - use token variables instead
- Don't use em-dashes or en-dashes in copy
- Don't add new npm dependencies without asking Anthony first
- Don't push to `/var/www/creatrbase/` - the live app is at `/root/creatrbase-v2/`
- Don't skip the pre-render step - crawlers get empty HTML without it

---

## Current State Summary

### What's complete and deployed
- Phase 1: Landing page + all marketing pages (v2 cream/sticker)
- Phase 2: Public scoring, free tier, tier gating, auth harmonisation, product UI refactor
- Phase 3: Admin platform, newsletter infra (Listmonk + SES), editorial agents + skills, signup integration
- Distribution Pack: Pre-rendering, sitemap, robots.txt, analytics, author/org schema, llms.txt, comparison + programmatic page infrastructure

### What's infrastructure-ready but has no content yet
- Comparison pages (`/compare/:competitor`) - API ready, 0 published
- Niche pages (`/niche/:slug`) - API ready, 0 published
- Rate pages (`/rates/:country/:niche`) - needs CPM benchmark data
- Threshold pages (`/threshold/:metric`) - API ready, 0 published
- Research reports (`/research/:slug`) - API ready, 0 published

### What hasn't been built yet
- Creators directory (Workstream E - deferred, needs 50+ opted-in creators)
- Admin modules: Subscribers, Creators, Agents, System, Revenue (placeholder pages exist)
- Scoring hub at `/scoring/` (separate from `/scoring-explained`)
- Internal linking remediation across existing articles
- Content production (comparison pages, niche enrichment, new articles)
