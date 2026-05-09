---
title: "JourneyIR v2 schema expansion — additive runner bindings"
id: ADR-0178
status: accepted
layer: decision
created: 2026-04-22
updated: 2026-04-22
---

# ADR-0178: JourneyIR v2 schema expansion — additive runner bindings

## Context and Problem Statement

ADR-0171 made `packages/journey-ir` the canonical JourneyIR home. ADR-0174
retargeted the three generators (Mission / Docs / Audit) to consume it. At
M3 closure (commit `8f2defc9`), cutover step C.11 — **delete the
`protocolToJourneyIR()` adapter** — was deferred per ADR-0174 §E row 3
("Extend `JourneyIR` (additive), not `ProtocolSource`"). The reason, captured
in `docs/HANDOFF-journey-engine-m3-generator-unification.md`, is that two
consumers today need different slices of the same authoring input:

| Consumer | Needs (today) | Source shape |
|---|---|---|
| `apps/e2e/generators/**` | `JourneyIR` v1 | Derived at call site via `protocolToJourneyIR()` |
| `apps/e2e/runners/protocol-runner.ts` | `ProtocolDefinition` (actions, actor, platform, auth_profile, preconditions) | Direct import |

JourneyIR v1 carries only: `version`, `slug`, `title`, `module`, and
`JourneyStep { key, title, action: string, assertion, timeoutMs? }`. It is
strictly less expressive than `ProtocolDefinition` — the runner cannot drive
Playwright from `action: string`; it needs the typed `Action` discriminated
union (navigate / fill / click / click_text / wait_visible / wait_hidden /
settle). It also needs actor identity and auth profile to set up the session
cookie, platform to choose between web/mobile, and `preconditions.db_state`
to set up test fixtures.

Deleting the adapter before IR grows means either (a) the runner loses its
sample inputs, or (b) sample files dual-write two structurally different
objects — the exact "two sources of truth" ADR-0074 is trying to eliminate.

ADR-0174 §E row 3 explicitly authorizes the resumption path: **expand
`JourneyIR` (additive only), retarget the runner, rewrite samples to emit
`JourneyIR` natively, delete the adapter in a single PR.** This ADR is that
expansion.

## Decision Drivers

- **Single source of truth (ADR-0074, ADR-0171).** The `ProtocolDefinition`
  type exists only because IR v1 is too narrow. Closing the gap eliminates
  the parallel contract.
- **Additive only (M3.5 campaign binding rule 4).** v1 IRs must continue
  parsing unchanged. `version: "1.0.0"` documents today's Zod + TS surface.
- **Typed actions for runtime consumers (M5 Fjernkontroll).** The
  Fjernkontroll state machine needs typed actions to render step-specific
  UI cues (Navigate → "go to url", Fill → "type in the field", Click →
  "press the button"). A free-form string cannot drive that.
- **Authoring surface continuity (M4).** The authoring UI at
  `apps/web/src/app/platform-admin/journeys/` (M4) will serialize to the
  same IR format the runner reads, so authoring round-trips are lossless.
- **No 5th capability (ADR-0173).** Expansion is data-shape only. The four
  capabilities in `packages/ai/src/capabilities/journey/tools.ts` are
  untouched beyond minor type tightening.
- **No new telemetry events (ADR-0175 frozen for the registered 5).** IR
  v2 does not emit. If step-level events are later added, they land in a
  separate ADR + registry commit per ADR-0175's append-only rule.
- **Version guard closes the open door.** Bumping the IR version to
  `"2.0.0"` and guarding writes prevents a consumer from silently writing a
  v1-shaped IR to a v2-only row or vice versa.

## Considered Options

1. **Expand JourneyIR to v2 (additive optional fields + typed actions).**
   Runner retargets. Sample files emit `JourneyIR` natively. Adapter deletes.
2. **Keep IR v1; document `ProtocolDefinition` as the runner-only contract.**
   Adapter stays forever. Two contracts. ADR-0074 never closes.
3. **Introduce a third shape (`RunnerSpec`) alongside IR and `ProtocolDefinition`.**
   Three contracts. Worse than Option 2.
