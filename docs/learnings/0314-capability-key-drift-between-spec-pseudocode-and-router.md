---
title: "Capability-Key Drift Between Spec Pseudocode and Real Agent Router"
id: LEARNING_0314
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [council, spec-review, capability, gate-action, phantom-contract, L-0176-family]
---

# Learning-0314: Capability-Key Drift Between Spec Pseudocode and Real Agent Router

## Context

Council review on 2026-05-18 of the Announcement Kind/Tier/Entity-Link spec. Spec §8 pseudocode invoked `callGateAction({ capability: 'broadcast.send', ... })` for the agent capability tool's gate enforcement. Agent-Coordinator Phase 3 code-trace at `packages/ai/src/capabilities/communication/publish-announcement.ts:91-96` found the real tool body invokes `callGateAction(supabase, ctx.workspaceId, ctx.profileId, { capability: "communication", actionType: "publish_announcement", channel: ctx.channel ?? "chat" })`.

Spec used `broadcast.send`. Real code uses `communication`. These are different capability keys backed by different authority seeds:

- `communication` seeded at `supabase/migrations/20260601100000_seed_communication_authority.sql:42` — `level=suggest`, `min_role=employee`.
- `broadcast.send` seeded at `supabase/migrations/20260515110000_seed_day_control_authority.sql:55` AND `supabase/migrations/20260518000000_contract_authority_seed_upsert_and_bootstrap.sql:193` — `level=confirm`, `min_role=manager`.

Had the spec shipped as-pseudocoded, the agent's gate enforcement would either (a) silently jump from `employee+` to `manager+` privilege requirement (silent regression for existing customers using Mr. Botsson to publish announcements), or (b) fail with "no seed found" if `broadcast.send` was not registered for the workspace.

## Discovery

Spec pseudocode that names capability keys, gate functions, or router endpoints CAN drift from production code at any time. Phase 2.5 fact-check methodology typically verifies file existence and column shapes but does NOT verify that capability-string references in pseudocode match the registry strings in production code.

This is a **sibling pattern** to:

- **L-0176** (2026-04-29): docstring claims about ADR compliance drift from function body reality. Reviewer must read body, not docstring.
- **L-0177** (2026-04-29): silent fallback to JWT-default workspace_id when body-supplied row reference returns null. Reviewer must verify fail-fast paths.
- **L-NEW (this learning)**: capability-key strings in spec pseudocode drift from agent-router registry. Reviewer must grep real call sites for the capability string.

The pattern signature: spec is written at the contract level (intent / target behavior); production code is written at the implementation level (current strings). The two drift over time. A spec that invokes `broadcast.send` MAY be expressing intent that the router should be updated to use that key, but may also be a typo or stale reference.

## Impact

**Phase 2.5 fact-check methodology addition (mandatory for any spec referencing capability strings):**

For every capability key, gate name, or router endpoint referenced in spec pseudocode:

1. Grep `packages/ai/src/router/**/*.ts` for the capability string.
2. Grep `packages/ai/src/capabilities/**/*.ts` for the capability string.
3. Grep `supabase/migrations/**.sql` for `seed_*_authority` rows containing the capability string.
4. If grep returns 0 hits in production code or authority seeds, FLAG as `CAPABILITY-KEY-DRIFT` in fact-check report.

**Council Phase 3 hard rule addition (for multi-tool capability briefings):**

When briefing reviewers on a spec that proposes capability-name changes (or implicit changes via pseudocode), include a side-by-side table:

| Capability key | Spec uses | Real code uses (file:line) | Seeded? | Min role |
|---|---|---|---|---|

This table is the chair's responsibility in the briefing package; reviewers can verify each row in their code-trace pass.

**Memory hook for spec authors:** When writing pseudocode, ALWAYS open the real code file and copy the capability-string verbatim. If the spec INTENDS to change the capability, declare that explicitly: "This change MIGRATES the agent from `communication` capability to `broadcast.send` (manager+/confirm)" — visible in council briefing.

## References

- ADR-0370 (Capability Boundary for Announcement Surface, deferred placeholder)
- Council session: `docs/council/COUNCIL-LOG.md` entry 2026-05-18 Announcement Kind/Tier/Link
- Sibling patterns: L-0176 (docstring drift), L-0177 (silent fallback)
- Falsifying evidence: `packages/ai/src/capabilities/communication/publish-announcement.ts:91-96` vs spec §8

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
