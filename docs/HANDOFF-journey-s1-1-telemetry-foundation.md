---
title: "Handoff — S1.1 Telemetry Foundation (Gate A extended)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [handoff, s1-1, m1, telemetry, journey-engine]
---

# HANDOFF — S1.1 Telemetry Foundation

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.1 (extended scope per Gate A verdict)
> **Branch:** `feat/journey-engine-journey-s1-1-telemetry-foundation` (based on `campaign/journey-engine`)
> **Brief:** `docs/superpowers/plans/2026-04-22-s1-1-telemetry-foundation.md`

## Summary

S1.1 landed the telemetry floor for the Journey Engine. It closes the three structural pipeline gaps Gate A's code-trace surfaced, then adds the five canonical journey events (ADR-0175) with four-destination routing. No `emit()` call sites exist yet — those arrive in S1.4, so this sub-sortie is registry-and-plumbing-only.

### What changed

**Pipeline normalization (Part A):**

- `packages/telemetry/src/providers/activity-trail.ts`
  - New exported pure helper `resolveEntityRef()` — accepts both nested `props.entity` (legacy) AND flat `props.entity_type/_id/_label` (journey events, ADR-0175). Nested wins on conflict. Returns `null` only when neither shape resolves.
  - `writeActivityTrail()` rewired to the helper. Same warn-and-return behaviour when no entity resolves.
- `packages/telemetry/src/registry.ts`
  - Added `journey_run` + `journey_version` to `EntityType` union.
  - Added `journey` to `EventCategory` union.
- `packages/ai/src/capabilities/types.ts`
  - Header comment above `AuthorityLevel` documents that levels are Node-side advisory; `gate_action` RPC only enforces `min_role` + `requires_four_eyes`.
- `docs/superpowers/plans/2026-04-21-journey-engine-orchestration.md`
  - §2.1 footnote: registry-key naming is space form; dot form is wire format.
  - §2.3 note: `AuthorityLevel` semantics duplicated here for consumers of ADR-0176.

**Journey events (Part B):**

- `packages/telemetry/src/registry.ts`
  - 5 new interfaces: `JourneyRunStarted`, `JourneyStepReached`, `JourneyCompleted`, `JourneyStuck`, `JourneyRunFailed` — FLAT + nested `entity` block.
  - 2 new support types: `JourneyCapability` (4 capabilities per ADR-0173), `JourneySurface` (dev | admin | runtime_web | runtime_mobile).
  - All 5 added to `SmartoutEvent` union.
  - All 5 registered in `EVENT_ROUTING` → `["posthog", "logger", "activity_trail", "engine_event"]`, category `"journey"`.
- `packages/telemetry/src/__tests__/registry.journey.test.ts` (30 tests)
  - Destination-coverage: each event routes to exactly the 4 required destinations.
  - Category assertion: all 5 categorised as `"journey"`.
  - No-dot assertion: registry keys contain no `.`.
  - Compile-time + runtime: each interface has non-optional `actor_id` + `workspace_id` on `properties` (ADR-0134).
  - Each interface carries nested `entity` block with `entity_type: "journey_run"`.
- `packages/telemetry/src/__tests__/activity-trail.flat.test.ts` (8 tests)
  - Nested shape resolves; flat shape resolves; nested wins when both present; half-flat rejected; missing shapes → null; no warn on success.

**Docs:**

- `docs/decisions/0175-journey-telemetry-contract.md` — appended S1.1 clarification section with the three pipeline realities + naming convention decision. Base ADR body untouched (still `proposed`).
- `docs/decisions/0000-decision-log.md` — new "ADR-0175 clarification" row (status `addendum`, date 2026-04-22). Frontmatter `updated:` bumped.
- `docs/journeys/JOURNEY-journey-s1-1-telemetry-foundation.md` — operator journey (dev verifies 4 destinations receive a journey event), error path (phantom event), forcing-function journey (CI catches missing test entry).
- `docs/HANDOFF-journey-s1-1-telemetry-foundation.md` — this file.

### What did NOT change (out-of-scope guards held)

- No file inside `packages/ai/src/capabilities/journey/` — empty, remains S1.4 territory.
- `CapabilityName` union in `packages/ai/src/capabilities/types.ts` untouched.
- `toDotNotation()` in `engine-event.ts` untouched — it is the naming-convention seam.
- No migrations. No SQL files committed.
- No new imports from `packages/ai/src/journey`. Legacy pair (`packages/ai/src/journey/compile.ts` + `apps/web/src/app/platform-admin/journeys/actions/compile.ts` via `@smartout/ai/journey/compile`) unchanged.
- No touch to `engine_authority_config` — that's S1.3.

## Decisions made

