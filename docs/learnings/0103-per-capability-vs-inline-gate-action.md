---
title: "Per-capability vs inline gate_action — when each is appropriate"
id: LEARNING_0103
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [governance, gate_action, authority, capability, agent-router, pattern]
---

# Learning-0103: Per-capability vs inline gate_action — when each is appropriate

## Context

Council Gate 1 Agent Trust Gate analysis (contract-hub-redesign, 2026-04-22) verified that the new contract capability's 8 tools (`create_contract_template`, `fork_template`, `publish_template`, `deprecate_template`, `view_drift`, `dismiss_drift`, `update_clause`, `delete_template`) do NOT call `gate_action` inline inside each tool body.

This raised an obvious reviewer question: ADR-0099 mandates `gate_action` for authority checks — why no inline call?

Code-trace resolved it. The central `gate_action` RPC is invoked exactly once per request in `services/stage-engine/src/core/agent-router.ts:89` via `p_capability = intent.capability`. For the contract capability, a single `engine_authority_config` row covers all 8 tools with identical authority stance: min-role `admin`, level `confirm`, four-eyes `false`. One gate, one capability, one stance → one central check is sufficient.

Contrast with `shift-lifecycle` tools, which DO call `gate_action` inline per action. That capability has four semantically distinct actions (publish, approve, interpret, settle) that each need different authority evaluations — `publish` might be manager-level `suggest`, `settle` is owner-level `confirm`, `interpret` is read-only. A single capability-level gate would collapse that into one stance and break the governance model.

## Discovery

Inline `gate_action` at the tool level is **not required by ADR-0099**. ADR-0099 requires that SOME gate check happens — whether at the router level (central) or the tool level (inline) is a per-capability design choice driven by how many distinct authority stances the capability's tools need.

**Rule of thumb:**

| Tools share stance? | Where to put `gate_action` |
|---|---|
| All tools identical stance (min-role, level, four-eyes) | Central router — ONE `engine_authority_config` row, NO inline calls |
| Tools diverge (read vs mutate; employee vs admin; confirm vs autonomous) | Inline per tool — OR split into multiple capabilities — OR add a per-tool authority column |

**Why inline-everywhere is bad hygiene:**

- Extra DB round-trip per tool call (router gate + inline gate = 2 RPCs where 1 suffices).
- Duplicated stance declarations — the `engine_authority_config` row AND the inline call encode the same policy, so drift between them becomes possible.
- Reviewer cognitive overhead — every new tool requires a "does this one also need inline?" conversation.

**Why central-everywhere is bad hygiene:**

- Cannot differentiate tools that need different stances. Forces all tools to the most restrictive stance, creating "works in principle, broken in practice" surfaces.
- When a capability grows a new tool that needs a different stance, the right fix is inline — central is a trap you didn't notice until too late.

## Impact

**Briefing template for new capability ADRs — add a "Gate Placement" section:**

```
## Gate Placement
- [ ] All N tools share authority stance? → central gate only
- [ ] Tools diverge on min-role? → list divergence, choose inline or split capability
- [ ] Tools diverge on level (suggest/confirm/autonomous)? → inline required
- [ ] Tools diverge on four-eyes? → inline required
```

**Council Phase 3 code-trace — gate placement audit:**

For every new capability under review, verify:

1. Count `gate_action` call sites inside the capability's `tools.ts`. 0 or N+1 (where N = tool count) are expected; anything between suggests drift.
2. Read the `engine_authority_config` seed. If `tools_covered` (implicit) = all tools = same stance, central-only is correct.
3. If different tools of the same capability want different levels, the design is wrong before the code is.

**Generalizes to other auth patterns:**

- RLS policies — one policy per table vs multiple (same question).
- Zod input schemas — one union type vs per-tool schemas (same question).
- Rate limits — per-capability quota vs per-tool quota.

## References

- ADR-0099 — `gate_action` central authority evaluation (defines the RPC, not the placement).
- ADR-0091 — `gate_action` dual-gate mechanism (capability-level primary, tool-level secondary).
- ADR-0183 — `industry_intelligence` capability (proposed; will need explicit gate-placement decision).
- L-0066 — `gate_action` default-allow at the capability level (what happens when placement is wrong AND unseeded).
- L-0097 — C4 authority defaults are not free (related; permissive vs blocking defaults).
- L-0102 — briefing granularity vs schema reality (companion learning — briefings assumed per-tool rows that schema didn't support).
- `services/stage-engine/src/core/agent-router.ts:89` — central `gate_action` call site.
- `packages/ai/src/capabilities/shift-lifecycle/tools.ts` — inline-per-tool reference implementation.
- Council Gate 1 (2026-04-22) — contract-hub-redesign, Agent Trust Gate.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
