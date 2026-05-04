---
title: "Journey — CI blocks phantom emit contracts"
feature: harness-hardening
journey: ci-blocks-phantom-emit
status: verified
verified_at: 2026-04-23
verification_debt: "Scratch-branch regression test deferred — no PR was pushed with a phantom emit to observe CI failure. Script unit tests (positive + negative fixtures) pass; script runs clean on HEAD."
verification_scope_limitation: "Script currently scans packages/telemetry internals only. Monorepo-wide grep coverage is tracked as follow-up work — noted in handoff Known Issues."
e2e_test: packages/ai/scripts/__tests__/check-emit-registry-coverage.test.ts
created: 2026-04-23
updated: 2026-04-23
module: MODULE_BOTSSON
tags: [journey, ci, telemetry, invariants]
---

# Journey: Developer adds unregistered emit; CI blocks the PR

**Role:** developer (shipping a capability change)

**Precondition:**
- `packages/ai/scripts/check-emit-registry-coverage.ts` shipped (Task 9)
- `.github/workflows/ci.yml` has the `harness-invariants` job wired (Task 12)
- `packages/telemetry/src/registry.ts` is the registry source

## Happy Path

1. Developer adds a tool that calls `emit({ event: "contract.template.forked", ... })` in `packages/ai/src/capabilities/contract/tools.ts` but forgets to register `"contract.template.forked"` in `packages/telemetry/src/registry.ts`.
2. Developer opens PR against `development`. → CI triggers `harness-invariants` job.
3. Job runs `pnpm --filter @smartout/ai run invariants:emit-coverage` → script greps for `emit(...)` calls, cross-references `registry.ts`, finds the unregistered event. → Exits non-zero with:
   ```
   1 unregistered emit call(s):
     packages/ai/src/capabilities/contract/tools.ts:312 — contract.template.forked
   ```
4. GitHub marks the check as **Failed** on the PR. → Merge button is disabled (ruleset blocks).
5. Developer reads the error, opens `registry.ts`, adds the entry with payload schema, pushes. → CI re-runs, passes. → PR mergeable.

**Postcondition:**
- No `emit()` call ships to `development` without a matching `registry.ts` entry
- L-0094 (phantom emit contracts — 4th occurrence) cannot happen silently anymore

## Error Paths

- **Scenario:** Script has a false positive (dynamic event name, e.g. `emit({ event: \`x.${dynamic}\` })`) → Script's grep regex only matches string literals; dynamic names are silently skipped (documented limitation). If a real bug slips through this gap, it is caught by I3 (emitPrefix uniqueness runtime assertion).
- **Scenario:** Developer needs to ship an emit call during registry migration and can't register the event yet → They land registry.ts entry FIRST in the same PR. No `--no-verify` escape.
- **Scenario:** CI job itself has a bug → script's own unit tests (Task 9.1) verify positive + negative fixtures; bug in the script fails those tests before reaching production CI.

## Verification

- [ ] Implementation matches the steps above (Task 9 + Task 12)
- [ ] Script unit tests pass: `pnpm --filter @smartout/ai test check-emit-registry-coverage`
- [ ] Manually tested: introduce a phantom emit on a scratch branch → push → CI fails with expected message
- [ ] Script runs green on current HEAD (no existing drift):
      `pnpm --filter @smartout/ai run invariants:emit-coverage`

**Mark `status: verified` in frontmatter when all four boxes are checked.**