| Decision | Rationale | Trace |
|---|---|---|
| Registry keys use space form, ADR-0175 dot form is wire format | 459 existing events use space form. `toDotNotation()` is the single conversion point. Changing convention would break engine-dispatch for existing events. | ADR-0175 clarification; orchestration plan §2.1 footnote |
| Journey payloads carry FLAT + nested `entity` block (belt-and-braces) | Brief §B.1 requires flat per ADR-0175, but nested is trivially cheap + guarantees `activity_trail` correctness even if a future regression narrows `resolveEntityRef()`. Nested wins on conflict in the resolver. | registry.ts `JourneyRunStarted.properties.entity` etc.; `resolveEntityRef()` |
| `AuthorityLevel` documented as Node-side advisory (not DB-enforced) | Code-trace against `20260506120000_gate_action_accept_entity_id.sql:45-161` shows RPC enforces only `min_role` downgrade + `requires_four_eyes`. Level semantics live in `tool-selector.ts`. Undocumented — ADR-0176 readers would likely misread. | `packages/ai/src/capabilities/types.ts` header comment; ADR-0175 clarification; orchestration plan §2.3 |
| New `EventCategory = "journey"` | No existing category fits. `ops_intelligence` + `operations` would conflate runtime mission state with ops telemetry. Clean category preserves downstream dashboards. | registry.ts L42 |
| Test file covers 30 assertions not Zod schema | Brief §B.4 defers Zod-in-dev to S1.4. Interfaces + compile-time literal assignment + runtime expect() give equivalent confidence until emit call sites exist. | registry.journey.test.ts header |
| Pure `resolveEntityRef()` helper exported from activity-trail | Lets the flat-payload test run hermetically (no Supabase mock needed). Tests the exact logic that decides nested-vs-flat without the IO path. | activity-trail.ts; activity-trail.flat.test.ts |

## Learnings

1. **CLAUDE.md grep gate `packages/ai/src/journey` literal-matches the filesystem path, not the package-export path.** The grandfathered consumer (`apps/web/src/app/platform-admin/journeys/actions/compile.ts`) imports via `@smartout/ai/journey/compile` package export — that string doesn't contain `packages/ai/src/journey`. The grep effectively tests "no one imports by raw filesystem path." Fine as-is, but a future M2 cleanup should also grep the `@smartout/ai/journey` package export path. Surfacing here so the M2 migration doesn't get false-green.
2. **Pre-commit lint-staged will reformat test-heredoc type parameters.** The hook split a long `test.each<[...]>` generic onto multiple lines. Output still valid, tests pass, no rollback needed. Worth noting because the ScheduleWakeup rule about "re-verify after formatter" applies — I re-ran the tests after commit and confirmed.
3. **`AuthorityLevel`-doc for §2.3 placement.** Brief said "orchestration plan §2.3" for the AuthorityLevel note. §2.3 is the `packages/journey-ir` section, not the capabilities section (§2.4). I placed the note at top of §2.3 per brief wording, but the more natural home may be §2.4 when ADR-0176 implementers read it. Safe to leave; flagging for the orchestrator to relocate if preferred.
4. **`BaseEvent.workspace_id` is `string | null` project-wide.** Journey events redeclare `workspace_id: string` on `properties` (non-null) to match ADR-0134. The `BaseEvent` field stays nullable to preserve compatibility with existing events. Non-null enforcement happens at the emit-site layer (S1.4 capability wiring), not at the registry. Noted in the registry comment block.
5. **No `vi.mock` pattern exists in the telemetry package.** Existing tests avoid Supabase mocking by asserting on registry shape only. I kept to that convention by extracting `resolveEntityRef()` as a pure helper — hermetic, no fixtures needed. If future tests need to assert the full `writeActivityTrail` path, a thin wrapper around `@supabase/supabase-js` createClient will be required.

## Next steps

- **S1.2 — enum lifecycle** (`journey_version_status` via 0a/0b/0c). This sub-sortie adds a column used by `journey.publish_mission` + `journey.publish_guide` capabilities in S1.4. No dependency on S1.1 code; can dispatch immediately.
- **S1.3 — authority seed** (`engine_authority_config` rows for 4 capabilities, migration). No dependency on S1.1 code; can dispatch in parallel with S1.2.
- **S1.4 — capability skeletons** (`packages/ai/src/capabilities/journey/*`). DEPENDS on S1.1 (emit events), S1.2 (enum), S1.3 (authority rows). Journey-events are now safely callable from S1.4 capabilities without phantom drops.
- **S1.4 deferred work** — Zod-in-dev payload validation (brief §B.4) lands here, gated on emit call-site count ≥ 1.
- **M6 close-feature gate** — grep rules should add `@smartout/ai/journey` in addition to `packages/ai/src/journey` (see Learning 1). Tracking as a follow-up for the Journey Guardian CI workflow (§2.8 `.github/workflows/journey-guardian.yml`).

## Known issues / debt

- None blocking. The only operational debt is the `BaseEvent.workspace_id` nullability delta from ADR-0134 — the registry compiles fine but downstream emit sites must enforce non-null via `getProfileContext()` at call time (S1.4 responsibility).

