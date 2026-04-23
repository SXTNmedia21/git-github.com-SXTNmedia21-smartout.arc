---
title: "Atomic Season Activation — Trigger-Extension D1 Cascade + RPC Race Guard"
status: accepted
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
tags: [season, activation, d1, operating-hours, rpc, trigger, cascade, authority]
supersedes: "ADR-0085 §Consequences known-risk (long-term fix: wrap in DB function/RPC)"
council_session: "2026-04-23 — campaign/year-wheel M1 pre-implementation review"
council_verdict: "APPROVE-WITH-CHANGES (12 fixes applied before acceptance)"
---

# ADR-0200: Atomic Season Activation — Trigger-Extension D1 Cascade + RPC Race Guard

## Status

Accepted (2026-04-23, campaign/year-wheel M1 council review — 4 reviewers converged APPROVE-WITH-CHANGES, 12 blocking fixes applied to text before flip).

## Supersedes

ADR-0085 §Consequences known-risk. That section explicitly deferred the archive→activate partial-success window to a "long-term fix: wrap in a DB function/RPC." This ADR is that fix. The deferral is closed.

## Context

Season activation in `packages/year-wheel/src/hooks/use-seasons.ts:140-232` performs two sequential client-side Supabase UPDATE calls (archive current active season → set target to active) with a documented partial-success window (ADR-0085 §Consequences known-risk). If the first UPDATE succeeds and the second fails, the workspace has zero active seasons. The function also writes no `department_operating_hours` (D1) rows. Activating a season is D4-only (budget + factors); the schedule engine never sees the season change. A soft `window.confirm()` gate is the only user-facing safety check and is bypassable by calling the mutation directly.

The existing migration `20260428100001_season_activation_trigger.sql` already establishes `trg_season_activated` — an `AFTER UPDATE OF status ON season` trigger that fires `emit_season_activated_event()` (SECURITY DEFINER plpgsql) to INSERT into `engine_event` with `event_type = 'season.activated'` and an idempotency key. This trigger also routes `season.activated` → `department_session_lifecycle` (D6) via `engine_trigger`. The trigger covers D6 atomicity but not D1.

A second existing writer of `department_operating_hours` is `supabase/functions/bootstrap-cascade/index.ts:328-398` (Step 3). It writes DEFAULT rows (`season_id IS NULL`) for all departments using workspace base hours + per-department offsets. It does NOT write season-specific rows. The two writers occupy distinct domains: bootstrap owns DEFAULT rows; this ADR's trigger extension owns SEASON rows.

`department` has no `archived_at` column. Active department filter is `is_active = TRUE`.

No `season.activate` capability row exists in `engine_authority_config`. No `gate_action` call precedes the mutation today. The `window.confirm()` gate is not an authority check.

## Decision

The fix ships as three coordinated layers, each independently deployable but only correct when all three are present:

### Layer 1 — Trigger extension (D1 atomicity)

Extend `emit_season_activated_event()` in a new migration (`20260518010001_season_activation_trigger_d1.sql`) using `CREATE OR REPLACE FUNCTION` to add an idempotent D1 copy block AFTER the existing `engine_event` insert. The trigger fires for ANY code path that flips `season.status → 'active'` — the RPC call, a direct UPDATE, a migration, or any future caller. This is intentional: D1 cascade is automatic and cannot be bypassed by choosing a different call path.

The D1 copy block:

