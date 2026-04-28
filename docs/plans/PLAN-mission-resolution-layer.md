---
title: "Mission Resolution Layer — BFF read path from engine_missions ↔ journey_version"
id: PLAN-mission-resolution-layer
status: ready
layer: plan
created: 2026-04-27
updated: 2026-04-27
module: journey-engine
tags: [journey-engine, mission-resolution, engine_missions, bff, run-guided, phase-3]
depends_on:
  - ADR-0099
  - ADR-0132
  - ADR-0194
  - L-0023
---

# Mission Resolution Layer — Implementation Plan

**Goal:** Provide a canonical read path that, given a `journey_version_id` and `workspaceId`, returns the single active `engine_missions` row (with ordered `engine_stages`) for that version — the read complement to `publish_mission`'s write.

**Tech Stack:** TypeScript, Supabase PostgREST (admin client), `@smartout/supabase` DB types.

**Source documents:**

- `docs/plans/CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT → Phase 3 #2`
- ADR-0094 (hybrid mapping: `engine_missions.journey_id` FK, no `journey_version_id` direct link)
- ADR-0099 (`callGateAction` mandatory on mutations — NOT on this read path)
- ADR-0132 (Mobile AI Routing — resolution must be BFF-callable, mobile proxies through BFF)
- ADR-0194 (JourneyIR v2.1 → engine_missions, `is_active=false` until author enrich)
- L-0023 (dev-tracking ≠ runtime-state — resolver is read-only; no write to `journey_event`)

---

## Scope Spike — What Is the Gap?

### 1. Where does mission resolution happen TODAY?

**It does not exist.** Concrete citations:

- `services/stage-engine/src/core/session-manager.ts:89` — `loadMission(missionId: string)` takes a raw TEXT primary key from `engine_missions.id`. The caller must already know the mission id. This is a stage-engine–internal function; it is not accessible from Next.js BFF routes.
- `packages/ai/src/capabilities/journey/tools.ts:610–798` — `runGuidedTool.execute()` loads `journey_version` + parent `journey`, inserts `engine_state`, and emits `run_started`. It never queries `engine_missions`. The mission id is never resolved inside the capability.
- `apps/web/src/app/api/journey/guided/start/route.ts:118–257` — BFF validates `journey_version_id`, calls `gateAction`, builds `AgentToolContext`, then invokes `runGuidedTool`. No `engine_missions` lookup. The `is_active=true` flip from `activateMissionAction` has no consumer in the runtime path yet.
- `apps/web/src/app/platform-admin/journeys/versions/actions/enrich-mission.ts:185–291` — `activateMissionAction` flips `engine_missions.is_active = true` correctly, but that flip lands in a DB row that nothing reads during a guided run.

**Summary:** `is_active=true` missions exist in the DB but no runtime caller selects them by `journey_version_id`. The gap is a missing shared utility — NOT a complex new subsystem.

### 2. Exact contract a consumer needs

The resolution step requires:

1. Look up `journey_version` by `journey_version_id` + `workspaceId` → get `journey_id`.
2. Query `engine_missions` where `journey_id = <above>` AND `workspace_id = workspaceId` AND `is_active = true`.
3. Expect exactly one row; zero = no active mission; two or more = data integrity bug (log + return null).
4. Query `engine_stages` where `mission_id = mission.id`, ordered by `stage_order ASC`.
5. Return the pair.

```ts
// packages/ai/src/lib/mission-resolution.ts

type EngineMissionRow = Database["public"]["Tables"]["engine_missions"]["Row"];
type EngineStageRow = Database["public"]["Tables"]["engine_stages"]["Row"];

interface ResolveMissionParams {
  journeyVersionId: string;   // UUID — the journey_version PK
  workspaceId: string;        // workspace scope guard — MUST be server-derived, never client-supplied
  supabaseAdmin: SupabaseClient; // caller provides admin client (no RLS bypass needed — workspace guard is explicit)
}

type ResolveMissionResult =
  | { ok: true; mission: EngineMissionRow; stages: EngineStageRow[] }
  | { ok: false; reason: "not_found" | "version_not_found" | "multiple_active" | "stages_empty"; detail?: string };

function resolveMissionForJourneyVersion(params: ResolveMissionParams): Promise<ResolveMissionResult>
```

