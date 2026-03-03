---
title: "User Journeys — Onboarding Flow"
status: done
updated: 2026-03-02
created: 2026-03-02
module: onboarding
tags: [onboarding, wizard, workspace-activation, user-journey]
---

# User Journeys — Onboarding Flow

## Journey: New User Creates Workspace via Website Scan

**Precondition:** User has a company website URL. No existing account.

1. User navigates to `/onboarding` → System shows InitStep with URL input
2. User enters website URL → User clicks "Scan & Generate"
3. System navigates to CrawlStep (loading spinner) → System calls `gather-workspace-intelligence` Edge Function → System extracts company data (name, locations, departments, contact info)
4. System navigates to AuthStep → User creates account (email + password) → System calls `supabase.auth.signUp`
5. System navigates to OrgVerificationStep → User enters 9-digit org number → System fetches from Brønnøysundregistrene API → System displays verified company info (name, address, CEO, industry)
6. User confirms org data → System navigates to BrandingStep
7. User configures branding (logo, slogan, brand color, communication tone) → User clicks "Continue"
8. System navigates to SeasonEducationStep → User reads explanation of Seasons concept → User clicks "I understand, let's build one"
9. System navigates to SeasonIdentityStep → User names their season, selects type (Permanent/Temporal), optionally sets dates → User clicks "Setup Departments"
10. System navigates to DepartmentsStep → User adds/removes departments, toggles season activity → User clicks "Setup Teams"
11. System navigates to TeamsStep → User adds teams within each department, optionally adds cross-department teams → User clicks "Verify Locations"
12. System navigates to LocationsStep → User reviews/edits locations, adds new ones → User clicks "Setup Procedures"
13. System navigates to ProceduresStep → User creates operational procedures with urgency/department assignment → User clicks "Final Review"
14. System navigates to BattlefieldReviewStep → User reviews all configured data (identity, season, locations, departments, procedures)
15. User clicks "Activate Workspace" → System shows FinalizeStep (loading) → System calls `activate-workspace` Edge Function → Edge Function calls `activate_workspace_v3` RPC
16. RPC creates: company → workspace → company_member → profile → season → locations → departments → teams → policy → protocol → procedures
17. System fetches workspace slug → System marks onboarding session completed → System navigates to InviteStep
18. User invites team members via email, SMS, or shareable link → User clicks "Enter Dashboard" or "Skip for now"
19. System navigates to DoneStep → User clicks "Enter Dashboard" → System redirects to workspace dashboard

**Postcondition:** Workspace created with all structure. User is admin/owner. Dashboard accessible at `{slug}.smartout.ai/dashboard`.

**Error paths:**

- Website scan fails → System falls back to demo data after 3s, continues flow
- Auth fails → Error shown inline, user retries
- Org number not found → Error message, user can skip or retry
- `activate-workspace` fails → Error shown on BattlefieldReviewStep, user can retry
- Invalid season_type enum → Fixed: frontend now sends DB-compatible values (`default`/`calendar`)

---

## Journey: Returning User Resumes Onboarding

**Precondition:** User has an account with incomplete onboarding session.

1. User navigates to `/onboarding` → System checks auth state
2. System finds incomplete `onboarding_session` for user → System restores `current_step` and workspace data from JSONB columns
3. System navigates to the restored step (skipping transient steps like `crawling`/`finalizing`)
4. User continues from where they left off

**Postcondition:** User resumes at their last saved step with all data intact.

**Error paths:**

- Session data corrupted → System falls back to `init` step

---

## Journey: Authenticated User Starts Onboarding

**Precondition:** User is already logged in (e.g., via `/login`).

1. User navigates to `/onboarding` → System detects authenticated state
2. User enters URL → System calls `gather-workspace-intelligence`
3. System skips AuthStep automatically → navigates directly to OrgVerificationStep
4. Flow continues as normal from step 5 onward

**Postcondition:** Same as Journey 1, but auth step is skipped.

---

## Journey: User Sets Up Manually (No Website)

**Precondition:** User has no website or prefers manual setup.

1. User navigates to `/onboarding` → System shows InitStep
2. User clicks "Set up manually" → System navigates to AuthStep (or OrgVerificationStep if authenticated)
3. User fills in all data manually through each step (branding, season, departments, teams, locations, procedures)
4. Flow continues normally

**Postcondition:** Same as Journey 1, but with user-entered data instead of scraped data.

**Error paths:**

- No departments defined → Procedures step shows "must define departments first"
