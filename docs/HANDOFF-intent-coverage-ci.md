---
title: "HANDOFF — ADR-0112 Intent Classifier Coverage CI (Phase A4)"
status: done
module: MODULE_BOTSSON
created: 2026-04-23
updated: 2026-04-23
tags: [handoff, ci, invariant, intent-classifier, adr-0112, phase-a4, botsson-arena]
---

# HANDOFF — ADR-0112 Intent Classifier Coverage CI

**Branch:** `feat/botsson-arena-intent-coverage-ci`
**Campaign:** `campaign/botsson-arena`, Phase A4
**ADR:** [ADR-0112](./decisions/0112-intent-classifier-coverage-invariant.md) (accepted 2026-04-15, follow-ups now ticked)
**Invariant:** I10 in `docs/architecture/INVARIANTS.md`

## Summary

ADR-0112 was accepted six weeks ago, but its CI script was never written. The
registry of capabilities (`packages/ai/src/capabilities/registry.ts`) and the
intent classifier enum (`packages/ai/src/router/intent-classifier.ts`) could
drift silently — and historically had (PR #197 registered `shift_lifecycle`
without updating the enum; every write request routed to `schedule` and
dead-ended).

This PR lands the script, wires it into the `lint` entry point, and registers
a new CI step (`harness-invariants` job) so `pnpm turbo lint` fails with a
clear error pointing at the drift.

## What Ships

| Path | Purpose |
|---|---|
| `packages/ai/scripts/check-intent-coverage.ts` | Script. Parses both source files textually (no module-graph dependency), cross-references, prints a human-readable report, exits 0 clean / 1 on drift / 2 on parser error. |
| `packages/ai/scripts/__tests__/check-intent-coverage.test.ts` | 13 unit tests covering the two parsers, `computeCoverageReport`, and end-to-end fixture-driven runs. |
| `packages/ai/scripts/__tests__/fixtures/intent-coverage/{positive,missing-in-enum,orphan-in-enum}/**` | 3 fixture trees exercising clean / missingInEnum / orphanInEnum. |
| `packages/ai/package.json` | `lint` script now runs `tsx scripts/check-intent-coverage.ts && eslint src/`; new `invariants:intent-coverage` entry matching the existing `invariants:*` pattern. |
| `.github/workflows/ci.yml` | `harness-invariants` job gets a fourth step: `pnpm --filter @smartout/ai run invariants:intent-coverage`. |
| `docs/decisions/0112-intent-classifier-coverage-invariant.md` | Follow-ups ticked off; "Current Allow-List" section added to document the evolved fall-through set. |
| `docs/architecture/INVARIANTS.md` | Added row I10 (intent-coverage) + changelog entry. 10 invariants total, 7 🟢. |
| `docs/architecture/BOTSSON-SYSTEM-MAP.md` | Phase A4 row flipped 🔴 → 🟢. |

## How It Works

The script textually parses two files rather than importing the `@smartout/ai`
module graph (which would drag in supabase, openrouter, zod, workspaces, and
make the CI step an order of magnitude slower + flakier):

1. **Registry:** find `const capabilities: Record<string, CapabilityDefinition> = { ... };`,
   walk brace depth to capture the literal body, strip comments, extract keys.
2. **Intent enum:** find `capability: z.enum([ ... ] as const)`, walk bracket
   depth, strip comments, extract quoted string literals.
3. **Cross-reference:**
   - `missingInEnum`: registered but not in enum → LLM can never route there.
   - `orphanInEnum`: in enum but neither registered nor in `DOCUMENTED_TOOLLESS`
     → classifier picks it, `selectTools()` returns `[]`, silent dead-end.

### Allow-list (`DOCUMENTED_TOOLLESS`)

Intentional fall-throughs — enum values the classifier can pick that have no
tool surface and are answered narratively from the system prompt:

- `knowledge` — policy/FAQ lookup.
- `payroll` — salary questions; no payroll tools exist yet.
- `general` — sentinel for greetings / small talk / unclear intent.

**Not on the list anymore:** `memory` (registered as a real capability in Phase
A3, 2026-04-22), `training` (was registered from the start — the original ADR
draft had it listed by mistake). If you extend the allow-list, also add a
matching comment in `packages/ai/src/router/tool-selector.ts` so the next
reviewer can trace the intent.

## Captured Failure Output (simulated drift, pre-revert)

