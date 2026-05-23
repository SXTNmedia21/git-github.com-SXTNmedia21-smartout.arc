---
title: "Year Wheel — Domain Index"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, planning, D4, D5, source-of-truth]
---

# Year Wheel — Source of Truth

> Authoritative folder for the **year-wheel** domain. If code contradicts this folder → **CODE wins**, update these docs.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Year Wheel canvas (`apps/web/src/app/dashboard/year-wheel/`) | ✅ | 🟡 | Linear timeline + draw-to-create + sidebar + companion rail |
| Season detail page (`apps/web/src/app/dashboard/season/[seasonId]/`) | ✅ | 🟡 | Budget/day/hour/hours/goals/procedures/overview tabs |
| Season capability (`packages/ai/src/capabilities/season/`) | ✅ | 🔴 | 5 tools (create, set_revenue, save_playbook, get_readiness, learn_factors) |
| Year-wheel Botsson tools (`_tools/use-year-wheel-tools.ts`) | ✅ | 🟡 | 7 tools (5 read + 2 write proposals) |
| Season Botsson tools (`season/[seasonId]/_tools/use-season-tools.ts`) | ✅ | 🟡 | 6 tools (4 read + 2 write proposals) |
| Season package (`packages/year-wheel/`) | ✅ | 🟡 | Types, hooks, query-keys, season-planning helpers |
| Season tables (`season`, `season_budget`, `day_factor`, `hour_factor`) | ✅ | 🟡 | Base schema + RLS in place |
| Season goal + policy binding tables | ✅ | 🟡 | `season_goal`, `season_policy_binding` |
| `activate_season` RPC | ✅ | 🟡 | Atomic archive-current + activate-target + D1 fanout trigger |
| D1 fanout trigger (department_operating_hours seed) | ✅ | 🟡 | `trg_season_activated` fires inside RPC transaction |
| Authority seeds (3: activate, agent, archive_dup) | ✅ | — | C4 engine_authority_config rows per workspace |
| Season lifecycle mission | ✅ | — | `20260319120400_seed_season_lifecycle_mission.sql` |
| SeasonGoalsTab + SeasonProceduresTab | 🟡 | 🔴 | In `_deferred/` — out of active path |
| Drag-to-resize season blocks (spec §4.1) | 🔴 | 🔴 | Planned (CAMPAIGN M2 / redesign P1 defer) |
| "Copy last year" duplication flow | 🟡 | 🔴 | `duplicate-season-action.ts` exists; no UI button wired |
| Voice bridge for mutation tools (M5 spec) | 🔴 | 🔴 | Deferred per ADR-0201 §D5 |
| E2E coverage (Playwright) | 🟡 | 🟡 | 3 spec files; goals/procedures paths deferred |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | Tables, FKs, enums, RLS, RPCs, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | verified | Flow index → journeys |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan + ADR/campaign refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Test = proof of built |

## Agent Guardrails

> Read before touching year-wheel or season code. Truth lives in this folder.

- **NEVER move `planning_cycle` into this domain.** `planning_cycle` is D1 structural envelope, owned by `core-structure`. Year-wheel READS it; it does not own it. Any FK or RLS change on `planning_cycle` goes through core-structure.
- **NEVER build a scheduling engine here.** The year-wheel surface is D4/D5 authoring (budget, factors, season lifecycle). D6 production (shift sessions, hooks, daily ops) is owned by `day-session` and consumes year-wheel as upstream. Do not blur the boundary.
- **NEVER bypass the `activate_season` RPC with direct `UPDATE season SET status='active'`.** The RPC is a SECURITY DEFINER function that archives the current active season and seeds D1 operating-hours atomically. Direct updates break the invariant of "exactly one active season per workspace" (ADR-0085 + ADR-0200).
- **NEVER activate a season without all three D4 gates cleared:** `season_budget.total_target_revenue > 0`, `day_factor` rows present, `hour_factor` rows present. The `activateSeasonAction` server action enforces these; so does the `proposeActivateSeason` Botsson tool.
- **NEVER register a new tool named `proposeActivateSeason` or `proposeArchiveSeason` in any other surface without first resolving the known collision in `scripts/known-tool-name-collisions.json`.** Both names exist on both the year-wheel page AND the season detail page (L-0258; logged as Deviation in GAPS-AND-DEBT.md).
- **NEVER write season capability tools claiming ADR compliance in the docstring before the body satisfies it.** L-0176: write body first, verify, then docstring.
- **NEVER derive `workspace_id` from body-supplied rows without fail-fast on row-not-found.** ADR-0151 forgery defense. The `activate_season` RPC already enforces this via auth.uid() resolution before any SELECT/UPDATE.
- **NEVER move `season_policy_binding` to the procedure-engine domain.** The table is authored on the season detail page (Procedures tab) and owned by year-wheel. The procedure-engine READS it; it does not own the binding. Clear author/consumer boundary.
- **ALWAYS emit telemetry on season mutations.** The `season.*` namespace (25 events registered in `packages/telemetry/src/registry.ts:1710–1954`) is the audit trail for D4/D5 changes. No emit = silent mutation.
- Owning surfaces: `apps/web/src/app/dashboard/year-wheel/` · `apps/web/src/app/dashboard/season/[seasonId]/` · `packages/year-wheel/` · `packages/ai/src/capabilities/season/` · `packages/ai/src/tools/season/` · Core tables: `public.season`, `public.season_budget`, `public.day_factor`, `public.hour_factor`, `public.season_goal`, `public.season_policy_binding` · RPCs: `activate_season(p_workspace_id, p_season_id)` · Edge Functions: none (season has no dedicated EF; uses shared workspace-api gateway)
