---
title: "Plan — change-password-settings"
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: auth
tags: [plan, auth, settings, password, web, mobile]
---

# Plan — change-password-settings

> Branch: `feat/change-password-settings` | Worktree: /home/sxtnl/dev/smartout.ai-wt-5 | Base: `development` | Module: auth

## Goal

Authenticated users can change their password from settings on both web and mobile. Re-auth with current password is required before applying the new one.

## Background

- `/update-password` (web) + `/m/update-password` (mobile) exist but handle FORGOT-password flow only — entered via recovery email link, consume Supabase `PASSWORD_RECOVERY` event from URL hash.
- Web settings (`apps/web/src/app/dashboard/settings/`) has a "security" tab that renders `ShiftLockPolicySettings` only — no account-security UI.
- Mobile settings (`apps/mobile/app/(app)/(home)/settings.tsx`) has Personlig / Workspace / Display / System / Help / Logout sections — no password change row.
- Supabase Auth API: `supabase.auth.updateUser({ password })` updates session user. Re-auth via `supabase.auth.signInWithPassword({ email, password })` confirms current password before apply.

## Tasks

### A. Web — ChangePasswordCard in Settings → Security tab
- [ ] New `apps/web/src/app/dashboard/settings/_components/change-password-card.tsx`:
  - Card "Bytt passord" with three password inputs (current, new, confirm)
  - `PasswordStrengthMeter` on new
  - Submit: validate match + min length → re-auth signInWithPassword → updateUser({ password }) → toast + clear
  - Telemetry emit via `@smartout/telemetry` (`password changed` event if registered, otherwise skip)
- [ ] `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx`: mount `<ChangePasswordCard />` above `<ShiftLockPolicySettings />` in the "security" case.

### B. Mobile — Change-password screen
- [ ] New `apps/mobile/app/(app)/(me)/change-password.tsx`:
  - Three password inputs, SafeAreaView + KeyboardAvoidingView
  - Submit: re-auth + updateUser, Alert.alert on success/failure
- [ ] `apps/mobile/app/(app)/(me)/_layout.tsx`: register new screen
- [ ] `apps/mobile/app/(app)/(home)/settings.tsx`: add "Bytt passord" row in Personlig-section, navigates to new screen

## Acceptance Criteria

- [ ] `apps/web` tsc exit 0
- [ ] Mobile typecheck exit 0
- [ ] Submit happy path: wrong current → reject; matching new+confirm + correct current → updates auth.users.encrypted_password
- [ ] Form rejects: mismatched new+confirm, new < 8 chars

## Out of Scope

- 2FA, password history, force-change-after-policy, forgot-password flow (already exists)
