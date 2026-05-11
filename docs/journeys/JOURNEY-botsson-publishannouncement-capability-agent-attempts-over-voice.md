---
title: "Journey — Agent attempts publish over voice channel"
feature: botsson-publishannouncement-capability
journey: agent-attempts-over-voice
status: draft
verified_at: null
e2e_test: apps/e2e/komm-nyheter/agent-publish/journey-2-voice-reject.spec.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, deny-path, voice-guard, adr-0078]
---

# Journey: Agent attempts publish over voice channel

**Role:** Botsson voice agent (Ultravox or LiveKit session)

**Precondition:**
- `ctx.channel = "voice"`
- All other layers OK

## Happy Path (deny)

1. Voice agent invokes `publish_announcement` over Ultravox
2. Tool execute() FIRST STATEMENT: `if (ctx.channel === "voice") return "Announcement publishing is not available over voice. Switch to chat."`
3. NO callGateAction call (return is before gate)
4. NO audience resolution
5. NO INSERT
6. NO emit
7. Voice agent surfaces the reject copy to user

**Postcondition:**
- Zero rows added to `channel_message`
- Zero events emitted
- Zero gate audits (none called)

## Error Paths

- Agent retries via chat channel → different ctx.channel → proceeds to normal path
- Agent body-supplies `channel: "chat"` to bypass server-derived ctx.channel → tool MUST ignore body channel (ADR-0151 server-derive)

## Verification

- [ ] E2E spec passes — tool returns voice-deny copy + zero side effects
- [ ] Unit test asserts FIRST statement is the voice check (regression guard)
- [ ] Manual smoke

**Mark `status: verified` when all 3 boxes checked.**
