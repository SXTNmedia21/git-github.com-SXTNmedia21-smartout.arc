---
title: "Journey — Erik magic-link login og ser komplett historikk"
feature: billing-erik-seed
journey: erik-login
status: verified
verified_at: 2026-05-05
e2e_test: null
created: 2026-05-04
updated: 2026-05-04
module: MODULE_BILLING
tags: [journey, billing, accountant, login, magic-link]
---

# Journey: Erik magic-link login og ser komplett historikk

**Role:** Erik — regnskapsfører for SmartOut AS

**Precondition:**
- CSV-import journey fullført (11 selskap + 33+ fakturaer + Erik super-admin grants)
- admin.smartout.ai er live (Vercel-prosjekt + DNS + env-vars)
- Supabase Auth `https://admin.smartout.ai/auth/callback` whitelisted i prod
- Erik har e-postadresse `erik@smartout.no` aktiv
- Erik har ikke fysisk tilgang til Pontus' dashbord eller godmode-token

## Happy Path

1. **Erik** åpner `https://admin.smartout.ai` i nettleser
2. **Apps/admin middleware** ser ingen sesjon → redirect til `/auth/login`
3. **Erik** skriver `erik@smartout.no` i magic-link-skjema
4. **Apps/admin** kaller `supabase.auth.signInWithOtp({ email })` → Supabase sender magic-link
5. **Erik** klikker linken i e-posten → `/auth/callback?code=...`
6. **`/auth/callback`-route** kaller `supabase.auth.exchangeCodeForSession(code)` → sesjon opprettes
7. **Middleware** ser sesjon → tillater navigasjon
8. **`(admin)/layout.tsx`** kaller `requireAccountant()` → henter `companyIds` via `billing.accountant_company_grant` → 11 IDs
9. **Layout** rendrer shell med navigasjon: `/orders`, `/workspaces`, `/avstemming`, `/account`
10. **Erik** klikker `/workspaces` → ser liste med 11 selskap
11. **Erik** klikker `Strøm Mat & Bar AS` → `/workspaces/[id]` viser kontrakt-info, billing-config, members, order-historikk (3 fakturaer feb-apr utestående 5.600 kr)
12. **Erik** navigerer til `/orders` → ser 33+ fakturaer på tvers av alle 11 selskap, filterbart per måned/status/kunde
13. **Erik** klikker en faktura → `/orders/[id]` viser detaljer + "Last ned PDF" + "Last ned CSV" knapper
14. **Erik** klikker "Last ned PDF" → PDF genereres + lastes ned

**Postcondition:**
- Erik er innlogget og kan navigere selvstendig i admin.smartout.ai
- Erik kan laste ned grunnfaktura-PDF for hvilken som helst av 33+ fakturaer
- Erik kan se betalingsstatus per faktura (paid/open/void)
- Pontus var ikke i loop

## Error Paths

- **Erik har ingen grant i DB** → `(admin)/layout.tsx` returnerer `notFound()` → 404 ("you have no tenancy here")
- **Magic-link expired** → `/auth/callback` viser feilmelding + ny login-knapp
- **Erik prøver workspace utenfor sine grants** → `requireAccountant()` filtrerer companyIds, faktura/workspace skjult fra UI; direkte URL → 404
- **PDF-generering feiler** → toast-feilmelding, ingen download
- **Auth-callback whitelist mangler** → Supabase returnerer error, Erik ser feilmelding

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes — `apps/e2e/admin/onboarding/erik/walkthrough.ts` allerede finnes; må bekreftes mot ny seed-data
- [ ] Manuelt verifisert end-to-end på admin.smartout.ai (preview eller Local) av Pontus eller Erik

**Mark `status: verified` in frontmatter when all three boxes are checked.**
