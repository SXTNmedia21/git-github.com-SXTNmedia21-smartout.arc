---
id: L-0116
title: "Sibling-tool architectural inconsistency = Trust Gate failure"
status: accepted
date: 2026-04-22
type: process
created: 2026-04-22
updated: 2026-04-22
related_adrs: [ADR-0191]
module: MODULE_AGENT
tags: [learning, council, trust-gate, capability, agent, sibling-tools, contract-hub-redesign]
---

# L-0116 — Sibling-tool architectural inconsistency = Trust Gate failure

## Context

`contract-hub-redesign` (PR #234) added three capability tools in the same module:

- `forkTemplate` — calls BFF route via `fetch('/api/contracts/templates/[id]/fork')`. No `Cookie`, no agent signature → 401 every time.
- `publishWorkspaceTemplate` — bypasses BFF, writes direct via `ctx.supabaseAdmin` after `gate_action`.
- `deprecateWorkspaceTemplate` — same direct-admin pattern as publish.

**Three sibling tools. Two different auth/write patterns. Mixed within one capability.** The PR shipped without anyone catching the divergence pre-merge. Four council gates passed. The 401 was caught only at post-merge code-trace.

The mix was not a deliberate architectural choice. It was an accident of two developers (or one developer in two sessions) reaching for the closest pattern at hand: `forkTemplate`'s author saw the BFF route exist and wrote a fetch; `publish` and `deprecate`'s author saw `gate_action` + `supabaseAdmin` work and copied that.

Each tool, individually, "worked" in isolation (publish/deprecate did; fork's 401 was silent). The pattern divergence was invisible at per-tool review.

## Discovery

**When a single PR adds multiple capability tools, the tools must use ONE auth/write pattern OR each divergence must have an explicit per-tool ADR justifying it.** Mixed patterns in the same capability are a Trust Gate failure even if every tool individually compiles, types, and (apparently) runs.

The reason mixing is a structural failure (not just a stylistic one):
1. **Cognitive load** — future tool authors in the same capability cannot pattern-match; they have to read every tool to understand the convention.
2. **Hidden auth bugs** — the two patterns have different failure modes; mixing them inside one capability multiplies the failure surface.
3. **Test coverage gaps** — a "the capability works" test that exercises one pattern leaves the other path untested. `publishWorkspaceTemplate` E2E gave false confidence in `forkTemplate`.
4. **Telemetry inconsistency** — Pattern A (BFF) and Pattern B (direct admin) emit telemetry from different layers; mixed pattern emits inconsistent shapes in the same capability's traces.

## Impact

**Add to `feedback_trust_gate_mutation_plans.md` memory:** when reviewing a PR that adds multiple capability tools in the same capability, verify uniform auth/write pattern. If divergence exists, require either:
- (a) refactor to uniform pattern in same PR, or
- (b) per-tool ADR justifying the divergence (rare — would require a real architectural reason, e.g., one tool needs BFF rate limiting and another doesn't).

**Update `run-council` SKILL.md Phase 5 Trust Gate questions:**
- "Does every capability tool in this PR use the same auth/write pattern?"
- "If patterns diverge, is there an explicit ADR justifying the divergence?"
- "Has the auth path been E2E-tested for every tool independently?" (see L-0118)

**Codified in ADR-0191** — agent capability tool auth-passing pattern. Per-capability binary choice (Pattern A: BFF; Pattern B: direct admin). Never mix in the same capability.

## References

- ADR-0191 — Agent capability tool auth-passing pattern.
- L-0118 — Every capability tool requires E2E Trust Gate test before merge (sibling).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22.
- `feedback_trust_gate_mutation_plans.md` — agent memory.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
