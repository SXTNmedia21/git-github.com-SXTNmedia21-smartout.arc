---
title: "ADR-0074 Protocol Verification Engine unification completion — JourneyIR as single source"
id: ADR-0174
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-22
---

# ADR-0174: ADR-0074 Protocol Verification Engine unification completion — JourneyIR as single source

## Context and Problem Statement

ADR-0074 (Protocol Verification Engine) established that Mission, Docs, and Audit generators in `apps/e2e/generators/` share a protocol primitive. The Journey Runner Suite v1.6.0 proposes a different primitive — JourneyIR — and never reconciled whether the existing generators (`mission-generator.ts`, `docs-generator.ts`, `audit-generator.ts`) are retargeted to JourneyIR or whether a second parallel system emerges. Two parallel systems = graveyard (L-0044 parity framing).

## Decision Drivers

- ADR-0074 generators are already building dual-source-of-truth pressure — any new primitive that does not subsume them creates a third source.
- JourneyIR is strictly more expressive than the protocol structure (inference-pattern registry, step annotations for authority/telemetry).
- Migration cost is bounded — the three generators share a single input shape; swap the input loader.

## Considered Options

1. **Retarget ADR-0074 generators to consume JourneyIR** — single primitive, three emit modes (Mission, Docs, Audit).
2. **Keep ADR-0074 generators on protocol; JourneyIR runs in parallel** — two systems.
3. **Deprecate ADR-0074 generators; JourneyIR re-implements from scratch** — lose tested generator code.

## Decision Outcome

Chosen option: **"Retarget ADR-0074 generators to consume JourneyIR"**, because keeping a single source eliminates the "which one do I write?" decision for future authors, and the generators' emit logic is reusable verbatim once the input shape is unified.

Unification steps:
1. JourneyIR becomes the single input to `mission-generator.ts`, `docs-generator.ts`, `audit-generator.ts`.
2. Protocol-shaped inputs are accepted via a thin adapter `protocolToJourneyIR()` during migration window; adapter deleted after all protocols converted.
3. `apps/e2e/generators/` imports `@smartout/journey-ir` types.
4. ADR-0074 status remains `accepted` but gets an amendment addendum referencing this ADR as the completion event.

## Rules & Consequences

- **Good, because** one primitive to learn, one set of tests to maintain, one changelog.
- **Good, because** future generators (changelog, release-notes, audit-diff) get JourneyIR input for free.
- **Bad, because** migration window requires adapter code — small added surface temporarily.
- **Agent Impact:** New mission/doc/audit generators must target JourneyIR. Do NOT re-introduce the protocol shape in new code. ADR-0074 must be read together with this ADR during any generator work.

---

## Delta Appendix — Generator retarget, adapter contract, cutover, deletion window

> **Added 2026-04-22 (Sub-sortie S2.4, Journey Runner Suite spec v1.7.0 council-integration).** Closes Trust-Gate Unblock #7. Binding for M3 execution in `campaign/journey-engine`. Status stays `proposed` until M2 council bumps to `accepted`.

### A — Affected code today (verified via grep 2026-04-22)

Current `ProtocolDefinition` consumers in `apps/e2e/`:

| File | Import | Role |
|---|---|---|
| `apps/e2e/protocols/schema.ts` | exports `ProtocolDefinitionSchema` (Zod) + `ProtocolDefinition` (inferred type) at lines 149 + 179 | Source of `ProtocolDefinition` type |
| `apps/e2e/protocols/types.ts` | runtime result types (`ProtocolTestOutput` etc.) | Consumed by mission generator for test-result-aware mission prompts |
| `apps/e2e/protocols/P-001-admin-onboarding.ts` | authored `ProtocolDefinition` instance | Input sample |
| `apps/e2e/protocols/index.ts` | re-exports | Registry |
| `apps/e2e/generators/mission-generator.ts` | `import type { ProtocolDefinition }` at line 5; consumes at line 55; `formatGateAsCriteria(gate: ProtocolDefinition["steps"][0]["gate"])` at line 103 | **Generator A** |
| `apps/e2e/generators/docs-generator.ts` | `import type { ProtocolDefinition }` at line 4; consumes at line 14 | **Generator B** |
| `apps/e2e/generators/audit-generator.ts` | `import type { ProtocolDefinition }` at line 4; consumes at line 14 | **Generator C** |

Three generators. All take `ProtocolDefinition` as input. All write output to different destinations (mission → `engine_missions` per M3; docs → `docs/guides/`; audit → audit report artefact).

### B — Adapter contract