Simulated: removed `"journey"` from the `intentSchema.capability` enum and ran
`pnpm turbo lint --filter=@smartout/ai`:

```
@smartout/ai:lint: ADR-0112 — Intent Classifier Coverage Invariant
@smartout/ai:lint:
@smartout/ai:lint: drift detected:
@smartout/ai:lint:
@smartout/ai:lint:   [missingInEnum] 1 capability/capabilities are registered in
@smartout/ai:lint:   packages/ai/src/capabilities/registry.ts but are NOT in the intentSchema enum in
@smartout/ai:lint:   packages/ai/src/router/intent-classifier.ts. OpenRouter's structured-output cannot emit
@smartout/ai:lint:   these values — the classifier will never route to them. Silent dead-end.
@smartout/ai:lint:     - journey
@smartout/ai:lint:
@smartout/ai:lint:   fix: add the missing names to the z.enum([...]) in intent-classifier.ts AND to the
@smartout/ai:lint:        "Capabilities:" list in the system prompt.
@smartout/ai:lint:
@smartout/ai:lint: registered (17): billing_query, communication, contract, contract_intake, governance, guardian, helpdesk_query, journey, memory, operations, operations_intelligence, profile, schedule, shift_lifecycle, shift_swap, training, ui
@smartout/ai:lint: enum values (19): billing_query, communication, contract, contract_intake, general, governance, guardian, helpdesk_query, knowledge, memory, operations, operations_intelligence, payroll, profile, schedule, shift_lifecycle, shift_swap, training, ui
@smartout/ai:lint: tool-less allow-list (3): general, knowledge, payroll
@smartout/ai:lint:  ELIFECYCLE  Command failed with exit code 1.

Tasks:    0 successful, 1 total
Failed:    @smartout/ai#lint
```

Also exercised the orphan-in-enum path by adding `"phantom_capability"` to the
enum — produced a matching `[orphanInEnum]` report with fix-options 1/2/3.
Both drifts were reverted; clean-tree exit is 0:

```
ok: 17 capability names ↔ 20 enum values — all in sync.
     fall-through allow-list: general, knowledge, payroll
```

## Decisions Made

| # | Decision | Why |
|---|---|---|
| D1 | **Textual parsing instead of module import.** The script doesn't `import` from `@smartout/ai`. | The ADR snippet used `import`s. In practice that means transpiling + loading 50+ files worth of Supabase / OpenRouter / Zod for a CI step that only needs two string literals. Brace-depth walking is 100 lines and runs in milliseconds. |
| D2 | **Allow-list lives in the script, not in tool-selector.ts.** `DOCUMENTED_TOOLLESS` is an exported constant. | ADR-0112 said "documented in tool-selector.ts"; in practice the check needs a machine-readable list. The tool-selector comment is still the canonical prose description — the script requires they stay in sync via reviewer discipline (same-PR rule). |
| D3 | **Keep both an `invariants:intent-coverage` script AND the `lint` integration.** | Matches the existing `invariants:emit-coverage`, `invariants:server-actor`, `invariants:gate-singleton` trio. CI's `harness-invariants` job can invoke it directly; local dev gets it implicitly via `pnpm turbo lint`. Two entry points, one script. |
| D4 | **Allow-list trimmed from the ADR draft.** Dropped `memory` and `training`. | `memory` became a real capability in Phase A3 (2026-04-22). `training` was never actually tool-less — it has been registered from day one. The ADR's draft list was written before both landings; the code wins (docs/HANDOFF ADR-0075 §1). ADR-0112 updated to reflect the current state. |
| D5 | **Exit code 2 on parser error.** | Distinguishes "invariant violated" (exit 1) from "parser broken because the source files' shape changed" (exit 2). The error message tells the next contributor which parser to patch. |

## Learnings

- **ADR follow-ups rot.** ADR-0112 was accepted 2026-04-15 with three
  checkboxes. Nothing enforced that they were closed; the `harness-invariants`
  CI job existed and did not include this check; the BOTSSON-SYSTEM-MAP
  already flagged the gap as 🔴 but nobody picked it up until Phase A4 of the
  campaign made it blocking. The invariant index in `docs/architecture/INVARIANTS.md`
  now lists this as I10 — new invariants should land in that table so they're
  visible on every code-trace.
