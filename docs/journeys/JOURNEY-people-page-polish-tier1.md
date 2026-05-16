---
title: "Journey — People Page Polish Tier-1"
status: verified
feature: people-page-polish-tier1
updated: 2026-05-14
created: 2026-05-14
module: people
tags: [polish, performance, ux, page-polish, people, tier1]
---

# Journey — People Page Polish Tier-1

This polish sortie applies the 8-phase SKILL.md workflow to `/dashboard/people` — the employee roster page. Focus: skeleton-flash elimination, motion token compliance, Botsson tool registration, and site-map entry. LCP measurement is deferred pending Docker Desktop restart (Supabase local prerequisite).

## Journey: Admin loads /dashboard/people (cold cache)

**Precondition:** User authenticated as admin or manager. First navigation to `/dashboard/people` after browser restart. Network normal (10 Mbit+).

### Happy Path

1. User clicks "Ansatte" in dashboard sidebar → Browser issues GET `/dashboard/people` → System serves Next.js prod-build RSC bundle → `loading.tsx` returns null (no mismatched skeleton flash during RSC streaming phase)
2. RSC completes — `fetchWorkspacePeople` + `listWorkspaceInvitations` run in `Promise.all` server-side → `PeoplePageClient` receives hydrated `initialData` → User sees full employee roster immediately (no client-side mount fetch)
3. Page renders KPI strip (Ansatte / Aktive / Beredskap) + tab navigation + employee data table → User sees live employee data from first frame

**Postcondition:** People page fully rendered. All employees, departments, readiness scores, and contract status visible. No skeleton flash. Target cold LCP `<` 1500ms (measurement deferred).

### Error Paths

- **Auth missing or expired** → Middleware redirects to `/login` → User signs in → Returns to /dashboard/people.
- **fetchWorkspacePeople fails** → RSC throws, Next.js shows error boundary → User sees error with retry option.
- **Empty roster** → Empty state with "Ingen ansatte ennå. Bruk «Inviter ansatt»-knappen for å legge til ditt første teammedlem." message + invite CTA.

## Journey: Admin invites a new employee

**Precondition:** /dashboard/people loaded, user is admin.

### Happy Path

1. User clicks "Inviter ansatt" button → `InviteMemberDialog` opens with `AnimatePresence` → Dialog shell animates in using `motionTokens.spring` (not raw spring values)
2. User fills in first name, last name, selects invite channels (link/email/SMS) → System auto-saves draft to localStorage so accidental close never loses input
3. User clicks "Send invitasjon" → `submitSingleInvite` fires → Server returns token → `generateLink` displayed → User copies invitation link
4. On close: `emit("button clicked")` fires → `activity_trail` records the invite action

**Postcondition:** Invitation created. Link generated or channels dispatched. People list refreshes.

### Error Paths

- **Validation error** → Inline error display under the field (`row.errors` array) + "Rett opp feil" toast → User corrects → Resubmits.
- **API error** → `toast.error` with error message → User retries.

## Journey: Manager creates a staff event (innkalling)

**Precondition:** /dashboard/people/invitations loaded, user is admin or manager.

### Happy Path

1. User clicks "Ny innkalling" → `StaffEventDialog` opens with `AnimatePresence` → Dialog animates in using `motionTokens.spring`
2. User selects event type, fills title + date/time, optionally adds location and message
3. User selects participants from the multi-select picker → Adds to event
4. User confirms → `createStaffEvent` server action fires → `emit("button clicked")` records event creation → Success toast

**Postcondition:** Staff event created. Invitations list refreshes.

### Error Paths

- **No participants selected** → "Legg til minst én deltaker" toast → User selects participants → Resubmits.
- **Server error** → Error toast with message → User retries.

## Journey: Botsson queries people data via voice

**Precondition:** User on /dashboard/people with Botsson voice active.

### Happy Path

1. User says "Hvor mange aktive ansatte har vi?" → Botsson calls `getPeopleState` tool → Returns `{ total, active, departments, avg_readiness_pct }` → Botsson speaks summary
2. User says "Hva er Kari sin status?" → Botsson calls `getEmployeeInfo({ employeeName: "Kari" })` → Returns matching employees with role, department, status, readiness → Botsson speaks result
3. User says "Hvem er i kjøkkenavdelingen?" → Botsson calls `getPeopleByDepartment({ departmentName: "kjøkken" })` → Returns department members → Botsson reads the list
4. User says "Vis meg beredskapsoppsummering" → Botsson calls `getReadinessSummary` → Returns avg score, below-50%, lowest 5 names → Botsson speaks insight

**Postcondition:** Botsson answers workforce questions without requiring page navigation. All 4 tools available when user is on /dashboard/people (registered via `PeopleVoiceToolsBridge` → `useRegisterTools`).

### Error Paths

- **Employee not found** → `getEmployeeInfo` returns `{ error: "No employee found matching ..." }` → Botsson apologizes and asks user to clarify name.
- **Empty department** → `getPeopleByDepartment` returns error → Botsson reports no match.

## Phase Status (2026-05-14)

| Phase | Description | Status |
|---|---|---|
| 1 | Prod build baseline (LCP/CLS/TTI/INP) | DEFERRED — Docker Desktop down |
| 2 | Skeleton-flash fix + motion tokens | DONE |
| 3 | Re-test after fixes | DEFERRED (no baseline yet) |
| 4 | Nordic Split design audit | DONE — 0 hardcoded colors, 0 motion violations |
| 5 | Telemetry emit audit | DONE — all non-deferred mutations emit() |
| 6 | Page knowledge (header/description/copy) | DONE — content written, DB sync deferred |
| 7 | Harness tools (useRegisterTools) | DONE — 4 tools registered |
| 8 | Site-map entry | DONE |

**To complete:** Start Docker Desktop → `npx supabase start` → run `people-perf-baseline.ts` → insert `page_knowledge` row → flip `lighthouse_lcp_under_1500ms: true` + `page_knowledge_db_synced: true` → set `verified: true`.
