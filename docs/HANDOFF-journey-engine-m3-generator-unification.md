---
title: "Journey Engine M3 — Generator unification (ADR-0174 cutover)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey-engine, journey-ir, adr-0174, m3, cutover, generators]
---

# HANDOFF — Journey Engine M3: Generator Unification

## Summary

M3 executes the ADR-0174 12-item cutover (C.1–C.12). The three generators in
`apps/e2e/generators/` (`mission-generator.ts`, `docs-generator.ts`,
`audit-generator.ts`) now take a canonical `JourneyIR` as their primary input.
Legacy callers have been swept to call `protocolToJourneyIR()` inline at the
call site, the temporary thin wrappers have been deleted, and the ADR-mandated
grep invariants are green.

C.11 (adapter deletion) is **deferred** to a follow-up sub-sortie, using the
explicit authority of ADR-0174 §E rollback row 4. Reason: JourneyIR v1 is
structurally under-specified for the other side of the authoring surface —
the Playwright `protocol-runner` still needs the full `ProtocolDefinition`
(actions list, actor, platform, auth_profile) that IR v1 does not carry.
Retaining the adapter keeps the M3 cutover shippable while the IR grows to
cover the runner. The handoff below names the owner + resumption conditions.

C.12 (decision-log bump for ADR-0174) was satisfied at M2 exit (commit
`72bbb55b`); no further change required.

## The Option A vs Option B Choice (C.11)

**Chosen: Option B (partial) — with C.11 deletion deferred.**

### Options considered

| Option | Shape | Consequence |
|---|---|---|
| **A** | Mirror `apps/e2e/protocols/*.ts` samples to `docs/journeys/JOURNEY-*.md` as JourneyIR-markdown. Docs-first authoring. | Requires a new markdown-to-IR parser. `apps/e2e/protocols/*.ts` stays live (runner still needs it) → adapter stays AND a new parser is added. Increases surface. |
| **B** | Retarget `apps/e2e/protocols/*.ts` samples to emit JourneyIR directly. TS-first authoring. | Samples feed both runner AND generators — requires dual-write (one as `ProtocolDefinition`, one as `JourneyIR`). IR v1 cannot fully replace `ProtocolDefinition`. |

### Why Option B (partial, deferred)

1. **Fewer dead references.** Option A introduces a new markdown parser the codebase doesn't have. Option B keeps the authoring surface where the code lives (rule 4 in campaign §Documentation Protocol — code wins).
2. **Maintainability.** One language (TS), one file family, no MDX/Markdown parser surface. The team reads and writes TS fluently today.
3. **Re-use.** The protocol-runner already depends on the Zod-backed `ProtocolDefinition` contract in `apps/e2e/protocols/schema.ts` — no benefit in moving the authoring surface elsewhere.

### Why C.11 is deferred

The adapter cannot be deleted **in this PR** because two separate consumers need two different shapes of the same authoring input:

| Consumer | Needs | Source shape |
|---|---|---|
| `apps/e2e/generators/**` | `JourneyIR` (post this PR) | Derived at call site via `protocolToJourneyIR()` |
| `apps/e2e/runners/protocol-runner.ts` | `ProtocolDefinition` (still, today) | Direct import |

`JourneyIR` v1 (per `packages/journey-ir/src/types.ts`) only defines:
`version`, `slug`, `title`, `module`, and `JourneyStep { key, title, action: string, assertion, timeoutMs? }`.

The runner needs `Action[]` (seven discriminated types), `actor`, `platform`,
`auth_profile`, and `preconditions.db_state`. Deleting the adapter before IR
grows means either (a) the runner loses its sample inputs, or (b) sample
files must dual-write two structurally different objects — the exact "two
sources of truth" ADR-0074 is trying to eliminate.

ADR-0174 §E explicitly authorizes this defer:

> | M3 final-PR (C.11) blocked on input-authoring choice | **Defer C.11 only.** Keep the adapter shipping. Document the defer in the M3 handoff with owner + date. | Merge C.11 without the callers swept (C.10). |

C.10 is green (callers swept). C.11 ships in a follow-up.

### Resumption conditions for C.11

The deferred deletion unblocks when **either** of these lands:

1. **IR enrichment** — `JourneyIR` grows `actions`, `actor`, `platform`,
   `auth_profile`, and `preconditions` fields (or a nested `runnerBinding`
   subtree) such that the protocol-runner can consume it directly. At that
   point the runner retargets to `JourneyIR`, the `apps/e2e/protocols/*.ts`
   sample files are rewritten to emit `JourneyIR` natively, and the adapter
   is deleted in a single PR.
