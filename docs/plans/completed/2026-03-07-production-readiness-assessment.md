---
title: "Production Readiness Assessment — Codebase Audit & Dispatch Plan"
status: draft
updated: 2026-03-07
created: 2026-03-07
module: platform
tags: [production, audit, dispatch, v1]
---

# Smartout — Production Readiness Assessment

> **Date:** 7 March 2026
> **Method:** 10 autonomous codebase exploration agents auditing onboarding, org structure, auth/billing, build health, dashboard, unwired UI, KPI indexes, and all active branches
> **Goal:** Ground truth for V1 production dispatch plan
> **V1 Definition:** Admin can register a company, set up org structure, invite employees, and land on a useful dashboard

---

## 1. Codebase Reality — Verified Against Code

### Infrastructure — Complete

| Component                   | Status | Evidence                                                                                                                                                                               |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo (pnpm + Turborepo) | DONE   | apps/web, apps/landing, apps/e2e, 13 packages, 5 services                                                                                                                              |
| Supabase + migrations       | DONE   | 97 migrations, 12,227 lines of SQL, sequential numbering                                                                                                                               |
| RLS (workspace isolation)   | DONE   | All workspace-scoped tables have JWT + API key policies                                                                                                                                |
| Shared types                | DONE   | identity, structure, governance, engine, journey, enums, platform, time                                                                                                                |
| Next.js 16 + App Router     | DONE   | Auth, middleware, subdomain routing                                                                                                                                                    |
| Docker + Caddy              | DONE   | docker-compose.yml + docker-compose.prod.yml with resource limits. feat/infra-hardening (wt-4) adds security headers, non-root containers, CI builds, backup scripts — ready to merge. |
| Edge Functions              | DONE   | 28 functions, 16 with verify_jwt=false (all properly secured)                                                                                                                          |
| Package exports             | DONE   | 12/15 packages have proper exports (3 internal-only missing)                                                                                                                           |

### Module 1: Onboarding — 95% Complete

| Component             | Status  | Details                                                                                                                                            |
| --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup / login / auth | DONE    | Email/password + Google OAuth + magic link                                                                                                         |
| Onboarding wizard     | DONE    | 8 scroll-based sections: hero, business, departments, locations, procedures, season, contract, welcome                                             |
| Resume mechanism      | DONE    | Two-tier: workspace intelligence_data (primary) + onboarding_session (fallback). No localStorage — all backend-driven                              |
| Business enrichment   | DONE    | gather-workspace-intelligence orchestrates: Brreg + scrapling + Google Places + web search                                                         |
| Edge Functions (6)    | DONE    | gather-workspace-intelligence, identify-company, search-brreg, scrape-website, activate-workspace, finalize-workspace                              |
| Finalization RPCs (2) | DONE    | finalize_onboarding_workspace + activate_workspace_v3. Two fix migrations (20260405, 20260408) suggest this area had bugs — needs E2E verification |
| Voice agent (Botsson) | DONE    | 25+ client tools, Ultravox WebSocket, mission: onboarding-interview                                                                                |
| Error handling        | PARTIAL | Section-level try/catch exists. No React ErrorBoundary. No toast on finalization failure.                                                          |
| Password reset        | STUB    | Form renders at /reset-password but backend NOT implemented                                                                                        |

### Module 2: Org Structure — 100% Complete

| Entity     | CRUD     | Page                                  | Notes                                                          |
| ---------- | -------- | ------------------------------------- | -------------------------------------------------------------- |
| Department | FULL     | /organization + /departments/[id]     | 5-tab detail page, manager assignment, color/icon              |
| Location   | FULL     | /organization + /locations/[id]       | Parent of zones/assets, type enum, capacity                    |
| Team       | FULL     | /organization + /teams/[id]           | Member management, leader, 5 type enum                         |
| Position   | EMBEDDED | Under /departments/[id] Positions tab | Create/Edit/Move dialogs. Always scoped to department          |
| Zone       | EMBEDDED | Under /locations/[id] Zones section   | Create/Edit dialogs. Always scoped to location                 |
| Asset      | EMBEDDED | Under /locations/[id] Assets section  | Create/Edit dialogs. requires_training, requires_routine flags |

All entities use soft delete (is_active toggle). 18 component files in \_components/.

### Module 3: Scheduling — 90% Complete

| Component        | Status  | Details                                                     |
| ---------------- | ------- | ----------------------------------------------------------- |
| Schedule builder | DONE    | DnD Kit, daily grid, monthly view, list view                |
| Templates        | DONE    | Create, edit, load template dialogs                         |
| Open shifts      | DONE    | OpenShiftDialog, assignment                                 |
| Shift CRUD       | DONE    | TanStack Query hooks: create, update, move, delete, publish |
| Absence          | DONE    | useAbsences hook, AbsencePopover                            |
| Batch actions    | DONE    | BatchActionBar                                              |
| Publishing       | DONE    | PublishOverviewDialog                                       |
| Punch clock      | MISSING | Requires mobile app (V2)                                    |
| Day Session      | DONE    | DaySessionProvider, voice tools bridge                      |

### Module 9: Communication — 70% Complete

| Component             | Status  | Details                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
| Chat UI               | DONE    | ChatShell, MessageList, MessageBubble, ConversationList |
| Broadcast             | DONE    | SendMessageDialog, BroadcastDialog                      |
| Notifications package | DONE    | Email, SMS, rate-limit, kill-switch                     |
| Realtime sync         | UNKNOWN | useJourneySocket exists, chat realtime unclear          |