- Guard: `IF NOT EXISTS (SELECT 1 FROM department_operating_hours WHERE workspace_id = NEW.workspace_id AND season_id = NEW.season_id)` — copy only when no rows exist for this season_id.
- Source: `department_operating_hours` rows WHERE `workspace_id = NEW.workspace_id AND season_id IS NULL` (default rows, written by bootstrap-cascade).
- Scope: only departments where `is_active = TRUE`.
- Columns copied: `workspace_id`, `department_id`, `location_id`, `day_of_week`, `open_time`, `close_time`, `open_offset_minutes` (COALESCE to 0), `close_offset_minutes` (COALESCE to 0), `is_closed`. Set `season_id = NEW.season_id`, `is_derived = TRUE`, `provenance = jsonb_build_object('source', 'auto_copy_on_activate_trigger', 'activated_at', NOW(), 'trigger', 'trg_season_activated')`.
- `open_offset_minutes` and `close_offset_minutes` are additive minute adjustments stored alongside base times by bootstrap-cascade. Copied verbatim; COALESCE to 0 for NULL safety.
- The trigger body MUST NOT use `auth.uid()` — in many activation paths (migrations, service-role direct calls, cron) `auth.uid()` returns NULL. Actor context is not available inside the trigger and is not needed: the trigger writes facts, not actor-attributed mutations. Actor attribution belongs in the application layer.
- The trigger fires `FOR EACH ROW`, executes inside the same transaction as the triggering UPDATE. If the D1 INSERT fails, the entire transaction rolls back — including the season status update. D1 presence is a precondition for a successful activation.

### Layer 2 — `activate_season` RPC (archive+activate atomicity)

A new Postgres function `activate_season(p_workspace_id UUID, p_season_id UUID) RETURNS JSONB`, SECURITY DEFINER, LANGUAGE plpgsql, at migration `20260518010002_activate_season_rpc.sql`. It wraps the two-step archive→activate in a single transaction, closing the partial-success window from ADR-0085.

Actor derivation (L-0058 forgeable-actor defense): `auth.uid()` is called at the start of the RPC body. If NULL (service-role caller or unauthenticated), the RPC returns `{ok: false, error: 'unauthenticated'}` immediately with no writes. The RPC does NOT accept `p_actor_id` as a parameter — the caller cannot assert an actor identity.

The RPC logic:
1. `v_actor_id := auth.uid()` — reject if NULL.
2. Check if target season is already active; if yes, return `{ok: true, skipped: true, reason: 'already_active'}`.
3. `UPDATE season SET status = 'archived' WHERE workspace_id = p_workspace_id AND status = 'active'`.
4. `UPDATE season SET status = 'active' WHERE season_id = p_season_id AND workspace_id = p_workspace_id` — fires `trg_season_activated`, which atomically runs the D1 copy inside this same transaction.
5. Read back `departments_affected` and `rows_generated` from `department_operating_hours WHERE season_id = p_season_id` AFTER the trigger has run.
6. Return `{ok: true, season_id, departments_affected, rows_generated}`.

`rows_generated = 0` with `ok: true` is a valid outcome — it means the season already had D1 rows (idempotent guard fired). Represented as `skipped_copy: true, reason: 'rows_exist'` when `rows_generated = 0 AND departments_affected > 0`.

### Layer 3 — Server Action + gate_action + proposal modal

A new Server Action at `apps/web/src/app/dashboard/_actions/activate-season-action.ts` (following the established naming convention alongside `add-shift-action.ts`, `open-session-action.ts`). It is the ONLY application-layer call path to the RPC in M1.

The Server Action:
1. `resolveCurrentProfile()` — derives `profileId` and `workspaceId` server-side per ADR-0151. Returns `{ok: false, error: 'unauthenticated'}` if null.
2. `gateAction({workspaceId, capability: 'season.activate', channel: 'chat', actorProfileId: profileId, actionType: 'activate', entityId: seasonId})` from `apps/web/src/app/dashboard/_actions/_shared.ts`. Uses `channel: 'chat'` matching the convention established by `add-shift-action.ts:148` and `open-session-action.ts:58` — Server Actions invoked from the admin UI are treated as the user's primary interaction channel. If `!result.allow`, returns `{ok: false, error: 'insufficient_authority'}` without proceeding.
3. Validation queries (budget exists + has revenue target > 0; day_factor count > 0; hour_factor count > 0). Each failed check returns a typed `{ok: false, error: string}` without calling the RPC.
4. `adminClient.rpc('activate_season', {p_workspace_id, p_season_id})`.
5. On RPC success: `emit('season activated', ...)` with enriched payload (including `departments_affected`, `rows_generated`, `had_existing_hours`). If `rows_generated > 0`: also `emit('season operating_hours_generated', ...)`.
6. Returns typed result to the client.

