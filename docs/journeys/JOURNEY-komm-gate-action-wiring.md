---
title: "User Journeys — Komm Gate-Action Wiring"
status: draft
updated: 2026-04-29
created: 2026-04-29
module: botsson
tags: [botsson, komm, gate-action, voice-guard, journeys]
---

# User Journeys — Komm Gate-Action Wiring

Three journeys covering the gate-action + voice-guard changes to the komm mutation hooks and Botsson tool executors.

---

## Journey J1: Manager uses Emma (chat) to send a message — gate authority passes

**Precondition:**
- User is authenticated as a workspace manager
- User is on `/dashboard/komm/chat` with an active channel selected
- `engine_authority_config` row exists for `komm.send_message` with `level='suggest'`, `min_role='employee'`
- Emma is active (BotssonShell mounted, KommToolsBridge registered under "komm" source)

1. Manager tells Emma: "Send 'Husk å melde deg på morgenmøtet' til denne kanalen" →
   System: Emma invokes `sendMessage` tool with `content="Husk å melde deg på morgenmøtet"` →
   User sees: Emma confirms wording verbally before invoking the tool.
2. Emma calls the `sendMessage` tool executor →
   System: executor checks `sessionChannel !== "voice"` (passes — session is chat) →
   User sees: nothing yet, processing continues.
3. `onSendMessage` callback fires → `useSendMessage.mutateAsync({ content })` is called →
   System: `use-send-message.ts` calls `supabase.rpc("gate_action", { p_capability: "komm.send_message", p_action_type: "send", p_actor_profile_id: profileId, p_workspace_id: workspaceId, p_channel: "chat" })` →
   User sees: nothing yet.
4. `gate_action` returns `{ allow: true }` →
   System: hook proceeds to `supabase.from("channel_message").insert(...)` →
   User sees: message appears in the channel timeline in real-time via Supabase Realtime subscription.
5. `onSuccess` fires →
   System: `emit("channel.message.sent", { workspace_id, actor_id, ... })` is called →
   User sees: no visible change (telemetry is silent to user). Emma responds: "Melding sendt."

**Postcondition:** Message is persisted in `channel_message`. `activity_trail` + `engine_event` rows created by emit(). `engine_authority_config` consulted exactly once per send.

**Error paths:**
- Gate denies (`allow: false`): hook throws with `gate_action` reason string. `onError` fires → `toast.error(reason)`. Emma receives `{ ok: false, reason }` and explains to the user in Norwegian.
- `gate_action` RPC unavailable: hook throws "gate_action unavailable: ...". Same error path — toast + Emma explanation. Never default-allows.
- No active channel: executor returns `{ ok: false, reason: "Ingen kanal er åpen." }` before calling mutateAsync.

---

## Journey J2: Manager uses Emma (chat) to create a DM channel — gate authority passes

**Precondition:**
- User is authenticated as a workspace manager
- User is on `/dashboard/komm` (any sub-route with KommToolsBridge mounted)
- `engine_authority_config` row exists for `komm.create_channel` with `level='suggest'`, `min_role='employee'`
- Emma is active in chat mode

1. Manager tells Emma: "Start en DM med Kari Nordmann" →
   System: Emma first calls a profile-lookup tool to resolve `otherProfileId` →
   User sees: Emma says "Fant Kari. Skal jeg starte en samtale?"
2. Manager confirms →
   System: Emma invokes `createChat` tool executor with `{ otherProfileId: "<uuid>" }` →
   User sees: nothing yet, processing continues.
3. Executor checks `sessionChannel !== "voice"` (passes) →
   `onCreateChat` callback fires → `useCreateChannel.mutateAsync({ channelType: "direct", memberProfileIds: ["<uuid>"] })` is called →
   System: `use-create-channel.ts` calls `supabase.rpc("gate_action", { p_capability: "komm.create_channel", p_action_type: "create", p_actor_profile_id: profileId, p_workspace_id: workspaceId, p_channel: "chat" })` →
   User sees: nothing yet.
4. Gate returns `{ allow: true }` →
   System: hook calls `supabase.rpc("create_channel", { p_channel_type: "direct", p_created_by: profileId, p_member_profile_ids: ["<uuid>"] })` →
   User sees: channel list updates to include the new DM conversation.
5. `onSuccess` fires →
   System: `emit("channel.created", { ... })` called →
   Emma responds: "DM-kanal opprettet med Kari."

**Postcondition:** New `channel` row created (or existing DM returned if already exists). `channel_member` rows exist for both participants. Telemetry emitted.

**Error paths:**
- Gate denies: `onError` fires → `toast.error(reason)`. Emma explains denial to manager.
- `otherProfileId` missing: executor returns `{ ok: false, reason: "otherProfileId mangler." }` without calling mutateAsync.
- `create_channel` RPC returns error: thrown error caught in `onCreateChat` callback → `{ ok: false, reason: error.message }` → Emma explains.

---

## Journey J3: Manager in voice mode asks Emma to send a message — tool rejects per ADR-0078

**Precondition:**
- User is authenticated as a workspace manager
- User is on `/dashboard/komm/chat` with an active channel selected
- Emma is active in **voice mode** (Ultravox session, `sessionChannel === "voice"`)
- KommToolsBridge has `sessionChannel="voice"` propagated through `KommToolInput`

1. Manager says (via voice): "Send beskjed til kanalen: møtet er utsatt" →
   System: Emma invokes `sendMessage` tool executor →
   User hears: nothing yet.
2. Executor checks `sessionChannel === "voice"` →
   System: immediately returns `{ ok: false, reason: "Kan ikke sende meldinger eller opprette kanaler over voice. Bytt til chat." }` — **no gate_action call, no DB write** →
   User hears: Emma says (in voice): "Jeg kan ikke sende meldinger via stemme. Bytt til chat for å sende meldingen."
3. Manager switches to chat mode or dismisses →
   System: normal chat flow resumes if user proceeds in chat.

**Postcondition:** No `channel_message` row created. No `gate_action` RPC called. No emit(). ADR-0078 write-restriction enforced silently at L1 tool layer.

**Error paths:**
- If `sessionChannel` is not propagated (undefined/null): executor defaults to allowing the action (null is not "voice") — the hook-level gate_action still runs. This is an acceptable degraded mode; voice-guard is best-effort at L1 when the bridge does not propagate the channel.
- `createChat` in voice mode: identical rejection path to `sendMessage`.