```ts
// packages/journey-ir/src/adapters/protocolToJourneyIR.ts
import type { JourneyIR } from "../ir-schema";

/**
 * Minimal shape the three generators read from today.
 * Mirrors the public surface of `ProtocolDefinition` (apps/e2e/protocols/schema.ts:149-179)
 * without duplicating the Zod schema.
 *
 * Additive-only evolution: if ProtocolDefinition gains a field, we extend
 * ProtocolSource *and* the adapter — never silently drop.
 */
export interface ProtocolSource {
  /** Stable protocol ID (today: `P-001-admin-onboarding` etc.) */
  id: string;
  /** Human title */
  title: string;
  /** Optional description */
  description?: string;
  /** Ordered steps — structurally mirrors ProtocolDefinition["steps"] */
  steps: Array<{
    id: string;
    label: string;
    actions: ReadonlyArray<unknown>;  // opaque to adapter — preserved verbatim
    gate: {
      type: "db_record" | "ui_state" | "url_match";
      // ...remaining gate fields preserved via structural typing
      [key: string]: unknown;
    };
    timeout_ms?: number;
  }>;
  /** Optional workspace scope */
  workspace_id?: string;
  /** Optional version string in protocol */
  version?: string;
}

/**
 * Pure, deterministic. Same input → same IR. No DB. No fs.
 * Throws ProtocolAdapterError on structural gaps the IR cannot represent.
 *
 * Callers:
 * - `apps/e2e/generators/mission-generator.ts` (retargeted in M3)
 * - `apps/e2e/generators/docs-generator.ts`   (retargeted in M3)
 * - `apps/e2e/generators/audit-generator.ts`  (retargeted in M3)
 *
 * Lifespan: introduced in M3; deleted at M3 exit per §D below.
 */
export function protocolToJourneyIR(source: ProtocolSource): JourneyIR;
```

**Adapter guarantees:**

- **Determinism.** `content_hash(protocolToJourneyIR(x)) === content_hash(protocolToJourneyIR(x))` — no timestamps, no UUIDs minted inside.
- **Structural preservation.** Every field in `ProtocolSource` maps to exactly one field in `JourneyIR`. Fields JourneyIR adds (inference-pattern, step annotations for authority/telemetry) are defaulted to `null` / empty — the adapter never *invents* data.
- **No side effects.** Pure function. No Supabase. No fs. No `console.*` in production path.
- **Error class.** `ProtocolAdapterError` — thrown when `ProtocolSource` contains a field that cannot be represented (e.g. gate type unknown to IR). Error message includes the offending path (`steps[3].gate.type`).

### C — Cutover checklist (ordered — each box is a gate, not a suggestion)

M3 execution — exactly one sub-sortie per box unless explicitly batched in the handoff:

- [ ] **C.1 Adapter implemented** — `packages/journey-ir/src/adapters/protocolToJourneyIR.ts` lands with unit tests per field (gate types, step ordering, optional-field handling, error cases).
- [ ] **C.2 Adapter unit tests green** — `pnpm --filter @smartout/journey-ir test` passes. Property-based test: `protocolToJourneyIR` is idempotent on round-trip where round-trip is defined.
- [ ] **C.3 Generator A (`mission-generator.ts`) retargeted** — input signature becomes `(ir: JourneyIR, options)` with a thin `(protocol: ProtocolSource, options) => generate(protocolToJourneyIR(protocol), options)` wrapper for caller-site compatibility in the same PR.
- [ ] **C.4 Generator A output validated** — existing mission generator tests pass against adapter-produced IR. Golden-file diff reviewed for semantic equivalence.
- [ ] **C.5 Generator B (`docs-generator.ts`) retargeted** — same pattern as C.3.
- [ ] **C.6 Generator B output validated** — docs generator tests + MDX-compile still green.
- [ ] **C.7 Generator C (`audit-generator.ts`) retargeted** — same pattern as C.3.
- [ ] **C.8 Generator C output validated** — audit generator tests green.
- [ ] **C.9 Callers swept** — every caller of the three generators calls the JourneyIR signature directly. Wrappers from C.3/C.5/C.7 deleted in this PR.
- [ ] **C.10 `apps/e2e/protocols/` read-path audit** — `grep -R "apps/e2e/protocols/schema" apps/e2e/generators` returns zero hits. Generators no longer import `ProtocolDefinition`.
- [ ] **C.11 `protocolToJourneyIR()` adapter deleted** — M3 final PR removes `packages/journey-ir/src/adapters/protocolToJourneyIR.ts`, its test file, and `ProtocolSource` type. Input-authoring layer (`apps/e2e/protocols/*.ts` sample files) either mirrored to `docs/journeys/JOURNEY-*.md` as JourneyIR-markdown or retargeted to emit JourneyIR directly — choice documented in the M3 final-PR handoff.
- [ ] **C.12 `docs/decisions/0000-decision-log.md` row for ADR-0174 bumped `proposed → accepted`** in the same PR as C.11.

