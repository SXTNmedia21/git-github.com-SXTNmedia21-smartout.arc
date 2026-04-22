---
title: "Journey Engine M5.1 — Fjernkontroll runtime (web) + journey.run_guided fleshed"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey-engine, fjernkontroll, runtime, adr-0177, m5-1]
---

# HANDOFF — Journey Engine M5.1 (Fjernkontroll runtime + run_guided web)

## Summary

M5.1 lands the first runtime surface of the Journey Engine on the web: the Fjernkontroll component suite (ADR-0177) and the real `journey.run_guided` capability body behind it. Previous milestones landed the registry (M1), package (M2), IR v2 (M3.5), authoring UI (M4), and stuck-detector Edge Function (M5.3). This sub-sortie is the first point where an admin can open a journey version, press start, and see a 6-state Fjernkontroll driven by `engine_state` + live `engine_event` realtime.

Four commits on `campaign/journey-engine`:

1. `cf07a5cc` — flesh out `journey.run_guided` web runtime (gate_action, engine_state insert, step insert, emit)
2. `6707d443` — Fjernkontroll 5-file component suite (ADR-0177 contract)
3. `671dd2bd` — admin test-run page embedding Fjernkontroll
4. (this commit) — ADR-0177 bumped `proposed → accepted` + handoff

## What was built

### 1. `journey.run_guided` web runtime (`packages/ai/src/capabilities/journey/tools.ts`)

The S1.4 skeleton became a real runtime starter. Flow:

1. MISSING_CONTEXT guard (ADR-0134) — `workspace_id` + `actor_id` non-empty BEFORE any side-effect.
2. `callGateAction({capability: "journey.run_guided", channel, actionType: "run_guided", entityId: journey_version_id})` — MANDATORY per council red-line R5.1-3. Fail-closed on RPC error; deny returns `{ok:false, error:"capability_disabled"}`.
3. Load `journey_version` + parent `journey` rows. `journey.engine_process_id` (from migration `20260308194427_journey_engine_process_link.sql`) is required because `engine_state.process_id` is NOT NULL.
4. Validate `ir_json` via `JourneyIRSchema` from `@smartout/journey-ir`. Surfaces `journey_ir_invalid` cleanly instead of crashing the Fjernkontroll.
5. Insert `engine_state` runtime row (`entity_type="journey_run"`, `entity_id=journey_version_id`, `status="running"`, `context` carries capability + surface + ir_version).
6. Insert one `engine_state_step` per IR step with `status="pending"`.
7. Emit `journey run_started` (already registered in `packages/telemetry/src/registry.ts` — no new events per R5.1-5).
8. Return `{ok:true, run_id, note:"runtime started"}`.

Also added `packages/ai/src/capabilities/journey/gate.ts` — `callGateAction` wrapper mirroring `shift-lifecycle/gate.ts`, per-capability for future surface divergence (e.g. different channel policy for `run_guided` vs `publish_mission`).

### 2. Fjernkontroll component suite (`apps/web/src/components/journey/`)

Five files, ~720 lines total:

| File | Responsibility |
|---|---|
| `fjernkontroll-spring.ts` | `FJERN_SPRING = { stiffness: 35, damping: 22, mass: 2.2 }` + `FJERN_STATES` tuple. Single source of the Nordic Split motion spec. |
| `useFjernkontrollMachine.ts` | 6-state reducer (`idle / running / paused / stuck / completed / failed`). Unidirectional transitions. Zero external deps. |
| `FjernkontrollStep.tsx` | Per-step row. Token-mapped status tones. `useReducedMotion`-guarded layout spring + icon spin. |
| `FjernkontrollActions.tsx` | Single-primary-action button cluster per state. 44pt min touch target via `h-11`. No motion elements. |
| `Fjernkontroll.tsx` | Outer component. Loads `journey_version` via RLS-scoped `createClient()`, validates IR, hosts the machine, subscribes to `engine_event` realtime, renders per-step rows + actions. ARIA live region announces transitions. |

Realtime subscription: `supabase.channel('journey-run:{runId}').on('postgres_changes', {table:'engine_event', filter:'entity_id=eq.{runId}'}, …)` routes `journey stuck` → `markStuck()`, `journey completed` → `markCompleted()`, `journey run_failed` → `markFailed()`.

### 3. Admin test-run page (`apps/web/src/app/platform-admin/journeys/versions/[journeyVersionId]/run/page.tsx`)

Server Component. Godmode-only via `getSuperAdminId()` (non-admin redirects to `/dashboard`). Loads the `journey_version` row via `createAdminClient()` (bypasses workspace_id for platform admins), renders `<Fjernkontroll journeyVersionId={...} />` in its idle default. Back link to the edit page.

The Start-click handoff to the `journey.run_guided` Server Action lands in M5.2 — M5.1 deliberately stops at idle-render, so the UI and the runtime tool can be audited independently before they're wired.

## Decisions

All land under ADR-0177 (bumped `proposed → accepted` as part of this sub-sortie):

