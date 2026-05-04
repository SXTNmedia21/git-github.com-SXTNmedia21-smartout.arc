---
title: "Phase 2 Capability Audit — Journey Engine (post publish-mission-body merge)"
status: complete
created: 2026-04-27
updated: 2026-04-27
module: journey-engine
tags: [audit, phase-2, remediation, capability, falsifiable]
---

# Phase 2 Capability Audit — 2026-04-27

> Worktree: `~/dev/smartout.ai-journey-engine`
> Branch: `campaign/journey-engine` @ `0092c78e`
> Audit triggered post `e5326401` (publish-mission-body merge) per the 2026-04-23 REMEDIATION AMENDMENT.
> Audit method: code-trace + grep against the working tree. **No Supabase MCP tools available in this session, so G2 is verified via migration code-trace, NOT against the persistent preview DB.**

## Executive verdict

**Phase 2 gates: G1 = PASS · G2 = FAIL · G3 = PARTIAL · Phase 3 unblocked: NO.**

Phase 2's stated exit gate is "all 4 capabilities call `callGateAction`; seed-compile migration green on Supabase preview; artefact-asserting tests green." All four capabilities call the gate (G1 PASS). The seed-compile migration (G2) was never written — only 2 journeys (`signup_onboarding`, `workspace_setup`) hold an `engine_process_id`. G3 has exactly one artefact-asserting E2E (`publish_mission`) — `run_dev`, `run_guided`, `publish_guide` lack one entirely; `journey-engine.spec.ts` J1–J11 are page-load smoke, not artefact assertions. C2 finds no phantom capabilities in production code, but the unit test file `journey.capability.test.ts:132–152` was not updated when `publish_mission` shipped a real body — so `pnpm vitest` will hit the rubber-stamp crash that commit `cb400fe9` documents as "1 expected — Phase E cleanup." That remains uncleared. C4 (stuck-detector cutover) is stuck at L-0098 step A: the legacy `guardian_signal` cron path still runs and **no capability tool schedules the event-driven path**, so dual-write is not actually happening — the new path is dead code on the capability side.

## Per-gate report

### G1 — `callGateAction` before mutation in all 4 capabilities

**Claim (campaign Phase 2 amendment):** "Add `callGateAction` to `run_dev`, `publish_mission`, `publish_guide` (ADR-0099 / Invariant 13)." `run_guided` was already gated.

**Method:** Read full `packages/ai/src/capabilities/journey/tools.ts` (798 lines). For each capability, locate the first `supabase.from(...).insert/update/delete(...)` after `execute()` entry, then check whether `callGateAction(...)` precedes it.

**Evidence per capability:**

| Capability | gate call line | first mutation line | gate before mutation? |
|---|---|---|---|
| `run_dev` | `tools.ts:114` | `tools.ts:191` (`engine_state.insert`) | YES |
| `publish_mission` | `tools.ts:432` | `tools.ts:458` (`engine_missions.insert`) | YES |
| `publish_guide` | n/a — neutered | n/a — neutered | N/A (returns `{ok:false, error:"not_implemented"}` at `tools.ts:575–580`, no mutation, no emit) |
| `run_guided` | `tools.ts:631` | `tools.ts:710` (`engine_state.insert`) | YES |

`gate.ts:49–106` is the shared wrapper. It fails CLOSED on RPC error (`gate.ts:76–88`) and returns `allow:false` — the four call-sites all branch on `!gate.allow` and return `capability_disabled` / `authority_denied` before any DB write.

The BFF route `apps/web/src/app/api/journey/guided/start/route.ts:161–174` ALSO calls `gateAction()` at the route boundary. That is dual-gating per Invariant 13 — the route gates first, the capability gates again. Acceptable; not a violation.

**Verdict: PASS.** Three of four capabilities call `callGateAction` before any mutation; the fourth (`publish_guide`) is neutered and intentionally has nothing to gate.

### G2 — Seed-compile migration populates `journey.engine_process_id` for ≥4 journeys

**Claim (campaign Phase 2 amendment):** "Seed-compile migration: populate `journey.engine_process_id` for 2+ additional journeys (currently only `signup_onboarding` + `workspace_setup` per supervisor Layer 2 trace)."