4. **Replace IR v1 non-additively (breaking).** Violates M3.5 binding rule 4.

## Decision Outcome

Chosen option: **Option 1 — Expand JourneyIR to v2 with additive optional
fields.**

### v2 additive surface

All fields are **optional** (`?`). A valid v1 IR (`version: "1.0.0"`) parses
unchanged — adapter tests from M3 land on v2 without modification.

```ts
// packages/journey-ir/src/types.ts (v2)

/** Actor role authoring surface — optional. Mirrors ProtocolDefinition.actor. */
export type JourneyActor = "owner" | "admin" | "manager" | "employee";

/** Target platform for a journey run — optional. Mirrors ProtocolDefinition.platform. */
export type JourneyPlatform = "web" | "mobile";

/** Auth profile used to bootstrap a test run — optional. */
export type JourneyAuthProfile = "admin" | "employee" | "godmode";

/**
 * Precondition assertion before a run starts (db_state rows that must match).
 * Optional. Mirrors ProtocolDefinition.preconditions.
 */
export interface JourneyPreconditions {
  readonly db_state?: ReadonlyArray<{
    readonly table: string;
    readonly where: Readonly<Record<string, unknown>>;
    readonly expect: Readonly<Record<string, unknown>>;
  }>;
}

/**
 * Typed step action — discriminated union. Mirrors ProtocolDefinition.Action.
 * A JourneyStep may have `actions` (typed) OR `action` (legacy string) OR both.
 * Runtime consumers prefer `actions` when present; v1 consumers keep using
 * `action`. Both are preserved by the adapter until the adapter is deleted.
 */
export type JourneyAction =
  | { readonly type: "navigate"; readonly url: string }
  | { readonly type: "fill"; readonly testid: string; readonly value: string }
  | { readonly type: "click"; readonly testid: string }
  | { readonly type: "click_text"; readonly text: string }
  | { readonly type: "wait_visible"; readonly testid: string }
  | { readonly type: "wait_hidden"; readonly testid: string }
  | { readonly type: "settle"; readonly ms: number };

// v2 additions on JourneyStep: `actions?: readonly JourneyAction[]`
// v2 additions on JourneyIR: `actor?`, `platform?`, `auth_profile?`, `preconditions?`
```

### Version semantics

- `CURRENT_IR_VERSION = "2.0.0"` exported from `packages/journey-ir/src/types.ts`.
- `JourneyIRSchemaVersion = "1.0.0" | "2.0.0"` — both parse.
- **Version guard (binding rule 8).** `packages/journey-ir/src/compile.ts`
  (the write surface) adds `assertCurrentIrVersion(ir)` that rejects writes
  whose `ir.version !== CURRENT_IR_VERSION`. Throws
  `UnsupportedIrVersionError` with the offending version + required version.
  Callers writing `journey_version.ir_json` MUST call this guard first.

### Consumers named

| Consumer | How it uses v2 |
|---|---|
| M4 authoring UI (`apps/web/src/app/platform-admin/journeys/`) | Renders the new fields: actor selector, platform radio, auth-profile dropdown, precondition rows. Serializes to `JourneyIR` v2. |
| M5 Fjernkontroll (`apps/web/src/components/journey/**`) | Reads typed `actions` on each step to drive per-step UI cues (Navigate, Fill, Click, etc). Falls back to `action` string when `actions` is absent. |
| `apps/e2e/runners/protocol-runner.ts` | Retargeted (M3.5 commit 4) to consume `JourneyIR` directly. Reads `actions`, `actor`, `platform`, `auth_profile`, `preconditions` from the IR — no more `ProtocolDefinition` import. |
| `apps/e2e/generators/**` | Already on `JourneyIR` (M3). v2 additions are passthrough — generators ignore unknown optional fields (Zod `.strict()` is relaxed to `.passthrough()` only if needed; preferred: widen schema to include the new fields, which happens in this ADR). |

### Reconciliation with ADR-0177 (Fjernkontroll)

