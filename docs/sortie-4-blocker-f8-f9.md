---
title: Sortie 4 Blocker — F8-F9 chat_message BFF Route Missing
status: blocked
created: 2026-05-06
updated: 2026-05-06
module: mobile
tags: [blocker, adr-0132, chat, bff, mobile]
sortie: feat/audit-sortie-4-mobile-remediation
---

# Sortie 4 Blocker: F8-F9 — chat_message BFF Route Missing

## Summary

Audit finding H2 flagged two files for direct `chat_message` writes bypassing the BFF
(ADR-0132 R5 — stage-engine is the sole `chat_message` writer). Investigation during
this sortie revealed the situation is more nuanced than the audit description.

## Findings

### use-botsson-chat.ts:393 — CONFIRMED VIOLATION

**File:** `apps/mobile/src/hooks/queries/use-botsson-chat.ts`
**Lines:** 393–414

After a successful BFF round-trip to `/api/emma/chat` (stage-engine), the hook writes
BOTH turns (user message + assistant response) directly to `chat_message` via
`supabase.from("chat_message").insert(...)`.

The BFF at `/api/emma/chat` handles AI conversation only — it does NOT write to
`chat_message`. The `chat_message` table is the UI history store; stage-engine owns
`engine_sessions` as the agent state store. This is dual persistence, acknowledged
in the code comment:

> "dual persistence acknowledged debt per Council 2026-04-17 — collapsing to a
> single store is Phase B."

ADR-0132 R5 week-6 deadline has passed. This remains an open violation.

**Why blocked:** No BFF endpoint exists that accepts `chat_message` writes. Routing
through the existing `/api/emma/chat` would require extending it to return AND persist
history, which is an architectural decision (Phase B collapse). Creating a new
`/api/mobile/chat-history` endpoint requires an ADR. Do not invent an endpoint without
review.

### useShiftChat.ts:65,159 — AUDIT LABEL INCORRECT

**File:** `apps/mobile/src/hooks/shift-clock/useShiftChat.ts`

The audit cited lines 65 and 159 as direct `chat_message` writes. On inspection:

- **Line 65**: `supabase.from("chat_message").select("*")` — this is a READ query,
  not a write. Reads via direct Supabase client are permitted per ADR-0132 R4
  (which allows direct reads per ADR-0029).
- **Line 159**: `table: "chat_message"` — this is a Realtime subscription listener,
  again a read/subscribe, not a write.

The actual WRITE in `useShiftChat.ts` is at line 238 via `enqueue("send_message", ...)`
which goes through the offline sync queue → `action-map.ts:102` → writes to
`channel_message` (not `chat_message`). This is a different table.

The `send_message` sync action uses caller-supplied `sender_id: senderProfileId`
(H1 class — forgeable attribution), but that falls under the M4 finding
(`use-send-channel-message` BFF migration, in-progress under
`feat/mobile-addsheet-server-action-migration`).

**Conclusion:** `useShiftChat.ts` has NO `chat_message` direct writes. The H2 audit
label for lines 65 and 159 is incorrect for the "direct write" violation.

## Proposed Resolution

### For use-botsson-chat.ts (genuine violation)

One of:

**Option A — Extend BFF (Phase B collapse):**
Extend `/api/emma/chat` route to write chat_message rows server-side after stage-engine
returns the response. Mobile stops writing chat_message entirely. Requires:
- ADR extending ADR-0132 with Phase B chat_message ownership transfer
- Server-side `chat_message` insert in the BFF route handler
- Remove lines 393–421 from `use-botsson-chat.ts`

**Option B — Dedicated history BFF:**
Create `POST /api/mobile/chat-history` route that accepts `{ conversationId, messages[] }`
and writes to `chat_message` server-side. Mobile calls this after BFF round-trip.
Requires: new ADR + new route handler.

**Recommended:** Option A. BFF already has the data (both turns in the response).
Server-side write is 3-4 lines in the route handler. Option B is a heavier surface.

### For useShiftChat.ts

No action needed for the H2 finding — lines 65/159 are reads. The separate H1
attribution issue (`sender_id: senderProfileId`) is tracked under M4 (in-progress
sub-sortie on campaign/mobile).

## Next Step

Pontus to decide: approve Option A or Option B, or defer to a separate sortie.
If Option A: this sortie can implement it (estimate: +1 commit, ~30 min).
If defer: this blocker doc is the complete record. F8 remains open.