**Method:** `grep -rn "engine_process_id" supabase/migrations/`. Read `20260308194433_seed_journey_engine_process_links.sql` (the only migration that sets this column). Supabase MCP tools to verify against persistent preview DB (`cibmhhgsrdmpnmcikalu`) are NOT available in this session — verdict relies on migration code-trace alone.

**Evidence:**

```sql
-- supabase/migrations/20260308194433_seed_journey_engine_process_links.sql
UPDATE journey
SET engine_process_id = 'signup_onboarding', ...
WHERE slug = 'sign-up-create-workspace';

UPDATE journey
SET engine_process_id = 'workspace_setup', ...
WHERE slug = 'configure-organization-setup-wizard';
```

That is the only `engine_process_id` write to the `journey` table in the entire migrations tree. No additional seed-compile migration exists. `20260406150000_journey_03_poc_seed.sql` seeds an `engine_process` row (`journey_03_check_shifts`) but does NOT link it to a `journey` row.

**Verdict: FAIL.** Only 2 journeys are linked. Phase 2 amendment requires "2+ additional" → minimum 4 — the gate is unsatisfied. Until a Supabase MCP read confirms or denies, the migration code-trace is conclusive: there is nothing to populate the preview DB with even if it were re-applied.

### G3 — E2E tests assert downstream rows / artefacts (not return shape) per L-0125

**Claim (campaign Phase 2 amendment):** "E2E tests in `apps/e2e/tests/journey-capability-*.spec.ts` assert downstream rows (per L-0118 spirit + L-0125)."

**Method:** `ls apps/e2e/tests/journey-capability-*`. Read each spec (only one exists). For each test in `journey-engine.spec.ts`, check for `supabase.from(...).select(...)` against canonical artefact tables (`engine_state`, `engine_event`, `activity_trail`, `engine_missions`, `engine_stages`).

**Evidence — `journey-capability-*.spec.ts`:**

Files present: `journey-capability-publish-mission.spec.ts` only. Three other capabilities have no `journey-capability-*` spec.

| Spec file | Capability | Verdict |
|---|---|---|
| `journey-capability-publish-mission.spec.ts:210–303` | `publish_mission` | **ARTEFACT-asserting.** Selects `engine_missions` (filtered by workspace + system_prompt + since), asserts row count, mode, system_prompt, is_active=false. Selects `engine_stages` (filtered by mission_id), asserts goal/instructions/success_criteria derivation per ADR-0194 §rule 2. Selects `engine_event` (event_type='journey.run_started', since), asserts row exists. Selects `activity_trail` (event='journey run_started', since), asserts row exists with non-null actor_id matching ADMIN_PROFILE_ID. The negative test (line 306–399) asserts ZERO `engine_missions` row + ZERO new `engine_stages` rows + ZERO `engine_event` row + ZERO `activity_trail` row when validation fails. |
| (no file) | `run_dev` | **MISSING.** No `journey-capability-run-dev*.spec.ts`. |
| (no file) | `run_guided` | **MISSING.** No `journey-capability-run-guided*.spec.ts`. |
| (no file) | `publish_guide` | **MISSING.** Justified — body is neutered; only relevant test is "no emit on neutered path" which is in `journey.capability.test.ts:154–174` (unit, NOT E2E). |

**Evidence — `journey-engine.spec.ts` per-test verdict:**

| Test | Asserts | Verdict |
|---|---|---|
| J1 `create journey version lands in draft` | URL navigation only | RETURN-SHAPE-only |
| J2 `edit version route loads for a seeded draft` | URL only | RETURN-SHAPE-only |
| J3 `status transition draft → ready_test surface exists` | URL only | RETURN-SHAPE-only |
| J4 `test-run page renders for a seeded draft` | URL only | RETURN-SHAPE-only |
| J6 `rejects unauthenticated request with 401` | HTTP status | RETURN-SHAPE-only |
| J6 `rejects spoofed workspace_id in body` | HTTP status set | RETURN-SHAPE-only |
| J7 `engine_event 'journey stuck' transitions state machine to stuck` | URL only — comment at line 286: "Injected event below would fire the subscription; assertions TBD" | RETURN-SHAPE-only (comment admits it) |
| J8 `engine_event 'journey completed' transitions state machine to completed` | URL only | RETURN-SHAPE-only |
| J9 `authenticated invocation returns 2xx (legacy cron mode smoke)` | HTTP status | RETURN-SHAPE-only |
| J10 `anon key is rejected with 401` | HTTP status | RETURN-SHAPE-only |
| J11 `disabled capability returns 403 capability_disabled` | HTTP status + body.error string | RETURN-SHAPE-only (testing gate plumbing, not artefact) |

