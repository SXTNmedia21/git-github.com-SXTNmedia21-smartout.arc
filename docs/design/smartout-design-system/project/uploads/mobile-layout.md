Smartout Mobile — Wireframe Design Overview

App Structure

┌─────────────────────────────────┐  
 │ Bottom Tab Bar │
├────────┬────────┬───────┬───────┤  
 │ Home │ Shifts │ Komm │ Me │  
 └────────┴────────┴───────┴───────┘

---

1. HOME (home)/

Focus: "What do I need to do RIGHT NOW?"

Use case: Employee opens app at work — instantly
sees current status and urgent tasks.

┌─────────────────────────────┐
│ ☀️ God morgen, Sofia │
│ Sjøhuset · Servitør │
├─────────────────────────────┤
│ │
│ ┌─ SHIFT STATUS ─────────┐│
│ │ Before / During / After ││
│ │ (phase-aware card) ││
│ │ Punch in: 15:00 ││
│ │ [Start Shift →] ││
│ └─────────────────────────┘│
│ │
│ ┌─ MY TASKS ─────────────┐│
│ │ ☐ HACCP Temp Check 🔴 ││
│ │ ☐ Handoff to evening ││
│ │ ☐ Restock bar ││
│ └─────────────────────────┘│
│ │
│ ┌─ QUICK ACTIONS ────────┐│
│ │ [Report Deviation] ││
│ │ [Spokesperson Approval]││
│ └─────────────────────────┘│
│ │
│ ┌─ BOTSSON ──────────────┐│
│ │ 💬 "Hva er allergenkrav ││
│ │ for desserten?" ││
│ │ [Ask Botsson →] ││
│ └─────────────────────────┘│
└─────────────────────────────┘

Functionality:

- 3 shift phases — UI morphs based on time:
  BeforeShiftView (prep tasks, check-in),
  DuringShiftView (active tasks, punch, breaks),
  AfterShiftView (handoff, hour confirmation)
- Task modal — Tap task → modal with form (HACCP
  form, handoff form, etc.)
- Deviation reporting — Quick-access form for
  logging incidents
- Spokesperson approval — Manager
  approves/rejects requests
- Botsson — AI chat for instant answers about
  procedures, policies, allergener

---

2. SHIFTS (shifts)/

Focus: "My schedule — past, present, future"

Use case: Check upcoming shifts, review worked
hours, confirm/dispute logged time.

┌─────────────────────────────┐
│ Mine Vakter │
├─────────────────────────────┤
│ │
│ ── This Week ──────────── │
│ ┌─────────────────────────┐│
│ │ Man 24. mar 15:00-23:00│
│ │ Servitør · Sjøhuset ││
│ │ ✅ Confirmed ││
│ ├─────────────────────────┤│
│ │ Ons 26. mar 11:00-19:00│
│ │ Servitør · Sjøhuset ││
│ │ 🟡 Pending confirmation ││
│ ├─────────────────────────┤│
│ │ Fre 28. mar 16:00-01:00│
│ │ Bar · Sjøhuset ││
│ │ 🔵 Upcoming ││
│ └─────────────────────────┘│
│ │
│ ── Next Week ──────────── │
│ │ ... ││
└─────────────────────────────┘

Shift Detail [id].tsx:
┌─────────────────────────────┐
│ ← Fre 28. mar │
├─────────────────────────────┤
│ 16:00 — 01:00 9t │
│ Bar · Sjøhuset │
│ Position: Bartender │
├─────────────────────────────┤
│ Colleagues on shift: │
│ 👤 Erik 👤 Maria 👤 Jonas │
├─────────────────────────────┤
│ Supplements: │
│ Kveldstillegg +15.65/t │
│ Helgetillegg +29.74/t │
├─────────────────────────────┤
│ Break rules: │
│ 30 min paid after 5.5t │
├─────────────────────────────┤
│ Hours Confirmation: │
│ [Confirm ✓] [Dispute ✏️ ] │
└─────────────────────────────┘

Functionality:

- Shift list — Grouped by week, status badges
  (upcoming/active/confirmed/disputed)
- Shift detail — Colleagues, supplements
  calculation, break rules, GPS guard status
- Hour confirmation — Employee confirms or
  disputes logged hours after shift
- Punch in/out — GPS-verified clock in/out with
  break tracking
- Shift notes — Personal notes attached to a
  shift

---

3. KOMM (komm)/

Focus: "Team communication — channels, not chaos"

Use case: Structured workplace communication.
Channels per department/topic. Replaces random
WhatsApp groups.

┌─────────────────────────────┐
│ Kommunikasjon │
├─────────────────────────────┤
│ │
│ ┌─ CHANNELS ─────────────┐│
│ │ #general 3 new ││
│ │ #kjøkken 1 new ││
│ │ #bar ││
│ │ #driftsinfo 🔴 2 ││
│ └─────────────────────────┘│
│ │
│ ┌─ VOICE ────────────────┐│
│ │ 🟢 Active group call ││
│ │ Kitchen (3 people) ││
│ │ [Join] ││
│ │ ││
│ │ [🎙 Walkie-Talkie PTT] ││
│ └─────────────────────────┘│
│ │
│ ┌─ CALL HISTORY ─────────┐│
│ │ 📞 Erik — 2 min ago ││
│ │ 📞 Group: Bar — 14:30 ││
│ └─────────────────────────┘│
└─────────────────────────────┘

