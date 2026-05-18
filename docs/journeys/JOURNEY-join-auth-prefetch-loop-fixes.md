---
title: "Journeys — join-auth-prefetch-loop-fixes"
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: onboarding
tags: [journeys, join, wizard]
---

# Journeys — join-auth-prefetch-loop-fixes

Three repaired flows on the public `/join` wizard. Each journey lists the live (pre-fix) failure mode and the expected post-fix behaviour.

---

## Journey 1: New restaurant signs up (happy path)

**Role:** Public visitor (no Supabase account yet).
**Precondition:** User lands on `https://app.smartout.ai/join`. No prior session cookie.

1. User types `Strøm Mat & Bar` in **Company name** and `Skien` in **City** on Step 1.
   - System (post-fix): after 800 ms idle, calls `/api/scrape/brreg` once with `(name, city, industry)`. Calls `/api/workspace-intelligence` once. Caches the tuple — re-types in same field do not re-fire.
   - User sees: BRREG match suggestion ("Strøm Mat & Bar AS, 911 722 267") plus "AI henter beskrivelse..." status hint.
2. User types email + password + confirm-password + first name + last name on Step 1, then blurs confirm-password.
   - System: silently calls `supabase.auth.signUp({email,password})`. Browser cookies receive the new session. No `_accessToken` is written to wizard state.
   - User sees: small "Oppretter konto..." spinner that resolves silently.
3. User clicks **Neste**. Step 2 prefills `street`/`postalCode`/`orgNumber` from BRREG. User accepts.
4. Step 3: "Om oss / Vår historie / Vårt konsept" textareas typewriter-fill from prefetched intelligence. User accepts or rewrites.
5. Step 4: opening hours grid + phone + Instagram/Facebook.
6. Step 5: chips for cuisine + select for restaurant-type + select for price + textarea for menu description ALL prepopulated from the prefetched LLM classification.
   - System (post-fix): `intel.llm_cuisine_types`, `intel.llm_price_category`, `intel.llm_restaurant_type`, `intel.menu_description` are present on `state.intelligence`. The "✨ AI-foreslått"-badge shows.
7. Step 6 Summary review → user clicks **Fullfør**.
   - System: `onComplete` calls `supabase.auth.getSession()` client-side (forces fresh cookies), then POSTs to the `completeSignup` Server Action.
   - Server: reads session from cookies via `getSession()` (no refresh trigger, no race). Provisions onboarding workspace via `provision_onboarding_workspace` RPC.
   - User sees: redirect to `/onboarding/{workspaceId}`.

**Postcondition:** workspace exists with `contract_status='onboarding'`, `status='sandbox'`, `verification_deadline=+48h`. User logged in via fresh Supabase cookies. No `refresh_token_already_used` in Vercel runtime logs.

**Error paths:**
- Email already registered → silent `signInWithPassword` fallback. On wrong password: inline error "E-post allerede registrert" — retry stays on Step 1.
- BRREG match miss → user enters org-number manually on Step 2; intel proceeds without it.
- Scrapling timeout → Step 3 falls back to plain placeholders, Step 5 shows blank fields, "AI-foreslått"-badge omitted. User can fill manually. No 500.

---

## Journey 2: Returning user who closed tab mid-wizard

**Role:** Public visitor with localStorage state from a prior `/join` session.
**Precondition:** localStorage `JOIN_STORAGE_KEY` contains steps 1-5 data from a session 30 min ago. Supabase session cookies expired.

1. User reopens `https://app.smartout.ai/join`. Wizard restores from localStorage; user lands on Step 6 Summary.
2. User clicks **Fullfør**.
   - System: `getSession()` returns null (cookies expired). `completeSignup` cookie path fails. Falls back to `getUser()`, which also returns null.
   - System: throws `Not authenticated`. Client surfaces a recoverable error toast: "Sesjonen er utløpt. Vennligst logg inn på nytt."
   - User sees: routed back to Step 1 or a `/login` modal (out of scope for this sortie — recovery UX is a follow-up).

**Postcondition:** Pre-fix: same 500. Post-fix: 500 still thrown but stack trace + error code is intelligible (we know it is _expired session_, not _refresh-token race_). Follow-up sortie can add UX rescue.

**Error paths:** as above.

---

## Journey 3: User idles on Step 3 for >5 min, then submits

**Role:** Public visitor; opened wizard, walked away for coffee.
**Precondition:** Step 1 silent signUp completed successfully at T=0. Supabase access-token TTL is 60 min; refresh-token rotation kicks in around 55 min if active.

1. User types Step 1 fields. signUp succeeds. Cookies set: A1+R1. _Wizard state no longer stores `_accessToken` (post-fix)._
2. User idles on Step 3 for 6 min. Supabase JS client schedules silent refresh ≥ 55 min before A1 expiry — for short idles this is a no-op, but for very long idles or app focus events the client refreshes early. After refresh: cookies become A2+R2.
3. User completes Step 4-5-6 → clicks **Fullfør**.
   - System (post-fix): `supabase.auth.getSession()` runs client-side first → ensures any pending rotation is flushed to cookies. Then POSTs to `completeSignup`.
   - Server: reads cookie via `getSession()` (no refresh attempt). Sees A2+R2 → user resolves → workspace provisioned.
   - User sees: redirect to `/onboarding/{workspaceId}`.

**Postcondition:** No `refresh_token_already_used` because the server never tries to refresh; client already did. Workspace exists.

**Pre-fix failure:**
- Server saw cookie A1+R1; called `getUser()` → triggered server refresh of R1 → but R1 was already consumed by the client → `400 refresh_token_already_used` → fallback to stale `_accessToken=A1` → `admin.auth.getUser(A1)` returned null (expired) → throw `Not authenticated` → **500 to user**.
