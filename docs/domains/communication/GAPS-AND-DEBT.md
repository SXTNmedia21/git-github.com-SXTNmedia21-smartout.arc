---
title: "Communication Domain — Gaps and Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-23
updated: 2026-05-23
created: 2026-05-23
domain: communication
tags: [domain, communication, gaps, debt, technical-debt]
---

# Communication Domain — Gaps and Debt

> Every gap cites code (file:line anchor) or a governing ADR.
> Severity: **CRITICAL** = blocks production use of a feature; **HIGH** = significant functional gap; **MEDIUM** = debt affecting quality/correctness; **LOW** = polish/aspirational.

---

## §Gaps

### G1 — C2 Intelligence pipeline not built (CRITICAL)

**What the spec says:** `channel_event` receives projections from `engine_event` via a trigger/subscription (ADR-0160). C2 Interaction Control Plane translates cascade state into `channel_message` inserts (ADR-0087).

**What the code shows:**
- `channel_event` table exists (`20260422300000_channel_communications.sql` — `CREATE TABLE IF NOT EXISTS channel_event`), zero rows in development.
- No Event Engine process writes briefings/handoffs/KPI alerts to channels.
- `compose_shift_briefing`, `compile_day_brief`, `compile_preclose` tools exist in `packages/ai/src/capabilities/communication/briefing.ts` and `compile-day-brief.ts` — but no cron or Event Engine process invokes them.

**Impact:** `brief` and `handoff` message types (both in `channel_message_type` enum) are never written. Session channels function as generic chat rooms with no operational intelligence.

**Blocked by:** C2 Interaction Control Plane (cascade-level, upstream of this domain).

**Fix path:** ROADMAP Phase C — when C2 ships, build projection trigger + Event Engine process seeds.

---

### G2 — `channel_event` projection trigger missing (HIGH)

**ADR-0160** specifies `channel_event` as a materialized projection of `engine_event` written by a trigger. The trigger was to be written "as part of the helpdesk migration (ADR-0161) and becomes the template for future cascade-consumer features."

**What the code shows:** No trigger in any helpdesk migration (`20260515130*` series) writes to `channel_event`. `channel_message.event_id` FK exists but has zero non-null rows (cannot verify row count without running DB query; structural gap evident from no write path).

**Impact:** `channel_event` is dead infra. ADR-0087 90-day deadline from 2026-04-13 = 2026-07-13.

---

### G3 — `channel_ai_policy` half-wired (HIGH)

**L-0086** (`docs/learnings/0086-channel-ai-policy-half-wired.md`): Policy rows + seeds exist; agent-router does NOT read this table.

**What the code shows:**
- `channel_ai_policy` table defined (`20260422300000_channel_communications.sql` — `CREATE TABLE IF NOT EXISTS channel_ai_policy`)
- Seed rows inserted by `20260422300300_channel_seed_botsson.sql` and `20260519201000_seed_botsson_direct_channels.sql`
- `isAiAllowedInChannel()` in `packages/ai/src/capabilities/communication/policy.ts` exists as Layer 3 check
- `AiPolicyTab.tsx` component exists in `_components/` for configuration UI

**Missing:** Agent-router (`services/stage-engine/src/core/agent-router.ts`) does not consult `channel_ai_policy` before allowing Botsson to respond. Policy table is read-only decoration.

**Fix path:** ROADMAP Phase D — agent-router reads policy before dispatching.

---

### G4 — `helpdesk_query` capability not implemented (HIGH)

**ADR-0162** (accepted) specifies a new `helpdesk_query` capability with 5 registration touchpoints:
1. `packages/ai/src/capabilities/types.ts` — add to CapabilityName union
2. `packages/ai/src/capabilities/registry.ts` — register
3. `packages/ai/src/router/intent-classifier.ts` — enum + classifier prompt
4. `packages/ai/src/capabilities/helpdesk-query/index.ts` — CapabilityDefinition
5. Migration: `engine_authority_config` seed row

**What the code shows:** None of these files contain `helpdesk_query` (grep-verified: `find packages/ai/src/capabilities -name 'helpdesk*'` returns empty).

**Impact:** Helpdesk feature has no agent capability. Manager must use manual UI only; Botsson cannot open/assign/resolve queries.

**Fix path:** ROADMAP Phase G.

---

### G5 — Mobile parity: all hooks in `apps/web/` (HIGH)

