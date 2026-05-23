---
title: "InlineConfirmCard Phase 2-a — send_message confirm pattern"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [botsson, harness, hitl, communication, send-message, phase-2]
---

# InlineConfirmCard Phase 2-a — send_message confirm pattern

> **Source of truth:** Thin pointer to authoritative ADRs. If this file disagrees with the ADRs, the ADRs win.

## Canonical ADRs

- **[ADR-0398](../../decisions/0398-inline-confirm-card-primitive.md)** — InlineConfirmCard primitive (Phase 1, accepted)
- **[ADR-0399](../../decisions/0399-channel-platform-descriptors-tool-contract.md)** — Channel + Platform descriptors
- **ADR-0403** (draft, this sortie) — `send_message` confirm pattern (capability migration, Phase 2-a)

## Goal

Extend the InlineConfirmCard HITL primitive to `send_message` capability via Architecture B. Today `send_message` is single-call (commit immediately). Phase 2-a splits to confirm=false (draft + descriptor) → `show_proposal_card` → confirm=true (commit). Same primitive, new consumer.

**Key differences from Phase 1 `publish_announcement`:**

- **No audience resolution** — `send_message` writes to ONE channel; recipients = channel members (RLS-scoped, primary DEFENSE 1).
- **No `audience_kind` complexity** — single `channel_id` body param; tamper-target is the channel_id itself.
- **Existing chat-only guard** — `tools.ts:165` already rejects voice; no change needed.
- **No `four_eyes_pending` interaction** — `send_message` is single-actor (no second-approver gate).
- **DEFENSE 3 narrowing** — on resume with `proposal_id`, re-resolve `channel_id` from `ctx.workspaceId` RLS scope (foreign channel_id rejects on lookup).
- **Surface:** `"message"` (Phase 1 ADR-0398 enum already includes it; no schema change).

## Out of Scope (Phase 2-b separate sortie)

- `approve_shift` × `four_eyes_pending` interaction → ADR-0405 (reserve)
- Mobile RN port (D6 execute verb; deserves own sortie)
- Phase 3: real edit-flow BIR spawn-under-card

## Three Declared Journeys

1. **happy-send-message** — admin → chat → "Send 'møte i morgen kl 14' til Vakter-kanalen" → card → click Send → channel_message row + .shown/.confirmed telemetry
2. **cancel-send-message** — same setup → click Avbryt → no INSERT + .shown/.cancelled telemetry
3. **resume-tamper-defense-send-message** — POST `client_tool_results` tampered to mutate `channel_id` to foreign-workspace channel → server defense via DEFENSE 1 (ctx.workspaceId from JWT, RLS rejects cross-workspace channel_id on `.eq("channel_id", X).eq("workspace_id", ctx.workspaceId)`)

## Blocking Conditions (mirror Phase 1)

1. `gate_action` precheck in `send_message` draft branch before descriptor return
2. Reuses Phase 1 `show_proposal_card` BotssonChat-fixed client-tool (no new registration)
3. Reuses Phase 1 telemetry events (`inline_confirm_card.{shown,confirmed,cancelled,edited}`) — surface field discriminates `"message"` vs `"announcement"` for downstream analytics
4. System-prompt block from Phase 1 (mr-botsson.ts) already teaches LLM the flow — no change needed unless message-specific instruction surfaces

## Tracks (lead-coordinated, DAG)

```
T0 setup (this commit)
T1.5 ADR-0403 draft
T3-msg send_message rework (gate_action precheck + descriptor return + commit accepts proposal_id)
T6-msg verify telemetry — should require ZERO new events (reuse Phase 1 4-event set)
T2-msg UI verify — should require ZERO new component code (Phase 1 primitive handles surface:"message")
T4-msg BotssonChat — should require ZERO change (Phase 1 fixed-impl handles surface enum dispatch)
T8-msg E2E 3 specs
T9 review + HANDOFF + close
```

**Expected scope:** ~6 files changed (vs Phase 1's 22). Primarily server-side (publish-announcement.ts equivalent on send_message + ADR + 3 journeys + 3 specs).

## Council Provenance

Approved 2026-05-23 by Pontus directly (Phase 1 council verdict 2026-05-23 already approved primitive + descriptors; Phase 2 is extension under same contract). No new council needed unless ADR-0403 surfaces new architectural decision beyond send_message-confirm migration.
