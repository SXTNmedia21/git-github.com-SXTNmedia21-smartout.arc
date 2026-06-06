---
title: Agent Knowledge Map — where the knowledge lives
status: in_progress
updated: 2026-06-06
created: 2026-06-06
module: meta
tags: [onboarding, roadmap, knowledge, handoff]
repo_root: /home/sxtnl/archon-projects/smartout.ai
assumes_worktree: authoring (paths verified in this worktree only)
note: |
  If you operate from a different worktree root, substitute the matching prefix.
  All §1, §2, §5 paths are <repo_root>-relative under the hood.
---

# Agent Knowledge Map

> For an incoming agent switching into this repo. Read order, gold nuggets, what to skip,
> and a full definition of every available skill. All paths absolute from repo root
> `/home/sxtnl/archon-projects/smartout.ai`.

> **Freshness:** counts (ADRs, domains, modules) reflect `development` at 2026-06-06 and will drift. Always cross-check `docs/INDEX.md` for live numbers.
> **Trust:** this map is a *finder*, not a *believer*. Code + DB schema still win every conflict (see CLAUDE.md precedence).

**Precedence (CLAUDE.md law):** Code + DB schema win ALWAYS. Then CLAUDE.md → decisions/ → reference/ → domains/ → engines/modules/architecture/cross-cutting. If a doc contradicts code, code wins, patch the doc.

---

## 1. Read first (in order)

| # | Full path | What |
|---|-----------|------|
| 1 | `/home/sxtnl/archon-projects/smartout.ai/docs/ORIENTATION.md` | North Star cheat sheet (from ADR-0075). Always first. |
| 2 | `/home/sxtnl/archon-projects/smartout.ai/CLAUDE.md` | Ground truth: conventions, traps, "What NOT To Do", data model, task ontology. |
| 3 | `/home/sxtnl/archon-projects/smartout.ai/docs/STATE-SUMMARY.md` | Current priorities + active gaps. Lightweight. |
| 4 | `/home/sxtnl/archon-projects/smartout.ai/docs/INDEX.md` | Master map of all docs. |

---

## 2. Gold nuggets 🏆

| Full path | What | Why gold |
|-----------|------|----------|
| `/home/sxtnl/archon-projects/smartout.ai/docs/decisions/` | **424 ADRs**. Index: `docs/decisions/0000-decision-log.md` | The *why* behind every choice. Check before changing same area. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/domains/` | **20 domains**, 8-file spine each. Index: each `_DASHBOARD.md` | Compiled truth (ADR-0392). `mirror:` column = `verified`/`aspirational`/`mixed` — tells what to trust. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/reference/DATABASE.md` | Schema reference | public (169 tables), payroll (23), websites (13), timesheet (1). |
| `/home/sxtnl/archon-projects/smartout.ai/docs/reference/ROUTES.md` | All routes | Web + API surface. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/reference/PACKAGES.md` | Package exports | Monorepo package map. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/reference/ENV_VARS.md` | Env var registry | All `op://` secrets + config. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/reference/` (API_*.md, openapi.*.yaml) | Full API contracts | Data dictionary, endpoints, OpenAPI specs (public/partner/internal/v1). |
| `/home/sxtnl/archon-projects/smartout.ai/docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` | Cascade Core spec | Canonical: I1 + 6D + 4C + K1a/K1b. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/modules/` | 23 module docs | Business logic. Wins for business logic. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/engines/` | Event Motor packaging | Industry, niche, role-capability, environment, handbook. |

### Domains list (`/home/sxtnl/archon-projects/smartout.ai/docs/domains/<name>/`)
`agent-harness` · `announcements` · `billing` · `bootstrap` · `botsson` · `communication` · `contracts` · `core-structure` · `day-session` · `lovsen` · `notifications` · `onboarding-wizard` · `payroll` · `procedure-engine` · `reports` · `scheduling` · `scrapling` · `shift-clock` · `training` · `year-wheel`

---

## 3. Skip ⏭️

| Path | Why skip |
|------|----------|
| `/home/sxtnl/archon-projects/smartout.ai/docs/archive/` | Superseded. Never load. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/STATE.md` (82KB) | Use STATE-SUMMARY instead; semantic-search for detail. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/needs-rewrite/` | Known-stale, awaiting rewrite. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/audits/` (old runs) | Only latest synthesis relevant. |
| `/home/sxtnl/archon-projects/smartout.ai/docs/reference/archive/` | Superseded reference. |
| claude-mem auto-injected observation-ID list | Index, not context. Only `smart_search` on concrete question. |

---

## 4. Skills — the packed knowledge

Skills auto-trigger on keywords and pack domain knowledge tighter than raw docs. **Prefer loading the relevant skill over reading raw docs.** Definitions below.

### Domain knowledge (AUTHORITATIVE — load before touching that area)

| Skill | Load before | Defines |
|-------|-------------|---------|
| `smartout-cascade-developer` | Any schedule/shift/season/year-wheel/framework/tariff/cascade work | Cascade Core Model (I1 + 6D + 4C + K1a/K1b). "Confident != Authorized". |
| `smartout-database-guide` | Any SQL/migration/schema/enum/RLS/Supabase/type-regen | DB rules. Trap: table is `user_identity` NOT `user`; 72 enums — check `database.types.ts` first. |
| `payroll-engine-developer` | Any payroll/lønn/calc-engine/tariff/feriepenger/A-melding/period-lock | 3-layer payroll (Input/Regelmotor/Output), 4 principles (versjonering/idempotens/audit-trail/golden-cases). |
| `smartout-nordic-split` | Any UI/styling/component/theme/farge/design | "Nordic Split" design system. OKLCH warm hue 40-60, CSS vars, no hardcoded colors. |
| `smartout-edge-function-guide` | Any Edge Function / new API endpoint | Dual-auth (JWT + API key), scope guards, workspace-api gateway, config.toml. |
| `secrets-protocol` | Any secret/credential/env-var/auth work | THE LAW for credentials. Two-vault (`smartout_ai` dev + `smartout_ai_prod`). Secrets never enter AI context. |
| `smartout-agent-dev` | Building/modifying Smartout AI agents, capabilities, tools, router | SmartoutTool, intent classification, authority config, Stage Engine agent mode. |
| `smartout-design-port` | Porting design into the app | Design-to-code workflow. |
| `smartout-page-polish` | Productionizing a dashboard page | 8-phase polish: speed-test, telemetry, page-instructions, harness-tool descriptions, site-map. |