### Module 12: AI Layer — 85% Complete

| Component                                                           | Status |
| ------------------------------------------------------------------- | ------ |
| packages/ai (engines, agents, capabilities, router, tools, prompts) | DONE   |
| Stage Engine (Hono + Docker)                                        | DONE   |
| Interview MCP (voice pipeline)                                      | DONE   |
| Shift MCP (schedule tools)                                          | DONE   |
| Guardian system (sweep, signal, actions, notify)                    | DONE   |
| Leader Pulse                                                        | DONE   |
| Specialized agents (6)                                              | DONE   |
| Voice assistant (BrowserCall, Norwegian)                            | DONE   |
| Embeddings/RAG (workspace_doc_chunk, pgvector)                      | DONE   |

### Module 13: Multi-tenant — 90% Complete

| Component                             | Status |
| ------------------------------------- | ------ |
| Workspace isolation (RLS)             | DONE   |
| Subdomain system ({slug}.smartout.ai) | DONE   |
| Workspace switcher                    | DONE   |
| Platform Admin (godmode)              | DONE   |
| API key management                    | DONE   |

### Auth & Middleware — Verified

| Flow                        | Status | Notes                                                                                  |
| --------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Email/password login        | DONE   | Supabase signInWithPassword                                                            |
| Google OAuth                | DONE   | signInWithOAuth, callback at /api/auth/callback                                        |
| Email signup                | DONE   | signUp + email verification (auto-login in dev)                                        |
| Invitation-based onboarding | DONE   | /invite/[token] page, 7-day expiry, email/SMS/link modes                               |
| Password reset              | STUB   | Form renders, NO backend implementation                                                |
| Middleware route protection | DONE   | Security gate + subdomain detection + session management                               |
| Godmode cache (30s TTL)     | DONE   | Platform-admin protection                                                              |
| Showcase mode               | DONE   | Cookie-based demo workspace bypass                                                     |
| Dashboard layout guards     | DONE   | contract_status enforcement (setup/onboarding -> /onboarding, deactivated -> /blocked) |

### Billing — Contract-Driven, NOT Stripe

| Component                 | Status    | Notes                                                                                      |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| /select-plan pricing page | DONE      | 3 tiers (499/1299/enterprise NOK). Buttons link to /dashboard — NO Stripe checkout         |
| Stripe integration        | NOT BUILT | No webhooks, no API calls, no checkout flow, no stripe_customer_id field                   |
| DocuSeal contract webhook | DONE      | /api/webhooks/docuseal handles form.viewed, form.completed, form.declined                  |
| Trial banner              | DONE      | Shows countdown when contract_status = trial/pending_contract                              |
| Company billing fields    | PARTIAL   | billing_email, subscription_plan, subscription_status, trial_ends_at exist. No Stripe IDs. |

Billing is contract-signature-driven: contract signed -> workspace activated. No payment processing.

### Invitation System — Complete

| Component                        | Status                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| create-invitation Edge Function  | DONE — batch + single mode, email/SMS/link dispatch          |
| accept-invitation Edge Function  | DONE — creates auth user + profile + team_member assignments |
| /invite/[token] page             | DONE — validates token, collects name/password, signs in     |
| SendGrid email dispatch          | DONE                                                         |
| Twilio SMS dispatch              | DONE                                                         |
| 7-day expiry + unique constraint | DONE                                                         |

---

## 2. Unwired UI — Components Showing Fake Data

### Critical: Fake metrics displayed as real

| Component                       | File                           | What's Fake                                                                                                         | Real Data Source                                                   |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| StrategicView — 6 KPI cards     | StrategicView.tsx:49-98        | 40 hardcoded values across 4 locations (payroll %, turnover, absence, onboarding time, compliance, task completion) | Should calculate from schedule_shift, profile, protocol_assignment |
| StrategicView — Turnover chart  | StrategicView.tsx:642-650      | 4 series x 6 months of fake trend data                                                                              | Should calculate from historical profile status transitions        |
| ActivityView — Heatmap          | ActivityView.tsx:40-46         | Math.random() \* 100 for ALL cells                                                                                  | Should query engine_event or department_session                    |
| ActivityView — Labels           | ActivityView.tsx:49-82         | 22 hardcoded names (locations, depts, teams, employees)                                                             | Should query location, department, team, profile tables            |
| ActivityView — Intensity cards  | ActivityView.tsx:211-226       | "Fredager", "Kveldsgjengen" hardcoded                                                                               | Should compute from heatmap data                                   |
| ActivityView — Event log        | ActivityView.tsx:556-560       | 5 fake events with fake times/scores                                                                                | Should query department_session or engine_event                    |
| TacticalView — Protocol list    | TacticalView.tsx:174-235       | 4 demo protocols (Matservering, Brannvern, Kassasystem, Allergener) with fake completion stats                      | Should query protocol + protocol_assignment                        |
| GuardianView — Compliance table | GuardianView.tsx:329-335       | 5 demo compliance rows with fake percentages                                                                        | Should query protocol_assignment status                            |
| GlobalSearchPalette             | GlobalSearchPalette.tsx:67-176 | 11 hardcoded results (8 commands, 3 people, 3 knowledge items). Has TODO: "Replace with /api/search"                | Wire to /api/search + workspace_doc_chunk                          |

### Medium: Acknowledged placeholders

