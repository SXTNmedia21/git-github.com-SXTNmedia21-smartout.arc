---
title: "InlineConfirmCard Phase 1 — HITL UI primitive for Botsson chat"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [botsson, harness, hitl, primitive, capability, communication]
---

# InlineConfirmCard Phase 1

> **Source of truth:** This spec is a thin pointer to the two authoritative ADRs that govern
> the design. If this file disagrees with the ADRs, the ADRs win — update this file.

## Canonical ADRs

- **[ADR-0398](../../decisions/0398-inline-confirm-card-primitive.md)** — InlineConfirmCard Primitive (component, client-tool, BotssonChat-fixed registration, stateless proposal_id, visual + motion + a11y contract, 4 telemetry events, 4 blocking conditions)
- **[ADR-0399](../../decisions/0399-channel-platform-descriptors-tool-contract.md)** — Channel + Platform Descriptors on Tool Contract (orthogonal `channel_constraint` + `platforms` axes, 4-layer enforcement)

## Goal

Ship the InlineConfirmCard HITL primitive end-to-end for **`publish_announcement`** only.
LLM emits draft via Architecture B (name-keyed dispatch, no marker interception) → browser
renders inline card with 3 actions (Bekreft / Endre / Avbryt) → user resolves → commit
proceeds with RPC-level idempotency via existing `p_client_message_id`.

## Out of Scope (Phase 2 — separate sortier with own ADRs)

- `send_message` confirm pattern → ADR-0400 (reserved)
- `approve_shift` × `four_eyes_pending` interaction → ADR-0401 (reserved)
- Mobile RN port → Phase 2 (schema lives in `packages/ai/` from day-1 to enable port)
- Edit-flow BIR spawn-under-card → Phase 3

## Council Provenance

Approved 2026-05-23 by full System Council (5/5 reviewers, fact-check 15/15 VERIFIED).
See `docs/council/COUNCIL-LOG.md` entry "2026-05-23 — Arena Inline-Proposal Cards".

Learnings extracted: L-0329 (collision-grep-globally), L-0330 (stateless-default-from-existing-uuid),
L-0331 (BotssonChat-fixed sub-pattern), L-0332 (harness-builder mandatory Phase 3 for Botsson surfaces).

## Blocking Conditions Before Phase 1 Merge (verbatim from ADR-0398)

1. `gate_action` precheck added to `publish-announcement.ts` draft branch (avoid dead-end UX)
2. `show_proposal_card` BotssonChat-fixed registration verified — NOT registered via `useRegisteredTools()`
3. Telemetry registry entries `inline_confirm_card.{shown,confirmed,cancelled,edited}` paired with file:line emit call-sites (anti-phantom per L-NEW-1)
4. System-prompt 10-line block landed in `mr-botsson.ts` and verified via a 3-turn dialog test

## Three Declared Journeys

1. **happy-publish** — admin → chat → "lag kunngjøring X" → card → click Bekreft → published + telemetry
2. **cancel-publish** — same setup → click Avbryt → no RPC + `inline_confirm_card.cancelled` emitted
3. **resume-tamper-defense** — POST `client_tool_results` tampered to mutate `audience_kind` → server re-resolves audience server-side → no privilege escalation (ADR-0398 §Resume-Payload Trust Boundary)

## Implementation Tracks (lead-coordinated)

T1 primitive schema · T7 harness types (ADR-0399) · T3 capability rework · T6 telemetry ·
T5 system prompt · T2 UI component · T4 BotssonChat wiring · T8 E2E · T9 code review · T10 verify.
See plan file `docs/plans/PLAN-inline-confirm-card-phase1.md` in worktree for sequencing + DAG.

## Council Gates

- **Gate 1** (after T1 + T7 land): steward + agent-coord verify schema vs ADRs verbatim
- **Gate 2** (after T4 lands): harness + agent-coord + frontend verify composition + fixed-registration tier
- **Gate 3** (only if T9 finds HIGH): full council escalation