Channel Detail [id].tsx:
┌─────────────────────────────┐
│ ← #kjøkken │
├─────────────────────────────┤
│ │
│ Maria 14:32 │
│ ┌─────────────────────┐ │
│ │ Dessert 86. Bruker │ │
│ │ siste laktosfri. │ │
│ └─────────────────────┘ │
│ 👍 2 🙏 1 │
│ │
│ You 14:35 │
│ ┌─────────────────────┐ │
│ │ Bestilt mer, kommer │ │
│ │ i morgen. │ │
│ └─────────────────────┘ │
│ │
├─────────────────────────────┤
│ [Message input...] [Send] │
└─────────────────────────────┘

Functionality:

- Channel list — Unread badges, department-scoped
  channels
- Message thread — Text messages with reaction
  bar (emoji reactions)
- Walkie-talkie — Push-to-talk (PTT) button for
  instant voice via LiveKit
- Group calls — Join/leave group call banner,
  Krisp noise filtering
- Call signaling — Incoming call screen, call
  history list
- Direct messages — via (chat)/ route (1:1
  messaging)

---

4. ME (me)/

Focus: "My employment — money, time, absence"

Use case: Employee self-service. Check pay,
request time off, see balances.

┌─────────────────────────────┐
│ Min Side │
│ Sofia Andersen · Servitør │
├─────────────────────────────┤
│ │
│ ┌─────────┐ ┌─────────┐ │
│ │ Lønn │ │ Timebank│ │
│ │ 💰 │ │ ⏱ │ │
│ │ Mar: 24t│ │ +12.5t │ │
│ └─────────┘ └─────────┘ │
│ │
│ ┌─────────┐ ┌─────────┐ │
│ │ Fravær │ │ Fravær- │ │
│ │ søknad │ │ saldo │ │
│ │ 📝 │ │ 📊 │ │
│ │ [Søk →] │ │ 18d left│ │
│ └─────────┘ └─────────┘ │
│ │
│ ── Recent Payslips ────── │
│ │ Feb 2026 32 450 kr ││
│ │ Jan 2026 28 100 kr ││
│ │ Des 2025 35 200 kr ││
│ │
└─────────────────────────────┘

Sub-pages:

Page: Payslip payslip.tsx
What it shows: Monthly breakdown: base hours,
supplements (kveld/helg/helligdag), gross, tax,

    net. Trust labels showing calculation
    confidence.

────────────────────────────────────────
Page: Timebank timebank.tsx
What it shows: Plus/minus hours balance. Overtime

    accumulation. Historical graph.

────────────────────────────────────────
Page: Absence Request absence-request.tsx
What it shows: Form: type (sick, vacation,
leave),
date range, comment. Submit → manager gets
notification. Cancel pending requests.
────────────────────────────────────────
Page: Absence Balance absence-balance.tsx
What it shows: Remaining vacation days,
used/total, sick leave history. Projection of
remaining days through year.

Functionality:

- Payroll calc — Local supplement calculation
  (kveldstillegg, helgetillegg, helligdagstillegg)
  with trust labels (shows confidence in
  calculation accuracy)
- Absence flow — Request → pending →
  approved/rejected. Cancel while pending.
- Absence projection — How many days left if
  current usage pattern continues
- Timebank — Running plus/minus hour balance

---

Cross-Cutting Features

Feature: Offline-first
Where: Everywhere
What: MMKV cache + SQLite sync queue. Works
without network, syncs when back online.
────────────────────────────────────────
Feature: GPS guard
Where: Shift punch
What: Verifies employee is at workplace location
before allowing clock-in
────────────────────────────────────────
Feature: Push notifications
Where: Background
What: Shift reminders, task assignments, message
alerts, approval requests
────────────────────────────────────────
Feature: Haptic feedback
Where: PTT, punch, actions
What: Physical feedback on key interactions
────────────────────────────────────────
Feature: Shift-phase awareness
Where: Home
What: Entire home screen adapts to
before/during/after shift state
────────────────────────────────────────
Feature: Telemetry
Where: All mutations
What: Every action emits via @smartout/telemetry
—
same pipeline as web

---

Navigation Flow Summary

App Launch
├── Not authenticated → (auth)/ → Login
└── Authenticated → (app)/
├── Tab: Home ─── shift phase card,
tasks, quick actions, botsson
├── Tab: Shifts ── list → detail
(colleagues, supplements, confirm hours)
├── Tab: Komm ─── channels → thread, PTT,
calls
└── Tab: Me ────── payslip, timebank,
absence request, absence balance

The app is employee-centric — no admin/manager
views. Managers use the web dashboard. The mobile
app answers one question: "What do I need to
know and do for my shift today?"