**Error / null cases:**

| Case | `reason` | Trigger |
|------|----------|---------|
| `journey_version` not found or wrong workspace | `version_not_found` | Version does not exist in this workspace |
| No `engine_missions` row with `is_active=true` | `not_found` | Mission not yet published, or not yet activated by author enrich |
| Two or more `is_active=true` rows for same `journey_id` | `multiple_active` | Data integrity bug — log to console.error, return null |
| Mission found but `engine_stages` empty | `stages_empty` | Publish succeeded but stage insert was rolled back or never landed |

### 3. Caller surfaces

| Surface | File | Current state | Needs from resolver |
|---------|------|---------------|---------------------|
| `runGuidedTool.execute()` | `packages/ai/src/capabilities/journey/tools.ts:610` | Loads `journey_version` + `journey`, creates `engine_state`. Never fetches `engine_missions`. | `mission.system_prompt`, `mission.mode`, ordered `stages[]` — stored into `engine_state.context` JSONB for Fjernkontroll + stuck-detector |
| BFF `/api/journey/guided/start` | `apps/web/src/app/api/journey/guided/start/route.ts:118` | Calls `runGuidedTool`, returns `run_id`. | Could call resolver before `runGuidedTool` to pre-validate an active mission exists, return 409 early if none |
| Stage-engine `loadMission()` | `services/stage-engine/src/core/session-manager.ts:89` | Expects raw `mission_id` TEXT PK — already works if a `mission_id` is passed | Alignment needed: when `run_guided` creates `engine_state`, `context.mission_id` should carry the resolved `mission.id` so stage-engine can call `loadMission()` with it |
| Fjernkontroll UI | `apps/web/src/components/journey/` | Reads `engine_state` rows via Realtime — `context` JSONB carries step metadata | Needs `mission.mode` in `engine_state.context` so Fjernkontroll renders free/sequential/hybrid UI variants |
| Mobile BFF (`/api/journey/guided/start`) | Same route — Bearer auth path | No mobile-specific logic needed; resolver runs server-side, result invisible to client | Same as web — thin client sees only `run_id` |
| Admin test-run (`/platform-admin/journeys/versions/[id]/run`) | Embeds Fjernkontroll | Calls `/api/journey/guided/start` | Benefits indirectly from 409 early-return when no active mission |

**Stage projection:** full `engine_stages` rows needed (goal + instructions + success_criteria + creative_freedom + stage_order) — the stage-engine `buildStagePrompt()` uses all fields.

### 4. Authorization model

**Read-only: no `callGateAction`.** Per ADR-0099, `callGateAction` is mandatory on mutations only. This resolver is a pure SELECT. The authorization model is:

- `workspace_id` scope guard (explicit `.eq("workspace_id", workspaceId)` on every query).
- `workspaceId` MUST come from the server-derived auth context — NEVER from the request body (ADR-0176 Invariant 3 / ADR-0134).
- RLS on `engine_missions` / `engine_stages` provides defense-in-depth at the DB layer even with admin client.

No `callGateAction` call. No new authority row needed.

### 5. Caching / invalidation

**No cache for now.** Rationale:

- The `is_active=true` flip (`activateMissionAction`) is a rare admin event (once per mission publication). The resulting row is cold-read until the first guided run starts.
- Once a mission is active, its `system_prompt` / `mode` are frozen (stages are locked post-activation per `enrich-mission.ts:101`). The resolver result is stable after the flip.
- Adding a React cache or Next.js `unstable_cache` would require careful invalidation tied to `activateMissionAction` (it already calls `revalidatePath`). This is low-risk to defer — the hot path (one `SELECT` per run-start) is fast and infrequent.
- **Verdict: no cache.** Revisit only if profiling shows mission resolution is a bottleneck (unlikely given run frequency in v1).