- **Drift was real, not hypothetical.** While writing the script I ran it on
  the current tree: clean. But a search through the pre-campaign history shows
  `shift_lifecycle` (PR #197), `journey` (campaign/journey-engine), and
  `helpdesk_query` (Phase B4) each could have landed with the drift. Two of
  them were actually fixed manually before merge. Exactly the class of bug
  CI should catch.
- **Module-graph imports are expensive in CI.** Original ADR draft imported
  `getRegisteredCapabilities()` + `intentSchema`. That would have pulled in
  `@openrouter/ai-sdk-provider`, `@supabase/supabase-js`, all capability
  modules, and forced a `pnpm install` before the check ran. Textual parsing
  means the CI step completes in ~300ms with zero dependency cost beyond `tsx`.

## How To Extend

### Adding a new capability

1. Add the capability file under `packages/ai/src/capabilities/<name>/`.
2. Import + register it in `packages/ai/src/capabilities/registry.ts`.
3. Add the exact same string to the `z.enum([...])` in
   `packages/ai/src/router/intent-classifier.ts`.
4. Extend the system prompt's "Capabilities:" list in the same file so the
   LLM knows what the new name means.
5. Run `pnpm --filter @smartout/ai run invariants:intent-coverage` — should
   print "ok" with the new capability in the registered list.

### Adding an intentional tool-less intent (rare)

1. Add the string to `DOCUMENTED_TOOLLESS` in
   `packages/ai/scripts/check-intent-coverage.ts`.
2. Add the string to `z.enum([...])` in
   `packages/ai/src/router/intent-classifier.ts`.
3. Extend the comment block at the top of `selectTools()` in
   `packages/ai/src/router/tool-selector.ts` explaining why the intent has
   no tool surface.
4. Run the invariant check; confirm the new entry appears in the
   "fall-through allow-list (N)" line of the ok report.

### Removing a capability

1. Delete the import + registry entry in `registry.ts`.
2. Remove the string from `z.enum([...])` in `intent-classifier.ts`.
3. Remove the corresponding bullet from the system prompt's "Capabilities:"
   list.
4. Run the invariant check.

If you forget any of these, the script fails with a precise
`[missingInEnum]` or `[orphanInEnum]` report and a `fix:` block telling you
exactly which file to touch.

## Known Issues / Debt

- **Pre-commit hook:** ADR-0112 listed husky integration as a follow-up; it
  is still unchecked. The `harness-invariants` CI job now catches drift
  before merge, so the risk is low, but a local pre-commit hook would shift
  feedback left by one round-trip.
- **Parser brittleness:** if someone reshapes the registry literal (e.g.
  spreads, conditional keys, helper functions), the textual parser throws
  with exit 2 and a message pointing at ADR-0198 / which parser to patch.
  That is by design — catching a layout change explicitly beats silent
  false-ok. But it does mean future refactors must touch this script.
- **Allow-list coupling:** `DOCUMENTED_TOOLLESS` in the script and the
  comment block in `tool-selector.ts` are kept in sync by reviewer
  discipline. A follow-up could generate one from the other.

## Next Steps

1. Ship this PR.
2. Move ADR-0112 follow-up D (derive enum from registry) out of "deferred"
   once ADR-0073 addendum's Zod-to-OpenRouter constraints are revisited —
   that would collapse the two surfaces into one and make this invariant
   vacuous.
3. Pre-commit hook per ADR-0112 follow-up C — small, worth doing.

## Acceptance Checklist

- [x] Script exists at `packages/ai/scripts/check-intent-coverage.ts`.
- [x] `pnpm --filter @smartout/ai run invariants:intent-coverage` exits 0 on clean tree.
- [x] Captured simulated-drift failure output (see "Captured Failure Output" above).
- [x] Drift reverted; clean-tree re-run green.
- [x] `pnpm turbo typecheck` passes (6/6 tasks, 0 errors).
- [x] 13 unit tests pass (`vitest run scripts/__tests__/check-intent-coverage.test.ts`).
- [x] Wired into `lint` script in `packages/ai/package.json`.
- [x] Wired into `harness-invariants` CI job in `.github/workflows/ci.yml`.
- [x] ADR-0112 follow-ups updated; current allow-list documented.
- [x] INVARIANTS.md updated with row I10.
- [x] BOTSSON-SYSTEM-MAP.md Phase A4 row flipped 🔴 → 🟢.