2. **Runner retirement** — if the Playwright protocol-runner is retired in
   favour of a mission/guided-flow runtime (relevant to M5 Fjernkontroll),
   the adapter's second consumer disappears and the adapter can be deleted
   the moment the samples are rewritten.

Owner: `campaign/journey-engine`. Target: M3.5 or M5 sub-sortie (whichever
lands IR enrichment first). Deadline: end of campaign M5 (approx 6 weeks).

## C.1–C.12 Outcome Checklist

| # | Item | Status | Commit SHA |
|---|---|---|---|
| C.1 | `packages/journey-ir/src/adapters/protocolToJourneyIR.ts` lands | done | `9cf97adf` |
| C.2 | Adapter unit tests green (`pnpm --filter @smartout/journey-ir test` = 28 pass) | done | `9cf97adf` |
| C.3 | Generator A (`mission-generator.ts`) retargeted to `JourneyIR` primary signature + thin wrapper | done | `c74900ee` |
| C.4 | Generator A output validated — typecheck + caller spec compile clean | done | `c74900ee` |
| C.5 | Generator B (`docs-generator.ts`) retargeted | done | `c74900ee` |
| C.6 | Generator B output validated | done | `c74900ee` |
| C.7 | Generator C (`audit-generator.ts`) retargeted | done | `c74900ee` |
| C.8 | Generator C output validated | done | `c74900ee` |
| C.9 | Callers swept — `protocol.spec.ts`, `protocol-login.spec.ts` call `protocolToJourneyIR(P)` inline, thin wrappers deleted | done | `7d7669f8` |
| C.10 | `apps/e2e/protocols/` read-path audit — grep returns 0 for `apps/e2e/protocols/schema` AND `ProtocolDefinition` under `apps/e2e/generators/` | done | `7d7669f8` |
| C.11 | `protocolToJourneyIR()` adapter deleted + input-authoring choice executed | **DEFERRED** per ADR-0174 §E row 4; Option B chosen with C.11 adapter-deletion step postponed until IR enrichment or runner retirement | n/a |
| C.12 | `docs/decisions/0000-decision-log.md` row for ADR-0174 bumped `proposed → accepted` | already done | `72bbb55b` (M2 exit) |

## Final Gate Results

| Gate | Command | Result |
|---|---|---|
| 1 | `grep -R "apps/e2e/protocols/schema" apps/e2e/generators` | 0 (green) |
| 2 | `grep -R "ProtocolDefinition" apps/e2e/generators` | 0 (green) |
| 3 | `grep -R "packages/journey-ir/src/adapters" apps packages` (non-journey-ir callers) | expected hits in `packages/journey-ir` itself (adapter still shipping per C.11 defer) |
| 4 | `grep -R "protocolToJourneyIR" apps packages` (exclude `dist/`, `node_modules`) | 13 references total: 1 adapter impl, 1 barrel export, 2 caller inline uses (`protocol.spec.ts`, `protocol-login.spec.ts`), 1 test file, and 8 doc-comment mentions. All legitimate while C.11 is deferred. |
| 5 | `grep -R "packages/ai/src/journey" apps packages scripts` | 0 (legacy stayed gone from M2) |
| 6 | `pnpm turbo typecheck` — scoped: `pnpm --filter @smartout/journey-ir typecheck` + `cd apps/e2e && npx tsc --noEmit` | 0 new errors; pre-existing `apps/e2e/reporters/journey-reporter.ts` + `apps/e2e/tests/telemetry-smoke.spec.ts` errors unchanged. |
| 7 | `pnpm --filter @smartout/journey-ir test` | 28 pass |
| 8 | Generator tests — `apps/e2e/tests/protocol.spec.ts` (guarded by `test.skip(true)` — P-001 testids missing, unrelated) + `protocol-login.spec.ts` (requires running web app + browser) | compile-checked clean; no runtime regression possible from generator retarget per construction (adapter is deterministic + preserves `formatGateAsCriteria` semantics). |

## Key Decisions & Deviations

### Decision 1 — `JourneyIR.module` derivation

The adapter maps `ProtocolSource.package_id → JourneyIR.module` and treats
`package_id` as required. Rationale: `JourneyIRSchema` enforces
`module.min(1)`, and every real `ProtocolDefinition` in the codebase today
carries a non-empty `package_id` (e.g. `JP-R001-ADMIN-ONBOARDING`,
`JP-LOGIN`). Making it optional would silently default to the empty string
and fail Zod validation at the first generator call — better to throw
`ProtocolAdapterError` at the adapter boundary with a structured path.

### Decision 2 — step ordering follows array index, not the `order` field

The adapter preserves `ProtocolSource.steps` in array-index order. The
`order` number field is NOT used as a sort key. This matches how the
legacy generators iterated (`protocol.steps.map(...)` + `protocol.steps[0]`),
preserving behaviour under the retarget. A dedicated test guards this.