| Component                      | Count | Details                                                            |
| ------------------------------ | ----- | ------------------------------------------------------------------ |
| "Under construction" pages     | 5     | my-schedule, my-training, my-cv, my-salary, help                   |
| "Coming soon" settings tabs    | 5     | general, kpis, notifications, teams, security (only "hours" works) |
| Platform-admin journey buttons | 2     | "Play" and "Test Journey" show toast instead of action             |

### Sidebar badges — mixed real/fake

| Badge                     | Wired? | Source                                  |
| ------------------------- | ------ | --------------------------------------- |
| "2 Foresporsler" (people) | VERIFY | May be hardcoded or from useActionItems |
| "3" (chat)                | VERIFY | May be hardcoded                        |
| "1 forfalt" (my-training) | VERIFY | May be hardcoded                        |

---

## 3. Missing Database Indexes

### Critical — impacts every dashboard page load

| #   | Index                                  | Table                                          | Used By                | Query Pattern                                                    |
| --- | -------------------------------------- | ---------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| 1   | idx_protocol_assignment_profile_status | protocol_assignment(profile_id, status)        | useTrainingReadiness() | COUNT by profile + status filter. Fires on every dashboard load. |
| 2   | idx_profile_workspace_is_active        | profile(workspace_id, is_active)               | useWorkforcePipeline() | COUNT active staff per workspace. Fires on every dashboard load. |
| 3   | idx_profile_workspace_status_updated   | profile(workspace_id, status, updated_at DESC) | useWorkforcePipeline() | COUNT departures in last 30 days. Full table scan without index. |

### High — impacts action strip badges

| #   | Index                                       | Table                                                                        | Used By          | Query Pattern                                               |
| --- | ------------------------------------------- | ---------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| 4   | idx_onboarding_session_workspace_incomplete | onboarding_session(workspace_id, updated_at DESC) WHERE completed_at IS NULL | useActionItems() | COUNT stuck onboarding sessions. Partial index recommended. |
| 5   | idx_invitation_workspace_status_created     | invitation(workspace_id, status, created_at DESC)                            | useActionItems() | COUNT stale invitations. Composite index needed.            |

### Already adequate

- schedule_shift — has workspace_date + employee_date indexes
- leader_pulse — 3 indexes cover all patterns
- employment_contract — basic coverage sufficient
- workspace_kpi_target — workspace_id indexed via PK relationship

### Migration SQL (ready to apply)

```sql
-- Critical: Dashboard performance indexes
CREATE INDEX CONCURRENTLY idx_protocol_assignment_profile_status
  ON protocol_assignment(profile_id, status);

CREATE INDEX CONCURRENTLY idx_profile_workspace_is_active
  ON profile(workspace_id, is_active);

CREATE INDEX CONCURRENTLY idx_profile_workspace_status_updated
  ON profile(workspace_id, status, updated_at DESC);

-- High: Action strip performance
CREATE INDEX CONCURRENTLY idx_onboarding_session_workspace_incomplete
  ON onboarding_session(workspace_id, updated_at DESC)
  WHERE completed_at IS NULL;

CREATE INDEX CONCURRENTLY idx_invitation_workspace_status_created
  ON invitation(workspace_id, status, created_at DESC);
```

---

## 4. Build Health

### Green

- 97 migrations, sequential, no gaps/duplicates
- No circular dependencies between packages
- 12/15 packages have proper exports (3 are internal-only)
- No @ts-ignore in source code
- Seed data exists (10 users, 1 workspace, 4 departments, 250 shifts)
- All 28 Edge Functions implemented and secured
- Docker setup production-hardened with resource limits

### Amber

- 19 `as any` casts — all fixable by regenerating database.types.ts
- 34 TODOs — 8 are type regen, 4 are API endpoints, rest are future features
- 2 "fix" migrations for onboarding finalization (20260405, 20260408) — suggests the finalization RPC was iterated on. Likely stable now but needs E2E verification.
- 3 packages missing exports field (docs-pipeline, i18n, types) — internal only, not blocking

### Red

- None detected

---

## 5. Active Branches & Worktrees

### Current worktree state

| Worktree                              | Branch                                       | Merged? | Status                                                                     |
| ------------------------------------- | -------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `/home/sxtnl/dev/smartout.ai`         | `development`                                | —       | Main repo. NEVER touch.                                                    |
| `wt-2`                                | `feat/document-mode`                         | YES     | Clean, fully merged. **Can be freed.**                                     |
| `wt-4`                                | `feat/infra-hardening`                       | NO      | **Complete, ready to merge.** 3 commits, all docs done.                    |
| `wt-8`                                | `feat/showroom`                              | NO      | Phase 2 complete, Phase 3 pending. 45 commits + 4 uncommitted files.       |
| `wt-blender`                          | `test/blender`                               | NO      | Staging branch containing both showroom + infra-hardening merged together. |
| superpowers/plan-journey-portal-fixes | `plan/journey-portal-fixes`                  | YES     | Can be cleaned up.                                                         |
| superpowers/production-menu-inventory | `docs/production-menu-inventory-integration` | YES     | Can be cleaned up.                                                         |

### Available worktree slots

- **wt-1, wt-3, wt-5, wt-6, wt-7** — free, available for sprint agents
- **wt-2** — can be freed (branch merged, no uncommitted work)
- **wt-blender** — can be freed after wt-4 and wt-8 are handled independently

### feat/infra-hardening (wt-4) — MERGE BEFORE SPRINT 1

**This branch is production-critical and complete.** It must be merged to `development` as part of Sprint 0, not rebuilt.

What it contains (3 commits, 195 insertions):