**`grep -c "supabase.from(" apps/e2e/tests/journey-engine.spec.ts` = 0.** Zero artefact assertions in 11 tests.

**Verdict: PARTIAL.** One of four capabilities (`publish_mission`) has true L-0125-spirit artefact assertions. The Phase 2 gate, which says "E2E tests in `apps/e2e/tests/journey-capability-*.spec.ts` assert downstream rows," is satisfied for the only file that exists, but the gate as drafted assumes one spec per capability. Three are missing. `journey-engine.spec.ts` is L-0125 violation territory: 11 RETURN-SHAPE-only tests live there under journey-engine coverage, including J7/J8 with a self-admitted "TBD" inline comment.

### C1 — Invariant 9 (every emit is registered)

**Claim:** Invariant 9 — "Every new `emit('journey.*')` has a matching entry in `packages/telemetry/src/registry.ts` in the same commit. CI grep gate."

**Method:** `grep -rn 'emit({' packages/ai/src/capabilities/journey/ supabase/functions/journey-stuck-detector/` then map each emit `event:` value to a registry key.

**Evidence — emit call sites:**

| File:line | Event name | Registered? |
|---|---|---|
| `packages/ai/src/capabilities/journey/tools.ts:253` | `"journey run_started"` | YES — `registry.ts:7913` |
| `packages/ai/src/capabilities/journey/tools.ts:273` | `"journey step_reached"` | YES — `registry.ts:7917` |
| `packages/ai/src/capabilities/journey/tools.ts:514` | `"journey run_started"` | YES — `registry.ts:7913` |
| `packages/ai/src/capabilities/journey/tools.ts:771` | `"journey run_started"` | YES — `registry.ts:7913` |
| `apps/web/src/app/api/journey/guided/start/route.ts:195` | `"journey run_failed"` | YES — `registry.ts:7929` |
| `apps/web/src/app/api/journey/guided/start/route.ts:225` | `"journey run_failed"` | YES — `registry.ts:7929` |
| `supabase/functions/journey-stuck-detector/index.ts:393–410` (direct `activity_trail` insert, not `emit()` wrapper) | `"journey stuck"` | YES — `registry.ts:7925` |

**Caveat:** the stuck-detector at `index.ts:438` writes a console.log JSON object with `event: "journey.stuck"` (dot form). This is not an emit destination — it's a structured log. The actual `activity_trail` insert at line 394 uses the registered space form `"journey stuck"`. No phantom emit.

**Verdict: PASS.** Every emit-shaped call resolves to a registered key.

### C2 — Invariant 11 (no phantom capabilities)

**Claim:** Invariant 11 — "A capability tool that emits `run_started` MUST produce its declared domain artefact in the same `execute()` call, OR return `{ok:false, error:'not_implemented'}` WITHOUT emitting `run_started`."

**Method:** Walk each capability `execute()` body and check ordering: emit must follow a successful `.insert(...)` within 40 lines.

**Evidence per capability (production tools.ts):**

- `run_dev` (lines 92–297): `engine_state.insert` at line 191. `engine_state_step.insert` at line 236. First emit `run_started` at line 253. **Insert precedes emit** by ~62 lines for the state insert and ~17 lines for the step insert. The 40-line bound is breached vs. the state insert but satisfied vs. the step insert. The Journey Guardian grep contract checks "any insert within 40 lines" — it is satisfied. **Non-phantom.**
- `publish_mission` (lines 353–540): `engine_missions.insert` at line 458. `engine_stages.insert` at line 494. First emit `run_started` at line 514. **Insert precedes emit** by ~20 lines (stages → emit). **Non-phantom.**
- `publish_guide` (lines 561–582): No insert. No emit. Returns `{ok:false, error:"not_implemented"}` per Invariant 11. **Non-phantom (compliant deferred path).**
- `run_guided` (lines 609–796): `engine_state.insert` at line 710. `engine_state_step.insert` at line 758. First emit `run_started` at line 771. **Insert precedes emit** by ~13 lines. **Non-phantom.**

