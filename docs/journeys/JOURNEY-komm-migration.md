---
title: "Journey — Komm Migration"
status: done
updated: 2026-03-28
created: 2026-03-28
module: komm
tags: [journey, communication, i18n, migration]
---

# Journey — Komm Migration

## Journey: Admin navigates to communication

**Precondition:** Admin is logged in and on the dashboard.

1. Admin clicks "Komm" in sidebar nav
   -> System loads `/dashboard/komm` route
   -> Admin sees the KommShell with channels, chat, and news tabs
2. Admin switches between tabs (Kanaler, Chat, Nyheter)
   -> System renders the appropriate panel (channels list, direct messages, news feed)
3. Admin selects a channel or person
   -> System loads channel messages in the main pane

**Postcondition:** Admin is viewing a communication channel in the Komm system.

**Error paths:**

- If no channels exist, admin sees empty state: "Velg en kanal eller person for a begynne"
- If connection fails, admin sees toast error with retry option

## Journey: Employee uses communication in their language

**Precondition:** Employee is logged in, locale is set (nb or en).

1. Employee opens Komm
   -> System renders all labels, placeholders, empty states, and error messages in the employee's locale
   -> Norwegian: "Skriv en melding...", English: "Write a message..."
2. Employee creates a channel
   -> All dialog labels, buttons, and validation messages display in correct locale
3. Employee receives an error (e.g., message send fails)
   -> Toast message displays in correct locale: "Kunne ikke sende melding" / "Could not send message"

**Postcondition:** All Komm UI text is localized. No hardcoded Norwegian strings in components.

**Error paths:**

- If locale key is missing, system falls back to Norwegian (nb is fallback locale)
- Hook-level toast messages remain in Norwegian (tracked follow-up)

## Journey: AI agent navigates user to communication

**Precondition:** User is interacting with Emma (WalkAi) or Mr. Botsson.

1. User says "gå til kommunikasjon" or "vis meldinger"
   -> Agent resolves "komm" from DASHBOARD_PAGES
   -> System navigates to `/dashboard/komm`
   -> User sees the Komm interface
2. User asks agent about conversations
   -> Agent uses communication capability tools
   -> Tools query `channel`, `channel_member`, `channel_message` tables (migrated from chat\_\*)
   -> Agent returns current channel data

**Postcondition:** Agent correctly navigates to Komm and reads channel data.

**Error paths:**

- If user says "chat" verbally, agent maps to "komm" page (WalkAi page key is "komm")
- Old `/dashboard/chat` route returns 404 (route deleted)

## Journey: Admin views notifications filtered by communication

**Precondition:** Admin is on the notifications page.

1. Admin clicks the "Komm" filter tab
   -> System filters notifications by `iconType: "chat"` (DB value unchanged)
   -> Admin sees only communication-related notifications
2. Admin clicks a communication notification
   -> Deep link navigates to `/dashboard/komm/{channel_id}` (event-config already routes here)

**Postcondition:** Notification filtering works. Display label says "Komm", filter value matches DB.

**Error paths:**

- None. Filter id matches existing DB icon_type values.
