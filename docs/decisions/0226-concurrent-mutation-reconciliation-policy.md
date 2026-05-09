---
title: "Concurrent Voice + UI Mutation Reconciliation Policy"
id: ADR-0226
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
blocks: [B1-SS-4, B1-SS-5]
related: [ADR-0203, ADR-0204, ADR-0207, ADR-0211]
---

# ADR-0226: Concurrent Voice + UI Mutation Reconciliation Policy

## Context and Problem Statement

Capability tools (called from voice + chat via stage-engine `gate_action`) and Server Actions (called from web UI via `cascade_gate_write` + `gatedUpdate`) are two concurrent write paths into the same domain entities. ADR-0203 + ADR-0204 established that they share an SQL gate kernel but retain distinct RPC names. B1 SS-1, SS-2, SS-3 wrapped per-capability `gate.ts` modules and migrated 3 of 4 `cap-gate.ts` surfaces. SS-4 (final capability migration through orchestrator) and SS-5 (orchestrator default-on flag) remain.

Council 2026-04-28 voice + tool perf review surfaced the unresolved question: when a voice mutation and a UI mutation target the SAME entity within seconds (e.g., user requests shift swap by voice while another user clicks the swap button on dashboard), which write wins? The current implementation has no merge-precedence policy. Two paths can produce divergent outcomes that pass their respective gates but contradict each other in storage.

This ADR is a **prerequisite for B1 SS-4** — without merge-precedence policy, SS-4 ships with a known race condition that the orchestrator cannot resolve.

## Decision Drivers

- ADR-0203 / ADR-0204 separation: voice path and UI path use the same SQL kernel but distinct RPC entry points. They cannot serialize via shared transaction without coordination.
- Council 2026-04-16 Web Perf Trust Gate finding: three concurrent write paths can silently diverge in authority + telemetry (memory: `feedback_trust_gate_mutation_plans.md`).
- L-0146 phantom consumer pattern: race winners must be observable via telemetry, not silent.
- Pontus's "100% trygghet" intent — when voice and UI race, behavior must be deterministic and explainable.

## Considered Options

1. **Last-write-wins, no coordination** — simplest. UI clicks at T+1s overwrite voice mutation at T+0s. Acceptable for read-heavy operations; unacceptable for state-changing mutations like shift swap, contract send, season activation.
2. **Optimistic locking via `updated_at` precondition** — every mutation includes the `updated_at` it observed; gate rejects if entity moved. Caller (voice or UI) sees explicit conflict and retries with fresh state. Standard pattern; requires every gated mutation to plumb `updated_at` through.
3. **Mutex via `engine_mutation_lock` table** — short-lived row lock per (workspace_id, entity_type, entity_id) inserted at gate entry, deleted at exit. Concurrent writes serialize. Adds latency + a new table.
4. **Channel precedence rule** — voice always wins (or UI always wins) within a window. Asymmetric — picks one channel as authoritative. Predictable but counter-intuitive when voice is wrong.
5. **Hybrid: optimistic locking for D1-D5 authoring writes, channel precedence for D6 execution writes** — D1-D5 lives in web (per ADR-0133), so optimistic locking matches authoring patterns. D6 lives in mobile + voice; channel precedence + telemetry-visible conflict resolution matches execution.

## Decision Outcome

Chosen option: **Option 5 — hybrid optimistic locking + channel precedence**, scoped to mutation surface category.

### Specifically

**D1-D5 authoring mutations (web Server Actions only per ADR-0133):**
- Optimistic locking via `updated_at` precondition. Mutation payload includes `entity_updated_at: ISO`. Gate kernel checks `WHERE updated_at = $entity_updated_at`. Mismatch → return `gate_decision='conflict'` with current `updated_at` echoed back.
- Voice paths cannot author D1-D5 (per ADR-0133 boundary). No race possible by construction.

**D6 production + C4 acceptance mutations (mobile + voice + system):**
- Channel precedence: `system > voice > chat > mobile-tap > web-tap` (system-triggered automation wins, voice wins over tap, web tap loses to mobile tap because mobile is closer to point-of-execution per ADR-0133).
- Race detection via short-lived `engine_mutation_lock` row keyed `(workspace_id, entity_type, entity_id)` with TTL 5s. Second writer reads lock + lock_channel; if precedence > current, kill current + take over; if precedence ≤, return `gate_decision='conflict'`.
- Telemetry: every conflict emits `mutation.conflict` with both channels + winning channel + entity reference. Conflicts visible in activity_trail.

### Implementation sequence

1. ADR-0226 accepted (this ADR).
2. Schema migration: add `engine_mutation_lock` table + RLS + 5s TTL trigger.
3. Update `gate_action` SQL kernel: emit `gate_decision='conflict'` with `updated_at_echo` for D1-D5 path; lock-acquire/lock-precedence-check for D6/C4 path.
4. Update capability tool wrappers (B1 SS-4 work) to use kernel-aware error code.
5. Update Server Action `gatedUpdate` to plumb `entity_updated_at`.
6. SS-5 default-on flag flips orchestrator on for new mutations. Old paths drain via deprecation window.

## Rules & Consequences

- **Good, because** races become explicit (`mutation.conflict` telemetry event) instead of silent last-write-wins.
- **Good, because** D1-D5 optimistic locking matches existing TanStack mutation patterns.
- **Good, because** channel precedence for D6 matches "voice is closer to execution than tap" intuition.
- **Bad, because** adds a new table (`engine_mutation_lock`) with TTL trigger. Operational complexity.
- **Bad, because** clients must handle `gate_decision='conflict'` retry. Voice retry UX: re-read state, ask user to reconfirm. Web retry UX: re-fetch + diff + show "data changed, review" banner.
- **Agent Impact:**
  - `botsson-harness-builder`: B1 SS-4 implementation must consume kernel `gate_decision='conflict'` code. Per-cap `gate.ts` files updated to thread `entity_updated_at` for D1-D5 capabilities.
  - `system-agent-coordinator`: capability tool wrappers must include retry-on-conflict semantics in voice channel (voice cannot show banners; must verbally re-prompt).
  - `supervisor`: code-review gate adds "race-conflict handling" to mutation-touching PRs.
  - `close-feature.sh`: when feature touches a gated mutation, require either (a) `entity_updated_at` plumbing OR (b) channel-precedence justification in handoff.

## References

- Council 2026-04-28 — System Council voice + tool perf
- ADR-0133 — Mobile surface boundary (web composes, mobile executes)
- ADR-0203 / ADR-0204 — Dual-gate composition (decision drivers)
- ADR-0207 — `callGateAction` unification (kernel layer)
- ADR-0211 — ADR-0203/0204 amendment for MCP consumer
- L-0146 — Phantom consumer pattern (silent races are this shape's cousin)
- B1 SS-4 / SS-5 — campaign work blocked by this ADR
- Memory: `feedback_trust_gate_mutation_plans.md` (Council 2026-04-16 finding)