**Test-layer regression (Phase 1 unaddressed):** `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:121–152` is a `describe("publish_* neutered (Phase 0 remediation — ADR-0196 Invariant 11)")` block that asserts `publish_mission` returns `{ok:false, error:"not_implemented"}` and emit is not called. Commit `cb400fe9` (the Phase B body landing) explicitly notes "1 expected rubber-stamp crash — Phase E cleanup." Phase 1 amendment line said "Update `journey.capability.test.ts:118-147` — delete or `.skip` with FIXME per L-0125." That has not been done — the file is unchanged since `d0258817` (Phase 0 honesty), but the body it asserts against was rewritten at `cb400fe9`. Running `pnpm vitest run packages/ai/.../journey.capability.test.ts` will throw on the publish_mission test because the real body now reads `versionRow` from a `{}` stub Supabase client.

**Verdict: PASS for production code; FAIL for the unit test layer.** No phantom capabilities ship. But the Phase 1 cleanup of the test that pretended `publish_mission` was still neutered was not executed when `cb400fe9` shipped, so the test bench is broken in a way Phase E was supposed to clean up.

### C3 — Invariant 12 (falsifiable status claims)

**Method:** Pick 5 random "✅ green" Trust-Gate Unblock rows from `docs/plans/CAMPAIGN-journey-engine.md` and run a verification grep / read for each.

**Evidence:**

| Unblock # | Claim | Verification | Pass? |
|---|---|---|---|
| 1 | "Telemetry registry registered 5 events + 4 destinations" | `grep -n '"journey ' packages/telemetry/src/registry.ts` shows 5 keys at lines 7913, 7917, 7921, 7925, 7929. Each maps to `["posthog", "logger", "activity_trail", "engine_event"]`. | PASS |
| 2 | "`journey_version_status` enum 0a/0b/0c migration" | `ls supabase/migrations/20260516000{1,2,3}00_*` shows `_0a_widen.sql`, `_0b_enum.sql`, `_0c_tighten.sql`. | PASS |
| 3 | "C4 authority seed migration (4 rows)" | `grep "INSERT INTO engine_authority_config" supabase/migrations/20260516000400_journey_authority_seed.sql` and `tools.ts:127–130` confirms 4 entries: run_dev/publish_mission/publish_guide=suggest, run_guided=autonomous. | PASS |
| 4 | "Capability skeletons (4) with correct authority defaults" | `tools.ts` exports `runDevTool, publishMissionTool, publishGuideTool, runGuidedTool` (line 798: `allTools = [...]` 4 entries). `index.ts:51–64` constructs `journeyCapability` with these. | PASS — but the claim "skeletons" is now stale: `publish_mission` ships a real body (cb400fe9), `run_dev` ships a real queue body, `run_guided` ships a real runtime body. Only `publish_guide` is still skeletonised. The Trust-Gate Unblock label "skeletons" is wrong-tense but the 4-tool contract holds. |
| 5 | "`packages/journey-ir` created; zero `packages/ai/src/journey` refs" | `ls packages/journey-ir/src/` shows `compile.ts, index.ts, schema.ts, types.test.ts, types.ts, validate.ts`. `grep -rn "packages/ai/src/journey" apps packages supabase` = zero hits. | PASS |

**Verdict: PASS.** All five spot-checked Trust-Gate Unblock claims are falsifiably true today. No headline-row fabrication detected.

**Note on the campaign doc REMEDIATION header:** the line "M1–M3.5 'all green' claims FALSE" is itself a true historical claim — the post-Phase-0 state has not re-asserted "all green" without code-trace, so this audit does not retract it.

### C4 — Stuck-detector cutover state

**Claim (campaign §M5.3 footnote): "stopped at step 1 — dual-write."**

**Method:** Read `supabase/functions/journey-stuck-detector/index.ts` end-to-end. Identify the legacy path and the event-driven path. Verify that BOTH paths are actually being driven by upstream callers — dual-write requires both writes to actually happen in production.

**Evidence:**

