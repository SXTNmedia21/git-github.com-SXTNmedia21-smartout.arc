---
title: "Journey — Employee on resolved audience receives push at notify_at"
feature: dagslinjen-quickadd
journey: employee-receives-targeted-note
status: draft
verified_at: null
e2e_test: null
created: 2026-05-15
updated: 2026-05-15
module: MODULE_COMMUNICATION
tags: [journey]
---

# Journey: Employee receives scheduled targeted note

**Role:** employee

**Precondition:** Employee is member of "Lørdag PM" team. Manager (other journey) created note with `audience.team_ids=["lørdag-pm"]` and `notify_at=2026-05-15T18:00`. Employee has mobile PWA installed or web open. Push notifications consent granted.

## Happy Path

1. Clock ticks to 18:00 → Scheduler job (pg_cron / Edge Function cron) wakes
2. System queries `session_note WHERE notify_at <= now AND delivered_at IS NULL` → finds the note
3. System resolves audience: `team_ids → profile_ids` via `team_member` → returns 4 profile ids
4. System emits 4 notification rows via `@smartout/notifications` `emit()` with channel=push, payload includes note_id + title + body
5. System sets `session_note.delivered_at = now` (idempotent — guards against double-fire)
6. Employee mobile: push arrives at lock-screen → User sees "📌 Lørdag PM: VIP-bord 12 — Gluten allergi"
7. Employee taps push → System deep-links to `/dashboard/communication/notes/<id>` (web) or mobile NoteDetail screen → User sees full note + who-else-was-notified

**Postcondition:** `notification` rows exist for 4 recipients. `session_note.delivered_at` set. Activity_trail logged. Recipient sees note in their feed.

## Error Paths

- **Employee left team between note-creation and notify_at:** → Resolution snapshot at fire-time excludes them (no push)
- **Push permission revoked:** → Falls back to in-app notification surface (SmartoutNotifications bell)
- **Scheduler runs late (delivery_at miss):** → Catches up next tick; idempotency guarded by `delivered_at IS NULL` predicate
- **Double-fire race:** → `UPDATE ... WHERE delivered_at IS NULL` returns 0 rows; second runner skips
- **Note deleted before fire:** → Soft-delete sets `deleted_at`; scheduler filters `WHERE deleted_at IS NULL`

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end (with time-shift or notify_at=now+30s)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
