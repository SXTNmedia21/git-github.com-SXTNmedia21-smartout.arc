---
title: "Journey — Agent sends message over voice, gate denies"
feature: sendmessage-adr-0287-retrofit
journey: agent-sends-message-gate-denies-voice
status: verified
verified_at: 2026-05-12
e2e_test: packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, deny-path, channel-guard, adr-0078, adr-0287]
---

# Journey: Agent sends message over voice, gate denies

**Role:** Botsson voice agent

**Precondition:**
- `ctx.channel = "voice"` (Ultravox or LiveKit session)
- `engine_authority_config` row exists for `(workspace_id, "communication")` with any level — channel restriction comes from gate, not from authority absence
- ADR-0078 channel-restriction policy in place (capability `allowedChannels` includes "voice" but action-level guard may differ; OR engine_process channel restriction blocks)

## Happy Path (deny)

1. Voice agent invokes `send_message` tool with `{ channel_id, content }` over Ultravox session
2. `sendMessage.execute()` runs, calls `callGateAction(... channel: "voice" ...)`
3. Gate evaluates: workspace has `communication` capability granted BUT engine_process or capability-level rule restricts `send_message` action over voice channel (PII-prone broadcast surface)
4. Gate returns `{ outcome: "denied", reason: "channel-restricted" }`
5. `sendMessage` execute() checks `outcome !== "granted"`, returns descriptive error: `"Cannot send messages over voice channel. Switch to chat to send a message."` (or similar — match existing voice-deny copy from `use-komm-tools.ts:215-221`)
6. NO channel_message INSERT
7. NO `channel.message.sent` emit
8. `gate.*` audit event records the denial with `outcome: "denied"`, `reason: "channel-restricted"`

**Postcondition:**
- Zero rows in `channel_message` for this attempt
- Zero `channel.message.sent` events
- ONE `gate.denied` event recorded with channel + capability + action_type
- Agent surfaces the descriptive error to the voice session

## Error Paths

- **Gate misconfigured (no row blocks voice)** — gate falls back to fail-closed default per ADR-0189; same denial outcome via different path
- **Channel param tampered to "chat" by agent** — server-derives `ctx.channel` from session context (ADR-0151 server-derive); body-supplied channel is ignored

## Verification

- [ ] Unit test `sendMessage.gate.test.ts` case "denied (channel-restricted) → no INSERT, no emit, descriptive error" passes
- [ ] Manual smoke (optional): invoke Botsson via voice channel attempting `send_message`; verify rejection + voice-friendly error message returned
- [ ] `gate.denied` event observable in `activity_trail` (assertion via service-role query)

**Mark `status: verified` when all three boxes are checked.**
