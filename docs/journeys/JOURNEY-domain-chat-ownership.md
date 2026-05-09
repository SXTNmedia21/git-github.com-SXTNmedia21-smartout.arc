---
title: "Journey: Domain Chat Ownership — Wizard + Orb Disambiguation"
status: draft
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, domain-chat, surface-disambiguation, wizard, ADR-0238, journey, vapor]
decisions: [ADR-0238, ADR-0078]
---

# Journey: Domain Chat Ownership — Wizard + Orb Disambiguation

> **STATUS: VAPOR.** ADR-0238 is proposed but NOT implemented. These journeys document the
> intended behaviour once `<DomainChatOwnership>` ships. Do NOT treat as current behaviour.

## Problem Context

On `/platform-admin/journeys/wizard/[sessionId]`, two AI chat surfaces coexist:
- **In-page wizard chat** — posts to `/api/botsson/chat` with `mission=journey_authoring`
- **BotssonShell Orb** — bottom-right fixed, general godmode session

A user typing into the wrong surface gets no error — the wizard simply doesn't advance.
ADR-0238 resolves this by suppressing the Orb to passive mode on pages that declare ownership.

---

## Journey: Admin Authors a Journey Wizard Step (Wizard Surface)

**Precondition:**
- Admin has godmode.
- Admin is on `/platform-admin/journeys/wizard/[sessionId]`.
- **Post-ADR-0238 implementation:** `<DomainChatOwnership reason="journey-wizard" />` is mounted.
- BotssonShell Orb renders in passive mode (icon-only, tooltip "Botsson ser denne siden").

**Steps:**

1. Admin sees the wizard page with the in-page chat textbox visible
   → Orb is visible as icon in bottom-right (passive — not chat-enterable)
   → Admin clearly sees ONE chat surface: the wizard chat

2. Admin types a journey authoring instruction in the wizard textbox:
   "Legg til et steg: ansatt bekrefter at de har lest HMS-prosedyren"
   → System sends message to `/api/botsson/chat` with `mission=journey_authoring`
   → Journey authoring capability processes the request
   → Wizard advances / draft preview updates

3. Admin sees wizard response in the in-page chat thread
   → Journey session state updated
   → Sidebar draft preview reflects new step

**Postcondition:**
- Journey step added to draft.
- Wizard session state updated.
- Orb remained passive throughout — no ambiguity.

**Error paths:**
- Admin attempts to type in the Orb area → Orb is icon-only, not clickable to open chat (passive mode).
  Tooltip appears: "Botsson ser denne siden" (passive state explanation).
- Wizard chat API fails → toast: "Kunne ikke behandle forespørselen. Prøv igjen."

---

## Journey: Admin Switches to a Non-Authoring Page

**Precondition:**
- Admin navigates away from the wizard to e.g. `/platform-admin/guardian`.

**Steps:**

1. Admin navigates to `/platform-admin/guardian`
   → No `<DomainChatOwnership>` mounted on this route
   → BotssonShell Orb returns to **fully interactive mode**
   → Admin can open Orb and chat normally

**Postcondition:**
- Orb is interactive on all routes without domain chat ownership.
- Admin can resume general Botsson interactions.

---

## Pre-Implementation Behaviour (Current)

Without ADR-0238 implemented, the current (broken) behaviour is:
1. Admin on wizard page sees BOTH the wizard textbox AND the Orb.
2. Admin types in the Orb → message goes to general Botsson session (wrong).
3. Wizard does not advance. No error. Silent misroute.

This is the shipping-blocker described in ADR-0238.

## Implementation Requirements

See `docs/HANDOFF-domain-chat-ownership.md` for full implementation spec.

Key: `<DomainChatOwnership>` must be mounted by the page — it is NOT automatic.
Every new page with an embedded chat surface must explicitly declare ownership.
Add to page checklist in `smartout-page-polish` skill.