The Server Action MUST NOT emit any telemetry event on `{ok: false}` paths. No `season activated` event fires unless the RPC returned `ok: true`. This closes the phantom-emit pattern (L-0094 / L-0118 / L-0125).

A `SeasonActivationProposalModal` component provides the user-facing preview and confirmation gate, replacing `window.confirm()`. This is an in-memory UI modal only. No `change_proposal` entity_type is introduced; no new DB table is created. Future audit-trail persistence for proposals is deferred.

#### Modal location — colocated with year-wheel, not top-level `components/`

File path: `apps/web/src/app/dashboard/year-wheel/_components/SeasonActivationProposalModal.tsx`. This follows the existing colocation pattern (`SeasonQuickCreateSheet.tsx`, `SeasonSidebar.tsx`, `CompanionRail.tsx` all live under `_components/`). No new top-level `apps/web/src/components/year-wheel/` directory is introduced — that would break the established convention.

#### Activate-button wiring — IN M1 SCOPE

Per `CAMPAIGN-year-wheel.md` §In scope M1 (line 22: "Includes activation gate, `SeasonActivationProposal` preview, rollback path.") and the M2/M3 lines 23/49 naming `apps/web/src/app/dashboard/season/**`. The Server Action without a UI surface is a phantom capability (ADR-0196 I11 violation). M1 MUST include:

1. An "Aktiver sesong" / "Activate season" CTA on the season-detail page. Target location: `apps/web/src/app/dashboard/season/[seasonId]/_components/SeasonOverviewTab.tsx` (preferred — tab-level action), or `season-page-client.tsx` (alternative — page header). Pick one in the build sub-sortie; document the choice in the handoff.
2. The CTA opens `SeasonActivationProposalModal`. Modal owns the preview→confirm→Server Action flow.
3. The existing year-wheel canvas has no Activate shortcut today; none is added in M1. If one emerges from M2 design-debt work, it routes through the same modal.

#### Cutover — `packages/year-wheel/src/hooks/use-seasons.ts` (L-0098 flip pattern)

The existing `activateSeason` TanStack mutation at `use-seasons.ts:140-232` is the broken client-side path. M1 applies the L-0098 flip pattern (no dual-write — the old path is broken by design, nothing to preserve):

1. Same M1 PR ships: the three migrations + Server Action + modal + hook refactor.
2. The `activateSeason.mutationFn` body is rewritten to call the Server Action via `"use server"` import. No client-side Supabase UPDATE calls remain in the hook.
3. The `window.confirm()` block at `use-seasons.ts:174-183` is removed. `SeasonActivationProposalModal` replaces it as the pre-submit UX.
4. The client-side `emit('season activated', ...)` block at `use-seasons.ts:209-223` is removed. The Server Action emits canonically server-side. No dual-emit window.
5. Client validation queries (budget, day factor, hour factor) are removed from the hook — the Server Action owns them. The hook retains only: open modal → receive Server Action result → invalidate queries → toast.

No dual-write transition exists because the old path is already incorrect. Flip is direct in a single PR.

verify: After M1 lands, `grep -n "supabase.from.*season.*update" packages/year-wheel/src/hooks/use-seasons.ts` — zero results. `grep -n "window.confirm" packages/year-wheel/src/hooks/use-seasons.ts` — zero results. `grep -n "emit.*season activated" packages/year-wheel/src/hooks/use-seasons.ts` — zero results.

### Scope boundary — M1 does NOT expose `season.activate` as an agent capability