**ADR-0087 §6** + CLAUDE.md mobile-parity rule require shared data hooks in `packages/`, not `apps/web/`.

**What the code shows:** All 14+ Komm hooks live in `apps/web/src/app/dashboard/komm/_hooks/`. No equivalent in `packages/`. `apps/mobile/` has no Komm screens.

**Impact:** Mobile cannot access channel messaging without duplicating all hooks. Mobile users have no in-app chat.

**Fix path:** ROADMAP Phase E — extract hooks to packages, build mobile UI.

---

### G6 — Session channel auto-archive not implemented (MEDIUM)

**MODULE_COMMUNICATION.md §8.3** documented this gap. `channel_retention_policy` table exists with `auto_archive_on_close = true` default, but no background process reads it.

**What the code shows:**
- `channel_retention_policy` table defined (`20260422300000`) — `auto_archive_on_close boolean NOT NULL DEFAULT true`
- No migration creates a trigger or cron that fires when `department_session.status` transitions to `closed`
- Session channels remain active after session close

**Fix path:** Cron job or Event Engine process step triggered by session status change.

---

### G7 — No auto-population of session channel members (MEDIUM)

When a session channel is auto-created, it adds only the duty leader (trigger verified in `20260413220000_auto_create_session_channel.sql`). Employees with scheduled shifts are not auto-added as members.

**What the code shows:** `auto_create_session_channel()` function adds `duty_leader_profile_id` to `channel_member` but does not join scheduled shift employees.

**Fix path:** Trigger or Edge Function that joins `schedule_shift.profile_id` to `channel_member` at session open.

---

### G8 — `channel-admin` capability seed migration missing (MEDIUM)

**ADR-0336** accepted design-only; notes "Seed migration shape at line 98-100 is placeholder. Implementation sortie writes concrete seed."

**What the code shows:**
- Tool files exist in `packages/ai/src/capabilities/channel-admin/tools/` (mute, leave, invite, rename, archive)
- No seed migration matching `*_seed_channel_admin_authority.sql` found in `supabase/migrations/`
- Default-allow trap: without seed, every `gate_action` call for channel_admin defaults to allow (L-0066 pattern)

**Fix path:** ROADMAP Phase B / `feat/channel-admin-capability-registration` sortie per ADR-0336.

---

### G9 — Announcement `publish_announcement_atomic` RPC not shipped (MEDIUM)

**ADR-0369** (accepted 2026-05-18) specifies `publish_announcement_atomic` RPC with fan-out in body. V1 spec rejected by council.

**What the code shows:** No migration `*_publish_announcement_atomic*` found. Current `publish-announcement.ts` tool body uses non-atomic writes. ADR-0370 + ADR-0371 also adopted but unimplemented.

**Fix path:** ROADMAP Phase F — V2 spec required first.

---

### G10 — `channel_integration` zero providers (LOW)

Table exists (`20260422300000`); no configured providers in seed or migrations.

---

### G11 — `channel_retention_policy` unenforced (LOW)

Table schema defines `retain_media_days`, `retain_messages_days`, `searchable_after_archive`. No enforcement process.

---

### G12 — SIP telephony not implemented (LOW)

**MODULE_18 spec said:** `channel_call_type` ENUM includes `'sip'`. Manager can dial an employee's phone number via LiveKit SIP bridge + Twilio elastic trunk (`createSipParticipant()`). Useful for reaching off-duty staff without the app.

**Code reality:** `channel_call_type` ENUM (`20260422301000_channel_voice.sql`) has values `direct`, `group`, `ptt` — no `'sip'` value. `livekit-webhook` and `livekit-token` EFs have no SIP-related logic. No Twilio SIP trunk config in env template.

**Impact:** Phone-side employees cannot be called from the app. Low priority for current restaurant scale; direct app-to-app covers most use cases.

**Fix path:** Add `'sip'` to `channel_call_type` enum migration + Twilio SIP trunk configuration + SIP dial Edge Function logic. Requires separate sortie when SIP is prioritized.

---

## §Deviations (spec says X, code does Y)

### D1 — SMARTOUT_MODULE_9: notification table scope

**Spec said:** `notification` table is part of the Communications module with multi-channel delivery pipeline (push/SMS/email) and priority-based routing.

**Code reality:** The `notification` table exists (`20260324220000_notification_table.sql` + `notification_outbox_auto_dispatch`), but its ownership has drifted to the **notifications** delivery layer (future domain). The communication domain does not own this table. `channel_notification_policy` governs channel-level routing rules; the `notification` table belongs to a future notifications domain.