| Category                | Changes                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker security**     | `USER node` in stage-engine Dockerfile (non-root), `.dockerignore` at monorepo root, fail-fast `${SUPABASE_URL:?}` in base compose        |
| **Caddy TLS hardening** | HSTS (no preload), X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, Server header removed |
| **Caddy timeouts**      | read_body 10s, read_header 5s, idle 120s. Stage-engine SSE override: flush_interval -1, 300s transport timeout                            |
| **Prod config**         | All service ports bound to 127.0.0.1, n8n pinned to 2.10.4, json-file log rotation (10m x 3)                                              |
| **CI**                  | Docker build matrix in .github/workflows/ci.yml (4 services, fail-fast: false)                                                            |
| **Ops**                 | `infra/scripts/backup-cron.sh` with 7-day rotation                                                                                        |
| **Secrets**             | Removed pre-filled N8N_ENCRYPTION_KEY from .env.example                                                                                   |
| **Documentation**       | WORKLOG, 6 user journeys, 6 ADRs, 5 learnings — all closure gates met                                                                     |

**Impact on plan:** Agent 3.3 (Docker CI/CD) scope is reduced significantly. CI Docker builds are already done. Remaining work is container registry + deploy-to-DigitalOcean automation.

### feat/showroom (wt-8) — NOT V1 BLOCKER, GREAT DEMO TOOL

Portable AI overlay with mission-driven agent runtime. 2365 LOC, 102 tests passing.

| Done (Phase 1+2)                                  | Not done (Phase 3)                     |
| ------------------------------------------------- | -------------------------------------- |
| Event envelope system                             | Voice integration (Ultravox WebSocket) |
| Zustand ephemeral state + JSON Patch              | Client-side tool execution             |
| 5-tool registry with authority filtering          | UI polish to match Smartout design     |
| Micro-proxy API route (Anthropic key server-side) | Show-off demo mission                  |
| ShowroomAgent (Observable + tool routing)         | Duo missions (2 agents)                |
| Mission runtime (3 missions, stage manager)       | Auto-stage-advance                     |
| 3 personas (Botsson + 2 specialists)              | User journey docs (closure gate)       |
| 9 knowledge domains with topic detection          |                                        |
| /showroom standalone page                         |                                        |

**Decision:** Keep wt-8 active. Not in V1 scope. Can be polished post-launch as sales/demo tool. 4 uncommitted files should be committed before any merge.

### test/blender (wt-blender) — STAGING BRANCH

Contains both showroom and infra-hardening merged together. Once wt-4 merges to development independently, this branch loses its purpose. Can be freed after wt-4 merge.

### Worktree cleanup plan (Sprint 0)

```bash
# 1. Merge infra-hardening to development
cd ~/dev/smartout.ai
git merge feat/infra-hardening   # into development

# 2. Free merged worktrees
git worktree remove ~/dev/wt-2
git branch -d feat/document-mode

git worktree remove ~/dev/wt-blender
git branch -D test/blender       # staging branch, no longer needed

# 3. Free superpowers worktrees (already merged)
git worktree remove ~/.config/superpowers/worktrees/smartout.ai/plan-journey-portal-fixes
git branch -d plan/journey-portal-fixes

git worktree remove ~/.config/superpowers/worktrees/smartout.ai/production-menu-inventory
git branch -d docs/production-menu-inventory-integration

# Result: wt-1 through wt-7 free (except wt-4 freed after merge, wt-8 stays for showroom)
```

---

## 6. Real Queries vs Fake Data — Dashboard Hook Inventory

### Hooks that return REAL data (wired to Supabase)

| Hook                  | Tables Queried                                | What It Powers                                                                                      |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| useStaffingCoverage   | schedule_shift                                | Tactical: weekly fill % donut chart                                                                 |
| useTrainingReadiness  | protocol_assignment + profile                 | Tactical: training readiness bar                                                                    |
| useWorkforcePipeline  | profile (4x COUNT)                            | Strategic: workforce pipeline metrics                                                               |
| useKpiTargets         | workspace_kpi_target                          | Strategic: KPI target cards                                                                         |
| useActionItems        | 5 tables (Promise.all)                        | Action strip: shift gaps, pending contracts, stuck onboarding, pending protocols, stale invitations |
| useLeaderPulse        | leader_pulse                                  | Tactical: leader engagement                                                                         |
| useActiveSeason       | season + engine_sessions                      | Season card in strategic view                                                                       |
| useGovernanceOverview | protocol + protocol_assignment                | Governance page                                                                                     |
| useBudget             | workspace_budget                              | Budget settings                                                                                     |
| useScheduleShifts     | schedule_shift                                | Schedule page: all shifts                                                                           |
| useEmployees          | profile                                       | Schedule + people pages                                                                             |
| useAbsences           | schedule_absence                              | Schedule page                                                                                       |
| useDayContent         | schedule_shift + profile + department_session | Day control panel                                                                                   |

### Components that IGNORE real hooks and show hardcoded data

| Component                    | Has Real Hook?                                                           | Shows Instead                  |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------ |
| StrategicView KPI cards      | useKpiTargets exists but cards use defaultMetrics fallback               | 40 hardcoded values            |
| StrategicView turnover chart | No hook                                                                  | 4x6 hardcoded array            |
| TacticalView protocol list   | useTrainingReadiness exists but protocol detail uses DEMO_PROTOCOLS      | 4 demo protocols               |
| GuardianView compliance      | useGovernanceOverview exists but compliance section uses DEMO_COMPLIANCE | 5 demo rows                    |
| ActivityView everything      | No hooks at all                                                          | Random data + hardcoded labels |
| GlobalSearchPalette          | /api/search exists                                                       | Hardcoded arrays               |