### Decision 3 — guardrail synthesis reads `assertion` strings, not gate types

The mission-generator's legacy code filtered steps where `step.gate.type === "db_record"`.
The adapter encodes those gates as `assertion` strings prefixed with
`"DB record exists in "`. Post-retarget, the mission-generator filters on
that string prefix. Behaviour is preserved; the coupling between generator
and adapter-encoding is documented in both files.

### Deviation — vitest config + test convention

ADR-0174 C.2 asks the test suite to exist; it did not prescribe a runner.
Adopted `vitest` to match `packages/telemetry/package.json` convention.
Added `packages/journey-ir/vitest.config.ts` to restrict discovery to
`src/**/*.test.ts` (prevents double-execution of rebuilt `dist/` copies).

### Deviation — commit-message scope

Commitlint's `scope-case: kebab-case` rule rejects scopes containing digits
without a hyphen boundary (e.g. `e2e` is rejected, `e2e-generators` is
also rejected because `e` + `2` + `e` is read as non-kebab). Used `generators`
as the scope for C.3–C.10 commits to clear lint. Pre-agreed per MEMORY
`commitlint-scope-case` learning.

## Known Issues & Debt

1. **C.11 deferred — adapter still shipping.** `packages/journey-ir/src/adapters/protocolToJourneyIR.ts`
   and `ProtocolSource` export remain live. Resumption criteria documented above.
2. **Pre-existing typecheck errors in `apps/e2e/reporters/journey-reporter.ts`
   and `apps/e2e/tests/telemetry-smoke.spec.ts`** — unrelated to M3, not
   introduced or worsened by this cutover. Tracked for a separate sweep.
3. **`apps/e2e/protocols/P-001-admin-onboarding.ts` test is `test.skip(true)`** —
   pre-existing; P-001 references data-testid attributes that do not yet
   exist on the onboarding page. Unrelated to M3 but means runtime output
   validation for mission-generator could not be executed end-to-end.
   Compile-time + unit-level invariants preserved.
4. **`guardrails` filter couples generator to adapter string format.**
   `mission-generator.ts` filters on the literal prefix `"DB record exists in "`.
   If the adapter's gate→assertion format changes, the filter breaks
   silently. Acceptable while both live in the same campaign; flag for
   C.11 cleanup.

## Next Steps

- **M3.5 (follow-up sub-sortie)** — IR enrichment: add `actions`, `actor`,
  `platform`, `auth_profile`, `preconditions` to `JourneyIR` (or a nested
  `runnerBinding` subtree). Once in place, retarget `apps/e2e/runners/protocol-runner.ts`
  to consume `JourneyIR` directly, rewrite sample files to emit `JourneyIR`,
  and complete C.11 adapter deletion in a single PR. This unblocks
  Option B's second leg.
- **M4 (authoring surface)** — Journey authoring UI lands in
  `apps/web/src/app/platform-admin/journeys/**`. This is independent of the
  C.11 deferral but benefits from the unified IR.
- **Journey Guardian close-feature gate** (campaign M6) — once C.11 is
  executed, add grep-block rules for `protocolToJourneyIR`, `ProtocolSource`,
  and re-introduced `ProtocolDefinition` imports in `apps/e2e/generators/`
  to prevent regression.

## Files Touched

- `packages/journey-ir/src/adapters/protocolToJourneyIR.ts` (new)
- `packages/journey-ir/src/adapters/protocolToJourneyIR.test.ts` (new)
- `packages/journey-ir/src/index.ts` (barrel update)
- `packages/journey-ir/package.json` (vitest + test scripts)
- `packages/journey-ir/vitest.config.ts` (new)
- `apps/e2e/generators/mission-generator.ts` (retargeted)
- `apps/e2e/generators/docs-generator.ts` (retargeted)
- `apps/e2e/generators/audit-generator.ts` (retargeted)
- `apps/e2e/tests/protocol.spec.ts` (caller swept)
- `apps/e2e/tests/protocol-login.spec.ts` (caller swept)
- `apps/e2e/package.json` (`@smartout/journey-ir` workspace dep added)
- `pnpm-lock.yaml` (lock refresh)

## Commit Trail

- `9cf97adf` — feat(journey-ir): protocolToJourneyIR adapter + tests (M3 C.1-C.2, ADR-0174)
- `c74900ee` — feat(generators): retarget mission/docs/audit to JourneyIR (m3 c.3-c.8, adr-0174)
- `7d7669f8` — feat(generators): sweep callers to JourneyIR direct-call, delete wrappers (m3 c.9-c.10, adr-0174)
- (handoff commit — this file)
