---
title: "Journey — Season Activation → D1 Cascade"
status: done
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
tags: [journey, season, activation, d1, cascade, m1]
feature: campaign/year-wheel M1 — cascade-gap-closure
---

# Journey — Season Activation → D1 Cascade

> **Feature:** campaign/year-wheel Milestone M1
> **ADR:** ADR-0200
> **Commits:** 9cf03aa0 · d9bfab6a · f613aa3b · 23934772 · 0b061d86 · 71412806 · be1ecbb7 · 77dfa050 · 69cf280e

## Journey: Manager activates a season from the detail page (happy path)

**Precondition:**
- Workspace has bootstrap-cascade completed (DEFAULT `department_operating_hours` rows exist, `season_id IS NULL`).
- Workspace has a draft season with: `season_budget.total_target_revenue > 0`, at least one `day_factor` row, at least one `hour_factor` row.
- User is logged in with role `manager` or higher.
- At least one `department` row exists with `is_active = TRUE`.

**Steps:**

1. Manager navigates to `/dashboard/season/[seasonId]` → Server renders season page. `SeasonOverviewTab` shows "Aktiver sesong" CTA enabled (season.status === 'draft').
2. Manager clicks "Aktiver sesong" → React state flips `activateModalOpen = true`. `SeasonActivationProposalModal` mounts.
3. Modal mounts → `useSeasonActivationPreview(seasonId)` fires three parallel queries: department count (is_active=true), existing D1 rows for this season_id, default D1 rows (season_id IS NULL).
4. Preview resolves → Modal transitions from `preview-loading` to `preview-ready`. Shows: "N avdelinger, M rader vil genereres." → Emits `season activation_preview` telemetry event (posthog + logger, no activity_trail since it's UX not mutation).
5. Manager clicks "Aktiver" → Modal transitions to `pending`. Confirm button shows spinner + "Aktiverer…". ARIA live region announces "Aktiverer sesong".
6. Server Action `activateSeasonAction(seasonId)` runs → `resolveCurrentProfile()` → `gateAction({capability: 'season.activate', channel: 'chat'})` → validation (budget/day_factor/hour_factor) → `adminClient.rpc('activate_season', {p_workspace_id, p_season_id})`.
7. Postgres RPC body: `auth.uid()` check → already-active guard (false) → `UPDATE season SET status='archived' WHERE workspace_id=X AND status='active'` → `UPDATE season SET status='active' WHERE season_id=Y` → **trigger `trg_season_activated` fires inside same transaction** → `INSERT INTO engine_event` (event_type='season.activated') → **D1 copy block**: `NOT EXISTS` guard passes → `INSERT INTO department_operating_hours SELECT ... FROM department_operating_hours WHERE season_id IS NULL JOIN department WHERE is_active=TRUE` → transaction commits.
8. RPC returns `{ok: true, season_id, departments_affected: N, rows_generated: 7*N}`. Server Action emits `season activated` (enriched payload with `departments_affected`, `rows_generated`, `had_existing_hours: false`) + `season operating_hours_generated` (since rows_generated > 0).
9. Server Action returns `{ok: true, ...}` to modal → Modal transitions to `success` → calls `onActivated(result)` → closes.
10. Parent (SeasonOverviewTab) fires toast: "Sesong aktivert — {7×N} rader generert." → invalidates `yearWheelKeys.seasons(wsId)` + `yearWheelKeys.seasonOperatingHours(wsId, seasonId)`.

**Postcondition:**
- `season.status = 'active'` for target.
- Previous `status = 'active'` season (if any) is now `status = 'archived'`. Its `department_operating_hours season_id = <prev>` rows are preserved (idempotent re-activation safe).
- `department_operating_hours WHERE season_id = target` contains `7 × active_departments` rows (one per day_of_week per active department), `is_derived = TRUE`, `provenance.source = 'auto_copy_on_activate_trigger'`.
- `engine_event` row exists: `event_type = 'season.activated'`, routes to `department_session_lifecycle` D6 process (existing behavior, unchanged).
- Schedule engine (`resolve-hours.ts:pickBestWeeklyRow`) now finds season-specific rows for this season on read — cascade gap closed.

## Journey: Manager re-activates an archived season (idempotent)

**Precondition:**
- Target season has `status = 'archived'` AND has `department_operating_hours` rows with its `season_id` (from a prior activation).
- Same prerequisites as happy path.

**Steps:**
1. Manager navigates to `/dashboard/season/[archivedId]` → CTA label reads "Aktiver på nytt" (enabled).
2. Clicks button → Modal mounts. Preview query runs.
3. Preview resolves: `existingRows > 0`, `rowsToGenerate = 0` → Modal shows `preview-noop` state: info Alert "Sesongen er allerede aktivert — ingen nye rader vil genereres." Primary button becomes "Lukk", no Confirm.
4. Manager clicks "Lukk" OR clicks through via explicit code path (if manager wants to flip the status anyway — this flow is not the primary no-op presentation).

Alternative re-activation (flip status without generation):
3b. If manager dismisses the noop modal and triggers activation another way (e.g., programmatic) → Server Action calls RPC → RPC archives the current-active (if any) + activates target → trigger fires → `NOT EXISTS` guard fails (rows exist) → no D1 INSERT → RPC returns `{ok: true, rows_generated: 0, departments_affected: K}`.
4b. Server Action emits `season activated` with `had_existing_hours: true`. NO `season operating_hours_generated` emit (rows_generated = 0).
5b. Toast: "Sesong aktivert — 0 rader generert" (or an i18n variant for the noop case).

**Postcondition:** target is active, previous active is archived, `department_operating_hours` rows for the target are unchanged (preserved from the prior activation).

## Journey: Activation blocked by missing budget (recoverable error)

**Precondition:** Target season has no `season_budget` row (or `total_target_revenue = 0`).

**Steps:**
1. Manager clicks "Aktiver sesong" → Modal mounts → preview loads → `preview-ready`.
2. Manager clicks "Aktiver" → `pending` → Server Action starts.
3. Server Action: `gateAction` passes (authority is fine), validation fires → budget query returns `null`.
4. Server Action emits `season activation_failed` with `reason: 'missing_budget'`. Does NOT emit `season activated`.
5. Server Action returns `{ok: false, error: 'missing_budget'}`.
6. Modal transitions to `error` state (recoverable): inline `Alert variant="destructive"` with Lucide `AlertTriangle`, i18n key `error.missingBudget`: "Sesongen mangler budsjett — legg til budsjett før aktivering."
7. Confirm button text becomes "Prøv igjen" (enabled). Cancel still available.
8. Manager dismisses, adds budget via BudgetSetupTab, returns, tries again → happy path.

**Postcondition:** `season.status` unchanged (still draft). No D1 rows generated. `engine_event` has no row for this attempt (trigger only fires on successful status transition).

## Journey: Activation blocked by insufficient authority (terminal error)

**Precondition:** Target user has role below `manager` (e.g., `employee`).

**Steps:**
1. User somehow reaches the Activate CTA (UI should hide it based on role, but authority is enforced server-side per C4 "confident != authorized").
2. User clicks "Aktiver" → `pending` → Server Action.
3. `resolveCurrentProfile()` returns `{profileId, workspaceId}` → `gateAction({capability: 'season.activate', ...})` returns `{allow: false, reason: 'min_role_not_met'}`.
4. Server Action emits `season activation_failed` with `reason: 'rpc_error'` (gate denial folds into rpc_error per architect's design decision — no dedicated `insufficient_authority` reason in registry enum). Does NOT emit `season activated`.
5. Returns `{ok: false, error: 'insufficient_authority'}`.
6. Modal transitions to `error` state (terminal): inline destructive Alert with `error.authority` key: "Du har ikke tilgang til å aktivere sesonger." Confirm button HIDDEN. Cancel becomes "Lukk".

**Postcondition:** No state change. `engine_authority_config` rejected the action; audit row exists in `engine_event` for the gate denial (standard gate_action behavior, not new to M1).

## Journey: Activation blocked by unauthenticated caller (defense-in-depth)

**Precondition:** Session expired mid-flow; `auth.uid()` returns NULL at RPC invocation.

**Steps:**
1. Modal submits → Server Action.
2. `resolveCurrentProfile()` returns null → Server Action returns `{ok: false, error: 'unauthenticated'}` without calling the RPC. No emit.

Alternative (passes resolveCurrentProfile but auth lapsed before RPC):
2b. Server Action calls RPC → RPC first statement: `v_actor_id := auth.uid()` → NULL → RPC returns `{ok: false, error: 'unauthenticated'}` before any SELECT/UPDATE (Invariant 8).
3b. Server Action passes this through: returns `{ok: false, error: 'unauthenticated'}`. No emit (per Invariant 3).
4b. Modal renders terminal error with `error.generic`.

**Postcondition:** No state change. No writes. No telemetry fanout.

## Journey: Concurrent activation race (Postgres transaction handles)

**Precondition:** Two managers click "Aktiver" on two different seasons at ~the same moment.

**Steps:**
1. Both Server Actions fire in parallel → both RPC calls start.
2. Postgres serializes the two transactions (MVCC + row-level locks on the season table).
3. First RPC archives current active → activates its target → trigger fires → D1 rows generated → commits.
4. Second RPC sees the first's effects: `UPDATE season SET status='archived' WHERE status='active'` archives the one the first just activated → `UPDATE season SET status='active' WHERE season_id=<second_target>` → trigger fires → second D1 rows generated → commits.
5. Both Server Actions emit `season activated` + `season operating_hours_generated` for their respective seasons.

**Postcondition:** Exactly one season is active (whichever was activated last). The first-activated season briefly held active state and has D1 rows stamped with its `season_id` (preserved on archive). No partial-success window thanks to RPC atomicity.

## Error paths summary

| Error code | Source | Modal state | Recoverable | Emits `season activation_failed`? |
|---|---|---|---|---|
| `unauthenticated` | resolveCurrentProfile null OR RPC auth.uid() NULL | error (terminal) | No | No |
| `insufficient_authority` | gateAction returned `allow: false` | error (terminal) | No | Yes (`rpc_error` reason) |
| `missing_budget` | server-side validation | error (recoverable) | Yes (add budget) | Yes |
| `missing_day_factors` | server-side validation | error (recoverable) | Yes (seed factors) | Yes |
| `missing_hour_factors` | server-side validation | error (recoverable) | Yes (seed factors) | Yes |
| `season_not_found` | RPC UPDATE affected zero rows | error (terminal) | No (race / deleted) | Yes |
| `rpc_error` | DB outage, constraint violation, trigger INSERT fail | error (recoverable — retry) | Yes (transient) | Yes |

## Telemetry events emitted

Per ADR-0200 §Telemetry. All registry entries + routing table entries ship in commit `d9bfab6a`.

- `season activated` — on every successful activation, including already-active skip and idempotent re-activate. Destinations: posthog + logger + activity_trail. `engine_event` row written by DB trigger (4th destination covered out-of-band).
- `season operating_hours_generated` — only when `rows_generated > 0`. Destinations: posthog + logger + activity_trail.
- `season activation_failed` — on user-actionable failure paths (not on `unauthenticated`). Destinations: posthog + logger + activity_trail.
- `season activation_preview` — when modal opens and preview resolves. Destinations: posthog + logger (UX telemetry, not a mutation).

## Files touched (summary)

| File | Commit | Role |
|------|--------|------|
| `supabase/migrations/20260518010000_season_activate_authority_seed.sql` | 9cf03aa0 | Authority seed for `season.activate` (ADR-0189 parity) |
| `supabase/migrations/20260518010001_season_activation_trigger_d1.sql` | f613aa3b | Extends `emit_season_activated_event()` with D1 copy block |
| `supabase/migrations/20260518010002_activate_season_rpc.sql` | f613aa3b | `activate_season(p_workspace_id, p_season_id)` RPC |
| `packages/telemetry/src/registry.ts` | d9bfab6a | 3 new events + enriched `SeasonActivated` payload |
| `packages/year-wheel/src/hooks/use-season-activation-preview.ts` | 23934772 | Read-only preview hook |
| `packages/year-wheel/src/hooks/use-seasons.ts` | be1ecbb7 | Deleted `activateSeason` mutation (L-0098 flip) |
| `apps/web/src/app/dashboard/_actions/activate-season-action.ts` | 0b061d86 | Server Action |
| `apps/web/src/app/dashboard/year-wheel/_components/SeasonActivationProposalModal.tsx` | 71412806 | Replacement for `window.confirm()` |
| `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonOverviewTab.tsx` | 77dfa050 | Wires Activate CTA into overview tab |
| `packages/i18n/locales/{nb,en}/year-wheel.json` | 71412806 + 77dfa050 | 21 new i18n keys under `seasonActivation.*` |
| `supabase/tests/season-activation-d1-fanout.sql` | 69cf280e | SQL integration test — L-0125 artefact assertion |
| `apps/web/src/app/dashboard/_actions/__tests__/activate-season-action.test.ts` | 69cf280e | 5 unit tests — all pass |
| `apps/e2e/tests/season-activation.spec.ts` | 69cf280e | Playwright spec (skipped pending seed helper) |
