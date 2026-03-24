---
title: "Journey — Unified Wizard Shell"
status: done
updated: 2026-03-24
created: 2026-03-24
module: ui
tags: [wizard, join, onboarding, dashboard-setup, i18n]
---

# Journey — Unified Wizard Shell

## Journey: New User Registration (Join Wizard)

**Precondition:** User is not registered. No account exists.

1. User visits `/join` -> System renders `AnimatedWizardShell` with dark theme, 7 steps in sidebar
2. User sees Step 1 (Account) -> System shows email, company name, industry, city, website fields
3. User fills company name + city -> System auto-triggers BRREG lookup via JoinScrapingProvider
4. User fills website URL -> System triggers web scraping for business data
5. User clicks "Neste" -> WizardShell validates via step1Schema against state.account, advances to Step 2
6. User sees Step 2 (Business) -> System pre-fills address/org number from BRREG data with typewriter animation
7. User confirms/edits business info, clicks "Neste" -> Advances to Step 3
8. User sees Step 3 (About) -> System auto-generates about/history/concept via intelligence pipeline
9. User edits text, can use AI rewrite per field -> Clicks "Neste" or "Hopp over"
10. User completes Steps 4-5 (Hours, Menu) -> System pre-fills from scraped data
11. User sees Step 6 (Create Account) -> System shows email (read-only) + password fields
12. User creates password -> System calls Supabase auth.signUp(), creates auth user
13. User sees Step 7 (Team) -> System shows invite form for team members
14. User adds invites or clicks "Hopp over" -> WizardShell calls onComplete(), persists to localStorage

**Postcondition:** User has auth account. Provisional workspace data stored in intelligence_data.

**Error paths:**

- BRREG lookup fails -> User fills fields manually, no blocking
- Scraping fails -> Intelligence pipeline returns partial data, user fills gaps
- Email already registered -> System suggests sign-in, offers password reset
- Validation fails -> WizardNavBar shows shake animation, user corrects fields

---

## Journey: Admin Confirms Workspace (Onboarding Wizard)

**Precondition:** User completed Join wizard. Workspace exists with intelligence_data populated. User is authenticated.

1. User visits `/onboarding` -> System loads workspace.intelligence_data via loadState()
2. System merges scraped + BRREG + Places data via mergeBusinessData()
3. System generates department/procedure suggestions via Industry Intelligence (I1)
4. User sees Step 1 (Confirm Business) -> Pre-filled card grid with 9 business fields
5. User clicks a field to edit -> Inline edit, updates state via updateState()
6. User clicks "Neste" -> Advances to Step 2 (Confirm Departments)
7. User sees pre-selected department chips -> Toggles on/off, adds custom departments
8. User clicks "Neste" -> Advances to Step 3 (Confirm Locations)
9. User sees location cards from scraping -> Adds/removes locations and zones
10. User clicks "Neste" -> Advances to Step 4 (Confirm Procedures)
11. User sees procedure toggles with "Anbefalt" badges -> Toggles, deselect warning for recommended
12. User clicks "Neste" -> Advances to Step 5 (Summary)
13. User sees read-only summary with edit links (goTo) -> Clicks "Fullfør oppsett"
14. System calls finalize-workspace Edge Function -> Bootstrap cascade runs (blocking)
15. Bootstrap succeeds -> System redirects to dashboard

**Postcondition:** Workspace is finalized. Cascade data (D1-D6, K1a binding, tariff rates) seeded. onboarding_completed = true.

**Error paths:**

- No workspace found -> Redirect to /join
- intelligence_data empty -> Empty forms, user fills manually
- Bootstrap fails -> HTTP 207 returned, error surfaced to user (not suppressed)
- Finalization fails -> Error shown on summary step, user can retry

---

## Journey: Admin Technical Setup (Dashboard Setup Wizard)

**Precondition:** Workspace finalized via onboarding. Admin logged in. Dashboard accessible.

1. Admin visits `/dashboard/setup` (or redirected if setup incomplete) -> System renders AnimatedWizardShell with light theme, 9 steps
2. Admin sees Step 1 (Welcome) -> Scraped company facts displayed via adapter
3. Admin uploads documents (Step 2) -> System extracts policies, payroll, employees, shift patterns
4. Admin configures governance (Step 3) -> Industry templates + extracted policies available
5. Admin sets up payroll (Step 4) -> Tariff selection, supplements, allowances from I1
6. Admin configures employment (Step 5) -> Contract templates, notice periods, pension
7. Admin invites team (Step 6) -> Manual + CSV import, creates invitations
8. Admin creates shift templates (Step 7) -> Suggested + custom shifts
9. Admin configures season (Step 8) -> Season creation with budget/factors
10. Admin reviews handbook (Step 9) -> Auto-generated chapters, inline editing
11. Admin clicks "Fullfør" on last step -> Wizard completed event emitted

**Postcondition:** Workspace fully configured with governance, payroll, employment, shifts, seasons, and handbook.

**Error paths:**

- Documents fail to extract -> Manual entry fallback
- Industry package not available -> Default templates used
- CSV import fails -> Row-level errors shown, valid rows processed
- Any step skippable steps can be skipped (welcome, documents, team, shifts, handbook)

---

## Journey: Invited Employee Accepts (Invitation Flow)

**Precondition:** Admin has sent invitation via Team step in Join or Dashboard Setup wizard.

1. Employee receives invitation link -> Opens `/invite/[token]`
2. System validates token (pending, not expired) -> Shows acceptance form
3. Employee fills name + creates account -> System calls accept-invitation Edge Function
4. Edge Function creates profile, assigns departments/teams, creates employment contract
5. Edge Function emits `invitation_accepted` event to activity_trail + engine_event
6. Employee redirected to dashboard -> Sees onboarding content for their role

**Postcondition:** Employee has profile with trainee status. Activity trail records acceptance.

**Error paths:**

- Token expired -> Error message, suggest contacting admin
- Token already used -> Error message with link to sign in
- Auth creation fails -> Generic error, retry option
