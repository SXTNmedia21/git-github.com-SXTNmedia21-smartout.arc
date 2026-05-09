---
title: "Journey: Komm Tools Bridge — Mr. Botsson via Komm Surface"
status: done
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, komm, tools-bridge, helpdesk, channel, journey, ADR-0099]
decisions: [ADR-0099, ADR-0078, ADR-0160]
---

# Journey: Komm Tools Bridge — Mr. Botsson via Komm Surface

## Context

The `komm-tools-bridge` mounts 8 Botsson tools on all 5 komm sub-routes
(`/dashboard/komm`, `/dashboard/komm/channels`, etc.). These tools allow Mr. Botsson
to read channel state and perform komm actions from within the komm surface.

Source: `apps/web/src/app/dashboard/komm/_tools/komm-tools-bridge.tsx`
Authority seed: `supabase/migrations/20260519200000_seed_komm_authority.sql`

5 read tools: `listChannels`, `getActiveChannel`, `getRecentMessages`, `getUnreadCount`, `getMyHelpdeskCount`
3 action tools: `sendMessage`, `createChat`, `joinCall`

## Journey: Employee Asks Botsson to Send a Message

**Precondition:**
- Employee is authenticated, on any `/dashboard/komm/*` route.
- Komm tools bridge is mounted (all 5 sub-routes).
- Channel exists for the workspace.
- C4 authority for `komm.send_message` allows the employee's tier.

**Steps:**

1. Employee opens Botsson chat (on `/dashboard/komm` or any sub-route)
   → System loads komm-tools-bridge tools into Botsson's tool registry for this surface
   → Botsson sees 5 read + 3 action komm tools

2. Employee asks: "Send en melding til vaktlaget: Husk å sjekke temperaturer"
   → Botsson calls `listChannels` (read_only) to find the relevant channel
   → System returns channel list from `getActiveChannel` / `listChannels` tools
   → Botsson identifies "vaktlaget" channel

3. Botsson proposes the send action (confirm tier):
   "Jeg vil sende: 'Husk å sjekke temperaturer' til #vaktlaget. Bekreft?"
   → Employee confirms

4. Botsson calls `sendMessage` tool
   → Tool calls `gate_action` (ADR-0099, capability slug: `komm.send_message`)
   → `gate_action` verifies C4 authority for the employee's profile
   → On approval: message is sent to channel
   → ADR-0078 voice guard checked — `sendMessage` is chat-only, rejected in voice channel

5. Botsson confirms: "Melding sendt til #vaktlaget."
   → Telemetry event emitted

**Postcondition:**
- Message appears in the channel.
- Telemetry emitted via `emit()`.

**Error paths:**
- C4 authority denies → `gate_action` returns denied. Botsson: "Du har ikke tillatelse til å sende meldinger via meg på dette arbeidsstedet."
- Voice channel request → Layer 3 guard rejects (ADR-0078). Botsson: "Denne handlingen er bare tilgjengelig i chat-modus."
- Channel not found → Botsson: "Fant ingen kanal som matcher 'vaktlaget'. Kan du spesifisere?"

---

## Journey: Employee Asks Botsson About Unread Messages

**Precondition:**
- Employee is on `/dashboard/komm/*`.
- Komm tools bridge mounted.

**Steps:**

1. Employee asks: "Har jeg uleste meldinger?"
   → Botsson calls `getUnreadCount` (read_only tool)
   → System returns count of unread messages for the employee's channels

2. Botsson responds: "Du har 3 uleste meldinger."
   (or) "Du har ingen uleste meldinger."

**Postcondition:** Read-only — no state changed.

**Error paths:**
- Read fails (Supabase timeout) → Botsson: "Kunne ikke hente meldinger akkurat nå. Prøv igjen."

---

## Journey: Employee Asks Botsson to Create a Chat

**Precondition:**
- Employee on `/dashboard/komm/*`.
- C4 authority for `komm.create_channel` allows the employee.

**Steps:**

1. Employee asks: "Opprett en chat med Sara"
   → Botsson calls `createChat` tool (action tool)
   → `gate_action` verifies `komm.create_channel` authority
   → On approval: new chat channel created between employee + Sara

2. Botsson confirms: "Chat opprettet med Sara."

**Error paths:**
- Sara not found in workspace → Botsson: "Fant ingen med navnet Sara i din bedrift."
- Authority denied → Botsson explains missing permission.

## Tool Mounting Notes

- Komm tools bridge is mounted via `"komm"` registry source on all 5 komm sub-routes.
- Tools are NOT available on other dashboard routes (not in global tool registry).
- `sendMessage` + `createChat` are wired to `gate_action` (ADR-0099).
- Both action tools have ADR-0078 voice guard — they reject voice channel requests.