`season.activate` is a Server Action capability in M1. No capability tool. No `packages/ai/src/capabilities/season/` work in M1. Agent exposure of `season.activate` is deferred to M3 and requires its own ADR.

### Bootstrap-cascade alignment (L-0114)

The two writers of `department_operating_hours` occupy non-overlapping domains and require no cutover:

- `bootstrap-cascade` (Step 3): writes DEFAULT rows (`season_id IS NULL`) at workspace-finalize time.
- `trg_season_activated` extension: writes SEASON rows (`season_id = X`) on first activation of each season.

There is no dual-write. Roles are additive, not competing. L-0114's cutover pattern does not apply.

### Telemetry (L-0083 — no phantom contracts)

Three new events registered in `packages/telemetry/src/registry.ts`. The registry has TWO coupled sections that MUST both be updated for an event to emit AND route:

1. The discriminated-union interface declaration block (~line 1400-1570 — where `SeasonCreated`, `SeasonActivated`, `SeasonUpdated` etc. live).
2. The `EVENT_ROUTING` table at ~line 6250 (where each event key maps to `destinations: ['posthog', 'logger', 'activity_trail']` etc.).

Adding only the interface compiles but routes nowhere. Adding only the routing entry fails type-checking. M1 commits BOTH in the same PR, same file. Every event ships its producer (the `emit()` call site in Server Action or modal) in the SAME commit as both registry sections:

- `season operating_hours_generated` — emitted by Server Action when `rows_generated > 0`. Routes to `['posthog', 'logger', 'activity_trail']`. Payload: `{entity: EntityRef, data: {departments_affected, rows_generated, source: 'auto_copy_on_activate_trigger'}}`. Semantically distinct from existing `season operating_hours_copied` (manual copy via SeasonHoursTab) — this event represents auto-copy fanout on activation, not user-initiated copy.
- `season activation_failed` — emitted on user-actionable `{ok: false}` paths (missing budget, missing factors, rpc_error). Routes to `['posthog', 'logger', 'activity_trail']`. Payload: `{entity: EntityRef, data: {reason}}`.
- `season activation_preview` — emitted by `SeasonActivationProposalModal` on open (read-only). Routes to `['posthog', 'logger']` (no `activity_trail` — this is UX telemetry, not a mutation). Payload: `{entity: EntityRef, data: {departments_count, existing_hours_rows, would_generate}}`.

Existing `SeasonActivated` interface is amended to add `departments_affected: number`, `rows_generated: number`, `had_existing_hours: boolean`. Routing for `season activated` stays at 3 destinations (`posthog`, `logger`, `activity_trail`) — the 4th destination (`engine_event`) is owned by the DB trigger `trg_season_activated` which INSERTs directly via SQL, bypassing `emit()`. This is intentional separation: app-layer telemetry writes to 3 destinations; DB-layer cascade signals write to `engine_event`.

### Authority seed (ADR-0189 CI parity)

The `engine_authority_config` seed migration (`20260518010000_season_activate_authority_seed.sql`) MUST ship in the same commit as any file that references the string literal `'season.activate'` as a capability key. Same CROSS JOIN idempotent pattern as the journey authority seed (`20260516000400_journey_authority_seed.sql:127-131`), with explicit 5-column VALUES matching SELECT (no column-default tricks):

