---
title: "Journey — shift-hub.tsx phase-aware views absorbed into canonical tab"
feature: mobile-phase-3f-home-absorption
journey: shift-hub-views-absorbed
status: draft
verified_at: null
e2e_test: null
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [journey, mobile, shift-hub, absorption, adr-0268, adr-0133]
---

# Journey: `shift-hub.tsx` phase-aware views absorbed into canonical tab

**Role:** employee (primary) — admin secondary

**Precondition:**
- User signed in on mobile PWA
- User has at least one active workspace membership
- ADR-0268 5-tab layout live (Kalender | Vakter | FAB | Chat | Min Tid)
- Council G2 has decided target tab for absorption (Kalender DayView vs Vakter)

## Happy Path

1. User opens app → System loads 5-tab layout → User taps Council-decided target tab
2. Target tab renders the appropriate phase view based on shift state:
   - No active/upcoming shift today → **NoShiftView** content (community, growth, news)
   - Shift starting soon → **BeforeShiftView** content (upcoming shift details, prep)
   - Active shift in progress → **DuringShiftView** content (live timer, tasks, actions) OR **DuringShiftViewV2** per Council G2
   - Shift just ended → **AfterShiftView** content (summary, hours confirm, handoff)
3. Phase transitions happen without route navigation — single tab surface renders the right view based on shift hook (`useShiftClock` or equivalent)
4. User can act on phase-relevant verbs (clock-in/out, deviation report, task complete) — all execute-verbs (ADR-0133)

**Postcondition:**
- No navigation through `(home)` hidden route at any point
- Every phase view emits with `getProfileContext()` (ADR-0134)
- All four view components live in the canonical target tab, not under `(home)/`
- ADR-0133 boundary preserved — no authoring/compose UI introduced

## Error Paths

- **Scenario:** Shift hook returns ambiguous phase (e.g. mid-clockout) → System renders graceful fallback (DuringShiftView with partial state) + retries hook
- **Scenario:** No workspace context (rare edge case) → NoShiftView renders empty state with "Join a workspace" hint (does NOT redirect to authoring on mobile per ADR-0133)
- **Scenario:** Phase transition mid-render → Suspense boundary holds; new view fades in
- **Scenario:** Push notification arrives during phase change → Notification surfaces in NotificationSheet without changing tab

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested all four phases on PWA `localhost:8083`
- [ ] `apps/mobile/app/(app)/(home)/shift-hub.tsx` confirmed deleted (or moved)
- [ ] Target tab page imports all four view components and renders them based on shift phase
- [ ] No remaining import path references `(home)/shift-hub`

**Mark `status: verified` in frontmatter when all six boxes are checked.**
