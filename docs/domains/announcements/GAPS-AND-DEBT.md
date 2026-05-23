---
title: "Announcements Domain — Gaps & Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: announcements
tags: [announcements, gaps, debt, wave-b, deviations, overlap]
mirror: verified
last_verified: 2026-05-23
---

# Announcements — Gaps & Debt

> Built-vs-planned delta. Every gap cites code (file:line or migration) or roadmap phase.

---

## Deviations (spec said X, code did Y)

### D1 — Wave B v1 spec: `{content}` field → CODE uses `{title, body}` (ADR-0371)

**Spec (v1):** Collapsed `{title, body}` into `{content: string(1-800)}`.

**Code (canonical):** `publish-announcement.ts` tool schema: `title: string(1-120)` + `body: string(1-1600)`. RPC receives `p_content` (pre-concatenated: `title + "\n" + body`). `channel_message.content` DB column unchanged.

**Resolution:** ADR-0371 Option A accepted. `{title, body}` preserved. Wave B pickers add `kind`/`tier`/`entity_link` as additive fields.

### D2 — Wave B v1 spec: `SET CONSTRAINTS ALL DEFERRED` → CODE uses RPC-body fan-out (ADR-0369)

**Spec (v1):** Claimed atomicity via `SET CONSTRAINTS ALL DEFERRED`.

**Code (canonical):** Fan-out moved out of AFTER INSERT trigger into `publish_announcement_atomic` RPC body. Trigger guard (M5) returns early for `message_type='announcement'`.

**Resolution:** ADR-0369 Option B accepted. `fn_publish_announcement_notifications` called inline by RPC.

### D3 — Wave B v1 spec: `broadcast.send` capability key → CODE uses `communication` (ADR-0370)

**Spec (v1) pseudocode:** `callGateAction({ capability: 'broadcast.send', ... })`.

**Code (canonical):** `publish-announcement.ts` line ~91: `callGateAction(..., { capability: 'communication', actionType: 'publish_announcement_atomic', ... })`.

**Resolution:** ADR-0370 Option B accepted. `broadcast.send` gate kept for Day-Control server action only (different authority level: manager+/confirm).

### D4 — `announcement_kind` values: spec v2 names differ from M7 additions

**Spec v2:** referenced `workspace_news` and `external_link` as enum values.

**Code (M7):** `ALTER TYPE announcement_kind ADD VALUE IF NOT EXISTS 'celebration'` + `'system_message'`. `workspace_news` → `general` (code-level rename, same DB value). `external_link` → `external` (same).

**Resolution:** Handled as code-only renames. DB enum values are `general` and `external` (M1). `celebration` and `system_message` added in M7 as requested by ADR-0372 and tool DSL.

---

## Gaps

### M1 — Mobile bulletin layout absent

**Code:** No dedicated mobile screen rendering a card-feed layout. Announcements render via `ChannelMessageBubble.tsx:55` as system bubbles inside the standard `news` channel chat view. No pinned strip, no card layout, no reactions UI.

**Intent:** Mobile read-side Wave A parity (pinned strip, reactions, card layout).

**Severity:** MEDIUM. Referenced in `PLAN-nyheter-engagement-wave-a.md` as `feat/mobile-nyheter-strip`.

### M2 — Home widget absent on both surfaces

**Code:**
- Web: no employee home-page widget showing latest announcements.
- Mobile: `NoShiftView.tsx` "Latest news" section is a hardcoded placeholder (`"Ny sesongmeny er her!"`), not wired to live `channel_message`.

**Intent:** Employees see recent announcements on the home surface without navigating to komm.

**Severity:** MEDIUM.

### C1 — Audience resolver duplicated (web + agent)

**Code:**
- Web: `apps/web/src/app/dashboard/komm/_hooks/use-audience-resolver.ts`
- Agent: `packages/ai/src/capabilities/communication/audience-resolver.ts`

Both implement the same 5-kind resolution logic. Drift risk when new audience kinds are added.

**Severity:** LOW. Harmonization candidate.

### C2 — Direct mutation composers not gated via `callGateAction`

**Code:**
- `use-send-announcement.ts` — direct Supabase mutation, no gate.
- `use-send-broadcast.ts` — direct Supabase mutation (service-role for channel create).
- Only `send-broadcast-action.ts` (Day-Control) and `publish-announcement.ts` (agent) gate via capability.

**Intent:** Per ADR-0157, direct browser mutations are accepted for surface-driven composers. Asymmetry noted.

**Severity:** LOW. Defended by RLS + UI role-gate. Harmonization candidate.

### P1 — Read-receipt per-card N-query on bulletin open

**Code:** `NyheterClient.tsx` fetches read-receipt counts per card. N cards = N queries on feed open.

**Intent:** Single batch-fetch RPC (`fn_news_read_receipts_batch`).

**Severity:** LOW for current scale.

### I1 — Norwegian locale lags English for `nyheter.*` keys

