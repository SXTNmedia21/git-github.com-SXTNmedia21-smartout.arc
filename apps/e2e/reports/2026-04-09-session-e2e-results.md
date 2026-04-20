---
title: E2E Results — 2026-04-09 Session
date: 2026-04-09
run_by: claude
trigger: post-fix verification for people-page + contract + finalize RPC
---

# E2E Results — 2026-04-09

## Run Config

- Dev server: localhost:3060
- DB: Supabase Local (freshly reset)
- Runner: Playwright (no service role key — excludes seed-dependent tests)

## Results: 23 pass, 0 fail

### auth.spec.ts (9/9)

- [x] Login page loads with Norwegian labels
- [x] Email and password fields present
- [x] Error on invalid credentials
- [x] Redirect unauthenticated /dashboard to /login
- [x] Login and reach dashboard
- [x] Persist session across navigation
- [x] Persist session on page reload
- [x] Signup page loads
- [x] Signup option from login page

### contracts-api.spec.ts (4/4)

- [x] Rejects POST body with `field_values` key (must use `overrides`)
- [x] Accepts POST body with canonical `overrides` key shape
- [x] Rejects unauthenticated POST with 401
- [x] Rejects GET without workspace_id with 400

### dashboard.spec.ts (8/8)

- [x] Dashboard shell renders with sidebar
- [x] User menu shows display name
- [x] Navigate to people page
- [x] Navigate to schedule page
- [x] No platform-admin link for non-godmode users
- [x] Platform-admin loads for godmode user
- [x] Guardian page loads
- [x] Platform-admin sidebar navigation

### governance.spec.ts (2/2)

- [x] Governance page loads
- [x] Governance content shows

## Skipped (not run — need service role key via op run)

- contract-composition/ (5 stubs — test.skip)
- journey-\* specs (need seed helpers)
- telemetry-smoke.spec.ts (needs seed helpers)
- workspace-setup-flow.spec.ts (needs seed helpers)

## Journeys NOT covered by E2E

These user journeys were fixed in this session but have NO E2E coverage:

### People Page

- [ ] Admin changes employee role via row action
- [ ] Admin changes employee department via row action
- [ ] Admin deactivates employee
- [ ] Admin bulk-updates multiple employees
- [ ] Admin sends contract from people page row action
- [ ] Admin edits emergency contact in slide-out panel
- [ ] Admin sends protocol reminder from competence tab
- [ ] Admin creates contract from slide-out "Opprett" button

### Contract Send Drawer

- [ ] Template list loads and displays seeded templates
- [ ] Placeholder values pre-filled from profile data
- [ ] Admin overrides placeholder value
- [ ] Contract draft created without microservice
- [ ] Employer name and org number auto-resolved

### Composition Wizard

- [ ] Employee picker loads workspace profiles
- [ ] Cascade derivation returns proposal
- [ ] GhostValueCards display derived values
- [ ] Compliance badges show validation results

### Finalize Onboarding

- [ ] Company address written after onboarding
- [ ] Company phone/email written after onboarding
- [ ] Logo URL written to workspace
- [ ] company_details upsert runs
- [ ] social_media upsert runs
- [ ] onboarding_completed set to true
- [ ] Google Places data written to workspace
