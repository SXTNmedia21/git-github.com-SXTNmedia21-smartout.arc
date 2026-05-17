---
title: "Journey — Mobile 4-Tab Plan Resolution (supersession by ADR-0268)"
status: verified
feature: mobile-restore-4tab-plan
updated: 2026-05-14
created: 2026-05-14
module: mobile
tags: [journey, mobile, tab-navigation, supersession, adr-0268, drift-fix]
---

# Journey — Mobile 4-Tab Plan Resolution

This sortie's original brief was "restore 4 tabs + FAB" against an alleged 6-tab drift. On execution, the branch base already embodied ADR-0268's canonical 5-tab layout. The journey below documents the post-supersession user-facing reality + the cleanup this sortie performed.

## Journey: Employee opens mobile app (canonical 5-tab post-ADR-0268)

**Precondition:** User authenticated, mobile app launched, no deep-link in URL.

### Happy Path

1. App boots → System renders `(app)/_layout.tsx` with 5-tab bottom navigator → User sees: Kalender / Vakter / ⊕ FAB / Chat / Min Tid
2. User taps **Kalender** (default tab) → Kalender screen renders today as anchor → User sees personal day view
3. User taps **Vakter** → Vakter list renders → User sees current week shift roster
4. User taps **⊕ FAB** (center) → AddSheet opens → User can quickly add shift / message / task / absence depending on context
5. User taps **Chat** → Chat surface opens → User sees Botsson conversation + helpdesk Skranke segment
6. User taps **Min Tid** → Timesheet surface opens → User sees own hours, settlements, pending approvals
7. Back-press from any tab → Returns to Kalender (default anchor)

**Postcondition:** Navigation reflects ADR-0268. No hidden tab is reachable via direct tap.

### Hidden / Deferred routes (NOT user-facing tabs)

- `(home)` folder — RETAINED for 3f.2/3f.3/3f.4 inbound importer retargets (per L-0250). Reachable only via deep-link.
- `(komm)` route group — RETAINED per ADR-0268 §"Tab removal sequence". Used as deep-link target + ticket-detail screen from Chat tab "Skranke" segment.
- `digest.tsx` — DELETED this sortie (0 cross-imports, orphaned by ADR-0268 supersession).
- `use-digest-feed.ts` — DELETED this sortie (only consumer was digest.tsx).

### Error Paths

- **Deep-link to deleted digest route** → Expo Router returns 404 → User sees "Page not found" → Falls back to Kalender via back-press.
- **Deep-link to (home)/index.tsx** → Renders home folder content (per L-0250, intentional during 3f.2-3f.4 transition).

## Journey: Manager opens mobile app (same 5-tab layout, manager-visible content)

**Precondition:** User is manager or admin role.

### Happy Path

1-7. Same as employee path. Tab labels and routes identical; tab content branches on role inside each screen.

**Postcondition:** Manager sees admin-tier content within each tab (e.g. team coverage in Vakter, all-employee timesheet in Min Tid).

## Acceptance Status

| Check | Result |
|------|--------|
| 5-tab layout matches ADR-0268 | PASS (verified `apps/mobile/app/(app)/_layout.tsx:93-109`) |
| FAB renders on every tab | PASS (verified `apps/mobile/src/components/navigation/AIFab.tsx`) |
| digest.tsx + use-digest-feed.ts deleted | PASS |
| (komm) route group retained | PASS |
| (home) folder retained for retarget | PASS |
| No cross-imports broken by deletion | PASS (grep clean) |

## Outcome

Original "restore 4 tabs" framing superseded by ADR-0268 (5-tab + FAB). This sortie's value is documentation of the supersession trajectory + deletion of 2 orphaned files.