**Code:** `packages/i18n/locales/en/komm.json` has full `nyheter.*` namespace (~lines 158–201). Norwegian counterpart has partial coverage; several composer-side strings fall back to English.

**Severity:** MEDIUM for Norwegian operators.

### F1 — Scheduled publish absent

**Code:** No `publish_at` column. No scheduler integration. Publishes are immediate.

**Severity:** LOW. Future feature.

### F2 — Edit-after-publish absent

**Code:** No edit composer. `channel_message_jwt_update` policy exists but no application code exposes it for announcements.

**Severity:** LOW. Workaround: delete + repost (re-notifies recipients).

### F3 — Expiry / auto-archive absent

**Code:** No `expires_at` column. No cron. Old announcements scroll indefinitely.

**Severity:** LOW. Future feature.

### UX1 — Chat "+" inline-attach shortcut absent

**Code:** No plus-icon affordance in chat composer to inline-publish an announcement from within a conversation context.

**Severity:** MEDIUM. Workaround: navigate to header menu or `/komm/nyheter`.

### Wave-B-E — AnnouncementKindPicker + AnnouncementTierPicker + EntityLinkPicker deferred (Track E)

**Code:** UI picker components not yet built for web. DB and RPC are live; defaults to `kind='general'`, `tier='work'`. EntityLinkCTA mobile mount deferred (Track G) — component exists at `apps/mobile/src/components/news/EntityLinkCTA.tsx`.

**Spec:** `docs/superpowers/specs/2026-05-18-announcement-kind-tier-link-design-v2.md` Track E + G.

**Severity:** HIGH for kind/tier differentiation UX. Entity-link CTA is HIGH for personaltreff flow (RSVP deep-link).

---

## Council Learnings (Live Debt)

These learnings are actively cited in README.md § Agent Guardrails and must be checked before any work that modifies the announcement RPC, trigger, or capability:

| Learning | Key trap |
|---|---|
| L-0312 | `SET CONSTRAINTS ALL DEFERRED` ≠ defer plain triggers |
| L-0313 | Grep `ALTER TYPE ... ADD VALUE` not just `CREATE TYPE` for enum presence |
| L-0314 | Spec pseudocode capability key ≠ production body capability key |
| L-0315 | `callGateAction` is positional not callback-style |

---

## Overlap Edges

| Domain B | Shared surface | Classification | Recommendation |
|---|---|---|---|
| **communication** | `channel_message WHERE message_type='announcement'` in `news` channel; `channel_message_type` enum; `comm_channel_type='news'`; `channel_notification_policy` | **keep** — communication owns channel/message infra schema; announcements owns Nyheter composers, UI, `announcement_meta` sidecar, and `publish_announcement_atomic` RPC. Seam: `message_type='announcement'` discriminator + trigger guard (M5). | resolved (keep) |
| **notifications** | `notification_outbox` (write target for announcement fan-out); `fn_publish_announcement_notifications` writes outbox rows | **keep** — announcements/communication authors priority routing; notifications domain owns `notification_outbox` + consumer pipeline. Seam: outbox row is the handoff point. | resolved (keep) |
| **botsson** | `publish_announcement` capability tool lives in `packages/ai/src/capabilities/communication/` (communication/announcements domain, ADR-0240 + ADR-0370). Botsson invokes but does not own. | **keep** — botsson domain surfaces the tool as a capability; announcements/communication domain owns the tool code and RPC. Seam: `callGateAction(capability='communication')` call boundary. | resolved (keep) |
| **core-structure** | Audience picker reads `department`, `team`, `profile` from D1/D2 tables for `department`/`role`/`individuals` audience kinds | **keep** — announcements reads D1/D2 data; core-structure owns those tables. Never write D1/D2 tables from announcement composers. | resolved (keep) |
| **day-session** | Day-Control Melding tab carries `system_data.session_id` — announcement is attributable to a `department_session` | **keep** — announcements writes `system_data.session_id` as a reference pointer only; day-session owns `department_session`. No schema coupling. | resolved (keep) |

---

## Adjacent Debt (NOT owned here, but touches announcements)

### `staff_event` has no FK from announcement

`staff_event` table + `staff_event_attendee` (RSVP) exist. No FK from `channel_message` or `announcement_meta.linked_entity_id` to `staff_event`. Wave B entity-link adds `linked_entity_type='staff_event'` + `linked_entity_id` — the POINTER exists in schema, the deep-link UI (EntityLinkCTA) is deferred (Track G).

### Cockpit employee home surface absent

The cockpit (`HospitalityOperationsCockpit`) is admin/manager-only. Employee web home surface does not exist. Until an employee home surface ships, a "latest announcements home widget" has no host page.

### `notification_outbox` consumer: quiet-hours behavior

Whether the notifications consumer respects `mode='work'` vs `mode='community'` differently (quiet hours, badge styling) is a notifications-domain concern, not tracked here. Announcement priority branching is correct; consumer behavior is out-of-scope.
