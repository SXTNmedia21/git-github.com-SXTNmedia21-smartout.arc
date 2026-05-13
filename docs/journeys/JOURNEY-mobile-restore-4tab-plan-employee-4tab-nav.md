---
title: "Journey — Employee navigates 4 tabs + FAB on mobile"
feature: mobile-restore-4tab-plan
journey: employee-4tab-nav
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [journey, mobile, employee, navigation]
---

# Journey: Employee navigates 4 tabs + FAB on mobile

**Role:** employee

**Precondition:**
- Employee signed in on mobile PWA (`localhost:8083` in dev, production URL in prod)
- Employee has at least one active workspace membership
- Profile status = `active` or `trainee`

## Happy Path

1. Employee opens app → System loads `(tabs)/_layout.tsx` → User sees 4 tab labels: **Hjem | Vakter | [FAB center] | Chat | Meg** (or "Min tid" pending naming decision)
2. Employee taps **Hjem** → System renders home content directly (no redirect through `(home)/index.tsx` stub) → User sees today's shift summary + next action
3. Employee taps **Vakter** → System renders shift hub → User sees upcoming shifts
4. Employee taps **Chat** → System renders chat list/thread → User sees conversation history
5. Employee taps **Meg** (or "Min tid") → System renders profile/personal-time view → User sees their hours, absences, settings
6. Employee taps **center FAB** → System opens AI chat bottom-sheet → routes to `/api/emma/chat` (BFF, ADR-0132)

**Postcondition:**
- No console errors on any tab transition
- Every navigation event emits via `getProfileContext()` (ADR-0134) — no empty-string `workspace_id` / `actor_id`
- No 404 on deleted route groups (`(digest)`, `(komm)`)

## Error Paths

- **Scenario:** Employee opens app while offline → System shows cached tab shell, FAB tap surfaces "Offline — try again when connected" via toast; no telemetry emit attempted until reconnect (offline queue per ADR-0134)
- **Scenario:** AI chat sheet `/api/emma/chat` returns 500 → System shows error state in sheet, retry button visible; sheet stays open
- **Scenario:** Employee has no active workspace → Tab shell still renders; tabs show empty states; FAB still functions for AI chat
- **Scenario:** Push deeplink targets removed `(digest)` or `(komm)` route → System redirects to default tab (Hjem); no crash

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end on PWA `localhost:8083`

**Mark `status: verified` in frontmatter when all three boxes are checked.**
