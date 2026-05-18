---
title: "Journey — e2e-join-suite-refresh"
status: done
updated: 2026-05-18
created: 2026-05-18
module: e2e
tags: [journey, e2e, join, playwright, testing, adr-0357, adr-0358]
---

# Journey: E2E Coverage of the /join Wizard

> Describes the test-development journey itself: spec authors maintain green coverage of /join.
> Source ADRs: ADR-0357 (wizard polish rules), ADR-0358 (ExpiredSessionGate + localStorage restore).

---

## Journey: Spec Author Repairs Stale Selectors

**Precondition:** WizardShell has been updated; step containers no longer emit `data-botsson-id` or `data-botsson-type` attributes. 4 existing specs reference phantom selectors and fail in CI.

1. Author reads D-Agent report → identifies 4 failure classes (phantom IDs, step-local Neste, timeouts, phantom shell ID)
2. Author repairs each spec — replaces phantom selectors with heading text (`getByRole("heading")`) and input IDs
3. Author verifies with `playwright test --list` — all 7 specs parse (exit 0)
4. Author runs suite locally — tests execute against dev environment
5. CI re-runs on PR — all join-*.spec.ts green

**Postcondition:** No phantom selectors remain. Suite resilient to future WizardShell internal refactors as long as headings and input IDs are stable.

**Error paths:** If heading text changes (i18n key rename), tests will fail with "element not found" — update heading regex in spec. If input IDs change, update locators.

---

## Journey 1: Fresh Visitor Completes Signup

**Precondition:** No localStorage `smartout_signup_wizard` key. No auth cookies. User visits `/join`.

1. User lands on Step 1 — sees "Opprett din konto" heading
2. User fills: company name, industry (select), city, email, password, confirm password, first name, last name
3. User clicks Neste (WizardNavBar) → Step 2 "Bedriftsinformasjon" appears
4. User fills: street, postal code, city, org number (MOD-11 valid)
5. User clicks Neste → Step 3 "Fortell om bedriften" appears (TypewriterTextarea fills; user may skip)
6. User clicks Neste → Step 4 "Drift" appears
7. User fills phone number → clicks Neste → Step 5 "Meny" appears (skippable)
8. User clicks Neste → Step 6 "Alt ser bra ut" (summary) appears
9. User clicks "Fullfør" → system creates workspace → redirect to `/onboarding`

**Postcondition:** User lands on `/onboarding`. Auth created. Workspace row exists.

**Error paths:** MOD-11 validation fails → toast shown, stay on Step 2. Email already registered → error on Step 1. Network error on submit → error toast, stay on Step 6.

---

## Journey 2: Expired Session Restore

**Precondition:** `smartout_signup_wizard` envelope in localStorage (partially filled wizard). Supabase `sb-*` auth cookies expired or deleted.

1. User returns to `/join` (e.g. after session timeout)
2. ExpiredSessionGate renders (200-500ms check) → detects envelope + no valid session
3. Gate redirects to `/login?return_to=%2Fjoin&reason=expired`
4. Login page shows "Sesjonen er utløpt" banner
5. User logs in → redirected back to `/join` → wizard restores from localStorage

**Postcondition:** User resumes wizard from saved state. No data lost.

**Error paths (fresh visitor):** No localStorage envelope present → gate does NOT redirect → wizard mounts fresh on Step 1.

---

## Journey 3: Long Idle on Step 3 Then Submit

**Precondition:** User has filled Steps 1+2, arrived at Step 3. User becomes idle for 6+ minutes (e.g. writing menu copy in another tab).

1. User is on Step 3 — TypewriterTextarea visible
2. 6 minutes pass — client-side Supabase token may rotate
3. User clicks Neste (WizardNavBar) → advances to Step 4
4. User fills phone, advances through Steps 4-5-6
5. User clicks "Fullfør" → submit must NOT return 500

**Postcondition:** Redirect to `/onboarding` (success) OR redirect to `/login?return_to=%2Fjoin` (session expired — acceptable per ADR-0358). Never a 500/crash.

**Error paths:** Token rotation fails → ADR-0358 gate triggers on submit → redirect to login with return_to.