```sql
INSERT INTO engine_authority_config
  (workspace_id, capability, min_role, level, requires_four_eyes, observer_escalation_hours)
SELECT w.workspace_id, v.capability, v.min_role, v.level, v.requires_four_eyes, v.observer_escalation_hours
FROM workspace w
CROSS JOIN (VALUES ('season.activate', 'manager', 'suggest', false, 72))
  AS v(capability, min_role, level, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

Capability key convention: dot-notation (`season.activate`), consistent with `journey.run_dev`. This establishes `season.*` as the namespace for `gate_action`-pathway season capabilities. No colon-delimited `season:create` / `season:update` capabilities exist in `engine_authority_config` — those route through `cascade_gate_write` (ADR-0091 pathway B), a distinct pathway.

### ADR-0190 Control 2 scope note

The `activate_season` RPC is SECURITY DEFINER plpgsql (ADR-0091 pathway B). It does NOT use `gatedInsert`. The `cascade-gate-entity-type-coverage.ts` CI (ADR-0190 Control 2) does not cover the RPC body. If any future code introduces `gatedInsert('department_operating_hours', ...)` outside this RPC, a `framework_trigger` seed for `(department_operating_hours, create)` must accompany that PR. Out of M1 scope.

## Consequences

### Positive

- **Atomicity:** Archive + activate + D1 copy execute in one Postgres transaction via RPC + trigger. Partial-success window from ADR-0085 is eliminated.
- **Universality:** The trigger fires for any code path that flips `season.status → 'active'`. D1 cascade cannot be bypassed.
- **Idempotency:** `NOT EXISTS` guard means re-activation of archived seasons (which retain rows) produces zero new rows.
- **Authority gate:** `gate_action` replaces `window.confirm()`. A `manager` minimum role is enforced server-side.
- **No bootstrap regression:** Bootstrap-cascade Step 3 continues to own DEFAULT rows unchanged.
- **Schedule engine visibility:** From first activation, `resolve-hours.ts:pickBestWeeklyRow` finds season-specific rows.

### Negative

- **Trigger as hidden writer:** Any code path that UPDATEs `season.status` to `'active'` silently generates D1 rows. Future data migrations must be aware.
- **Trigger failure = activation failure:** If the D1 copy INSERT fails (e.g., unique constraint violation), the entire activation rolls back. Opaque error to user — Server Action must translate.
- **No default rows = no D1 rows:** If bootstrap-cascade was skipped for a workspace, activation succeeds with `rows_generated = 0`. The season is active but schedule falls back to `default_weekly` resolver path. Documented, not silent.
- **Three migrations, ordered:** Seed (20260518010000) → trigger extension (20260518010001) → RPC (20260518010002). Server Action is not deployable until all three have run.

## Invariants

All invariants are falsifiable via the grep or SQL command in the `verify:` block.

**Invariant 1 — Trigger extension is the sole cascade-initiated D1 season writer.**
No application code performs `.from("department_operating_hours").insert(...)` outside of bootstrap-cascade step 3 (DEFAULT rows) after this ADR lands. Admin-UI `upsert(...)` calls for user-edited season-specific rows (e.g., `packages/year-wheel/src/hooks/use-season-operating-hours.ts:131`, `apps/web/src/app/dashboard/settings/_hooks/use-operating-hours.ts:161`, `DepartmentHoursTab.tsx:151`) are legitimate and explicitly permitted — they represent manual authoring, not cascade fanout. This invariant bans NEW cascade/system-initiated `.insert()` calls only.

verify: `grep -rn "\.from(['\"]department_operating_hours['\"]).*\.insert" apps packages services | grep -v "bootstrap-cascade/index.ts"` — zero results. Admin-UI upserts (`.upsert`) are excluded from the grep pattern.

**Invariant 2 — Gate before RPC, always.**
`activate-season-action.ts` MUST call `gateAction(...)` with `capability: 'season.activate'` before `adminClient.rpc('activate_season', ...)`.

verify: Read `activate-season-action.ts` — `gateAction` must appear before `adminClient.rpc('activate_season', ...)` with no other branch reaching the RPC.

**Invariant 3 — No phantom emit on failure paths.**
`activate-season-action.ts` MUST NOT call `emit('season activated', ...)` on any `{ok: false}` path.

verify:
1. `grep -c "emit.*season activated" apps/web/src/app/dashboard/_actions/activate-season-action.ts` — returns exactly 1.
2. Code review: the single `emit()` call must appear inside a branch where `rpcResult?.ok === true` (or equivalent truthy guard) has been asserted. No CI grep can prove this mechanically — it is a code-review gate at PR time.
3. `grep -n "emit.*season activation_failed" apps/web/src/app/dashboard/_actions/activate-season-action.ts` — each occurrence must appear in a branch where `rpcResult?.ok === false` or an upstream validation fell through.

**Invariant 4 — Authority seed ships with capability literal.**
Any file adding the string `'season.activate'` MUST be in the same commit as `supabase/migrations/20260518010000_season_activate_authority_seed.sql`.

verify: CI parity check per ADR-0189 enforces this automatically on PR.

**Invariant 5 — Telemetry registry and emit site in same commit (L-0083).**
Each of the three new event interfaces ships in the same commit as its `emit(...)` call.

verify: `git log --oneline -- packages/telemetry/src/registry.ts` — the commit adding `SeasonOperatingHoursGenerated` must also touch `activate-season-action.ts`.

**Invariant 6 — No `auth.uid()` in trigger body.**
`emit_season_activated_event()` function body MUST NOT reference `auth.uid()`.

verify: `grep -n "auth.uid()" supabase/migrations/20260518010001_season_activation_trigger_d1.sql` — zero results.

**Invariant 7 — Trigger guard is `NOT EXISTS`, not `COUNT = 0`.**
The idempotency guard uses `IF NOT EXISTS (SELECT 1 ...)` to avoid a full table scan.

verify: Read `20260518010001_season_activation_trigger_d1.sql` — confirm `NOT EXISTS`.

**Invariant 8 — RPC rejects unauthenticated callers.**
`activate_season` RPC body resolves `auth.uid()` before any SELECT or UPDATE statement, and returns `{ok: false, error: 'unauthenticated'}` on NULL before any data access.

verify: Read `20260518010002_activate_season_rpc.sql` — `auth.uid()` must be resolved prior to any data access, and the function must RETURN `{ok: false, error: 'unauthenticated'}` when NULL. No `SELECT`, `UPDATE`, or `INSERT` statement may execute on an unauthenticated code path.

**Invariant 9 — Department filter uses `is_active = TRUE`.**
`department` has no `archived_at` column.

verify: `grep -n "archived_at" supabase/migrations/20260518010001_season_activation_trigger_d1.sql` — zero. `grep -n "is_active" supabase/migrations/20260518010001_season_activation_trigger_d1.sql` — at least one.

**Invariant 10 — E2E asserts artefact (L-0125).**
E2E test asserts `SELECT COUNT(*) FROM department_operating_hours WHERE season_id = $target` — not just `{ok: true}` return shape.

verify: Read the E2E spec file; confirm a post-activation DB row-count assertion exists.

**Invariant 11 — No phantom capability (ADR-0196 I11).**
`activate-season-action.ts` emits `season activated` only after the RPC returns `ok: true` AND `departments_affected` + `rows_generated` have been read from the post-trigger state. The domain artefact (D1 rows) is produced in the same `execute()` call. No `{ok: false, error: 'not_implemented'}` short-circuit path exists.

verify: Code review. Invariant 3 (emit guarded by rpcResult.ok) + Invariant 10 (E2E asserts D1 rows exist) combined cover the falsifiable surface.

**Invariant 12 — No automated backfill for currently-active seasons.**
The ADR explicitly does NOT ship a `DO $$` backfill block. Workspaces with a season already at `status='active'` when the three migrations land retain zero `season_id != NULL` rows in `department_operating_hours` until the manager re-activates the season through the UI (archive → activate cycle, or direct UI re-activate). This is documented behavior, not a bug. Each affected workspace is its own decision point for operators.

verify: `grep -n "DO \\$\\$" supabase/migrations/20260518010001_season_activation_trigger_d1.sql supabase/migrations/20260518010002_activate_season_rpc.sql` — zero backfill blocks.

**Invariant 13 — Activate-button wiring is in M1 scope.**
The campaign ships with a user-reachable CTA. The Server Action must have a UI surface before M1 closes; shipping a Server Action with no caller is a phantom capability (ADR-0196 I11).

verify: `grep -rn "SeasonActivationProposalModal" apps/web/src/app/dashboard/season` — at least one import and one JSX render. The component must be mounted behind an "Aktiver sesong" / "Activate season" CTA reachable from the season-detail page.

## UI Contract — `SeasonActivationProposalModal`

### Primitive and file

- Primitive: shadcn Dialog (new-york style), via `apps/web/components/ui/dialog.tsx`.
- File: `apps/web/src/app/dashboard/year-wheel/_components/SeasonActivationProposalModal.tsx`.
- Mirror pattern: `SeasonQuickCreateSheet.tsx` (same domain, same lifecycle preview→confirm→toast).
- Size: `max-w-lg` (≈480px). Fits without scroll at ≤4 departments; scrolls gracefully beyond.
- Header: `font-heading` (Instrument Serif) — "Aktiver sesong — {seasonName}".
- Body: summary table (Department → Day count) in Geist Sans; numeric cells in Geist Mono.

### State matrix (6 states, not 4)

| State | Trigger | UI behaviour |
|-------|---------|--------------|
| `preview-loading` | Modal opens, `useSeasonActivationPreview` pending | Skeleton rows for department table. Confirm disabled. |
| `preview-ready` | Preview resolved, `rowsToGenerate > 0` | Normal render. Confirm enabled. |
| `preview-noop` | `existing_hours_rows > 0`, `rowsToGenerate === 0` | Distinct info-toned `Alert`: "Sesongen er allerede aktivert — ingen nye rader vil genereres." Primary button becomes "Lukk"; no Confirm. |
| `pending` | Confirm clicked, Server Action in flight | Confirm shows spinner + "Aktiverer…", disabled. Cancel disabled. ARIA live announces. |
| `error` | Server Action returned `{ok: false}` | Inline `Alert variant="destructive"` inside modal body. Differentiate by recoverability (see below). |
| `success` | Server Action returned `{ok: true}` | Modal closes immediately. Toast ("Sesong aktivert — {N} rader generert") at page level. No in-modal success state. |

### Error rendering — differentiate by recoverability

- **Recoverable (`missing_budget`, `rpc_error` transient):** inline `Alert variant="destructive"`, Lucide `AlertTriangle` icon. Confirm button text becomes "Prøv igjen"; remains enabled so user can retry after fix.
- **Terminal (`insufficient_authority`, `already_active`):** inline `Alert variant="destructive"`. Confirm button HIDDEN. Cancel becomes "Lukk".
- **No toast-only errors.** Activation errors MUST surface in the modal. Toast is for successful outcomes only.

### Spring physics — locked to strict-canonical

`{ type: "spring", stiffness: 35, damping: 22, mass: 2.2 }` on entrance/exit. Strict Nordic Split canonical, matches ADR-0177 §Motion. `useReducedMotion()` collapses springs to `{ duration: 0.01 }` opacity-only fade.

### i18n keys — `yearWheel.seasonActivation.*` namespace

Commit nb (default) + en pairs at `packages/i18n/locales/{nb,en}/year-wheel.json`:

| Key | nb | en |
|-----|----|----|
| `title` | `Aktiver sesong — {{seasonName}}` | `Activate season — {{seasonName}}` |
| `description` | `Dette vil generere timerader for perioden og låse D1-kaskaden.` | `This will generate hour rows for the period and lock the D1 cascade.` |
| `departmentsLabel` | `Avdelinger` | `Departments` |
| `rowsToGenerateLabel` | `Rader som genereres` | `Rows to generate` |
| `existingRowsLabel` | `Allerede genererte rader` | `Existing rows` |
| `confirm` | `Aktiver` | `Activate` |
| `cancel` | `Avbryt` | `Cancel` |
| `close` | `Lukk` | `Close` |
| `retry` | `Prøv igjen` | `Try again` |
| `pending` | `Aktiverer…` | `Activating…` |
| `noop.title` | `Sesongen er allerede aktivert` | `Season already activated` |
| `noop.description` | `Ingen nye timerader genereres.` | `No new hour rows will be generated.` |
| `error.authority` | `Du har ikke tilgang til å aktivere sesonger.` | `You don't have permission to activate seasons.` |
| `error.missingBudget` | `Sesongen mangler budsjett — legg til budsjett før aktivering.` | `Season is missing a budget — add one before activating.` |
| `error.alreadyActive` | `Sesongen er aktivert fra en annen økt. Last siden på nytt.` | `Season was activated from another session. Reload the page.` |
| `error.generic` | `Kunne ikke aktivere sesongen. Prøv igjen.` | `Could not activate season. Please try again.` |
| `toast.success` | `Sesong aktivert — {{count}} rader generert` | `Season activated — {{count}} rows generated` |

