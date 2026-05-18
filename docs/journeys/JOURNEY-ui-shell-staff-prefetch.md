---
title: JOURNEY — ui-shell staff-prefetch
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: mobile-schedule
tags: [mobile, journey]
---

# JOURNEY — Ansatt-dropdown viser hele teamet uavhengig av scope

## Journey: Employee opens Ansatt dropdown from default scope

**Precondition:** User signed in on mobile PWA (http://localhost:8083). Workspace has ≥ 2 active profiles. ShiftListScreen mounted with default scope `me`.

1. User taps "Ansatt ▾" chip → System opens dropdown panel → User sees 4-column avatar grid with EVERY active profile in workspace, not only themselves.
2. User taps a colleague avatar → System sets scope `{ kind: "person", value: profile_id }` → User sees only that colleague's shifts in the week.
3. User taps "✦ Mine vakter" → System resets scope to `me` → User sees own shifts. Dropdown state remains populated (no re-fetch latency).

**Postcondition:** Staff list cached for the active week; switching between `me` / `all` / `dept` / `person` does NOT alter dropdown content.

**Error paths:**
- `useTeamStaff` fetch fails → dropdown shows empty state with "Kunne ikke laste team" + retry button. Other scopes continue to work (shift list unaffected).
- Workspace has only 1 active profile → dropdown shows that single entry (degenerate but valid).

## Journey: Manager filters by person from team-wide view

**Precondition:** Same as above; user has manager role.

1. User selects "Hele teamet" → All workspace shifts render.
2. User taps "Ansatt ▾" → Dropdown shows full staff list (identical to me-scope case).
3. User picks "Erik" → Shift list filters to Erik's published shifts for the week.
4. User taps "Avdeling ▾ → Bar" → scope changes to `{ kind: "dept", value: "bar" }`; staff dropdown remains populated (no re-fetch).

**Postcondition:** Scope transitions never empty the dropdown.

**Error paths:** Same fail-fast behavior as journey 1.