Key insight: Several views have the real hooks available but fall back to hardcoded defaults. The wiring work is partially done — the gap is connecting existing hooks to existing UI.

---

## 7. Gap Analysis — What Actually Blocks V1

### Blockers (must fix before launch)

| #   | Gap                            | Effort | Description                                                                                                                                                             |
| --- | ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Password reset not implemented | 1 day  | /reset-password renders a form but has no backend. Users WILL forget passwords.                                                                                         |
| B2  | Onboarding finalization E2E    | 2 days | Two fix migrations (20260405, 20260408) suggest bugs existed. Needs end-to-end verification that signup -> wizard -> finalize -> dashboard works cleanly.               |
| B3  | Invitation flow E2E            | 1 day  | Edge Functions are complete. Needs verification that email/SMS/link -> accept -> profile creation -> dashboard access works.                                            |
| B4  | Fake data decision             | 0 days | StrategicView, ActivityView, TacticalView protocol list, GuardianView compliance all show fake data. Must decide: wire to real data OR hide/disable these views for V1. |
| B5  | Database indexes               | 1 hour | 5 missing indexes impact every dashboard load. Single migration.                                                                                                        |
| B6  | Type regeneration              | 10 min | `npx supabase gen types typescript --local` eliminates 19 `as any` casts.                                                                                               |

### Important (should fix for launch quality)

| #   | Gap                        | Effort   | Description                                                                                                   |
| --- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| I1  | Dashboard empty states     | 3 days   | New workspace sees hardcoded demo metrics, not helpful guidance. Need "Create your first department" CTAs.    |
| I2  | Error boundaries in wizard | 1 day    | No React ErrorBoundary. Finalization errors don't show toast.                                                 |
| I3  | Docker deploy pipeline     | 1-2 days | feat/infra-hardening adds CI builds, but deploy-to-DigitalOcean (registry + push + restart) is still missing. |
| I4  | Fresh migration chain test | 1 day    | 97 migrations never verified running clean on fresh Supabase. Do this before production.                      |
| I5  | GlobalSearchPalette wiring | 1-2 days | /api/search endpoint exists. Connect it to the palette.                                                       |

### V1 Scope Decisions Required

| Decision            | Option A                                        | Option B                                               | Recommendation                                           |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Fake dashboard data | Wire all views to real data (2+ weeks)          | Hide unwired views, ship only real data views (0 days) | Option B — fake data is worse than no data               |
| Billing             | Build Stripe integration (2-3 weeks)            | Launch with DocuSeal contract-only (ready today)       | Option B — add Stripe post-launch                        |
| Employee dashboard  | Build 5 "under construction" pages (2+ weeks)   | Ship admin-only, employee views in V2                  | Option B — admin is the paying user                      |
| Staging environment | Set up Supabase staging branch + Vercel preview | Go straight to production                              | Option A — one staging test saves days of prod debugging |

---

## 8. Revised Dispatch Plan

### Worktree Assignment

After Sprint 0 cleanup, available worktrees:

| Worktree | Sprint 1                     | Sprint 2                  | Sprint 3                 | Sprint 4                  |
| -------- | ---------------------------- | ------------------------- | ------------------------ | ------------------------- |
| **wt-1** | Agent 1.1: Onboarding E2E    | Agent 2.1: Empty States   | Agent 3.1: Security      | Agent 4.1: Prod Deploy    |
| **wt-3** | Agent 1.2: Invitation E2E    | Agent 2.2: Error Handling | Agent 3.2: Performance   | Agent 4.2: Monitoring     |
| **wt-5** | Agent 1.3: Auth + PW Reset   | Agent 2.3: E2E Tests      | Agent 3.3: Docker Deploy | Agent 4.3: Demo Data      |
| **wt-6** | Agent 1.4: Fake Data Cleanup | Agent 2.4: Localization   | Agent 3.4: Staging       | Agent 4.4: Landing Funnel |

wt-4 freed after infra-hardening merge. wt-8 stays reserved for showroom (not V1 scope).

### Sprint 0: Foundation (Day 1)

**Single agent in main repo, sequential, gates everything else.**

| #   | Task                  | Description                                                                                                                    |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0.1 | Merge infra-hardening | `cd ~/dev/smartout.ai && git merge feat/infra-hardening` — brings Docker hardening, Caddy security, CI builds into development |
| 0.2 | Worktree cleanup      | Free wt-2 (merged), wt-blender (staging), 2 superpowers worktrees (merged). See Section 5 for commands.                        |
| 0.3 | Type regeneration     | `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`                                          |
| 0.4 | Build verification    | `pnpm typecheck && pnpm build` — fix any errors                                                                                |
| 0.5 | Database indexes      | Create migration with 5 indexes from Section 3                                                                                 |
| 0.6 | Fresh migration test  | `supabase db reset` on clean local instance — verify all 97 + new index migration run                                          |

**Exit criteria:** infra-hardening merged, worktrees freed, typecheck passes, build succeeds, migrations run clean.

### Sprint 1: Verification (Week 1) — 4 parallel agents

#### Agent 1.1 — Onboarding Wizard E2E

**Worktree:** wt-1 | **Branch:** feat/verify-onboarding-wizard
**Goal:** Verify complete signup -> wizard -> finalize -> dashboard flow.

Tasks:

1. Create new user via /signup
2. Walk through all 8 wizard sections with real data (use a test org.nr)
3. Verify scrape pipeline (gather-workspace-intelligence) returns data
4. Verify finalization RPC creates workspace + season + departments + locations
5. Verify redirect to {slug}.smartout.ai/dashboard (or localhost equivalent)
6. Test resume: refresh browser mid-wizard, verify state restores
7. Document all bugs with reproduction steps

Exit criteria:

- New user completes entire wizard without crashes
- Workspace created with correct data in Supabase
- User lands on dashboard after finalization

#### Agent 1.2 — Invitation Flow E2E

**Worktree:** wt-3 | **Branch:** feat/verify-invitation-flow
**Goal:** Verify invite -> accept -> profile creation -> dashboard.

Tasks:

1. As admin: create email invitation via invite-member-dialog
2. Verify create-invitation Edge Function generates token + sends email
3. Open /invite/[token] in incognito
4. Complete acceptance form (name, password)
5. Verify accept-invitation creates user + profile + team_member
6. Verify new user sees correct workspace with correct role
7. Test duplicate invitation handling
8. Test expired invitation handling (mock 7-day expiry)
9. If Twilio configured: test SMS invitation

Exit criteria:

- Email invitation: complete flow works
- Link invitation: complete flow works
- New user lands in workspace dashboard with correct permissions

#### Agent 1.3 — Auth & Password Reset

**Worktree:** wt-5 | **Branch:** feat/auth-password-reset
**Goal:** Verify all auth flows + implement password reset.

Tasks:

1. Verify email/password login works
2. Verify Google OAuth login works
3. Verify middleware blocks unauthenticated /dashboard access
4. Verify showcase mode (?showcase=1) works
5. Verify godmode/platform-admin protection
6. IMPLEMENT password reset backend:
   - Supabase auth.resetPasswordForEmail()
   - /reset-password page wired to actual reset flow
   - /api/auth/callback handles password reset token
7. Test complete flow: forgot password -> email -> reset -> login

Exit criteria:

- All auth flows verified working
- Password reset fully implemented and tested
- Middleware protects all routes correctly

#### Agent 1.4 — Dashboard Data Audit & Fake Data Cleanup

**Worktree:** wt-6 | **Branch:** feat/dashboard-data-cleanup
**Goal:** Remove or flag all fake data in dashboard. Wire what's easy, hide what's not.

Tasks:

1. StrategicView KPI cards: useKpiTargets hook exists — wire it to replace defaultMetrics. For KPIs without real calculation, show "–" or "Kommer snart" instead of fake numbers.
2. StrategicView turnover chart: hide or show "Ikke nok data" placeholder until real calculation exists.
3. TacticalView protocol list: useTrainingReadiness exists — wire protocol detail from protocol + protocol_assignment tables. Replace DEMO_PROTOCOLS.
4. GuardianView compliance: useGovernanceOverview exists — wire compliance from protocol_assignment. Replace DEMO_COMPLIANCE.
5. ActivityView: hide entire heatmap section behind a feature flag or "Kommer snart" card. Random data is worse than no data.
6. GlobalSearchPalette: /api/search endpoint exists — wire it. Replace hardcoded results.
7. Sidebar badges: verify each badge (people, chat, training) is from real data or hardcoded. Fix any hardcoded ones.
8. Verify which hooks already return real data and just need UI connection vs which need new queries.

Exit criteria:

- Zero fake numbers displayed as if they're real
- Views without real data show honest "not enough data" state
- All wirable hooks are connected to their UI
- List of remaining unwired metrics documented for V2

### Sprint 2: Completeness (Week 2) — 4 parallel agents

#### Agent 2.1 — Dashboard Empty States

**Worktree:** wt-1 | **Branch:** feat/dashboard-empty-states
**Goal:** New workspace gets helpful guidance, not blank pages.

Tasks:

1. Map all dashboard pages and identify what a new workspace sees
2. Implement empty states with CTAs:
   - Organization: "Opprett din forste avdeling" -> /organization
   - People: "Inviter ditt team" -> invite dialog
   - Schedule: "Opprett din forste vaktmal" -> template dialog
   - Season: "Opprett din forste sesong" -> create season
3. Dashboard main: show onboarding progress checklist for new workspaces
   - Has departments? Has locations? Has employees? Has season? Has shifts?
4. Governance: "Ingen protokoller enna" with link to setup

Exit criteria:

- Every dashboard page has meaningful empty state with CTA
- New workspace experience is guiding, not confusing

#### Agent 2.2 — Error Handling & Recovery

**Worktree:** wt-3 | **Branch:** feat/error-handling
**Goal:** Robust error handling across critical flows.

Tasks:

1. Add React ErrorBoundary to wizard sections
2. Add toast notification on finalization success/failure
3. Verify all Edge Functions return proper HTTP status codes + JSON error messages
4. Add error toasts for all CRUD operations (org structure, invitations)
5. Verify wizard resume works after browser crash/refresh

Exit criteria:

- Wizard shows user-friendly error on any failure
- All CRUD operations show success/error toasts
- No silent failures in critical flows

#### Agent 2.3 — E2E Test Suite

**Worktree:** wt-5 | **Branch:** feat/e2e-core-flow
**Goal:** Playwright tests for V1 core flow.

Tasks:

1. Test: Signup -> Wizard -> Dashboard
2. Test: Invite employee -> Accept -> Workspace access
3. Test: Create department -> Location -> Team
4. Test: Password reset flow
5. Test: Auth middleware (unauthenticated redirect)
6. Test: Showcase mode