### Process / workflow

| Skill | Use when |
|-------|----------|
| `deploying` | Merge to main, deploy Vercel/DigitalOcean, run migrations on Cloud, CI fails. Runbook + ADR-0265. |
| `adr-contract-audit` | Periodic compliance check / pre-merge gate. `/audit` (full), `/audit smoke`, `/audit pr`. |
| `git-cleanup` | Worktrees/branches sprawl, before promote-preview, DASHBOARD drift. Maps landscape, queues clean merges. |
| `run-council` (`sxtn:run-council`) | Spec/plan/bug/arch decision needs multi-perspective review before implementation. |
| `dual-perspective-verification` | Feature with two roles (admin+employee etc). Before "done". |
| `post-merge-verify` / `local-ci-before-pr` / `preflight` | Pre-merge & pre-dispatch verification gates. |
| `prod-ready` | Production-readiness check. |
| `domain-steward` (`sxtn:domain-steward`) | Define/reconcile/close a `docs/domains/<name>/` folder against code. |
| `worktree` / `superpowers:using-git-worktrees` | Worktree discipline. |
| `journey-protocol` / `register-events` | Journey docs + telemetry event registration. |

### SDSM state machine (`sxtn:*`)

The SDSM (Smartout Development State Machine) drives features S0→S9. Key skills:
- `sxtn:sxtn-dispatch` `sxtn:sxtn-gate` `sxtn:sxtn-state` — orchestration core.
- `sxtn:sxtn-adr` `sxtn:sxtn-adr-author` — ADR authoring.
- `sxtn:sxtn-audit` `sxtn:sxtn-verify` `sxtn:sxtn-evidence` `sxtn:sxtn-truth-audit` — verification.
- `sxtn:sxtn-e2e` `sxtn:sxtn-journeys` — testing + journeys.
- `sxtn:sxtn-db-control` `sxtn:sxtn-db-verify` `sxtn:sxtn-migration` `sxtn:sxtn-supabase-*` — DB ops.
- `sxtn:sxtn-design-ingest` `sxtn:sxtn-design-decompose` `sxtn:sxtn-design-intake` `sxtn:sxtn-component-indexer` — design port.
- `sxtn:init-council` `sxtn:retro-council` `sxtn:sxtn-lesson-capture` `sxtn:sxtn-promote-lesson` — council + learnings.

### Superpowers (process discipline)

- `superpowers:brainstorming` — BEFORE any creative/feature work. Explores intent before code.
- `superpowers:test-driven-development` — before writing implementation code.
- `superpowers:systematic-debugging` — any bug/test-failure, before proposing fixes.
- `superpowers:writing-plans` / `superpowers:executing-plans` — multi-step task plans.
- `superpowers:dispatching-parallel-agents` / `superpowers:subagent-driven-development` — 2+ independent tasks.
- `superpowers:verification-before-completion` — before claiming done. Evidence before assertions.
- `superpowers:requesting-code-review` / `receiving-code-review` / `finishing-a-development-branch`.

### Knowledge systems

- `claude-mem:mem-search` — cross-session memory ("did we solve this before?").
- `claude-mem:smart-explore` — token-optimized AST code search (instead of reading full files).
- `karpathy-llm-wiki` / `heartbeat` / `research-log` — Second Brain vault ops.
- `tool-index` — maps intent → correct MCP tool (prevents GitHub/Linear confusion).
- `linear-protocol` — THE LAW for Linear (issues, tickets, `SMA-<id>`).

### Business / comms

- `board-copilot` — board governance, styremøter, GF, aksjonær.
- `email-writer` — outbound emails (draft only, never send).
- `finance-copilot` / `bubble-salary-mcp` — finance + Bubble.io data validation.

### Campaign (frontend-refactor)

- `campaign-boot` `commit-steward` `component-worklist` `import-domain-spec` `sync-campaign` `start-campaign`.

---

## 5. Code, not docs (when in doubt)

| Need | Path |
|------|------|
| Web dashboard | `/home/sxtnl/archon-projects/smartout.ai/apps/web/` (port 3060) |
| Mobile | `/home/sxtnl/archon-projects/smartout.ai/apps/mobile/` |
| Landing | `/home/sxtnl/archon-projects/smartout.ai/apps/landing/` (port 3055) |
| AI / agents / capabilities | `/home/sxtnl/archon-projects/smartout.ai/packages/ai/` |
| DB types (generated, never edit) | `/home/sxtnl/archon-projects/smartout.ai/packages/supabase/src/database.types.ts` |
| Migrations | `/home/sxtnl/archon-projects/smartout.ai/supabase/migrations/` |
| Edge Functions (31) | `/home/sxtnl/archon-projects/smartout.ai/supabase/functions/` |
| Telemetry registry (event source of truth) | `/home/sxtnl/archon-projects/smartout.ai/packages/telemetry/src/registry.ts` |
| Services | `/home/sxtnl/archon-projects/smartout.ai/services/` (stage-engine 5010, shift-mcp 5011, contract 5012, scrapling 8000) |

**Code wins. Always.**
