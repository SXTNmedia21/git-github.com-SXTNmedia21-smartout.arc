---
id: L-0118
title: "Every capability tool requires E2E Trust Gate test before merge"
status: accepted
date: 2026-04-22
type: process
created: 2026-04-22
updated: 2026-04-22
related_adrs: [ADR-0191]
module: MODULE_AGENT
tags: [learning, council, trust-gate, capability, agent, e2e-test, close-feature, journey-runner-suite, contract-hub-redesign]
---

# L-0118 — Every capability tool requires E2E Trust Gate test before merge

## Context

`contract-hub-redesign` (PR #234) added `forkTemplate` capability tool. The tool fetched a BFF route without `Cookie` or agent signature. BFF returned 401. The tool failed silently for every agent caller.

Four pre-merge council gates passed without catching this. Reasons:
- Phase 2.5 grep-based fact-check did not exercise the call path.
- Phase 3 reviewers verified the tool code typed and compiled.
- Phase 5 synthesis verdict rolled up "ontology PASS" from per-layer reviews (see L-0115).
- No E2E test exercised the agent → BFF → response path for `forkTemplate`.

A single E2E test of the shape "agent invokes `forkTemplate`, asserts response shape" would have caught the 401 the first time it ran. The test did not exist because there was no merge gate requiring it.

The runtime defect was caught at post-merge code-trace by Agent Coordinator, ~24h after PR merged. By then, every agent invocation of `forkTemplate` since merge had returned 401. No telemetry surfaced this because emit had inconsistent shapes (see ADR-0193 / L-0045).

## Discovery

**Every NEW capability tool requires a journey-test-suite-style E2E that exercises the full path: agent → router → capability tool → BFF/DB → response.** The test asserts:
1. Tool executes without throwing.
2. Tool returns the documented response shape.
3. If tool writes, the write actually happens (assert DB state).
4. If tool emits, the emit reaches `activity_trail` (or declared destination).

This is **not** a unit test (which mocks the BFF/DB). This is **not** a lint check (which only sees the source code). This is an integration test that runs the actual agent invocation path.

The reason a unit test would not have caught the bug: unit tests mock `fetch`. The mock returned `{ok: true}`; the real BFF returned 401. The mock was the bug.

The reason a lint check would not have caught the bug: linter does not know that `fetch('/api/...', { headers: {} })` lacks the `Cookie` the BFF requires. The signature is opaque to static analysis.

## Impact

**Add to `close-feature.sh` checklist** as a required deliverable for any PR that adds capability tools:

> **Capability E2E Test (required, blocks merge):**
> Every NEW capability tool added in this PR has a corresponding E2E test in `apps/e2e/tests/journey-capability-<capability>.spec.ts` that:
> - Spawns the agent runtime.
> - Invokes the tool via the real router (not unit-mocked).
> - Asserts response shape matches the tool's documented contract.
> - Asserts side-effects (DB writes, emits) actually occurred.
>
> If a capability tool ships without an E2E test, `close-feature.sh` rejects the merge.

**Update `journey-runner-suite` to v1.7+** with capability-tool test scaffold:
- Generator command: `pnpm journey:scaffold capability <capability-name> <tool-name>`.
- Generates a Playwright spec that bootstraps a workspace, seeds a profile, invokes the tool via agent-router, and asserts the response.
- Required scaffold for every new capability tool ADR.

**CI gate enforced at merge:** `apps/e2e/tests/journey-capability-*.spec.ts` count must equal or exceed capability tool count in `packages/ai/src/capabilities/*/tools.ts`. Mismatch = merge blocker.

**Rationale.** Four council gates passed. Code review passed. Type-check passed. Lint passed. None of those exercised the runtime path. One E2E test would have. Make that one test mandatory.

## References

- ADR-0191 — Agent capability tool auth-passing pattern (the pattern this test would verify).
- L-0115 — Ontology PASS does not imply runtime PASS (sibling failure mode).
- L-0116 — Sibling-tool architectural inconsistency = Trust Gate failure (sibling failure mode).
- Journey Runner Suite v1.6 / v1.7+ — `services/journey-runner/`.
- `close-feature.sh` — `~/.claude/scripts/close-feature.sh`.
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
