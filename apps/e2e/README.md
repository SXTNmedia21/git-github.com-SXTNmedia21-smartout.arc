---
title: E2E Test Suite
status: in_progress
updated: 2026-05-24
created: 2026-05-24
module: e2e
tags: [playwright, testing, e2e, wsl2]
---

# E2E Test Suite

Playwright-based end-to-end tests for Smartout web, mobile, and landing surfaces.

## Prerequisites

- Supabase Local running: `npx supabase start`
- Web dev server running on port 3060: `pnpm --filter web dev`
- Node modules installed: `pnpm install`
- `.env.local` populated (copy `.env.local.example`, fill Supabase local keys)

## Running Tests

```bash
# All web tests (default)
pnpm test:e2e

# Smoke suite only (@smoke tag)
pnpm test:e2e:smoke

# Interactive UI mode
pnpm test:e2e:ui

# Mobile PWA tests (start Metro first: pnpm dev:mobile)
pnpm test:e2e:mobile
```

## OPS-1: WSL2 Memory Constraints

WSL2 runs with **swap=0B** by default. Next.js 16 dev server peaks ~5 GB during
tsc/build phase. Concurrent Playwright workers add 2-4 GB of chromium tab memory.
**Total peak easily exceeds 15 Gi RAM**, triggering OOM kills of the web server.

4 OOM kills were documented in the 2026-05-23 journey sweep, each cascading
`ERR_NETWORK_CHANGED` across 5-15 subsequent Playwright tests (~30% sweep overhead). See
ADR-0408 and `docs/test-runs/2026-05-23-journey-sweep/BUGS.md` (OPS-1 section).

### Mitigations

**1. Worker count (Layer A -- zero-risk)**

`playwright.config.ts` defaults to `workers: 1` locally (was: auto = OOM).
Override only if you have added swap: `E2E_WORKERS=2 pnpm test:e2e`

**2. Production build mode (Layer C -- stable, slower iteration)**

Run the web app in production mode before running tests. Memory profile drops ~60%
because Next.js does not run tsc on every request in production mode.

```bash
# Step 1: build the web app (one-time, or after code changes)
pnpm --filter web build

# Step 2: start the production server on port 3060
pnpm --filter web start -- --port 3060

# Step 3: run tests with SKIP_WEB_SERVER=1 (reuse the running server)
pnpm test:e2e:prod-mode
```

Trade-offs of production mode:

- Stable: no tsc OOM during test run
- Slower iteration: must rebuild after code changes
- No hot-reload: code changes require `pnpm --filter web build` again
- More accurate: closer to what runs in CI and on Vercel

**3. Add WSL2 swap (Layer D -- permanent fix)**

See `docs/protocols/WSL2-SWAP-CONFIG.md` for step-by-step instructions to add
8-16 GB swap to your WSL2 instance. After adding swap, you can safely increase
`E2E_WORKERS=2` (or 3 with 16 GB swap).

**4. ci:local memory gate (Layer B)**

`pnpm ci:local` runs a memory pre-flight that aborts with an actionable message
if available RAM < 6500 Mi. Override: `CI_LOCAL_SKIP_MEMORY_CHECK=1 pnpm ci:local`

## Test Structure

```
apps/e2e/
├── tests/              -- Playwright specs, organized by feature/journey
│   ├── mobile/         -- Mobile-specific specs
│   ├── mobile-pwa/     -- PWA smoke suite
│   └── */              -- Feature suites
├── helpers/            -- Shared test helpers and harnesses
├── fixtures/           -- Playwright fixture factories
├── reporters/          -- Custom reporters (journey, SSE)
├── scripts/            -- Shell scripts (start-local-next-app.sh, etc.)
├── global-setup.ts     -- Pre-suite setup (fixture provisioning + C4 seed)
└── playwright.config.ts -- Playwright configuration
```

## Environment Variables

| Variable           | Purpose                                | Default         |
| ------------------ | -------------------------------------- | --------------- |
| `E2E_WEB_PORT`     | Web app port                           | `3060`          |
| `E2E_LANDING_PORT` | Landing page port                      | `3056`          |
| `E2E_MOBILE_PORT`  | Expo Metro port                        | `8083`          |
| `E2E_WORKERS`      | Playwright worker count                | `1` (OPS-1 cap) |
| `SKIP_WEB_SERVER`  | Skip auto-start of web/landing servers | unset           |
| `E2E_SSE`          | Enable SSE reporter                    | unset           |
| `CI`               | Enable CI reporter + forbidOnly        | unset locally   |
