---
title: "ADR-0101: Four-Eyes Extension of gate_action RPC"
id: ADR-0101
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0101: Four-Eyes Extension of gate_action RPC

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

ADR-0099 established `gate_action` as the unified authority gate across `engine-dispatch` and `agent-router`. The Governance/Training UI council session (2026-04-15) surfaced a need for two-person sign-off (four-eyes) on high-risk protocol evidence and policy changes. Without a gate-layer extension, UI components would need to re-evaluate approval rules client-side, duplicating authority logic and risking drift from the RPC truth.

## Decision Drivers

- Authority logic must live in one place (the gate) — UI re-evaluation is forbidden.
- Four-eyes must be declaratively configurable per action/scope, not hard-coded.
- The gate result must carry enough structure for UI to render approver state without extra round-trips.
- Must not fork `gate_action` — extend the existing return shape.

## Considered Options

- **A.** Add a separate `require_four_eyes` RPC called alongside `gate_action`.
- **B.** Extend `gate_action` return shape with four-eyes fields and add a `requires_four_eyes` column on `engine_authority_config`.
- **C.** Leave four-eyes to application code (UI + service) outside the gate.

## Decision Outcome

Chosen option: **B** — extend `gate_action`.

- Add column `requires_four_eyes BOOLEAN` to `engine_authority_config`.
- Extend `gate_action` return shape to `{ allow, reason, approvers_needed, approvers_present[], downgrade_to }`.
- When `requires_four_eyes = true` and `approvers_present.length < 2`, the gate returns `allow=false, reason='four_eyes_required'`.
- UI components (`<AuthorityChip>`, `<FourEyesStatus>`) render strictly from the gate result — they never re-evaluate authority.

## Rules & Consequences enforced for Agents

- **Good, because** the gate remains the single source of authority truth (preserves ADR-0099) while adding expressiveness.
- **Good, because** UI stays read-only against gate output, preventing authority drift.
- **Bad, because** the `gate_action` contract is now wider; every caller must handle the extended return shape.
- **Agent Impact:** Every write path (`engine-dispatch`, `agent-router`, `change_proposal` commit) MUST call `gate_action` and honor the extended shape. UI MUST NOT compute four-eyes state locally — render from `approvers_needed` / `approvers_present` only.
