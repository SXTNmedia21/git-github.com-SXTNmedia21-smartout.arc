---
title: SANDBOX-MAP — full kartlegging of the fasit
status: done
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [sandbox, fasit, kartlegging, campaign-home, reuse]
---

# SANDBOX-MAP — what the fasit actually holds

> Root: `/home/sxtnl/plugins/smartout-sxtn-sandbox` (branch `development`).
> Mapped 2026-06-02 by 3 parallel Explore agents. This is the evidence base for the **campaign-home**
> decision and the reuse plan. The sandbox = prior campaign's REAL output = "the fasit".

## One-line verdict
The sandbox holds **all load-bearing execution machinery** (reuse-map · coverage gates · 2 GREEN ported
pages · per-domain telemetry maps with 144 pre-identified events). master-refactor holds **docs only.**
→ **Sandbox = execution home** is the evidence-backed call.

---

## 1. The two ported pages (the proven motion) — GREEN confirmed

| Page | Component | Adapter | Page.tsx | Data | Telemetry |
|---|---|---|---|---|---|
| `oversikt-v2` | OversiktCockpit.tsx **996 L** (1:1 design, no bloat) | to-design-shape.ts **360 L** (real domain mapping) | 313 L server, parallel fetch | `schedule_shift` · `time_entry` · `deviation` · `session_task` · `workspace_budget` · `profile` (all workspace_id-filtered, ADR-0151) | ≥11 `emit()` on mutations |
| `min-dag-v2` | MinDagView.tsx **824 L** | to-design-shape.ts **40 L** (thin) | 71 L server | `schedule_shift` + `fn_list_my_tasks` RPC (SECURITY DEFINER, cookie client) | equivalent |

**Copy-not-rewrite CONFIRMED** — only the 6 allowed plumbing edits (IIFE→`"use client"`, React imports,
Ic shim, sonner toast, injected props, emit calls). Zero markup mutation. Real Supabase rows, no mocks.
Both are greenfield `-v2` (no original `/oversikt` or `/min-dag` to break).

## 2. App surface
- **~35 dashboard routes** exist; only the **2 above are `-v2`**. Rest are original (people, settings, schedule, contracts, hms, payroll, …).
- **Shell:** `apps/web/src/components/dashboard/DashboardShell.tsx` + `sidebar-config.ts` (ADMIN/EMPLOYEE/DEMO groups). v2 routes not yet in sidebar — URL-accessible. Route→mission map present (`/dashboard`→mr-botsson etc).
- **Design tokens:** `packages/design-tokens` (tokens.css/.ts, workspace-accent, native mirror) wired into `globals.css` (ADR-0366 discipline enforced). ✅
- **Mobile:** `apps/mobile` = skeleton (channels feature only), **unported** — expected per ADR-0133 ("web composes, mobile executes").

## 3. Backend reuse-map (`reports/backend-reuse-map.json`, 555 KB)
- **316 entities** — all `tier: REUSE`, `confidence: confirmed`. Rich shape per entity: `columns[{name,type,nullable,default}]` · `relationships[{column,references,cardinality}]` · `rls{enabled,policy_summary}`.
- **66 routes** · **185 enums**. Source = migrations + database.types.ts + route globs (no live introspection).
- Production-grade, ready for `toDesignShape` adapter wiring. master-refactor has **nothing equivalent.**

## 4. Coverage system (`.sxtn-staging/telemetry-map/`) — the done-oracle
- **DRIVE-TO-100.md** = iteration loop spec ("never stops until all domains gate==PASS && blockers==[]").
- **10 per-domain `control.json`** gates + `AGGREGATE-control.json`. Mechanical, can't-fake-done.
- **State: 5 GREEN / 5 FAIL**
  - GREEN: `hms` · `lonn` · `min-dag` · `oppgaver` · `oversikt`
  - FAIL: `ansatte` (20 ev/24 hooks/6 blk) · `vaktplan` (32 ev — highest gap) · `planlegging` (25 ev, ungated write) · `kommunikasjon` (mock-only helpdesk) · `avstemming` (0-row seed)
- **144 missing events (F0.1)** already enumerated — reconcile to `packages/telemetry/src/registry.ts` is one mechanical pre-build task.
- Control fields per domain: elements_mapped · mutations · events_required/in_registry/missing · hooks_found/missing · 5 control_points booleans · gate · blockers. HTML dashboards render from these.

## 5. Knowledge spine
- **Domains:** 12 REAL (design + spec: ansatte, avstemming, handbook, hms, kommunikasjon, lonn, min, oppgaver, oversikt, planlegging, rapporter, vaktplan) / **20 stub** scaffolds (8-file spine, no content — block on backend discovery).
- **425 ADRs** (latest 0430; **ADR-0047 pending** = the fork-decision gate to PLANLEGG).
- **110 handoffs** · **155 design specs** (`docs/superpowers/specs/`, durable snapshot — survives ingest) · learning-log · ORIENTATION + STATE-SUMMARY + DASHBOARD.
- `.sxtn/`: config.yaml ✓ · feature-index.yaml (4592 L, 1010+ components) · council.yaml (manual) · trigger-registry.json (10k L) · locks/ · heartbeat armed. **campaigns/ EMPTY** (no active stream staged).

---

## Implications for the campaign

1. **Campaign-home = sandbox.** It has the reuse-map, coverage gates, 2 green pages, 144-event backlog. Rebuilding these in master-refactor = wasteful. Pull master-refactor's docs (CONTEXT/HANDOFF/ORIENTATION/dossier/lessons) **into** the sandbox.
2. **Golden-path candidate already exists** — oversikt-v2 / min-dag-v2 prove the motion; pick the next GREEN-domain page to extend it.
3. **Fan-out order = the 5 GREEN domains first** (hms, lonn, oppgaver, + the 2 done). **Gap-track = the 5 FAIL domains** (backend gaps, DB-wall gated — close backend first).
4. **Pre-build mechanical task:** reconcile the 144 F0.1 events into `packages/telemetry/src/registry.ts`.

## Caveats / risks
- **5/10 domains FAIL** on real backend gaps (ungated writes, 0-row seeds, mock-only surfaces) — outside pure page-porting; DB-wall gated.
- **design-export/ is transient** — confirm canonical design source (rule 11) before porting.
- **council.yaml hand-curated** — reconcile roster before reactivating council.
- The 2 green pages **predate the control.json gate** — their readiness isn't mechanized yet.
