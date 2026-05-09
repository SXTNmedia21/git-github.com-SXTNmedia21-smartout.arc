---
title: "Journey: Botsson Arena — Form View"
status: draft
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, arena, form-view, journey]
---

# Journey: Botsson Arena — Form View

> **Current status: Form-view is a placeholder.** `BotssonArena.tsx` renders the string "Skjema"
> only. This journey documents the INTENDED flow for when the view is implemented.
> Reference: BOTSSON-SYSTEM-MAP.md §Component map (🟡 Form-view + Video-view er placeholders).

## Journey: Manager Opens a Form via Botsson Arena

**Precondition:**
- Manager is authenticated in the dashboard.
- BotssonShell is open (morphing div, bottom-right corner, expanded to Arena mode).
- The Form-view tab is selected in BotssonArena navigation.
- A workspace form (e.g. onboarding checklist, incident report) exists in the system.

**Steps (intended — not yet implemented):**

1. Manager navigates to BotssonArena → taps "Skjema" tab
   → System renders Form-view panel inside the Arena
   → Manager sees a list of available forms for their workspace

2. Manager selects a form (e.g. "Incident Report")
   → System loads the form definition from `policy` / `protocol` table or custom form schema
   → Manager sees form fields rendered in the Arena panel

3. Manager fills in fields (text, select, date)
   → System validates fields client-side
   → Form state is held in Arena local state

4. Manager submits the form
   → System calls relevant API endpoint (TBD per form type)
   → System emits telemetry event via `emit()` from `@smartout/telemetry`
   → Manager sees confirmation: "Skjema sendt" (or equivalent i18n key)

**Postcondition:**
- Form data is persisted (location depends on form type).
- Telemetry event emitted.
- BotssonArena returns to default view or shows confirmation state.

**Error paths:**
- Form fields fail validation → inline error messages per field. Form not submitted.
- API call fails → toast via `sonner`: "Kunne ikke sende skjema. Prøv igjen." (i18n key TBD)
- Workspace has no forms configured → empty state: "Ingen skjemaer tilgjengelig for dette arbeidsstedet."

## Implementation Notes

- Form-view is currently a placeholder string — full implementation is pending.
- Form schema source (policy table vs custom form table) is not yet decided.
- This journey requires a dedicated sub-sortie: `feat/botsson-arena-form-view`.
- No ADR exists yet for form data model; create ADR before building.