**Rollback granularity.** If any of C.4 / C.6 / C.8 fails, revert *only that generator* — the adapter and the other generators stay. Never revert the adapter mid-cutover; it is load-bearing while any generator still consumes it.

### D — Deletion window

- **Adapter lifetime:** introduced in M3 opening PR (S3.1 or equivalent), deleted in M3 final PR (C.11 above).
- **Post-M3 invariant:** `grep -R "protocolToJourneyIR" apps packages scripts` returns zero results.
- **Enforcement:** any PR landing on `campaign/journey-engine` or `development` after M3 final-PR that re-introduces the adapter (or the `ProtocolSource` type, or `ProtocolDefinition` imports in `apps/e2e/generators/`) is a merge blocker. Journey Guardian close-feature gate greps on a block-list.
- **Grace for input-authoring:** if C.11 chose to keep `apps/e2e/protocols/*.ts` as the human authoring surface and retarget to emit JourneyIR directly, the types file may still reference structural shapes — the ban is on `ProtocolDefinition` round-tripping through generators, not on any mention of the name in authoring tooling.

### E — Rollback policy (granular)

If a retargeted generator breaks mid-cutover:

| Scenario | Action | Never do |
|---|---|---|
| Generator B fails tests after C.5/C.6 | Revert the generator-B PR; leave adapter + generator A + C in place. Investigate in a fresh PR. | Revert the adapter. Revert other generators. |
| Adapter unit test flake (C.2) | Fix the test, not the adapter determinism guarantee. | Accept non-determinism "temporarily". |
| `JourneyIR` schema diverges from a generator's needs | Extend `JourneyIR` (additive), not `ProtocolSource`. | Add a side-channel or out-of-band config. |
| M3 final-PR (C.11) blocked on input-authoring choice | Defer C.11 only. Keep the adapter shipping. Document the defer in the M3 handoff with owner + date. | Merge C.11 without the callers swept (C.10). |

**Red line:** the adapter is a migration bridge, not a load-bearing runtime component. Reverting a generator PR is always allowed. Reverting the adapter mid-cutover is a separate decision requiring a new ADR.

### F — Amendment target

When C.11 + C.12 complete and ADR-0174 is bumped to `accepted`, **ADR-0074** gets an amendment addendum pointing to ADR-0174 as the completion event. ADR-0074 status stays `accepted` — it is not superseded, it is completed.

---

## Appendix — C.11 closure via ADR-0178 resumption path (2026-04-22, M3.5)

> Added 2026-04-22 at M3.5 sub-sortie close.

C.11 (adapter deletion) was deferred at M3 exit under §E row 3 ("Extend
`JourneyIR` (additive), not `ProtocolSource`") because `JourneyIR` v1 was
structurally under-specified for the Playwright runner's needs (actions
list, actor, platform, auth_profile, preconditions, gate, entry URL).

**Resumption mechanism.** M3.5 sub-sortie landed ADR-0178 ("JourneyIR v2
schema expansion") which added all of the above fields as additive optional
members (v1 IRs continue parsing unchanged). Runner, gate-checker, and
progress-writer retargeted to consume `JourneyIR` natively. Sample files
(`apps/e2e/protocols/P-001-admin-onboarding.ts` and the `P_LOGIN` inline in
`apps/e2e/tests/protocol-login.spec.ts`) were rewritten to emit `JourneyIR` v2
directly.

**C.11 gate results (M3.5 close).**

- `packages/journey-ir/src/adapters/protocolToJourneyIR.ts` — DELETED.
- `packages/journey-ir/src/adapters/protocolToJourneyIR.test.ts` — DELETED.
- `packages/journey-ir/src/adapters/` directory — REMOVED (empty).
- `packages/journey-ir/src/index.ts` — no longer re-exports from `./adapters/...`.
- `ProtocolSource` type — gone (was only exported from the deleted adapter).
- `grep -R "protocolToJourneyIR" apps packages scripts` → 0.
- `grep -R "ProtocolSource" apps packages scripts` → 0.
- `apps/e2e/runners/protocol-runner.ts` — consumes `JourneyIR` directly, no
  `../protocols/schema` import.
- `apps/e2e/runners/gate-checker.ts` — consumes `JourneyGate` directly, no
  `../protocols/schema` import.
- `apps/e2e/runners/progress-writer.ts` — consumes `JourneyIR` directly.

**C.12 status.** Already green at M2 exit (`72bbb55b`). ADR-0174 stays at
`accepted`.

The deletion-window enforcement rule in §D now applies: any PR landing on
`campaign/journey-engine` or `development` that re-introduces
`protocolToJourneyIR` or the `ProtocolSource` type is a merge blocker.
Journey Guardian close-feature gate (M6) will add the grep-block explicitly.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