**Recorded as:** Correct architectural seam. Communication CREATES channel_message; notifications DELIVERS externally. Not a bug.

### D2 — Old module used `chat_*` table names; code uses `channel_*`

**Spec said (SMARTOUT_MODULE_9):** `chat_channel`, `chat_message`, `chat_channel_member`, `chat_message_read`.

**Code reality:** ADR-0063 froze the old chat tables; Komm uses `channel`, `channel_message`, `channel_member`, `channel_message_read`. Module doc migrated to reflect the live schema.

### D3 — `channel_ai_voice_policy` vs `channel_ai_voice_mode`

**MODULE_COMMUNICATION.md** used `channel_ai_voice_policy` for the per-channel AI voice mode enum. **Migration** defines both `channel_ai_voice_policy` (voice policy enum: `disabled`/`listen_only`/`interactive` on the `channel` table) and `channel_ai_voice_mode` (separate enum: same values). The `channel_ai_policy` table uses `voice_participation channel_ai_voice_mode`. Naming is internally consistent; module doc was slightly imprecise.

### D4 — MODULE_18 uses bare `call_session`/`call_participant`; code uses `channel_` prefix

**MODULE_18 spec said:** Tables named `call_session`, `call_participant`.

**Code reality:** Tables are `channel_call_session`, `channel_call_participant` (`20260422301000_channel_voice.sql`). The `channel_` prefix reflects the channel-anchored design — all call state is scoped to a specific channel. MODULE_18 was written before the naming convention was finalized. `call_log` is the exception: it uses the unprefixed name.

---

## §Overlap edges

### OE1 — Announcements (communication ↔ announcements domain)

| Field | Value |
|---|---|
| Shared surface | `channel_message WHERE message_type = 'announcement'` posted to `channel WHERE channel_type = 'news'` |
| Communication owns | `channel`, `channel_message` schema + RLS + Realtime infra |
| Announcements owns | Nyheter composers, audience targeting, bulletin board UI, `system_data.audience` interpretation |
| Recommendation | **keep** — clear infra/UX split. Communication provides the plumbing; Announcements provides the product surface. |
| Status | resolved (keep) |

### OE2 — day-session (session channel container creation)

| Field | Value |
|---|---|
| Shared surface | `channel.session_id FK → department_session`; auto-create trigger fires on `department_session INSERT` |
| day-session owns | `department_session` row lifecycle; triggers channel creation |
| communication owns | Channel runtime from point of creation onward |
| Recommendation | **keep** — clear author/consumer split. day-session creates; communication runs. |
| Status | resolved (keep) — also recorded in `_DASHBOARD.md` |

### OE3 — notifications domain (future)

| Field | Value |
|---|---|
| Shared surface | `channel_notification_policy` table; `notification_outbox` dispatch |
| communication owns | Per-channel routing rules (`channel_notification_policy`); message creation |
| notifications owns (future) | External delivery (push/SMS/email), quiet hours, rate limiting, morning digest |
| Recommendation | **keep boundary** — communication is the source; notifications is the delivery pipe. `channel_notification_policy` stays in communication. `notification` table and outbox belong to future notifications domain. |
| Status | open (notifications domain not yet defined) |

### OE4 — botsson domain (future)

| Field | Value |
|---|---|
| Shared surface | `channel_ai_policy`, `channel_member WHERE is_ai = true`, `channel_type='ai'` |
| communication owns | Schema for AI policy + membership; channel_type enum value |
| botsson owns (future) | Runtime behavior: when Botsson speaks, what it says, how it governs per-channel AI participation |
| Recommendation | **keep** — schema ownership in communication; behavioral ownership in botsson. Seam: `channel_ai_policy` + agent-router integration. |
| Status | open (botsson domain not yet defined; G3 is the current gap) |

### OE5 — targeted note fanout (communication ↔ day-session)

| Field | Value |
|---|---|
| Shared surface | `session_note.audience JSONB` + `notify_at` + cron fanout (`20260616100501`) |
| day-session owns | `session_note` row + lifecycle |
| communication owns | Fanout scheduler, audience resolution, delivery dispatch |
| Recommendation | **keep** — seam is the `deliver_at` moment. Note creation = day-session; delivery = communication. |
| Status | resolved (keep) |
