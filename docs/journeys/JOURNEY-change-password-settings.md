---
title: "Journey — Change password from settings"
status: draft
updated: 2026-05-20
created: 2026-05-20
module: auth
tags: [journey, auth, settings, password]
---

# Journey — Change password from settings

> Branch: `feat/change-password-settings`

## Journey 1: Web user changes password from settings

**Precondition:** User logged in, on `/dashboard/settings/?tab=security`.

1. User scrolls to "Bytt passord" card
2. Enters current password, new password, confirms new password
3. Strength meter shows feedback as user types
4. Clicks "Lagre nytt passord"
5. System validates: new === confirm, length >= 8
6. System calls `supabase.auth.signInWithPassword({ email, password: currentPassword })`:
   - Failure → toast "Feil nåværende passord", form stays
   - Success → continues
7. System calls `supabase.auth.updateUser({ password: newPassword })`:
   - Failure → toast with error
   - Success → toast "Passord oppdatert", clear form

**Postcondition:** `auth.users.encrypted_password` updated. Next login requires new password.

**Error paths:**
- New < 8 chars → inline validation, submit disabled
- New != confirm → inline validation, submit disabled
- Network error → toast generic error
- Session expired mid-submit → redirect to login

## Journey 2: Mobile user changes password

**Precondition:** Logged in. On Me-tab → settings page (via burger menu).

1. User scrolls to Personlig section, taps "Bytt passord"
2. Router pushes `/(app)/(me)/change-password`
3. Screen shows three secureTextEntry inputs
4. User fills, taps "Lagre"
5. Same re-auth + updateUser flow as web
6. Success → `Alert.alert("Passord oppdatert")` → navigation.goBack()

**Postcondition:** Same as web. User can immediately use new password.

**Error paths:**
- Same as web. Keyboard dismisses on submit. Loading spinner during submit.
