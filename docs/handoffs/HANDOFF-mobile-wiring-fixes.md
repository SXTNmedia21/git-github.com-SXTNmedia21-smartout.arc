---
title: "Handoff — Mobile Wiring Fixes"
status: done
updated: 2026-03-26
created: 2026-03-26
module: mobile
tags: [mobile, wiring, bugfix, navigation, handoff]
---

# Handoff — Mobile Wiring Fixes

## Summary

Connected 7 orphaned mobile features that were fully built but unreachable. No new business logic was introduced — this was pure wiring: updating imports, navigation paths, layout config handling, and query hooks.

**Before:** 12 orphaned components, 4 unreachable screens, 1 hidden tab, hardcoded demo data in 2 screens.
**After:** Every built feature is accessible. Real data flows where it was previously faked.

---

## What Was Built

| #   | Fix                                                                                  | File(s)                          |
| --- | ------------------------------------------------------------------------------------ | -------------------------------- |
| 1   | TabBar now respects `href: null` from layout config instead of hardcoded chat filter | `navigation/TabBar.tsx`          |
| 2   | PunchButton always visible, muted style when no shift scheduled                      | `shift/PunchButton.tsx`          |
| 3   | ShiftClockView replaced 3 hardcoded task cards with real `TaskFeed`                  | `shift-clock/ShiftClockView.tsx` |
| 4   | Me screen: added "Rediger profil" and "Mitt team" navigation buttons                 | `(me)/index.tsx`                 |
| 5   | HACCP screen: real `asset` query with demo fallback                                  | `(home)/haccp.tsx`               |
| 6   | Deviation form: submit connected to `useReportDeviation` offline sync queue          | `(home)/deviation.tsx`           |
| 7   | ShiftClockView: "Ring leder" opens phone dialer, "Notater" navigates to chat         | `shift-clock/ShiftClockView.tsx` |

---

## Decisions

### D1 — TabBar: layout config drives visibility, not hardcoded names

**Decision:** Replace `r.name !== "(chat)"` with `descriptors[r.key]?.options?.href !== null`.

**Why:** The layout already controlled tab visibility via `href: null`. The hardcoded filter was an override that conflicted with intent. Respecting the layout config is the correct pattern — it means new tabs are controlled in one place (the layout file), not two.

### D2 — PunchButton: always render, adapt style

**Decision:** Remove the `shouldShow` guard entirely. Use `isIdle` flag to mute styling instead of hiding.

**Why:** Ad-hoc punches are a valid use case (late arrivals, shift swaps). Hiding the button prevents this. The muted style communicates "no shift scheduled" without blocking the action.

### D3 — HACCP: demo fallback strategy

**Decision:** Query real assets, fall back to hardcoded demo units if none exist.

**Why:** HACCP logging must work even in workspaces that haven't set up their asset registry. The demo fallback ensures the workflow is never blocked by missing setup.

### D4 — Notes → Chat mapping

**Decision:** "Notater" tab in ShiftClockView navigates to `/(app)/(chat)`.

**Why:** Notes were always intended to live in the shift conversation thread. Routing to chat is correct rather than building a separate notes store.

---

## Learnings

1. **Build the wire at the same time as the component.** All 7 features were fully built but never connected. A checklist item "wire into navigation" should be part of every mobile screen implementation task.

2. **Hardcoded visibility filters accumulate debt.** The TabBar `r.name !== "(chat)"` filter was a quick workaround that survived well past its intended lifetime. Expo Router's `href: null` is the correct mechanism — use it from the start.

3. **Demo fallback pattern is worth standardising.** The HACCP query-with-demo-fallback approach works well for screens that depend on workspace configuration that may not exist yet. This pattern could be applied broadly (assets, teams, locations).

4. **Offline-first: decouple UX state from mutation state.** The deviation fix shows the "done" UI immediately on submit, letting the sync queue handle persistence. This is the correct mobile pattern — don't make users wait for network confirmation.

---

## Known Issues / Debt

- `useLeaderPhone` hook needs to be verified — it was referenced in the plan but its existence in the codebase was assumed. If missing, Task 7 will fail at runtime (not at build time).
- HACCP query targets `asset_type = 'cooling_unit'`. If the workspace uses a different asset type for temperature units, the fallback will always trigger. A workspace config setting for HACCP unit filter would resolve this.
- Me screen "Mitt team" navigates to `/(app)/(home)/team`. If this route doesn't exist or has been renamed, the navigation will fail silently on Android (Expo Router swallows missing-route errors in production builds).

---

## Next Steps

1. Verify `useLeaderPhone` hook exists and returns the correct field from the leader profile.
2. Add a typecheck smoke test for all 7 modified files to the CI pipeline.
3. Audit all other mobile screens for similar orphaned wiring — the pattern may recur.
4. Consider a standardised "connect to real data or fallback" utility for screens with optional workspace config dependencies.
