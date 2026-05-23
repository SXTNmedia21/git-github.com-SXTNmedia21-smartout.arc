---
title: "Journey — Admin sends message via InlineConfirmCard"
feature: inline-confirm-card-send-message
journey: happy-send
status: draft
verified_at: null
e2e_test: null
created: 2026-05-23
updated: 2026-05-23
module: MODULE_BOTSSON
tags: [journey, botsson, hitl, communication, send-message, happy-path]
---

# Journey: Admin sends message via InlineConfirmCard

**Role:** admin

**Precondition:**
- Admin authenticated, has `communication` capability authority for workspace W1
- Workspace has ≥1 active channel (e.g. "Vakter")
- BotssonChat open

## Happy Path

1. Admin types: `"Send 'møte i morgen kl 14' til Vakter-kanalen"` → BotssonChat POSTs to `/api/botsson/chat`
2. LLM calls `send_message({channel_id:"<vakter-uuid>", body:"møte i morgen kl 14", confirm:false})` → tool body:
   - precheck `gate_action(workspace, "communication", "chat", profile, "send_message")` → ALLOW
   - look up channel via RLS-scoped query — verify channel belongs to workspace + is active
   - generate `clientMessageId = crypto.randomUUID()` (before confirm-branch)
   - call `buildInlineConfirmCard({proposal_id, surface:"message", draft:{channel_id, body}, preview:{title:"Send melding til Vakter", body_excerpt:"møte i morgen kl 14", metadata:[{label:"Kanal",value:"Vakter"},{label:"Type",value:"DM"}]}, actions:[confirm:"Send",edit,cancel], channel_constraint:["chat"], platforms:["web","mobile"]})`
   - emit `inline_confirm_card.shown` (server-side, surface:"message")
   - return JSON with `phase:"draft", proposal_id, descriptor, next_step`
3. LLM per mr-botsson.ts prompt → calls `show_proposal_card(descriptor)` → stage-engine emits ClientToolCall → browser
4. BotssonChat renders InlineConfirmCard inline as message bubble (MessageSquare icon for surface:"message")
5. Admin sees card: "Send melding til Vakter" / body excerpt "møte i morgen kl 14" / chips [Kanal: Vakter, Type: DM] / [Send / Endre / Avbryt]
6. Admin clicks **Send** → browser POSTs `client_tool_results [{result: '{"proposal_id","action":"confirm"}'}]`
7. LLM resumes → calls `send_message({channel_id, body, confirm:true, proposal_id})` → tool body:
   - re-derive channel via ctx.workspaceId RLS (NOT body channel_id — DEFENSE 3 narrowing per Phase 1 pattern)
   - INSERT into channel_message with `client_message_id = proposal_id` (UNIQUE constraint enforces idempotency)
   - emit `inline_confirm_card.confirmed`
8. LLM responds: `"Sendt til Vakter ✅"` → card transitions to resolved state

**Postcondition:**
- 1 row in `channel_message` with body content, `client_message_id = proposal_id`, `channel_id = vakter-uuid`, `workspace_id = W1`
- 1 row in `engine_event` (channel.message.sent)
- activity_trail rows: `inline_confirm_card.shown` + `inline_confirm_card.confirmed` (both surface="message")
- PostHog received both events
- Channel members receive notification per their channel subscription

## Error Paths

- **gate_action denies** → text fallback, no card
- **channel_id resolves to NULL (foreign or inactive)** → "Kan ikke sende melding — kanal finnes ikke eller er inaktiv"
- **LLM forgets show_proposal_card** → draft body returns as text (regression in mr-botsson.ts)
- **RPC fails on commit** → card transitions to error state, retry possible

## Verification

- [ ] Implementation matches steps 1-8 end-to-end
- [ ] E2E test at `apps/e2e/tests/inline-confirm-card-send-message/happy-send.spec.ts`
- [ ] Manually tested via `op run pnpm dev` admin chat session
- [ ] activity_trail rows verified
- [ ] channel_message row verified with matching client_message_id

**Mark `status: verified` after Pontus runs `close-feature.sh 6` + confirms manual smoke (boxes 3-5).**
