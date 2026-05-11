---
title: "Journey — Agent sends message, gate grants"
feature: sendmessage-adr-0287-retrofit
journey: agent-sends-message-gate-grants
status: draft
verified_at: null
e2e_test: packages/ai/src/capabilities/communication/__tests__/sendMessage.gate.test.ts
created: 2026-05-11
updated: 2026-05-11
module: MODULE_COMMUNICATION
tags: [journey, happy-path, gate-action, adr-0287]
---

# Journey: Agent sends message, gate grants

**Role:** Botsson agent (via Stage Engine tool invocation)

**Precondition:**
- `engine_authority_config` has row for `(workspace_id, capability='communication')` with `level >= 'suggest'`
- Caller is a member of the target channel (`channel_member` row exists)
- Channel `channel_ai_policy` permits AI participation (default or explicit allow)
- `ctx.channel` is `"chat"` (or another non-voice channel)

## Happy Path

1. Agent invokes `send_message` tool with `{ channel_id, content }` params
2. `sendMessage.execute()` resolves `ctx.workspaceId`, `ctx.profileId`, `ctx.channel`
3. **NEW**: `callGateAction(supabase, workspaceId, profileId, { capability: "communication", action_type: "send_message", channel: ctx.channel, entity_type: "channel_message", entity_id: null })` called BEFORE all other checks
4. Gate evaluates `engine_authority_config` row → returns `{ outcome: "granted", authority_level: "suggest" | "confirm" | "autonomous" }`
5. Existing channel_member check passes (membership verified)
6. Existing `isAiAllowedInChannel` check passes (ADR-0163 layer)
7. INSERT into `channel_message` succeeds
8. `emit("channel.message.sent", { origin_type: "agent", message_type: "text" })` fires
9. Tool returns `JSON.stringify({ sent: true, message: data })`

**Postcondition:**
- Row in `channel_message` with `sender_id = ctx.profileId`, `origin_type` from agent context
- Telemetry event `channel.message.sent` recorded with workspace_id + actor_id
- `gate.*` audit event recorded by `callGateAction` (per ADR-0099)

## Error Paths

- **No `engine_authority_config` row for `(workspace_id, "communication")`** — covered by Journey 3 (default-deny)
- **Channel guard rejects** — covered by Journey 2 (voice channel)
- **Membership missing** — pre-existing layer returns "You are not a member of this channel."
- **`isAiAllowedInChannel` returns false** — pre-existing layer returns "AI participation is disabled..."

## Verification

- [ ] Unit test `sendMessage.gate.test.ts` case "granted → INSERT called, emit called" passes
- [ ] Manual smoke (optional): trigger Botsson `send_message` tool in dev workspace `Strøm Mat & Bar` with admin profile; verify row in `channel_message` + `activity_trail` row from gate
- [ ] gate.ts file matches sibling pattern (signature + docstring style)

**Mark `status: verified` when all three boxes are checked.**
