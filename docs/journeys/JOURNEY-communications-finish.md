---
title: User Journeys — Communications v2
status: done
updated: 2026-03-06
created: 2026-03-06
module: comms
tags: [journeys, email, sendgrid, tiptap, ai, webhooks]
---

# User Journeys — Communications v2

## Journey: Platform Admin — Compose and Send Dynamic Email

**Precondition:** Admin is logged in with godmode access. SendGrid dynamic template exists.

1. Admin navigates to `/platform-admin/communications` → System shows Quick Send cards + History/Reports tabs
2. Admin clicks "Compose" button → System navigates to `/platform-admin/communications/compose`
3. Admin sees compose form with: Audience selector, Template mode (Egendefinert/Standard), Subject field
4. Admin selects audience (All Users / Workspace Owners / Admins / Custom) → Audience selector updates
5. Admin clicks "Dry Run" → System resolves audience and shows recipient count + preview
6. Admin selects "Egendefinert (SendGrid)" template mode → System shows SendGrid template fields
7. Admin optionally loads a saved template from dropdown → System prefills subject
8. Admin enters SendGrid Template ID (`d-xxx...`) → System validates format
9. Admin fills Hero section: hero image URL + header (required)
10. Admin writes message in Tiptap rich editor with toolbar (bold, italic, underline, lists)
11. Admin optionally clicks AI correction button → System sends text to OpenRouter → Returns corrected text
12. Admin optionally adds Items (title + description + benefits + link per item)
13. Admin optionally adds CTA button (text + URL) and Info box (title + message)
14. Admin sees live preview in right panel (HTML rendering of template data)
15. Admin clicks "Send" → System validates (audience, subject, template ID, header required)
16. System resolves audience → filters suppressed → creates communication log → creates recipient rows
17. System sends emails via `sendDynamicTemplateBatch()` with per-recipient dynamic data
18. System updates log status to "sent" → audit logs action → Admin sees success toast
19. Admin is redirected to communications list

**Postcondition:** Email sent to all non-suppressed recipients. Communication log and recipient records created with engagement tracking columns ready for webhook updates.

**Error paths:**

- No audience selected → toast: "Velg en målgruppe"
- No subject → toast: "Skriv inn et emne"
- No template ID → toast: "Skriv inn SendGrid Template ID"
- No header → toast: "Header er påkrevd"
- Recipient count > hard cap → 400: exceeds maximum
- Recipient count > soft cap without confirmation → 400: requires confirmation
- All recipients suppressed → 400: all suppressed
- Rate limit exceeded → 429: rate limit
- Kill switch active → 503: sending disabled
- Send failure → log status set to "failed", 500 error

---

## Journey: Platform Admin — Send Quick Email (Inline Template)

**Precondition:** Admin is logged in with godmode access.

1. Admin navigates to `/platform-admin/communications`
2. Admin clicks a Quick Send button (e.g., "All Users", "All Admins")
3. System opens ComposeEmailSheet side-panel with pre-selected audience
4. Admin selects inline template from dropdown (Platform Announcement, Workspace Notification, etc.)
5. Admin enters subject and writes message in Tiptap rich editor
6. Admin optionally uses AI correction on the message text
7. Admin clicks "Send" → System validates, resolves audience, sends via `sendEmailBatch()` with inline HTML
8. Admin sees success toast with sent count

**Postcondition:** Email sent using inline HTML template. Log created.

**Error paths:** Same as dynamic email journey.

---

## Journey: Platform Admin — View Engagement Report

**Precondition:** Admin has previously sent communications.

1. Admin navigates to `/platform-admin/communications`
2. Admin clicks "Rapporter" tab → System shows EngagementReport component
3. Admin sees KPI cards: Total sent, Open rate %, Click rate %, Failed count
4. Admin sees per-email breakdown table: Subject, Date, Sent, Opened, Clicked, Open rate %
5. Open counts shown in blue, click counts in purple
6. Failed count shown in amber if > 0

**Postcondition:** Admin understands email performance across all communications.

**Error paths:**

- No communications sent → "Ingen kommunikasjon sendt ennå." empty state

---

## Journey: Platform Admin — View Communication History

**Precondition:** Admin has previously sent communications.

1. Admin navigates to `/platform-admin/communications` → "Historikk" tab is default
2. Admin sees DataTable with columns: Date, Subject, Template, Type, Audience, Recipients, Sent/Failed, Opened/Clicked, Status
3. Engagement column shows open count (blue) / click count (purple) with open rate %
4. Admin clicks a row → System expands CommunicationDetail panel below the row
5. Admin sees per-recipient delivery details
6. Admin clicks collapse button to close detail panel

**Postcondition:** Admin has reviewed delivery and engagement status per communication.

---

## Journey: System — Process SendGrid Webhook Events

**Precondition:** SendGrid configured to send signed event webhooks to the Edge Function endpoint.

1. SendGrid delivers POST request to `/functions/v1/sendgrid-webhook` with event batch
2. Edge Function extracts signature and timestamp from headers
3. Edge Function verifies ECDSA P-256 SHA-256 signature against verification key
4. For each event in the batch, system processes by event type:
   - `open` → Increment recipient `open_count`, set `opened_at` (first open), increment log `opened_count`
   - `click` → Increment recipient `click_count`, set `clicked_at` (first click), increment log `clicked_count`
   - `bounce` / `dropped` → Update recipient status to "bounced"/"dropped", add to suppression list
   - `delivered` → Update recipient status to "delivered"
   - `unsubscribe` / `spamreport` → Add to suppression list
5. System inserts raw event into `platform_webhook_event` audit table

**Postcondition:** Engagement metrics updated atomically. Bounced/unsubscribed emails added to suppression list.

**Error paths:**

- Invalid signature → 401 Unauthorized (reject entire request)
- Missing communication/recipient match → Event logged to audit table but no counter updates
- Database error → 500, event may need reprocessing

---

## Journey: Platform Admin — AI Text Correction

**Precondition:** Admin is composing an email in the rich editor. OpenRouter API key configured in Vault.

1. Admin types text in Tiptap rich editor
2. Admin clicks AI correction button (sparkle icon) in editor toolbar
3. System sends current text + locale to `/api/platform-admin/communications/ai-correct`
4. API validates input (text + locale: "no" or "en")
5. API calls OpenRouter with locale-aware system prompt for grammar/tone correction
6. System returns corrected text → Editor content is replaced with corrected version

**Postcondition:** Text is professionally corrected for grammar, spelling, and tone.

**Error paths:**

- OpenRouter API failure → toast: "AI-korrigering feilet", original text preserved
- Empty text → No action
