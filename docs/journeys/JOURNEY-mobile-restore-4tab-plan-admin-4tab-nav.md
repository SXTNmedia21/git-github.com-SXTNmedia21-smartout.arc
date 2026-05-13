---
title: "Journey — Admin navigates 4 tabs + FAB on mobile"
feature: mobile-restore-4tab-plan
journey: admin-4tab-nav
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: mobile
tags: [journey, mobile, admin, navigation]
---

# Journey: Admin navigates 4 tabs + FAB on mobile

**Role:** admin

**Precondition:**
- Admin signed in on mobile PWA (`localhost:8083` dev, prod URL in prod)
- Admin has workspace with `is_admin_in_workspace()` true
- Profile status = `active`

## Happy Path

1. Admin opens app → System loads `(tabs)/_layout.tsx` → User sees same 4 tab labels as employee: **Hjem | Vakter | [FAB center] | Chat | Meg** (ADR-0133: identical tab structure across roles; content differs)
2. Admin taps **Hjem** → System renders home with admin-scope summary (e.g. team coverage, pending approvals) → User sees admin home
3. Admin taps **Vakter** → System renders shift hub with admin-scope content (full team schedule, not just own shifts) → User sees team schedule
4. Admin taps **Chat** → System renders chat list → User sees admin conversations (incl. workspace-wide threads if any)
5. Admin taps **Meg** (or "Min tid") → System renders admin's own profile (not workspace settings — ADR-0133 boundary keeps admin authoring on web)
6. Admin taps **center FAB** → System opens AI chat bottom-sheet → routes to `/api/emma/chat` with admin scope context

**Postcondition:**
- Admin sees same 4 tabs, no extra "admin-only" tab (per ADR-0133)
- Every navigation event emits with admin `actor_id` + workspace `workspace_id`
- No authoring UIs accessible from any mobile tab (per ADR-0133)
- No 404 on deleted route groups

## Error Paths

- **Scenario:** Admin tries to access workspace settings via deeplink → System rejects with "Authoring not available on mobile" message + link to web (ADR-0133)
- **Scenario:** Admin's AI chat request involves authoring intent (e.g. "create new policy") → System replies "Please use the web app to author policies"; chat does not attempt write
- **Scenario:** Admin role check fails (token expired mid-session) → System redirects to login; tab shell does not render with stale state

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end on PWA as admin (`admin@smartout.no` seed)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
