---
id: L-0125
title: "Test spirit vs letter — asserting `ok:true` is not asserting the artefact"
status: accepted
date: 2026-04-23
type: process
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0196, ADR-0197]
module: quality
tags: [testing, l-0118-reinforcement, capability, trust-gate, phantom, e2e]
---

# L-0125 — Test spirit vs letter: asserting `ok:true` is not asserting the artefact

## Context

L-0118 ("every capability tool requires E2E Trust Gate test before merge") was logged 2026-04-22 after `forkTemplate` shipped with a runtime 401. The remedy — a test that invokes the tool via the real router and asserts response shape — entered `close-feature.sh` as a merge gate the same day.

On 2026-04-23, code-trace of campaign `journey-engine` revealed that `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:128-146` contains the following test for `publishMissionTool`:

```
const result = await publishMissionTool.execute(
  { journey_version_id: versionId },
  mockCtx,
);
const parsed = JSON.parse(result);
expect(parsed.ok).toBe(true);
expect(parsed.run_id).toMatch(/^[0-9a-f-]{36}$/);
```

The test passes. The tool body (tools.ts:299-344) returns `{ok:true, run_id: crypto.randomUUID(), note:"S1.4 skeleton — engine_missions insert ... lands in M4"}` without performing any insert. The test green-lit a phantom body (Mode 2 per L-0124).

L-0118's **letter** says: "the tool executes without throwing, returns the documented response shape, and assert side-effects (DB writes, emits) actually occurred." The test satisfies the first two. The third — `assert side-effects actually occurred` — is absent.

L-0118's **spirit** is: a test proves the tool did the work it claims. `ok:true` + UUID-shape does not prove that work. This test is worse than no test: it contributes false Trust-Gate green to the merge pipeline.

## Discovery

**An E2E test that asserts return shape without asserting downstream side effect is a rubber-stamp.** It satisfies L-0118 in letter while violating it in spirit. The gate passes; the runtime lies continue.

The pattern is not specific to journey. Any capability tool whose `execute()` returns a UUID + `ok:true` can ship a phantom body through an L-0118 test that asserts those two fields. The symmetry of the failure mode and the remediation shape is the insight: **the test must mirror the tool's side-effect declaration.**

For a capability tool whose declared effect is "insert a row in table X," the test must:
1. Call the tool.
2. Receive the response.
3. `SELECT FROM table X` with a filter that matches the tool's claimed write.
4. Assert row count ≥ 1, or the expected row content.

For a capability tool whose declared effect is "write a file to path P," the test must assert the file exists with the expected content. For "emit event E to destinations D," assert E landed in each of D. For "start an engine_state run," assert the row exists AND `engine_state_step` rows exist AND the run's `process_id` resolves.

Generalized: **an E2E test asserts what the tool CLAIMS, not what the tool RETURNS.** The return is plumbing; the claim is contract.

## Impact

**L-0118 merge gate strengthened with a side-effect-assertion sub-rule** (implementation owned by ADR-0196 Invariant 11):

```
# Every capability tool whose execute() body declares a side effect MUST have
# a corresponding test that asserts the side effect, not only the return shape.
# Declared side effects: insert/update/delete to a table, fs.writeFile,
# fetch with mutating method, emit with ADR-0175 destination.
```

**Test template** for capability tool E2E (to be added to `apps/e2e/tests/journey-capability-*.spec.ts` scaffold):

```ts
test("publish_mission writes engine_missions row", async () => {
  // 1. Setup — seed a journey_version with valid IR.
  // 2. Act — invoke the capability via the real router.
  const result = await agentInvoke("journey.publish_mission", { journey_version_id: v.id });
  expect(result.ok).toBe(true);           // letter of L-0118
  // 3. Assert artefact — the spirit.
  const { data: missions } = await supabase
    .from("engine_missions")
    .select("id")
    .eq("id", expectedMissionId(v));
  expect(missions).toHaveLength(1);       // spirit of L-0118
});
```

**Phase 2.5 council fact-check gains a review of test bodies for capabilities named in the plan.** If the test asserts only return shape (no `SELECT`, no file check, no emit destination query), flag FALSE TRUST-GATE GREEN.

**Campaign-specific amendment to `close-feature-journey-guardian.sh`:** for every capability in `packages/ai/src/capabilities/journey/tools.ts` that contains an insert/update/delete, the corresponding test in `__tests__/` OR `apps/e2e/tests/` must contain a SELECT against the affected table with an `.eq()` filter matching the tool's write.

**Fix-forward action:** The existing `publishMissionTool` and `publishGuideTool` tests at `journey.capability.test.ts:118-147` must be deleted or marked `.skip` with a FIXME referencing L-0125 until real bodies land (ADR-0194). A rubber-stamp test blocks merge less than no test, but contributes to false status.

## References

- L-0118 — every capability tool requires E2E Trust Gate test (reinforced here).
- L-0115 — ontology PASS does not imply runtime PASS (sibling principle).
- L-0124 — phantom body vs phantom emit (same-council sibling).
- ADR-0196 Invariant 11 — no phantom capabilities (merge gate).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23.
- `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:118-147`.
- `packages/ai/src/capabilities/journey/tools.ts:299-392`.
- `scripts/close-feature.sh` / `scripts/close-feature-journey-guardian.sh`.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