---

## Architecture Overview

The resolver is a shared pure function in `packages/ai/src/lib/mission-resolution.ts`. It accepts a Supabase admin client (caller-provided), performs two sequential SELECTs (version → mission → stages), and returns a typed discriminated union.

The primary integration point is `runGuidedTool.execute()`: after loading `journey_version` + `journey` (already done in that body), the tool calls `resolveMissionForJourneyVersion()` and writes `mission.id`, `mission.mode`, `mission.system_prompt` into `engine_state.context` JSONB alongside the existing `journey_version_id`. This lets the stage-engine's `loadMission(context.mission_id)` pick up the already-resolved id without a second resolution round-trip.

The BFF `/api/journey/guided/start` gains an optional early-return: if the resolver returns `not_found` before `runGuidedTool` is called, the BFF can return HTTP 409 with a structured body (`{ error: "no_active_mission" }`). This surfaces the author-enrich pre-condition to mobile and web callers before any `engine_state` row is created.

---

## Prerequisites

- [x] `publish_mission` body ships real `engine_missions` rows (done — `HANDOFF-publish-mission-body.md`)
- [x] `activateMissionAction` flips `is_active=true` (done — `enrich-mission.ts`)
- [x] `engine_missions` + `engine_stages` schema reflected in `database.types.ts` (done — types verified)
- [x] `@smartout/ai` package has `src/lib/` directory (exists — `resolveCompanyId.ts`, `pii-redact.ts`, etc.)

---

## Tasks

### Phase A — Test (write tests first, TDD)

#### Task A1: Unit test for `resolveMissionForJourneyVersion`

**What:** Write a Vitest unit test in `packages/ai/src/lib/__tests__/mission-resolution.test.ts`. Mock the Supabase admin client. Test all 5 branches: happy path (mission + stages returned), `version_not_found`, `not_found` (no active mission), `multiple_active` (two rows), `stages_empty`.

**Files:**
- CREATE `packages/ai/src/lib/__tests__/mission-resolution.test.ts`

**Acceptance:** `pnpm --filter @smartout/ai test -- mission-resolution` passes; all 5 branches covered.

#### Task A2: E2E test asserting real DB rows + end-to-end guided start

**What:** Extend `apps/e2e/tests/journey-capability-run-guided.spec.ts` (or create if absent). Test:
1. Publish a mission (via `publishMissionTool` or direct DB seed), activate it via `activateMissionAction`, call BFF `/api/journey/guided/start` — assert `run_id` returned AND `engine_state` SELECT contains `context.mission_id`.
2. Attempt `/api/journey/guided/start` on a version with `is_active=false` mission — assert HTTP 409 `no_active_mission`.

Per L-0125: assert the artefact (`engine_state.context.mission_id`), not just `ok:true`.

**Files:**
- CREATE or MODIFY `apps/e2e/tests/journey-capability-run-guided.spec.ts`

**Acceptance:** E2E assertions on DB rows green; 409 branch returns structured body.

### Phase B — Implementation

#### Task B1: Implement `resolveMissionForJourneyVersion`

**What:** Replace the stub `throw new Error("not_implemented")` in `packages/ai/src/lib/mission-resolution.ts` with the real two-SELECT body. Exact logic:
1. SELECT `journey_version` where `journey_version_id = params.journeyVersionId` AND `workspace_id = params.workspaceId` → get `journey_id`. If null → return `{ ok: false, reason: "version_not_found" }`.
2. SELECT `engine_missions` where `journey_id = <above>` AND `workspace_id = params.workspaceId` AND `is_active = true`. If 0 rows → `not_found`. If >1 → log + `multiple_active`. If exactly 1 → continue.
3. SELECT `engine_stages` where `mission_id = mission.id` ORDER BY `stage_order ASC`. If empty → `stages_empty`.
4. Return `{ ok: true, mission, stages }`.

