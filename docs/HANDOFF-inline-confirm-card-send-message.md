---
title: "HANDOFF — InlineConfirmCard Phase 2-a (send_message)"
feature: inline-confirm-card-send-message
status: ready-for-close
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [handoff, botsson, hitl, send-message, phase-2a, adr-0403]
---

# HANDOFF — InlineConfirmCard Phase 2-a (send_message)

## Summary

Phase 2-a extends the Phase 1 InlineConfirmCard HITL primitive to `send_message`. Two-call confirm pattern matching `publish_announcement`. Zero new UI component code, zero new telemetry events, zero new client-tool registration, zero system-prompt change — Phase 1 was designed surface-agnostic from day one and Phase 2-a is the proof.

**Final scope:** 4 commits, ~7 files changed (vs Phase 1's 22). The "reuse" claim of ADR-0403 §Decision 1 held.

## Commits

| SHA | What |
|---|---|
| `69723a393` | Phase 2 sortie setup (spec stub + plan + 3 journeys) |
| `2fa0d2d3f` | ADR-0403 draft + decision log registration |
| `436a31b0e` | T3-msg send_message capability rework (the work) |
| `3d4d3100b` | Doc-sync: ADR + 2 journeys aligned to real schema (`content`, `channel_type`) |
| `6f6c58a5f` | T8-msg 3 E2E specs + helpers |

## Decisions (registered in ADR-0403)

10 decisions, full prose in `docs/decisions/0403-send-message-inline-confirm-pattern.md`. Highlights:

1. **Surface contract `surface:"message"`** — Phase 1 enum already includes it; UI component maps to `MessageSquare` lucide icon (verified in `packages/ui/src/components/inline-confirm-card.tsx:59,126-130`).
2. **Preview shape** — channel-context chips (`Kanal`, `Type`). No recipient_count (channel members implicit via RLS).
3. **Schema discriminator** — `channel.channel_type` enum (not `is_direct` boolean). "direct" → "Direktemelding" chip; other → "Gruppe".
4. **gate_action precheck on draft** — Blocking Condition #1, mirrors Phase 1 T3 pattern (no dead-end UX).
5. **editable_fields = `["content"]`** — `content` is the real schema column on `channel_message` and the Zod param name (no UX-facing rename). `channel_id` NOT whitelisted (tamper vector).
6. **No four_eyes** — `send_message` is single-actor. Phase 2-b `approve_shift` will need `mode: awaiting_approver` extension.
7. **Zero new telemetry events** — Phase 1's 4 events (`shown/confirmed/cancelled/edited`) carry `surface` discriminator. PostHog routing identical.
8. **System prompt unchanged** — Phase 1 HITL block at `mr-botsson.ts:170-186` is surface-agnostic.
9. **platforms = `["web"]`** — Phase 2-b approve_shift adds mobile (D6 execute verb per ADR-0133).
10. **Slot reservation** — Phase 1 reserved 0400/0401 in ADR-0398, landed at 0403 due to cross-branch collisions (5th occurrence of the pattern; ADR-0398 §Phase Sequencing should be amended in Phase 2-b pre-flight, not a Phase 2-a blocker).

## Defense layers (resume-tamper threat model)

| Layer | Mechanism | Code |
|---|---|---|
| DEFENSE 1 | `ctx.workspaceId` from JWT (ADR-0151) | `tools.ts:228` (existing pattern) |
| DEFENSE 2 | RLS-scoped channel lookup rejects cross-workspace `channel_id` | `tools.ts:240-249` (existing channel lookup) |
| DEFENSE 3 | `editable_fields=["content"]` — narrowing on resume | `tools.ts:301-308` (comment block) |
| DEFENSE 4 | `client_message_id` UNIQUE index on `channel_message` | migration `20260422300000_channel_communications.sql` |

DEFENSE 2 + 4 are the load-bearing layers for `send_message`. DEFENSE 3 is fragile until Phase 3 ships `engine_memory` draft-state persistence (deferred per ADR-0403 §Trade-offs).

## Verification status

| Artifact | Status | Evidence |
|---|---|---|
| `@smartout/ai` typecheck | clean for communication slice | T3-msg agent report — 0 new errors; 26/26 existing tests pass |
| T3-msg unit tests | 26/26 pass | `sendMessage.gate.test.ts` updated for 2-phase shape |
| T2 (UI component surface dispatch) | PASS — surface-agnostic | `inline-confirm-card.tsx:59,126-130,156` |
| T4 (BotssonChat fixed-impl dispatch) | PASS — surface-agnostic | `BotssonChat.tsx:308-327` |
| T6 (telemetry registry zero-add) | PASS — surface field in all 4 events | `registry.ts:4503-4536,15275-15290` |
| Decision-5/8 system prompt unchanged | PASS — surface-agnostic | `mr-botsson.ts:170-186` |
| show_proposal_card client-tool accepts "message" | PASS | `inline-confirm-card-tool.ts:109-119,213` |
| E2E specs typecheck | clean for new specs (pre-existing journey-ir errors unrelated) | T8-msg agent report |
| Live LLM smoke | **NOT RUN** — deferred to Pontus tmux per Phase 1 design |

## Known issues / debt

1. **Live LLM smoke not run.** Same deferral as Phase 1 (sortie design accepts this trade-off; WSL2 OOM constraints).
2. **3 E2E selector assumptions** unverified at runtime (T8-msg report):
   - `[data-testid="inline-confirm-card-icon-message"]` — icon-element testid; UI component must expose for surface-discriminator E2E
   - `text="Gruppe"` chip text — i18n drift risk; consider `data-testid` for the chip
   - `text="FORSLAG"` badge text — same risk
   Will be V&V'd at Pontus's tmux smoke run; not blocking.
3. **Mobile RN port** deferred to Phase 2-b (approve_shift sortie).
4. **ADR-0398 slot-sequencing amendment.** Steward noted the ADR's §Phase Sequencing reserves 0400/0401 for Phase 2 slots; reality landed at 0403/0405. Amend ADR-0398 prose in Phase 2-b pre-flight.
5. **Phase 3 stateful draft store** via `engine_memory` will replace the stateless DEFENSE 3 narrowing. Documented in ADR-0403 §Trade-offs.

## Next steps (Phase 2-b)

1. **ADR-0405 — approve_shift × four_eyes_pending** (reserved slot, free across all branches at commit `6f6c58a5f`)
2. Extend descriptor `mode` enum with `awaiting_approver`
3. Add `platforms: ["mobile"]` to approve_shift descriptor (D6 execute verb, ADR-0133 mobile parity)
4. ADR-0398 §Phase Sequencing slot-number amendment (housekeeping)

## Architecture invariants verified

- ✅ `workspace_id` server-derived (ADR-0151), never trusted from body
- ✅ No silent fallback on identity fields (L-0177 — grep `params.workspace_id` / `body.workspace_id` returns zero)
- ✅ `emit()` server-side in tool body (L-0233 — voice context is separate LLM)
- ✅ BotssonChat-fixed client-tool sub-pattern preserved (L-0331)
- ✅ Proposal_id stateless (= `client_message_id` UUID, L-0330)
- ✅ Voice-channel rejected on `send_message` (chat-only per ADR-0078, preserved at `tools.ts:165`)
- ✅ ADR-0240 cross-namespace write boundary respected — `send_message` writes only to `channel_message` (its own namespace)

## Files touched

```
docs/decisions/0403-send-message-inline-confirm-pattern.md          (new)
docs/decisions/0000-decision-log.md                                  (+1 entry)
docs/journeys/JOURNEY-inline-confirm-card-send-message-happy-send.md (new + sync)
docs/journeys/JOURNEY-inline-confirm-card-send-message-cancel-send.md (new)
docs/journeys/JOURNEY-inline-confirm-card-send-message-resume-tamper-defense.md (new + sync)
docs/plans/PLAN-inline-confirm-card-send-message.md                  (new)
docs/superpowers/specs/2026-05-23-inline-confirm-card-send-message.md (new)
packages/ai/src/capabilities/communication/tools.ts                  (modified: T3-msg confirm-split + 2 emit + DEFENSE-3 comment)
packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts (updated: confirm flag + 2x emit assertion)
apps/e2e/tests/inline-confirm-card-send-message/helpers.ts            (new, 234 lines)
apps/e2e/tests/inline-confirm-card-send-message/happy-send.spec.ts    (new)
apps/e2e/tests/inline-confirm-card-send-message/cancel-send.spec.ts   (new)
apps/e2e/tests/inline-confirm-card-send-message/resume-tamper-defense.spec.ts (new)
docs/HANDOFF-inline-confirm-card-send-message.md                      (this file)
```

7 src/doc files + 4 e2e files + 1 ADR + 1 HANDOFF.
