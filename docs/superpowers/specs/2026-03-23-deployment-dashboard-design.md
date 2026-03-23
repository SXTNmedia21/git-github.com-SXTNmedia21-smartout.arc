---
title: "Deployment Dashboard — Visual HTML Gate Tracker"
status: draft
updated: 2026-03-23
created: 2026-03-23
module: infrastructure
tags: [deployment, dashboard, html, visualization, gates]
---

# Deployment Dashboard — Visual HTML Gate Tracker

## Brief for Skill Creator / Implementing Agent

### What We're Building

A single-file HTML dashboard (`docs/deploy-dashboard.html`) that visualizes the Smartout deployment pipeline as an interactive checklist of gates grouped by phase. Pontus opens this file locally in a browser during deployments to track progress visually.

**Data source:** `docs/protocols/DEPLOYMENT.md` — the canonical deployment protocol (884 lines, 7 phases, 35 gates).

**Design reference:** `docs/design/ren-og-varm-styleguide.html` — the Smartout "Ren og Varm" design system. MUST read before building. Live at `design.smartout.ai`.

---

### Who Uses This

Pontus (solo founder) during deployments. Sometimes while SSH'd into a server, sometimes from his Windows/WSL machine. Must work offline as a local HTML file — no server, no build step, no dependencies.

---

### Core Requirements

#### 1. Structure: 3 Columns Matching the Deployment Flow

The 7 phases from DEPLOYMENT.md collapse into 3 visual columns:

| Column     | Label   | DEPLOYMENT.md Phases                                         | Color theme  |
| ---------- | ------- | ------------------------------------------------------------ | ------------ |
| **LEFT**   | Prepare | Phase 1 (Pre-Flight) + Phase 2 (Database) + Phase 3 (Docker) | Neutral/blue |
| **CENTER** | Deploy  | Phase 4 (Push & CI) + Phase 5 (Vercel Env)                   | Amber/yellow |
| **RIGHT**  | Verify  | Phase 6 (Post-Deploy) + Phase 7 (Rollback)                   | Green/red    |

Each column contains **gate cards** stacked vertically in chronological order.

#### 2. Gate Cards

Each gate from DEPLOYMENT.md becomes a card with:

- **Gate ID** — e.g., "1.1", "2.3", "4.2"
- **Gate name** — e.g., "Working Directory Clean", "Test Migrations Locally"
- **CLI command** — the verification command from DEPLOYMENT.md (monospace, copyable)
- **Expected output** — what success looks like
- **Status indicator** — one of: pending (gray), running (amber pulse), passed (green check), failed (red X), skipped (dimmed)
- **Click to toggle** — clicking a gate cycles: pending → passed (or pending → failed)
- **Conditional visibility** — some gates say "skip if no changes". These should be skippable.

#### 3. Complete Gate Registry

Extract ALL gates from DEPLOYMENT.md. Here is the definitive list:

**Phase 1 — Pre-Flight (9 gates)**

| ID  | Gate                             | CLI                                         |
| --- | -------------------------------- | ------------------------------------------- |
| 1.1 | Working Directory Clean          | `git status --short`                        |
| 1.2 | No Secrets in Code               | `grep -rn 'smo_sk_\|smo_svc_\|sk_live_...'` |
| 1.3 | Environment Variables Consistent | `comm -23 /tmp/used.txt /tmp/declared.txt`  |
| 1.4 | TypeScript Passes                | `pnpm turbo typecheck`                      |
| 1.5 | Lint Passes                      | `pnpm lint`                                 |
| 1.6 | Build Succeeds                   | `pnpm turbo run build`                      |
| 1.7 | Format Clean                     | `pnpm format:check`                         |
| 1.8 | Build Health                     | `pnpm build:health`                         |
| 1.9 | API Docs Go-Live Guard           | `pnpm api:docs:verify-go-live`              |

**Phase 2 — Database (6 gates)**

| ID  | Gate                                     | CLI                                                                     |
| --- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 2.1 | Check for New Migrations                 | `git diff origin/development..HEAD --name-only -- supabase/migrations/` |
| 2.2 | Test Migrations Locally                  | `docker exec -i ... psql -U postgres < migration.sql`                   |
| 2.3 | Regenerate Types                         | `npx supabase gen types typescript --local > ...`                       |
| 2.4 | Verify RLS on New Tables                 | `psql` query for tables without RLS                                     |
| 2.5 | Check config.toml for New Edge Functions | `grep + ls` cross-reference                                             |
| 2.6 | Check config.toml Cloud Traps            | `grep` for sms_test_otp format, redirect URLs                           |

**Phase 3 — Docker Services (6 gates)**