**Files:**
- MODIFY `packages/ai/src/lib/mission-resolution.ts` (replace stub body)

**Acceptance:** Unit test from A1 goes green. Typecheck passes with 0 errors.

#### Task B2: Wire resolver into `runGuidedTool.execute()`

**What:** After the existing `journey_version` + `journey` load in `runGuidedTool.execute()` (tools.ts ~line 656–695), call `resolveMissionForJourneyVersion()`. On `not_found` or `multiple_active` → return structured error WITHOUT inserting `engine_state`. On `ok: true` → include `mission.id`, `mission.mode`, `mission.system_prompt` in `engine_state.context` JSONB (alongside existing `journey_version_id`, `capability`, `surface`, `ir_version`).

**Files:**
- MODIFY `packages/ai/src/capabilities/journey/tools.ts` (`runGuidedTool.execute()` only)

**Acceptance:** `engine_state.context.mission_id` is set on successful run-start; capability returns `mission_not_active` error when resolver returns `not_found`.

#### Task B3: Add early-return guard to BFF `/api/journey/guided/start`

**What:** Before invoking `runGuidedTool`, call `resolveMissionForJourneyVersion()` with the server-derived `workspaceId`. If `not_found` → return HTTP 409 `{ error: "no_active_mission", detail: "publish + enrich the journey version before starting a guided run" }`. If `multiple_active` → HTTP 500 (data integrity bug). On `ok` → continue to `runGuidedTool` as before (capability will call resolver again internally — acceptable duplication for defense-in-depth; profile the cost if needed).

**Files:**
- MODIFY `apps/web/src/app/api/journey/guided/start/route.ts`

**Acceptance:** BFF returns 409 for un-activated missions; E2E test from A2 branch 2 goes green.

### Phase C — Code-trace + Phase 2.5 grep

#### Task C1: Phase 2.5 registry grep

**What:** Run `grep -n "journey\." packages/telemetry/src/registry.ts` and confirm every `journey.*` event name referenced in Phase B code appears. Mission resolution is read-only — it emits NOTHING. Verify no accidental `emit()` call was introduced.

**Acceptance:** grep returns the 5 registered events (run_started, step_reached, completed, stuck, run_failed) and nothing new. 0 `emit()` calls in `mission-resolution.ts`.

#### Task C2: ADR-0099 invariant check

**What:** Grep `packages/ai/src/lib/mission-resolution.ts` for `callGateAction`. Result must be 0 — the resolver is read-only; gate is for mutations only (ADR-0099). Document in JSDoc.

**Acceptance:** grep returns 0 occurrences.

#### Task C3: Cross-workspace path trace

**What:** Trace the `workspaceId` flow from BFF auth derivation (`resolveAuth()`) through `runGuidedTool` context to `resolveMissionForJourneyVersion` params. Confirm `workspaceId` is never taken from request body at any point in the chain (ADR-0176 Invariant 3).

**Acceptance:** Written in handoff with file:line citations for each derivation point.

### Phase D — Close

#### Task D1: Typecheck

**What:** `pnpm turbo typecheck` — 0 errors.

**Acceptance:** CI green.

#### Task D2: Journey doc + handoff

**What:** Write `docs/journeys/JOURNEY-mission-resolution-layer.md` (happy path + 4 error paths; admin, runtime user, mobile surfaces). Write `docs/HANDOFF-mission-resolution-layer.md`.

