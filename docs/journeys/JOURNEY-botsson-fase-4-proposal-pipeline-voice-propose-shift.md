---
title: "Journey — Botsson voice proposes shift create/update/delete"
feature: botsson-fase-4-proposal-pipeline
journey: voice-propose-shift
status: draft
verified_at: null
e2e_test: null
created: 2026-05-06
updated: 2026-05-06
module: Botsson
tags: [journey]
---

# Journey: Botsson voice proposes shift change

**Role:** admin / manager (anyone with schedule write authority)

**Precondition:** User on `/dashboard/schedule`. Botsson Orb mounted with active voice session. Authority config permits proposal-domain tools.

## Happy Path

1. User says "Lag en kveldsvakt for Anna i morgen kl 16-22" → Botsson invokes `propose_create_shift` tool via stage-engine → tool returns `{ proposal_id, source: "voice", ... }` → ScheduleVoiceToolsBridge listener catches `BotssonActivityEvent` → `addProposal()` inserts ShiftProposal into React state → ghost card renders on schedule grid with "Foreslått av Botsson (stemme)" pill.

2. User says "Endre Annas vakt på fredag til 17-23" → Botsson invokes `propose_update_shift` with target shift_id → ghost card renders showing diff (current vs proposed).

3. User says "Slett Annas vakt på søndag" → Botsson invokes `propose_delete_shift` → ghost card renders with strikethrough on target shift.

**Postcondition:** Ghost card visible. NO `schedule_shift` row created/updated/deleted. `change_proposal` row exists with `source = 'voice'`. Telemetry: `change_proposal.proposed` emitted.

## Error Paths

- **Botsson voice tool called outside `/dashboard/schedule`** → path-gating in `tools-schedule.ts` rejects with structured error → no ghost card, error spoken back to user.
- **Tool succeeds but `addProposal` source is `undefined`** → R3: normalize to `"agent_response"` default → never write `undefined` to React state.
- **Voice retry (LLM duplicate tool call)** → V0 known limit (SMA-298): two ghost cards may appear. Acceptable for V0.

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter) — Task 14.2/14.3/14.4
- [ ] Manually tested end-to-end with real microphone

**Mark `status: verified` in frontmatter when all three boxes are checked.**