- Legacy cron path (lines 473–540): scans `engine_state` for `process_id='journey_03_check_shifts'` rows stuck on step 2 > 24h, inserts `guardian_signal` rows. Driven by the hourly cron entry in `supabase/config.toml` (cron mode = empty body POST). **Active.**
- Event-driven path (lines 278–471): expects POST `{run_id, step_key, workspace_id, scheduled_for?, actor_id?}`, emits `journey stuck` to `activity_trail` + `engine_event`. **Inactive.**
- **No capability tool schedules the event-driven path.** `grep -n "journey-stuck-detector\|engine_delayed_trigger" packages/ai/src/capabilities/journey/` returns zero hits. The header docstring at lines 14–19 promises "the `journey.run_dev` and `journey.run_guided` capability tools schedule a delayed invocation … using the step's `timeoutMs`" but this is unimplemented. `run_dev` (tools.ts:92–297) inserts `engine_state_step` and emits but never schedules a delayed trigger. `run_guided` (tools.ts:609–796) does the same.

Cannot SELECT from `engine_event WHERE event_name='journey.stuck'` against the persistent preview because Supabase MCP is not exposed in this session — but it does not matter: there is no caller, so the path cannot be producing rows in any environment except the cron's `guardian_signal` mode.

**Verdict: FAIL — dual-write is a contract on paper only.** L-0098 step A is not actually running. The new path will return 404 if directly invoked because it cannot find scheduled `engine_state_step` rows that the capability never marked with a timeout. The legacy `guardian_signal` path is the only emission shape any caller produces.

## Gap list — fixes needed before Phase 3

1. **Write seed-compile migration linking ≥2 additional journeys.**
   File: new `supabase/migrations/<TS>_seed_journey_engine_process_links_phase2.sql`.
   Lines: ~20.
   Fix: `UPDATE journey SET engine_process_id = '<process_slug>' WHERE slug IN (...)` for at least 2 more journeys. Candidate processes already seeded: `journey_03_check_shifts` (`20260406150000`), `Botsson_session` (`20260311023524`), `daily_close` (`20260304300000`), `reconciliation_close` (`20260328120200`). After landing, verify against persistent preview by selecting `count(*) FROM journey WHERE engine_process_id IS NOT NULL` ≥ 4.

2. **Add `journey-capability-run-dev.spec.ts`.**
   File: new `apps/e2e/tests/journey-capability-run-dev.spec.ts`.
   Lines: ~250 mirroring `journey-capability-publish-mission.spec.ts`.
   Fix: Trigger the capability via the platform-admin run page or a dedicated Server Action. Assert `engine_state` row inserted with `status='queued'`, `engine_state_step` rows = `ir.steps.length`, `activity_trail` `journey run_started` row, `engine_event` `journey.run_started` row. Negative test: corrupt IR → no rows.

3. **Add `journey-capability-run-guided.spec.ts`.**
   File: new `apps/e2e/tests/journey-capability-run-guided.spec.ts`.
   Lines: ~250.
   Fix: Drive via BFF route `POST /api/journey/guided/start`. Assert `engine_state` row inserted with `status='running'`, step rows, both telemetry destinations. Negative test: `journey_not_compiled` (engine_process_id NULL) → no rows.

4. **Skip-or-update broken unit test on `publish_mission`.**
   File: `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:121–152`.
   Lines: 32 to delete or `.skip(true, "FIXME L-0125: covered by E2E artefact assertion in journey-capability-publish-mission.spec.ts")`.
   Fix: Remove the `publish_mission returns not_implemented` assertion. Keep the `publish_guide returns not_implemented` assertion (still valid). Optionally add a happy-path unit test that mocks the Supabase client through to the inserts and asserts emit-after-insert ordering.

5. **Wire stuck-detector event-driven path from capability tools.**
   Files: `packages/ai/src/capabilities/journey/tools.ts:236–246` (run_dev step insert) and `tools.ts:758–768` (run_guided step insert).
   Lines: ~30 each.
   Fix: After inserting `engine_state_step` rows, for any step with `timeoutMs > 0`, insert an `engine_delayed_trigger` row scheduling a POST to `journey-stuck-detector` with `{run_id, step_key, workspace_id, scheduled_for}`. This closes L-0098 step A — dual-write actually starts. Step B (flip readers) and step C (delete legacy) follow per ADR-0174-style cutover plan.