- **6 states, not 5 or 7.** `idle | running | paused | stuck | completed | failed` — the spec's shape is preserved exactly. Adding "paused" as distinct from "idle" means the user can return to the same step without re-hydrating IR.
- **Terminal states require explicit restart.** `completed` and `failed` only accept a `start` event. No implicit recovery — if a run fails, the admin consciously re-runs.
- **`FJERN_SPRING` as a loose const, not a `Transition` object.** Inline-spread (`{ type: "spring", ...FJERN_SPRING }`) lets each caller add `delay` or `repeat` without wrestling the framer-motion Transition union.
- **`gate_action` mandatory for `autonomous` default.** The seed row could be flipped by the Wolf (L-0066 / L-0097) — treating the default as a skip-the-gate license is CVE-class. Fail-closed when RPC unavailable.
- **Runtime path never writes `journey_event`.** L-0023 — `journey_event` is dev-tracking; `engine_state` is live runtime. Separation preserved (council R5.1-1 grep = 0).
- **`journey.engine_process_id` required at run time, not synthesised.** Synthesising a stub `engine_process` would belong to `publish_mission` (M4). `run_guided` surfaces `journey_not_compiled` when missing.

## Learnings

- **Test suite for skeleton vs runtime must split.** The S1.4 happy-path test called `execute()` with a stubbed `supabaseAdmin` as `{}`. After flesh-out, `run_guided` calls `gate_action` and must fail closed on RPC error. The three remaining skeleton tools (`run_dev`, `publish_mission`, `publish_guide`) stay in the skeleton happy-path block; `run_guided` gets its own `gate_action`-aware test block. 23 tests green.
- **Turbo build order surfaces workspace-dep dependencies.** Adding `@smartout/journey-ir` to `packages/ai/package.json` required `pnpm install` + `pnpm turbo build --filter=@smartout/ai` (which builds journey-ir first) before typecheck would succeed. `pnpm --filter @smartout/ai typecheck` alone fails in a fresh clone until dependencies have been built at least once.
- **framer-motion + useReducedMotion is not all-or-nothing.** The step row uses layout spring + icon spin, both reduced-motion-guarded. `FjernkontrollActions` has zero motion elements (pure buttons), so it doesn't import `useReducedMotion` at all — the invariant is "every animated element is guarded", not "every file imports the hook". Grep gate updated mentally: check only files that import `motion.`.
- **Prettier will collapse multi-line Tailwind strings.** Post-commit review showed the formatter re-flowed `transition={prefersReducedMotion ? {duration:0} : {type:"spring", ...FJERN_SPRING}}` into a single line. Content preserved, so no re-apply needed — but worth logging so the next dev doesn't panic on a post-hook diff.

## Known issues / debt

- **Start-click has no server action yet.** M5.2 wires `<form action={runGuided}>` into `FjernkontrollActions`. Today Start flips the client state machine to `running` but does not insert an `engine_state` row. Safe because the test-run page is godmode-only.
- **No E2E test for the run page.** Playwright coverage lands when the Server Action binding lands (M5.2); exercising a page that only renders idle-state Fjernkontroll has low value.
- **No unit test for the state machine yet.** The reducer is pure and easy to test; a Vitest file under `apps/web/src/components/journey/__tests__/` should follow in a micro sub-sortie if the state table grows.
- **Realtime subscription filter is by `entity_id`.** `engine_event.entity_id` is a text column — for very old rows the filter could match non-journey-run entities. Scope is bounded by `run_id` uniqueness in practice, but a sibling filter on `event_name LIKE 'journey%'` would narrow further. Log as M5 follow-up if real workloads surface a collision.

## Next steps (M5.2)

1. Server Action at `apps/web/src/app/platform-admin/journeys/actions/run-guided.ts` that calls the capability tool with resolved ctx.
2. Bind it to `FjernkontrollActions` Start button via `useFormState` or TanStack `useMutation`.
3. BFF route for mobile thin-client per ADR-0132 (`/api/journey/guided/...`).
4. Step-progression: Edge Function or background worker advances `engine_state.current_step` + emits `journey step_reached` as Playwright/runner reaches each step.
5. Unit test for `useFjernkontrollMachine` — every event on every state.

## Council red lines (verified)

| Gate | Result |
|---|---|
| R5.1-1 — zero `journey_event` writes from runtime path | 0 ✓ |
| R5.1-2 — `MISSING_CONTEXT` count ≥ 4 in journey/tools.ts | 6 ✓ |
| R5.1-3 — `gate_action` present in journey/tools.ts | 5 refs ✓ |
| R5.1-4 — zero hardcoded colors, `useReducedMotion` on every animated .tsx, ARIA live | clean ✓ |
| R5.1-5 — no 6th `journey.*` event in registry | 5 events ✓ |
| R5.1-6 — zero `packages/ai/src/journey` refs | 0 ✓ |
| Typecheck `@smartout/ai` | green ✓ |
| Typecheck `web` | green ✓ |
| Unit tests (journey capability) | 23 pass ✓ |
| ADR-0177 accepted + dated 2026-04-22 | ✓ |