## Verification — 6 grep gates + typecheck + test

### 1. `pnpm turbo typecheck`

```
 Tasks:    33 successful, 33 total
Cached:    33 cached, 33 total
  Time:    766ms >>> FULL TURBO
```

### 2. `pnpm turbo test --filter=@smartout/telemetry` (last 15 lines)

```
@smartout/telemetry:test:  ✓ src/registry.test.ts (11 tests) 5ms
@smartout/telemetry:test:  ✓ src/__tests__/billing-fase3a.spec.ts (13 tests) 8ms
@smartout/telemetry:test:  ✓ src/__tests__/error-events.test.ts (17 tests) 12ms
@smartout/telemetry:test:  ✓ src/__tests__/registry.journey.test.ts (30 tests) 15ms
@smartout/telemetry:test:  ✓ src/__tests__/billing-emit.spec.ts (148 tests | 1 skipped) 28ms
@smartout/telemetry:test:  ✓ src/__tests__/engine-event-contract.test.ts (6 tests) 4ms
@smartout/telemetry:test:  ✓ src/__tests__/activity-trail.flat.test.ts (8 tests) 5ms
@smartout/telemetry:test:  ✓ src/__tests__/registry.governance.spec.ts (11 tests) 4ms
@smartout/telemetry:test:  ✓ dist/registry.test.js (11 tests) 5ms
@smartout/telemetry:test:  ✓ src/__tests__/shift-punched-out-routing.test.ts (4 tests) 4ms
@smartout/telemetry:test:  ✓ src/__tests__/billing-fase3b.spec.ts (4 tests) 4ms
@smartout/telemetry:test: Test Files  11 passed (11)
@smartout/telemetry:test:      Tests  262 passed | 1 todo (263)
```

### 3. Grep — 5 journey event keys in registry.ts (≥10 expected)

```
$ grep -c "journey run_started\|journey step_reached\|journey completed\|journey stuck\|journey run_failed" packages/telemetry/src/registry.ts
11
```

### 4. Grep — `journey_run` / `journey_version` in registry.ts (inside EntityType + nested entity blocks)

```
$ grep -n "journey_run\|journey_version" packages/telemetry/src/registry.ts | head -20
142:  | "journey_run"
143:  | "journey_version";
4739:    journey_version_id: string;
4746:      entity_type: "journey_run";
4762:      entity_type: "journey_run";
4778:      entity_type: "journey_run";
4794:      entity_type: "journey_run";
4811:      entity_type: "journey_run";
```

Lines 142–143 are the `EntityType` union additions. Subsequent lines are the nested entity blocks on each of the 5 interfaces. Gate satisfied.

### 5. Grep — no NEW `packages/ai/src/journey` references

```
$ grep -R "packages/ai/src/journey" apps packages scripts 2>/dev/null | grep -v node_modules
(no output)
```

Zero filesystem-path references. Grandfathered legacy pair uses `@smartout/ai/journey/compile` package export (per Learning 1); see:
```
$ grep -R "packages/ai/src/journey\|@smartout/ai/journey" apps packages scripts 2>/dev/null | grep -v node_modules
apps/web/src/app/platform-admin/journeys/actions/compile.ts:} from "@smartout/ai/journey/compile";
```
One line, matching the CLAUDE.md grandfathered pair. No new references introduced. Gate satisfied.

### 6. Grep — `AuthorityLevel` header comment present

```
$ grep -n "AuthorityLevel" packages/ai/src/capabilities/types.ts
25:// AuthorityLevel is a Node-side advisory for tool-selector + router.
31:export type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";
```

Line 25 is the header comment (6 lines ending line 30); line 31 is the type definition. Gate satisfied.

### Extra gate — no `ALTER TYPE journey_status ADD VALUE`

```
$ grep -R "journey_status ADD VALUE" supabase/migrations/
(no output)
```

Enum lifecycle (ADR-0172 0a/0b/0c) is S1.2's job.

## Dispatched deliverables complete

- [x] `pnpm turbo typecheck` — 0 errors
- [x] `pnpm turbo test --filter=@smartout/telemetry` — 262 passed, 1 todo (pre-existing)
- [x] Grep coverage ≥ 10 hits for 5 journey event strings — 11 hits
- [x] `journey_run`/`journey_version` in `EntityType` — confirmed lines 142–143
- [x] `activity_trail` accepts both nested + flat shapes — 8 unit tests
- [x] `AuthorityLevel` header comment — line 25–30
- [x] Handoff file — this document
- [x] Decision log entry — added row for ADR-0175 clarification
- [x] No new `packages/ai/src/journey` imports — verified
- [x] No `ALTER TYPE journey_status ADD VALUE` — verified
- [x] Operator journey doc — `docs/journeys/JOURNEY-journey-s1-1-telemetry-foundation.md`

Ready for orchestrator verification → `/close-feature`.