No hardcoded strings in `SeasonActivationProposalModal.tsx`. All copy through `useTranslations('yearWheel.seasonActivation')`.

### Accessibility requirements

- Radix Dialog focus trap (inherited). Auto-focus lands on **Cancel** (safer default for destructive-leaning actions).
- Escape closes in `preview-ready` + `error` states. Blocked during `pending` (prevent mid-mutation dismissal).
- ARIA live region (`role="status"`, `aria-live="polite"`) inside Dialog body announces state transitions (`preview-loading`, `pending`, `error` messages).
- Confirm button disabled state: `disabled` attribute + `aria-disabled="true"` (shadcn Button handles both).
- Touch targets: Confirm + Cancel `min-h-[44px]`. Close X sized to `44pt` (use `size="lg"` or custom class override over shadcn default 40pt).
- `useReducedMotion()` respected (see spring physics above).

### Tokens + dark mode

No `isDark` prop drilling. No `dark:` utility overrides. shadcn Dialog inherits `bg-background` + `text-foreground` — automatic light/dark switch via CSS vars. No hardcoded hex / `zinc-*` / `slate-*` classes introduced by this modal.

### Known debt — NOT fixed in M1

- `TimelineBlock.tsx:51` spring violation (400/30/0.8) — tracked in M2 scope.
- Hardcoded Norwegian strings in `SeasonQuickCreateSheet.tsx` + `SeasonSidebar.tsx` — tracked in M2 scope.
- M1 introduces no new hardcoded strings — all modal copy goes through i18n keys above.

## Related

- ADR-0085 — Year Wheel Governance Policy (superseded §Consequences known-risk)
- ADR-0091 — cascade_gate_write (pathway B; RPC is pathway B, not gatedInsert)
- ADR-0099 — gate_action unified authority gate (used by Server Action)
- ADR-0140 — Governance provenance JSONB
- ADR-0151 — Stage-engine profile_id server derivation
- ADR-0164 — Season namespace unification for telemetry
- ADR-0189 — Authority seed parity CI check
- ADR-0190 — cascade_gate_write orthogonal controls (Control 2 scope note)

## Learnings referenced

- L-0042 — Migration timestamp causal-ordering (migrations must be > repo tip 20260518000000)
- L-0058 — Forgeable actor / profile_id derivation (RPC auth.uid() pattern)
- L-0083 — Single-emit rule (registry + emit site in same commit)
- L-0094 — Phantom emit contracts (no emit on ok:false paths)
- L-0098 — Global scripts cutover ownership
- L-0107 — Authority appearance ≠ authority presence
- L-0114 — Bootstrap-cascade dual-write (confirmed non-overlapping)
- L-0118 — No phantom capabilities
- L-0125 — E2E artefact assertion