ADR-0177 defines the Fjernkontroll **runtime state machine** set:
`{idle, running, paused, stuck, completed, failed}`. That set is **runtime
execution state**, not authoring schema. JourneyIR v2 does NOT duplicate
those names in `types.ts`. The states live at the runtime layer where the
Fjernkontroll component renders. JourneyIR v2 adds `actions` (authoring-time
step plans), `actor`/`platform`/`auth_profile` (authoring-time identity),
and `preconditions` (authoring-time fixtures). A comment in
`packages/journey-ir/src/types.ts` cites ADR-0177 as the canonical home for
runtime state.

## Rules & Consequences

- **Good, because** adapter disappears — one contract from authoring to
  runner to generator.
- **Good, because** v1 parsing is preserved — existing tests + sample data
  work unchanged through the transition commit.
- **Good, because** typed actions unlock M5 Fjernkontroll per-step cues.
- **Good, because** version guard catches cross-version writes at the
  write boundary instead of corrupting DB state silently.
- **Bad, because** the IR type surface grows. Mitigated by keeping every
  new field optional and documenting semantics in `types.ts`.
- **Bad, because** two valid versions coexist in the repo. Mitigated by
  the version guard and by ADR-0172's enum lifecycle pattern (the IR row
  format is orthogonal to the DB status enum).
- **Agent Impact:**
  - No new capability. The four in ADR-0173 stay frozen.
  - No new emit events. The five in ADR-0175 stay frozen.
  - No non-additive changes. Any future breaking change requires a new ADR
    + version bump + migration path.
  - Mobile BFF for `journey.run_guided` (M5) MUST server-side re-derive
    `actor_id`/`workspace_id` — Invariant 3 (ADR-0176 appendix) is unchanged.
    Fields like `actor` on the IR are authoring data, not runtime auth.

## Consequences for M3.5 commit sequence

The adapter (`packages/journey-ir/src/adapters/protocolToJourneyIR.ts`)
stays live through commits 1–4 of M3.5 so the runner keeps working during
retarget. Commit 5 deletes it in a single atomic step: adapter + adapter
test file + `ProtocolSource` export + `adapters/` directory + barrel export.

At M3.5 close:
- `grep -R "protocolToJourneyIR" apps packages scripts` = 0.
- `grep -R "ProtocolSource" apps packages scripts` = 0.
- ADR-0174 C.11 is closed (appendix added to ADR-0174 points here).
- ADR-0178 bumps `proposed → accepted` in commit 5.

## Status

**accepted** (2026-04-22, M3.5 commit 5). ADR-0174 C.11 closed simultaneously —
adapter, its test, `ProtocolSource` export, and `adapters/` directory deleted
in the same commit. Samples (`P-001-admin-onboarding.ts`, `protocol-login.spec.ts`
inline `P_LOGIN`) rewritten to emit `JourneyIR` v2 directly. Runner, gate-checker,
and progress-writer consume `JourneyIR` natively with `JourneyGate` / `JourneyAction`
typed unions. Final grep state: `protocolToJourneyIR` = 0, `ProtocolSource` = 0.

### Implemented surface (what shipped vs what ADR-0178 body predicted)

- `actor`, `platform`, `auth_profile`, `preconditions`, `steps[i].actions?` —
  all landed as predicted (ADR-0178 body).
- `steps[i].gate?`, `steps[i].order?`, `steps[i].screenshot?`, `steps[i].description?`,
  `entry_url?`, `success_gate?` — additional additive optional fields added at
  commit 4 to let the runner retarget end-to-end without reaching back into
  `ProtocolDefinition`. Each of these mirrors a legacy protocol field 1:1; no
  semantic drift. All remain optional — v1 IRs still parse unchanged. Pattern
  stays fully inside ADR-0174 §E row 3 ("Extend JourneyIR, not ProtocolSource").
- `JourneyGate` discriminated union added to `types.ts` + `schema.ts` (4 variants
  mirroring `apps/e2e/protocols/schema.ts::GateSchema`).
- Runner throws `RunnerInputError` when runtime-required fields
  (`actor`, `step.actions`, `step.gate`) are missing on an input IR — authoring
  surfaces may omit them; runtime execution requires them.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