6. **Decide whether `publish_guide` artefact-test is required for Phase 2 close.**
   Decision input, not a code change.
   Fix: Either (a) declare `publish_guide` outside Phase 2 scope (it's neutered until Phase 3 storage decision) and amend Phase 2 exit gate text, or (b) require a "neutered tool returns `not_implemented` + emits zero telemetry" E2E that drives via UI. Recommendation: (a), with explicit note in campaign doc that `publish_guide` E2E moves to Phase 3 with the body.

7. **Promote J7/J8 from URL-smoke to artefact assertions.**
   File: `apps/e2e/tests/journey-engine.spec.ts:281–300`.
   Lines: ~40 net change.
   Fix: After page navigation, inject the `engine_event` row server-side (via service-role helper), wait for the Realtime subscription to fire, then assert the Fjernkontroll DOM state label changes (`Klar` → `Stuck` / `Fullført`). Comment at line 286 already admits "assertions TBD" — close the TBD.

## Falsifiable status proposal — Trust-Gate Unblocks post-audit

Recommend adding a new **Phase 2 status row** below the existing 7 unblocks, since the original 7 are M1/M2 closures and Phase 2 is a remediation amendment:

| # | Unblock | Verification | Status |
|---|---|---|---|
| P2.1 | All 4 journey capabilities call `callGateAction` before mutation | `grep -B5 'supabase.from("engine_state\|"engine_missions"' tools.ts` shows `callGateAction` precedes every insert. | ✅ green |
| P2.2 | Seed-compile migration populates ≥4 journeys with `engine_process_id` | `grep "engine_process_id" supabase/migrations/*.sql \| wc -l` shows row count; SQL `SELECT count(*) FROM journey WHERE engine_process_id IS NOT NULL` ≥ 4 against persistent preview. | ❌ red — only 2 |
| P2.3 | E2E artefact assertions for all 4 capabilities (or 3 + neutered exception) | `ls apps/e2e/tests/journey-capability-*.spec.ts` shows 3 files (publish_mission, run_dev, run_guided), and each contains a `supabase.from("engine_*").select(...)` assertion in green-path. | ⚠️ partial — 1/3 |
| P2.4 | Unit test bench passes on canonical body | `pnpm vitest run packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts` exits 0 with no rubber-stamp crashes. | ❌ red — 1 expected crash unaddressed |
| P2.5 | Stuck-detector dual-write actively producing `journey stuck` events | `grep "journey-stuck-detector" packages/ai/src/capabilities/journey/tools.ts` returns ≥2 hits (run_dev + run_guided schedule the trigger). | ❌ red — zero callers |

## Non-finding — what is verifiably fine

- **Telemetry registry contract:** all 5 runtime events present with all 4 destinations each (`registry.ts:7913–7932`).
- **ADR-0134 guard before any emit / DB read:** every capability rejects empty `workspaceId`/`profileId` first (`tools.ts:101–106, 365–370, 567–573, 618–623`).
- **`packages/ai/src/journey` migration:** verified zero references in `apps/`, `packages/`, `supabase/` outside markdown plan files. ADR-0171 closure holds.
- **No `ALTER TYPE journey_status ADD VALUE`:** verified zero occurrences in `supabase/migrations/`. ADR-0172 closure holds.
- **No `protocolToJourneyIR` adapter or `ProtocolSource` references:** verified zero occurrences. ADR-0174 + ADR-0178 closure holds.
- **Authority seed migration shape:** `20260516000400_journey_authority_seed.sql` seeds the deliberate 3× `suggest` + 1× `autonomous` per workspace per ADR-0176.
- **BFF dual-gate:** `apps/web/src/app/api/journey/guided/start/route.ts:161–174` calls `gateAction()` at the route boundary before invoking the capability (which calls `callGateAction()` again). Dual-gate per Invariant 13.
- **No phantom `run_started` emits in production code:** all 4 emit sites have a preceding insert within 40 lines of the surrounding mutation block.
- **Stuck-detector `activity_trail` event name:** uses the registered space form `"journey stuck"` (`index.ts:394`). The `journey.stuck` dot form at line 438 is structured logging, not telemetry.
- **Test seeds exist for journey:** `apps/e2e/helpers/journey-seed.ts` exports `seedParentJourney`, `seedDraftJourneyVersion`, `seedPublishedJourneyVersion`, `seedActiveRun`, `seedDisabledAuthority`, `restoreAuthority` — sufficient for the gap list items #2 and #3 (run_dev and run_guided E2E specs).
