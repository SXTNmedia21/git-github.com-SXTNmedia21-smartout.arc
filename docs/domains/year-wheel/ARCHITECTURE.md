---
title: "Year Wheel — Architecture"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: year-wheel
tags: [domain, year-wheel, season, architecture, code-map, D4, D5]
---

# Year Wheel — Architecture

> L1–L5 code map. **Code wins.** Every component cited with a grep-able anchor + line ±hint. Re-verified vs code 2026-05-23.

## Layer model

```
┌──────────────────────────────────────────────────────────────────┐
│  L1  SURFACE — user touches                                      │
│       /dashboard/year-wheel  (canvas + sidebar + companion)      │
│       /dashboard/season/[id] (budget/factors/hours/goals/procs)  │
│       apps/web/src/app/dashboard/year-wheel/                     │
│       apps/web/src/app/dashboard/season/                         │
└──────────────────────────────────────────────────────────────────┘
                    │ Server Actions (Next.js)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L2  SERVER ACTIONS — no dedicated BFF API route                 │
│       apps/web/src/app/dashboard/_actions/                       │
│       activate-season-action.ts   (L2 anchor)                    │
│       archive-season-action.ts    (L2 anchor)                    │
│       duplicate-season-action.ts  (L2 anchor)                    │
└──────────────────────────────────────────────────────────────────┘
                    │ Supabase client / RPC call
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L3  CAPABILITY — AI agent surface                               │
│       packages/ai/src/capabilities/season/index.ts  (L3 anchor) │
│       5 tools: create, set_revenue, save_playbook,               │
│                get_readiness, learn_factors                       │
│       packages/ai/src/tools/season/*.ts             (L3 anchor) │
│       Botsson page-tools:                                        │
│         _tools/use-year-wheel-tools.ts  — 7 tools               │
│         season/[id]/_tools/use-season-tools.ts — 6 tools        │
└──────────────────────────────────────────────────────────────────┘
                    │ Supabase Postgres + RPC
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L4  DATA — season tables + RPCs                                 │
│       public.season            (base record — D4/D5)             │
│       public.season_budget     (D4 revenue envelope)             │
│       public.day_factor        (D4 demand distribution)          │
│       public.hour_factor       (D4 demand distribution)          │
│       public.season_goal       (D5 KPI targets)                  │
│       public.season_policy_binding  (D5 policy activation)       │
│       activate_season(uuid,uuid) → JSONB  (L4 RPC)              │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  L5  LIFECYCLE — activation + D1 fanout                          │
│       trg_season_activated trigger                               │
│       → seeds department_operating_hours (D1 fanout)            │
│       activate_season RPC wraps archive + activate atomically    │
│       season_activate authority seed (C4 gate)                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## L1 — Surface

### Year Wheel page

| File | Role |
|---|---|
| `apps/web/src/app/dashboard/year-wheel/page.tsx` | Server shell — fetches seasons + planning events via Supabase, renders `YearWheelPageClient` |
| `apps/web/src/app/dashboard/year-wheel/year-wheel-page-client.tsx` | Client island — state management, Botsson tool wiring, canvas + sidebar layout |
| `apps/web/src/app/dashboard/year-wheel/_components/canvas/YearCanvas.tsx` | Draw-to-create canvas, TimelineBlocks, DrawPhantom |
| `apps/web/src/app/dashboard/year-wheel/_components/canvas/TimelineBlock.tsx` | Season block — status-aware (draft/active/archived) |
| `apps/web/src/app/dashboard/year-wheel/_components/canvas/TimelinePin.tsx` | Planning event pin — 12px dot or 10px bar |
| `apps/web/src/app/dashboard/year-wheel/_components/canvas/DrawPhantom.tsx` | Live phantom during drag-to-create |
| `apps/web/src/app/dashboard/year-wheel/_components/canvas/NormalDriftWatermark.tsx` | Hatch + italic heading when no season covers a period |
| `apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.ts` | Pure function: pack overlapping seasons into stacked lanes |
| `apps/web/src/app/dashboard/year-wheel/_components/shell/YearWheelTopbar.tsx` | Year navigation (prev/next arrows, ?year= URL param) |
| `apps/web/src/app/dashboard/year-wheel/_components/shell/SeasonSidebar.tsx` | Season list + filter pills (all/active/draft/archived) |
| `apps/web/src/app/dashboard/year-wheel/_components/shell/CompanionRail.tsx` | AI suggestion card rail |
| `apps/web/src/app/dashboard/year-wheel/_components/shell/AiSuggestionCard.tsx` | Empty-state AI suggestion card |
| `apps/web/src/app/dashboard/year-wheel/_components/shell/LegendChip.tsx` | Legend chip for timeline |
| `apps/web/src/app/dashboard/year-wheel/_components/SeasonQuickCreateSheet.tsx` | Right-side shadcn Sheet triggered by draw-complete |
| `apps/web/src/app/dashboard/year-wheel/_components/SeasonActivationProposalModal.tsx` | Confirmation modal before Botsson proposeActivateSeason |

### Season detail page

| File | Role |
|---|---|
| `apps/web/src/app/dashboard/season/[seasonId]/page.tsx` | Server shell — fetches single season |
| `apps/web/src/app/dashboard/season/[seasonId]/season-page-client.tsx` | Client island — tab state, Botsson tool wiring |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonSubmenu.tsx` | Tab navigation (budget, day, hour, hours, goals, procedures, overview) |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/BudgetSetupTab.tsx` | D4 revenue targets + labor model |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/DayFactorsTab.tsx` | D4 day-of-week demand weights |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/HourFactorsTab.tsx` | D4 hourly demand weights |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonHoursTab.tsx` | Per-department operating hours override |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonOverviewTab.tsx` | Season metadata + readiness summary |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/_deferred/SeasonGoalsTab.tsx` | Deferred — Season KPI goals (not in active path) |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/_deferred/SeasonProceduresTab.tsx` | Deferred — Season policy bindings UI (not in active path) |

### Shared package

| Export | File | Role |
|---|---|---|
| `@smartout/year-wheel` | `packages/year-wheel/src/index.ts` | Types, query-keys, season-planning helpers, factor templates |
| `@smartout/year-wheel/hooks` | `packages/year-wheel/src/hooks/index.ts` | TanStack Query hooks: `useSeasons`, `useSeasonBudget`, `useDayFactors`, `useHourFactors`, `usePlanningCycles`, `usePlanningEvents`, `useSeasonGoals`, `useSeasonPolicyBindings`, `useSeasonsSeededState`, `useSeasonOperatingHours`, `useSeasonActivationPreview` |

---

## L2 — Server Actions (no dedicated BFF route)

Year-wheel uses **Next.js Server Actions** directly — no `/api/seasons` REST route exists.

| Action | File | What it does |
|---|---|---|
| `activateSeasonAction` | `apps/web/src/app/dashboard/_actions/activate-season-action.ts` | Calls `activate_season(workspaceId, seasonId)` RPC. Validates C4 authority. Returns `{ ok, season_id, departments_affected, rows_generated }` or error |
| `archiveSeasonAction` | `apps/web/src/app/dashboard/_actions/archive-season-action.ts` | Direct UPDATE `season.status = 'archived'` with workspace RLS guard |
| `duplicateSeasonAction` | `apps/web/src/app/dashboard/_actions/duplicate-season-action.ts` | Clones season record + related budget/factors with date-shifted option |

Test: `apps/web/src/app/dashboard/_actions/__tests__/activate-season-action.test.ts`

---

## L3 — Capability (AI agent surface)

### Season capability

File: `packages/ai/src/capabilities/season/index.ts` (line 65 — `seasonCapability`)

| Tool | Name | Type | Channel | Notes |
|---|---|---|---|---|
| `createSeason` | `season.create` | suggest | chat + system | Creates season + budget + default factors |
| `setRevenue` | `season.set_revenue` | suggest | chat + system | Updates season_budget target_revenue + labor% |
| `savePlaybook` | `season.save_playbook` | suggest | chat + system | Appends notes to season.description |
| `getReadiness` | `season.get_readiness` | read_only | chat + voice | Workforce readiness % from protocol_assignment |
| `learnFactors` | `season.learn_factors` | read_only | chat + voice | Compare day/hour factors with previous season |

`season.activate` is NOT in this capability — it is a Server Action path with its own C4 authority seed (ADR-0201, line 12 in capability index).

Tool files: `packages/ai/src/tools/season/{create-season,set-revenue,save-playbook,get-readiness,learn-factors}.ts`

### Botsson page-tool kits

**Year-wheel page** — `apps/web/src/app/dashboard/year-wheel/_tools/use-year-wheel-tools.ts`
7 tools: `getYearWheelState`, `listSeasons`, `getSeasonDetail`, `listPlanningEvents`, `getSeasonProgress`, `proposeActivateSeason`, `proposeArchiveSeason`

**Season detail page** — `apps/web/src/app/dashboard/season/[seasonId]/_tools/use-season-tools.ts`
6 tools: `getSeasonStatus`, `getActivationReadiness`, `getBudgetSummary`, `getFactorSummary`, `proposeActivateSeason`, `proposeArchiveSeason`

Both surfaces share `proposeActivateSeason` + `proposeArchiveSeason` names — registered as known collision in `scripts/known-tool-name-collisions.json` (L-0258). See GAPS §Deviation D1.

---

## L4 — Data

See [DATA-MODEL.md](./DATA-MODEL.md) for full table schemas, RLS policies, and RPC signatures.

---

## L5 — Lifecycle (activation + D1 fanout)

The season activation flow is the most critical lifecycle path:

```
manager clicks "Activate" →
  activateSeasonAction (server action, L2) →
    activateSeasonAction checks C4 authority (engine_authority_config, season_activate) →
    calls activate_season(workspaceId, seasonId) RPC (L4) →
      RPC validates auth.uid() (Invariant I11 from ADR-0200) →
      RPC archives currently active season (atomic) →
      RPC updates season.status = 'active' →
      trg_season_activated trigger fires →
        seeds department_operating_hours rows (D1 fanout) →
      RPC returns { ok, season_id, departments_affected, rows_generated }
```

The `trg_season_activated` trigger is defined in `supabase/migrations/20260518010001_season_activation_trigger_d1.sql`. The RPC is defined in `supabase/migrations/20260518010002_activate_season_rpc.sql` (amended by `20260518040001` + `20260518210001`).

**Partial-success risk** (pre-RPC): ADR-0085 §Consequences known-risk documented two separate client-side UPDATEs as a partial-success window. ADR-0200 closed this by moving both operations into the RPC transaction. The RPC is the canonical activation path; direct status UPDATEs are forbidden.