Exit criteria:

- 6+ E2E tests covering core V1 flow
- Runs via `pnpm test:e2e`
- CI-ready (headless)

#### Agent 2.4 — Norwegian Localization Audit

**Worktree:** wt-6 | **Branch:** feat/localization-audit
**Goal:** All user-facing text in V1 flow is Norwegian.

Tasks:

1. Audit onboarding wizard — all sections
2. Audit dashboard navigation and pages
3. Audit error messages and toasts
4. Audit email templates (SendGrid — invitation, contract)
5. Document any English text that needs translation

Exit criteria:

- All user-facing text in V1 flow is Norwegian
- Email templates are Norwegian
- Remaining English text documented as issues

### Sprint 3: Hardening (Week 3) — 4 parallel agents

#### Agent 3.1 — Security Hardening

**Worktree:** wt-1 | **Branch:** feat/security-hardening
**Goal:** Close security holes before production.

Tasks:

1. Verify service role is NEVER used in client code
2. Verify all .env variables are in 1Password, not in code
3. Test workspace isolation: user in workspace A cannot see workspace B data
4. Verify rate limiting on auth endpoints
5. Check that client_secret files are in .gitignore
6. Run EXPLAIN ANALYZE on critical RLS policies (with new indexes)
7. Verify all Edge Functions with verify_jwt=false have proper alternative auth

Exit criteria:

- RLS isolation verified with cross-workspace test
- No secrets in code
- Rate limiting on auth
- EXPLAIN ANALYZE shows index usage

#### Agent 3.2 — Performance & Loading

**Worktree:** wt-3 | **Branch:** feat/performance
**Goal:** Fast, responsive dashboard with proper loading states.

Tasks:

1. Verify all dashboard pages have loading.tsx (19/20+ confirmed, check gaps)
2. Add skeleton states where missing
3. Lighthouse audit on core flow (onboarding, dashboard, organization)
4. Verify Edge Function cold starts are acceptable (< 3s)
5. Verify new indexes are used (EXPLAIN ANALYZE on dashboard queries)
6. Check Next.js Image optimization for any images

Exit criteria:

- Lighthouse score > 80 on core pages
- All pages have loading states
- New indexes confirmed used by query planner

#### Agent 3.3 — Docker Deploy Pipeline

**Worktree:** wt-5 | **Branch:** feat/docker-deploy
**Goal:** Complete the deploy pipeline. CI builds already exist (from feat/infra-hardening). Add registry + push + deploy.

Note: feat/infra-hardening (merged in Sprint 0) already provides:

- Docker build matrix in CI (.github/workflows/ci.yml)
- Non-root containers, .dockerignore, fail-fast env vars
- Caddy security headers, timeouts, log rotation
- backup-cron.sh with 7-day rotation

Remaining work:

Tasks:

1. Set up container registry (DigitalOcean CR or GitHub CR)
2. Add CI step: build -> push to registry (extend existing ci.yml matrix)
3. Create deploy script: pull from registry -> docker compose up on DigitalOcean
4. Verify Caddy reverse proxy routes to all 5 services
5. Test: deploy all services, verify health checks pass

Exit criteria:

- Container images pushed to registry on CI pass
- Deploy script pulls + restarts on DigitalOcean
- All services accessible via Caddy
- Health checks passing

#### Agent 3.4 — Fresh Migration & Staging

**Worktree:** wt-6 | **Branch:** feat/staging-setup
**Goal:** Verify migrations run clean + set up staging.

Tasks:

1. Create Supabase staging branch or project
2. Run all 97+ migrations from scratch
3. Deploy Edge Functions to staging
4. Run seed.sql
5. Verify V1 flow works against staging
6. Document any migration failures and fix them

Exit criteria:

- All migrations run clean on fresh instance
- Edge Functions deployed to staging
- V1 flow smoke-tested on staging

### Sprint 4: Production (Week 4) — 4 sequential agents

#### Agent 4.1 — Production Deploy

**Worktree:** wt-1 | **Branch:** feat/production-deploy
**Depends on:** Sprint 3 complete

Tasks:

1. Verify Vercel projects for apps/web and apps/landing
2. Configure DNS for \*.smartout.ai (wildcard subdomain)
3. Run all migrations against production Supabase
4. Deploy Edge Functions to production
5. Configure production env variables in Vercel (from 1Password)
6. Deploy Docker services to DigitalOcean
7. Verify Caddy reverse proxy
8. Smoke test: complete V1 flow in production

Exit criteria:

- app.smartout.ai serves dashboard
- smartout.ai serves landing page
- {slug}.smartout.ai routes to correct workspace
- SSL works on all subdomains
- Smoke test passes

#### Agent 4.2 — Monitoring & Alerting

**Worktree:** wt-3 | **Branch:** feat/monitoring
**Depends on:** Agent 4.1

Tasks:

1. Verify Sentry configuration in production
2. Set up uptime monitoring (BetterStack or equivalent)
3. Verify health-check Edge Function
4. Configure Slack channel for alerts
5. Verify PostHog tracks core events
6. Verify watchdog Edge Functions (uptime + integrity)

Exit criteria:

- Production errors generate Sentry alerts
- Uptime monitoring with Slack notification
- PostHog tracking core events

#### Agent 4.3 — Demo Workspace & Seed Data

**Worktree:** wt-5 | **Branch:** feat/demo-workspace
**Depends on:** Agent 4.1

Tasks:

1. Create seed script for demo workspace ("Fjordrestauranten")
2. Seed: 3 departments, 2 locations, 5 positions, 3 teams
3. Seed: 10 demo employees with realistic profiles
4. Seed: Sample policies and protocols
5. Seed: Demo shift schedule for coming week
6. Connect to showcase mode (?showcase=1)

Exit criteria:

- Demo workspace with realistic data
- Showcase mode shows pre-populated workspace
- Seed script idempotent (can re-run without duplicates)

#### Agent 4.4 — Landing Page Funnel

**Worktree:** wt-6 | **Branch:** feat/landing-funnel
**Depends on:** Agent 4.1

Tasks:

1. Verify apps/landing has clear CTA -> signup
2. Verify signup link routes to app.smartout.ai/signup
3. Verify UTM tracking from landing -> onboarding -> dashboard
4. Verify session tracking stores conversion data

Exit criteria:

- Landing -> Signup -> Dashboard works without friction
- UTM parameters tracked
- Conversion data stored

---

## 9. Dependency Diagram

```
Sprint 0 (Day 1 — Main repo, sequential, gates everything)
  ├── 0.1 Merge feat/infra-hardening into development
  ├── 0.2 Free worktrees: wt-2, wt-blender, 2 superpowers
  ├── 0.3 Type regeneration (database.types.ts)
  ├── 0.4 Build verification (typecheck + build)
  ├── 0.5 Database indexes migration
  └── 0.6 Fresh migration test (supabase db reset)

Sprint 1 (Week 1 — 4 parallel agents)
  ├── wt-1  Agent 1.1: Onboarding Wizard E2E
  ├── wt-3  Agent 1.2: Invitation Flow E2E
  ├── wt-5  Agent 1.3: Auth + Password Reset
  └── wt-6  Agent 1.4: Dashboard Fake Data Cleanup

Sprint 2 (Week 2 — 4 parallel agents, reuse worktrees)
  ├── wt-1  Agent 2.1: Empty States
  ├── wt-3  Agent 2.2: Error Handling
  ├── wt-5  Agent 2.3: E2E Tests             <-- depends on Sprint 1 fixes
  └── wt-6  Agent 2.4: Localization Audit

Sprint 3 (Week 3 — 4 parallel agents)
  ├── wt-1  Agent 3.1: Security Hardening
  ├── wt-3  Agent 3.2: Performance
  ├── wt-5  Agent 3.3: Docker Deploy Pipeline  <-- builds on infra-hardening CI
  └── wt-6  Agent 3.4: Staging Setup           <-- depends on Agent 3.3

Sprint 4 (Week 4 — Sequential)
  ├── wt-1  Agent 4.1: Production Deploy       <-- depends on Sprint 3
  ├── wt-3  Agent 4.2: Monitoring              <-- depends on 4.1
  ├── wt-5  Agent 4.3: Demo Workspace          <-- depends on 4.1
  └── wt-6  Agent 4.4: Landing Funnel          <-- depends on 4.1

Reserved:
  └── wt-8  feat/showroom (Phase 3 — post-V1, sales/demo tool)
```

---

## 10. Risk Assessment

| Risk                                                                      | Probability | Impact           | Mitigation                                                                    |
| ------------------------------------------------------------------------- | ----------- | ---------------- | ----------------------------------------------------------------------------- |
| Onboarding finalization has hidden bugs (2 fix migrations exist)          | Medium      | 3-5 day delay    | Agent 1.1 verifies early in Sprint 1                                          |
| 97 migrations fail on clean DB                                            | Medium      | 2-3 day delay    | Sprint 0 tests this before anything else                                      |
| Docker deploy pipeline incomplete (CI builds done, registry+push missing) | Medium      | 1-2 day delay    | feat/infra-hardening adds CI builds. Agent 3.3 adds registry + deploy script. |
| Wiring fake data to real hooks takes longer than expected                 | Medium      | 2-4 day delay    | Agent 1.4 only wires what's easy, hides the rest                              |
| DNS/subdomain wildcard setup complications                                | Low         | 1-2 day delay    | Start in Sprint 3 parallel with staging                                       |
| DocuSeal contract signing not stable                                      | Medium      | Not a V1 blocker | Contract signing is nice-to-have; workspace can activate without it           |

---

## 11. Scope Summary

### V1 ships with (real, verified)

- Signup + onboarding wizard (8 sections, voice agent, business enrichment)
- Password reset (new — Agent 1.3 builds it)
- Invitation system (email, SMS, link)
- Full org structure CRUD (6 entities)
- Schedule builder (daily, monthly, templates, batch, publish)
- Dashboard with REAL metrics only (staffing coverage, training readiness, workforce pipeline, action strip, KPI targets, governance)
- Views without real data: honest "not enough data" state
- Communication (chat, broadcast, notifications)
- AI layer (Botsson, Guardian, voice)
- Platform admin
- Norwegian localization verified

### V1 defers (acknowledged, not fake)

- Stripe billing (launch with contract-only)
- Employee dashboard pages (my-schedule, my-training, my-cv, my-salary)
- Activity heatmap (needs engine_event data accumulation)
- Turnover trend chart (needs historical data accumulation)
- Showroom Phase 3 (wt-8 — voice, tool execution, UI polish, demo missions. Great sales tool post-launch.)
- Punch clock (needs mobile app)
- HACCP runtime
- Payroll motor
- Gamification/Season runtime
- Mobile app

### Key principle

**No fake data in production.** If a metric can't be calculated from real data, show "Ikke nok data enna" — never show hardcoded numbers. Users discovering fake metrics destroys trust instantly.
