---
title: "ADR-0103: observer_request in C4 Decision Layer"
id: ADR-0103
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0103: observer_request in C4 Decision Layer

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

The Governance/Training design introduces `observer_request`: a record that a second human must observe and sign off on a protocol completion before it is accepted. Within the ADR-0095 five-layer model, it was unclear whether this belonged in the Reality layer (something happened) or the Decision layer (permission granted). Because protocol completion is *gated* until sign-off, the artifact is decision-making, not reality-recording.

## Decision Drivers

- ADR-0095 separates Reality (what happened) from Decision (what's permitted).
- The existing `shift_approval` pattern already sits in C4 Decision and has the same structural shape (request → claim → approve/reject).
- Observer outcomes must route through the unified authority gate (ADR-0099 + ADR-0101) — they are permission events.

## Considered Options

- **A.** Place `observer_request` in D6 Reality alongside `time_entry`.
- **B.** Place `observer_request` in C4 Decision, parallel to `shift_approval`.
- **C.** Overload `change_proposal` to carry observer sign-off semantics.

## Decision Outcome

Chosen option: **B**.

- `observer_request` lives in the C4 Decision layer, structurally parallel to `shift_approval`.
- Claim/approve/reject transitions flow through `gate_action` (ADR-0099 + ADR-0101).
- Default escalation window of 72h for pending requests; configurable via `engine_authority_config.observer_escalation_hours`.

## Rules & Consequences enforced for Agents

- **Good, because** consistent with the five-layer model — sign-off is a permission event, not an observation.
- **Good, because** reuses `shift_approval`'s shape and tooling.
- **Bad, because** observer evidence semantics still live partly in protocol content — tight coupling between C4 and governance content must be kept under review.
- **Agent Impact:** Observer claim/approve/reject MUST call `gate_action`. Do NOT place `observer_request` in D6 or bypass the gate. Escalation window is a config value, not a constant.
