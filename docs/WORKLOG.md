---
title: "Worklog — Onboarding Wizard Refactor"
status: review
updated: 2026-03-01
created: 2026-03-01
module: onboarding
tags: [wizard, refactor, steps, progressive-save]
---

# Worklog — Onboarding Wizard Refactor

## Status: 🟡 In Progress

## Done

- [x] Create shared types file (types.ts) — WizardStep, WorkspaceData, WizardContext
- [x] Create useOnboardingWizard hook — state machine, progressive save, auth tracking, finalize
- [x] Create WizardContext.tsx provider
- [x] Extract InitStep + CrawlStep from monolith
- [x] Extract OrgVerificationStep with Brreg lookup
- [x] Extract BrandingStep, SeasonEducationStep, SeasonIdentityStep
- [x] Extract DepartmentsStep, TeamsStep, LocationsStep, ProceduresStep
- [x] Extract 4 drawers: Department, Team, Location, Procedure
- [x] Extract BattlefieldReviewStep (enhanced with all sections + edit links)
- [x] Extract FinalizeStep + DoneStep (with dashboard redirect)
- [x] Create AuthStep (inline signup/signin after crawl)
- [x] Create InviteStep (email + SMS + shareable link)
- [x] Replace monolithic page.tsx with shell (step router + WizardProvider)
- [x] Delete page.tsx.bak backup
- [x] Full typecheck passes (0 errors)

## Remaining

- [ ] Manual E2E verification (requires local Supabase + migration apply)

## Decisions

| Date       | Decision                                                | Reason                                          |
| ---------- | ------------------------------------------------------- | ----------------------------------------------- |
| 2026-03-01 | Use existing invitation table, not new workspace_invite | Avoid table duplication; extend existing system |
| 2026-03-01 | Auth step between crawl and org verification            | Show value first (crawl), then ask for signup   |
| 2026-03-01 | Progressive save to onboarding_session JSONB columns    | Resume if browser closes mid-wizard             |
| 2026-03-01 | SSO buttons deferred                                    | All OAuth providers disabled in config.toml     |

## Log

| Date       | Time          | Event                                                                                    |
| ---------- | ------------- | ---------------------------------------------------------------------------------------- |
| 2026-03-01 | session start | Started onboarding wizard refactor on feat/onboarding-wizard branch (wt-3)               |
| 2026-03-01 | -             | Created types.ts, useOnboardingWizard.ts, WizardContext.tsx                              |
| 2026-03-01 | -             | Extracted all 15 step components + 4 drawers from 1,882-line monolith                    |
| 2026-03-01 | -             | Created new AuthStep and InviteStep components                                           |
| 2026-03-01 | -             | Replaced page.tsx with shell, typecheck passes                                           |
| 2026-03-01 | -             | Created DB migration: invitation_sms_support (phone, invite_type, relaxed constraints)   |
| 2026-03-01 | -             | Updated create-invitation Edge Function: single + batch mode, SendGrid email, Twilio SMS |
| 2026-03-01 | -             | Full typecheck (0 errors), lint (0 errors, 11 pre-existing warnings)                     |