| ID  | Gate                         | CLI                                                                           |
| --- | ---------------------------- | ----------------------------------------------------------------------------- |
| 3.1 | Check for Service Changes    | `git diff origin/development..HEAD --name-only -- services/ infra/ packages/` |
| 3.2 | Build Docker Images Locally  | `docker build -f services/*/Dockerfile ...`                                   |
| 3.3 | Verify infra/.env on Droplet | `ssh smartout-droplet "cat .../infra/.env"`                                   |
| 3.4 | Deploy to DigitalOcean       | `./infra/scripts/deploy.sh`                                                   |
| 3.5 | Verify Caddy TLS             | `curl -sI https://engine.smartout.ai/health`                                  |
| 3.6 | Backup Before Major Changes  | `./infra/scripts/backup.sh`                                                   |

**Phase 4 — Push & Monitor CI (4 gates)**

| ID  | Gate                      | CLI                                     |
| --- | ------------------------- | --------------------------------------- |
| 4.1 | Push to Development       | `git push origin development`           |
| 4.2 | Monitor GitHub Actions CI | `gh pr checks <PR> --watch`             |
| 4.3 | Monitor Vercel Bot        | `gh api .../comments` for vercel[bot]   |
| 4.4 | Monitor Supabase Bot      | `gh api .../comments` for supabase[bot] |

**Phase 5 — Vercel Environment (4 gates)**

| ID  | Gate                           | CLI                                   |
| --- | ------------------------------ | ------------------------------------- |
| 5.1 | Identify New Variables         | `git diff ... .env.template env.ts`   |
| 5.2 | Update Vercel Dashboard        | `vercel env add` or manual            |
| 5.3 | Verify env.ts CI Compatibility | `grep` for .optional() and startsWith |
| 5.4 | Update 1Password (Both Vaults) | `op item list --vault ...` diff       |

**Phase 6 — Post-Deploy Verification (6 gates)**

| ID  | Gate                      | CLI                                         |
| --- | ------------------------- | ------------------------------------------- |
| 6.1 | Verify Vercel Deployments | `curl -sI https://app.smartout.ai`          |
| 6.2 | Verify Supabase Cloud     | `npx supabase functions list`               |
| 6.3 | Verify Docker Services    | `curl -s https://engine.smartout.ai/health` |
| 6.4 | Verify Webhook Endpoints  | `curl -sI -X POST .../sendgrid-webhook`     |
| 6.5 | Verify Monitoring         | Check Sentry + PostHog dashboards           |
| 6.6 | Platform Health Dashboard | Visit `/dashboard/health`                   |

**Phase 7 — Rollback (shown as reference panel, not gates)**

| ID  | Target                       | CLI                                    |
| --- | ---------------------------- | -------------------------------------- |
| 7.1 | Vercel Rollback              | `vercel rollback <URL>`                |
| 7.2 | Supabase Rollback            | Write reverse migration                |
| 7.3 | Docker Rollback              | `git checkout <GOOD_COMMIT>` + rebuild |
| 7.4 | Emergency: Secret Compromise | Revoke → rotate → redeploy             |

#### 4. Progress Bar

Top of the page: a horizontal progress bar showing `X / 35 gates passed`. Color shifts from red (0%) → amber (50%) → green (100%).

#### 5. Phase Summary Row

Below the progress bar, a row of 7 phase badges:

```
[Phase 1: 0/9] [Phase 2: 0/6] [Phase 3: 0/6] [Phase 4: 0/4] [Phase 5: 0/4] [Phase 6: 0/6] [Phase 7: ref]
```

Each badge shows pass count and turns green when all gates in that phase pass.

#### 6. State Persistence

- **localStorage** — gate states persist across browser refreshes
- **Reset button** — "New Deployment" clears all states
- **Timestamp** — shows when each gate was marked passed/failed
- **Export** — button to copy current state as markdown (for pasting into SESSION.md or Slack)

#### 7. Copy-to-Clipboard on CLI Commands

Every CLI command block has a copy button. Click → copies the command → brief "Copied!" toast.

---

### Visual Design

Follow `docs/design/ren-og-varm-styleguide.html`:

- **Fonts:** Instrument Serif for headings, Geist Sans for body, Geist Mono for CLI commands
- **Colors:** Use CSS variables from the design system (`--background`, `--foreground`, `--border`, `--accent`, etc.)
- **Motion:** Subtle spring animations on state changes (not abrupt)
- **Dark/light mode:** Support both via `prefers-color-scheme` or a toggle
- **Icons:** Use inline SVG (no external icon library). Check = circle with checkmark. Fail = circle with X. Pending = empty circle. Running = pulsing circle.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  SMARTOUT DEPLOYMENT DASHBOARD            [New Deploy] [Export] │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  12/35 gates (34%)      │
│  [P1: 9/9] [P2: 3/6] [P3: 0/6] [P4: 0/4] [P5: 0/4] [P6: 0/6] │
├──────────────────┬──────────────────┬───────────────────────┤
│   PREPARE        │   DEPLOY         │   VERIFY              │
│                  │                  │                       │
│  ┌────────────┐  │  ┌────────────┐  │  ┌────────────────┐  │
│  │ 1.1 Clean  │  │  │ 4.1 Push   │  │  │ 6.1 Vercel OK  │  │
│  │ ✓ passed   │  │  │ ○ pending  │  │  │ ○ pending      │  │
│  │ git status │  │  │ git push   │  │  │ curl -sI ...   │  │
│  └────────────┘  │  └────────────┘  │  └────────────────┘  │
│  ┌────────────┐  │  ┌────────────┐  │  ┌────────────────┐  │
│  │ 1.2 Secret │  │  │ 4.2 CI     │  │  │ 6.2 Supabase   │  │
│  │ ✓ passed   │  │  │ ○ pending  │  │  │ ○ pending      │  │
│  │ grep -rn ..│  │  │ gh pr ...  │  │  │ npx supabase ..│  │
│  └────────────┘  │  └────────────┘  │  └────────────────┘  │
│  ...             │  ...             │  ...                  │
│                  │                  │                       │
│  ── Phase 2 ──   │  ── Phase 5 ──   │  ── Rollback ──      │
│  ┌────────────┐  │  ┌────────────┐  │  Reference panel     │
│  │ 2.1 Migr.  │  │  │ 5.1 New    │  │  (not checkable)    │
│  │ ⊘ skipped  │  │  │ vars       │  │                      │
│  └────────────┘  │  └────────────┘  │                      │
└──────────────────┴──────────────────┴───────────────────────┘
```

### Interaction Design

- **Click gate card** → cycles: pending → passed → failed → pending
- **Right-click gate card** → mark as "skipped" (for conditional gates like 2.1-2.6, 3.1-3.6)
- **Hover gate card** → expands to show full CLI command + expected output
- **Click CLI command** → copies to clipboard
- **Click phase badge** → scrolls to that phase in the column
- **"New Deployment" button** → confirms, then resets all gates to pending, sets new timestamp
- **"Export" button** → generates markdown summary of current state, copies to clipboard

### Export Format

```markdown
## Deployment Status — 2026-03-23 14:30

### Prepare (12/21)

- [x] 1.1 Working Directory Clean (14:01)
- [x] 1.2 No Secrets in Code (14:02)
- [ ] 1.3 Environment Variables Consistent
      ...

### Deploy (0/8)

- [ ] 4.1 Push to Development
      ...

### Verify (0/6)

- [ ] 6.1 Verify Vercel Deployments
      ...
```

---

### Technical Constraints

1. **Single HTML file** — no build step, no npm, no framework. Vanilla HTML + CSS + JS.
2. **No external dependencies** — fonts loaded from Google Fonts CDN only (Instrument Serif, Geist Sans, Geist Mono). If offline, falls back to system fonts.
3. **No server** — everything runs in the browser. State in localStorage.
4. **File location:** `docs/deploy-dashboard.html` (not in `apps/` — this is a standalone tool)
5. **Responsive** — works on laptop screen (1440px) and a narrower window (900px). Below 900px, stack columns vertically.
6. **Accessible** — keyboard navigable (tab through gates, Enter/Space to toggle), proper ARIA roles.

### What NOT to Build

- No automation (don't run CLI commands from the browser)
- No real-time CI integration (this is a manual tracking tool)
- No login or auth
- No database or API
- No separate CSS/JS files (everything in one .html)
- No framework (React, Vue, etc.)

---

### How to Verify

After building, open the file and verify:

1. All 35 gates render in the correct phases and columns
2. Clicking a gate toggles its state (pending → passed → failed → pending)
3. Right-clicking a gate marks it skipped
4. Progress bar updates in real-time
5. Phase badges update counts
6. CLI commands are copyable
7. localStorage persists across refresh
8. "New Deployment" resets everything
9. "Export" produces correct markdown
10. Dark mode works
11. Responsive layout works at 900px
12. Keyboard navigation works (Tab + Enter)

---

### Reference Files

| File                                      | What to read                         | Why                                                           |
| ----------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| `docs/protocols/DEPLOYMENT.md`            | All 7 phases, 35 gates, CLI commands | The data source — every gate in the dashboard comes from here |
| `docs/design/ren-og-varm-styleguide.html` | Colors, fonts, motion, patterns      | The visual design system — dashboard must follow this         |
| `infra/scripts/health-check.sh`           | Health endpoint URLs                 | Verify the URLs in Phase 6 gates match                        |
| `.github/workflows/ci.yml`                | CI job names                         | Verify Phase 4 gate descriptions match                        |

---

### Success Criteria

Pontus opens `docs/deploy-dashboard.html` in Chrome, clicks through gates as he deploys, and at the end can export a markdown summary to paste into SESSION.md. The dashboard should feel like a natural extension of the Smartout design system — warm, clean, professional.