---

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors.
- [ ] Unit test: 5 branches covered (happy + version_not_found + not_found + multiple_active + stages_empty).
- [ ] E2E (artefact-asserting per L-0125): `engine_state.context.mission_id` matches resolved mission; 409 returned for un-activated missions.
- [ ] BFF returns 409 `no_active_mission` when no active mission exists — NOT after `engine_state` row is created.
- [ ] `engine_state.context` on a successful run contains `mission_id`, `mission_mode`, `mission_system_prompt` (packed by `runGuidedTool`).
- [ ] Zero `emit()` calls in `mission-resolution.ts` — resolver is read-only.
- [ ] Zero `callGateAction` calls in `mission-resolution.ts` — ADR-0099 (mutations only).
- [ ] `workspaceId` never accepted from client — server-derived at all call sites (ADR-0176 Invariant 3, ADR-0134).
- [ ] Mobile BFF parity: Bearer auth path through `/api/journey/guided/start` hits the same resolver logic (same route file, no mobile-specific branch needed).
- [ ] Phase 2.5 grep: 0 new `journey.*` event keys introduced.

---

## Token Budget

Target: 25–35k tokens (mirrors `publish-mission-body` sortie). The implementation is 3 files + 2 test files. No new migrations. No new ADRs (read-path, no authority changes). No telemetry changes.

---

## Out of Scope (Kill List)

- **No new migration.** `engine_missions` already has `journey_id` FK; no `journey_version_id` column needed — the two-step join `journey_version → journey → engine_missions` is intentional per ADR-0194.
- **No caching layer.** Mission activation is rare; cache adds invalidation risk. Revisit only with profiling evidence.
- **No new telemetry event.** Resolution is read-only. Emitting on every resolution would flood `engine_event` with no signal value.
- **No `callGateAction`.** Read paths are not gated (ADR-0099).
- **No mobile-specific resolver branch.** Mobile proxies through the same BFF route — server-side resolver is already mobile-compatible.
- **No changes to `services/stage-engine/`.** Stage-engine receives `mission_id` via `engine_state.context` after this sortie ships. Stage-engine internals are not modified.
- **No changes to `packages/telemetry/src/registry.ts`.**
- **No changes to `docs/decisions/`.** (Concurrent T4 sortie owns that file; this sortie is read-only on ADRs.)
- **No `publish_guide` work.** Separate phase 3 sub-sortie.
- **No N-C worker.** Out-of-scope per CLAUDE.md §In-Scope / Phase 3 note #3.

---

## Files to be Created vs Modified

| Action | Path |
|--------|------|
| CREATE | `packages/ai/src/lib/mission-resolution.ts` (replace stub — stub committed in sortie preceding this plan) |
| CREATE | `packages/ai/src/lib/__tests__/mission-resolution.test.ts` |
| CREATE or MODIFY | `apps/e2e/tests/journey-capability-run-guided.spec.ts` |
| CREATE | `docs/journeys/JOURNEY-mission-resolution-layer.md` |
| CREATE | `docs/HANDOFF-mission-resolution-layer.md` |
| MODIFY | `packages/ai/src/capabilities/journey/tools.ts` (`runGuidedTool.execute()` body only — ~20 lines added) |
| MODIFY | `apps/web/src/app/api/journey/guided/start/route.ts` (add pre-resolution guard before `runGuidedTool` call — ~15 lines) |

**No new packages. No new migrations. No new ADRs.**

---

## Recommended Implementer Agent

`general-purpose` (Sonnet). The build is straightforward: two SELECTs, a discriminated union, wiring at three call sites. No new architecture decisions needed — all binding ADRs already accepted. A `botsson-harness-builder` or `smartout-agent-dev` agent is not needed; the resolver is a library utility, not a capability.

---

## Post-Implementation

- [ ] Move this file to `docs/plans/completed/` when done.
- [ ] Update `docs/plans/CAMPAIGN-journey-engine.md §Phase 3` status row for item #2.
- [ ] Register in `docs/INDEX.md` under Plans.

---

> Phase 2.5 grep (CLAUDE.md Invariant 9): `grep "journey\." packages/telemetry/src/registry.ts` returns 5 events (run_started, step_reached, completed, stuck, run_failed). No new `journey.*` event added by this plan. Registry grep: CLEAN.
