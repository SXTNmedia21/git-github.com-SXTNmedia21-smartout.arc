---
title: "User Journeys — E2E Wizard Validation"
status: in_progress
updated: 2026-03-31
created: 2026-03-31
module: e2e
tags: [e2e, testing, login, join, onboarding, setup-wizard, edge-functions, journeys]
---

# User Journeys — E2E Wizard Validation

> Alle buggar och edge cases som upptäcktes 2026-03-31 vid E2E-testning av login, join, onboarding och setup wizard. Varje avsnitt beskriver vad som var fel, varför, hur det fixades, och vilket E2E-test som verifierar det.

---

## Journey 1: Login — Password + OTP + Signup

**Precondition:** Supabase Local kjører. Web app på port 3060.

### Happy Path — Password Login

1. User navigerar till `/login` → System visar e-post + passord-fält + "Logg inn"-knapp
2. User fyller i credentials → Klickar submit → System autentiserar via `signInWithPassword`
3. System redirectar till `/dashboard` (eller `/dashboard/setup` om `setup_guide_completed = false`)
4. Session överlever navigation och page reload

**E2E:** `auth.spec.ts` — 7 tester (labels, fields, error, redirect, login, session nav, session reload)

### Happy Path — OTP Login

1. User väljer OTP-metod → Fyller i e-post → Klickar "Send kode"
2. System kallar `signInWithOtp({ shouldCreateUser: false })` → OTP skickas till e-post
3. User hämtar 6-siffrig kod från Mailpit (`127.0.0.1:54324`) → Klistrar in i OTP-fält
4. System verifierar via `verifyOtp({ type: "email" })` → Redirectar till dashboard

**E2E:** Inget test ännu. TODO: Skriv test som hämtar OTP från Mailpit API.

### Error Path — Signup-sida timeout

**Bug:** `/signup`-sidan timade ut med `page.goto("/signup")` på grund av tung hydrating.
**Fix:** Använd `waitUntil: "domcontentloaded"` istället för default `load`.
**E2E:** `auth.spec.ts` test 8 — "should load the signup page"

---

## Journey 2: Join Wizard — 6-stegs registrering

**Precondition:** Ingen inloggad user. Navigerar till `/join`.

### Happy Path

1. Steg 1 (Konto): E-post, bedriftsnamn, bransje, by, nettside → Klickar "Neste"
2. Steg 2 (Bedrift): Fornavn, etternavn, adresse, org.nr → Klickar "Neste"
3. Steg 3 (Identitet): Om oss, historie, konsept (valgfritt) → Klickar "Neste"
4. Steg 4 (Drift): Telefon, åpningstider → Klickar "Neste"
5. Steg 5 (Meny): Restauranttype, meny (valgfritt) → Klickar "Neste"
6. Steg 6 (Oppsummering): Gjennomgang → Klickar "Fullfør"
7. System kallar `completeSignup()` server action → Redirectar till `/onboarding`

### Error Path — Sidebar-labels utdaterte

**Bug:** E2E-test forventet gamle labels (Om bedriften, Opprett konto, Team). Nåværende labels: Konto, Bedrift, Identitet, Drift, Meny, Oppsummering.
**Fix:** Oppdaterte test til nåværende labels med `exact: true` for å unngå "Bedrift"/"Drift"-kollisjon.
**E2E:** `join-wizard.spec.ts` test 9 — "sidebar progress labels match the actual join steps"

### Error Path — Steg-validering blokkerer navigasjon

**Bug:** `WizardShell.useWizardState.next()` validerer full nested state mot flat step-schemas. Step 1 schema forventer `{ email, companyName }` men får hele `JoinState`-objektet. Dette blokkerer alle "Neste"-klikk.
**Status:** Ikke fikset — 7 tester markert `test.fixme`.
**TODO:** Fiks validation i `useWizardState` — valider sub-state, ikke full state.

---

## Journey 3: Onboarding Wizard — Workspace-oppsett

**Precondition:** Bruker er innlogget. Workspace provisjonert via `/join`. Navigerer til `/onboarding`.

### Happy Path

1. System laster workspace-data via `resume()` → Leser `workspace.intelligence_data`
2. Bruker gjennomgår 6 seksjoner (Hero → Business → Season → Departments → Contract → Done)
3. Bruker klikker "Gå til dashboardet" → System kallar `finalize-workspace` Edge Function
4. Edge Function kjører `finalize_onboarding_workspace` RPC → Oppretter avdelinger, lokasjoner, prosedyrer, sesong
5. System redirectar til `/dashboard/setup`

### Error Path — Edge Functions nede (503)

**Bug:** `supabase_edge_runtime_smartout.ai` kan stoppe uten varning. Alle Edge Function-anrop returnerer 503 med kryptisk "non-2xx status code" eller "Service Temporarily Unavailable". Gjelder:

- `gather-workspace-intelligence` (business-scraping)
- `search-brreg` (org.nr-søk)
- `identify-company` (identifisering)
- `scrape-website` (nettside-scraping)
- `finalize-workspace` (aktivering)
- `analyze-setup-documents` (dokument-analyse)

**Fix:** Opprettet `invokeEdgeFunction()` wrapper (`apps/web/src/lib/supabase-edge-invoke.ts`) som:

- Detekterer 503/nätverksfel og visar tydlig toast: "Edge Functions nede — kjør: docker start supabase_edge_runtime_smartout.ai"
- Viser toast bara en gång per session
- Returnerer developer-vänligt Error-objekt

**Migrerte 8 anrop** i:

- `useOnboardingState.ts` (5 anrop)
- `wizard-definition.ts` onboarding (1)
- `wizard-definition.ts` setup (1)
- `DocumentDropStep.tsx` (1)

**E2E:** Inget automatiskt test (krever at Edge Runtime stoppes). TODO: Vurder manuelt test eller health-check-test.

### Error Path — Invite-side feilmelding på feil språk

**Bug:** `/invite/[token]` med ugyldig token viste "Invitation not found" (engelsk). Nå vises "Invitasjonen ble ikke funnet" (norsk).
**Fix:** Oppdaterte test til å matche norsk tekst.
**E2E:** `onboarding.spec.ts` test 7 — "should show error for invalid token"

---

## Journey 4: Setup Wizard — Dashboard-konfigurering (9 steg)

**Precondition:** Bruker innlogget. `workspace.setup_guide_completed = false`. System redirectar til `/dashboard/setup`.

### Happy Path

1. System beregner `_initialStepIndex` basert på modul-komplettering (policies >= 3, profiles > 1, shifts > 0, active seasons > 0)
2. Bruker navigerer gjennom 9 steg via AnimatedWizardShell:
   - Velkommen til Smartout
   - Last opp dokumenter
   - Retningslinjer og policies
   - Lønn og tariff
   - Ansettelsesvilkår
   - Team og medarbeidere
   - Vaktmaler
   - Sesong
   - Personalhandbok
3. Bruker klikker "Fullfør" på siste steg → System sätter `setup_guide_completed = true` + trigger K1b ingestion
4. System redirectar till `/dashboard`

**E2E:** `workspace-setup-flow.spec.ts` — 11 tester

### Error Path — "Oppsett av arbeidsrom" finnes inte

**Bug:** Testene letade etter teksten "Oppsett av arbeidsrom" som wizard-indikator. Denna text existerar inte i koden — den var en gammal referens som aldrig implementerades i AnimatedWizardShell.
**Fix:** Ersatte med URL-check (`/dashboard/setup`) och step-titlar från `dashboard.json` i18n.
**Berörda:** auth helper `skipOnboardingIfPresent()`, alla 11 setup-tester.

### Error Path — Wizard startar på fel steg

**Bug:** Tester förväntade step 0 ("Velkommen til Smartout") men `loadState()` beräknar `_initialStepIndex` från modul-komplettering. "Welcome" är inte i `STEP_TO_MODULE` — den hoppas alltid over när det finns ofullständiga moduler. Med data gömd → first incomplete = governance → wizard startar på step 1 (document-drop).
**Fix:** Alla tester uppdaterade till att förvänta "Last opp dokumenter" som första steg. Lade även till `onboarding_guide_progress = NULL` i `hideWorkspaceData()`.

### Error Path — Felaktiga steg-titlar

**Bug:** 6 av 9 steg-titlar var ändrade sedan testerna skrevs:
| Gammal (i test) | Ny (i i18n) |
|---|---|
| Dine retningslinjer | Retningslinjer og policies |
| Lønn og tillegg | Lønn og tariff |
| Ditt team | Team og medarbeidere |
| Dine vaktmaler | Vaktmaler |
| Din sesong | Sesong |
| Din personalhåndbok | Personalhandbok |
**Fix:** Alla titlar uppdaterade till att matcha `packages/i18n/locales/nb/dashboard.json`.

### Error Path — Governance-UI ändrad

**Bug:** Test letade efter template-namn ("Arbeidsmilj/HMS", "Brannsikkerhet") som nu är dolda bakom en collapse-knapp. Ny UI visar toggle-switchar (Matservering, Alkoholservering, etc.) och en "10 retningslinjer — Trykk for å se"-knapp.
**Fix:** Ersatte template-name assertions med toggle-UI assertions.

### Error Path — Team-steg UI ändrad

**Bug:** Ingen "Legg til manuelt" eller "Send invitasjoner"-knappar längre. Invitationer skickas vid "Fullfør" i sista steget. Team-medlemmer läggs till direkt i formulärrader.
**Fix:** Ersatte invite-flow assertions med form-fill + count assertions.

### Error Path — Skip-knapp ambiguitet

**Bug:** `button:has-text("Hopp over")` matchade både "Hopp over og gå til dashboard" (top-right) och en steg-intern "Hopp over"-knapp → Playwright strict mode violation.
**Fix:** `getByRole("button", { name: "Hopp over og gå til dashboard" })`.

### Error Path — Season restore kraschar

**Bug:** `restoreWorkspaceData()` satte seasons tillbaka till `active`, men DB-triggern `emit_season_activated_event()` genererade en duplikat idempotency-nyckel i `engine_event`.
**Fix:** Raderar befintliga `engine_event`-rader med `idempotency_key LIKE 'season_activated_%'` före restore.

### Error Path — SessionStorage vs localStorage

**Bug:** Setup wizard dismiss använder `sessionStorage` (key: `setup_dismissed`), inte `localStorage`. Tester som testade localStorage-persistens var felaktiga.
**Fix:** Alla localStorage-referenser ersatta med sessionStorage.

---

## Testmatris — Vad som testas var

| Fil                            | Pass | Skip | Täcker                                        |
| ------------------------------ | ---- | ---- | --------------------------------------------- |
| `auth.spec.ts`                 | 9    | 0    | Login (password), signup, redirect, session   |
| `join-wizard.spec.ts`          | 2    | 7    | Steg 1 rendering, sidebar labels              |
| `onboarding.spec.ts`           | 2    | 5    | Invite-feilmelding, invite-sidestruktur       |
| `workspace-setup-flow.spec.ts` | 11   | 0    | Alla 9 steg, governance, team, skip, complete |

## Hva som IKKE er E2E-testet ännu

| Gap                   | Prioritet | Beskrivning                                                           |
| --------------------- | --------- | --------------------------------------------------------------------- |
| OTP-login             | Hög       | Send OTP → hämta från Mailpit → verifiera → dashboard                 |
| Join wizard full flow | Hög       | 7 tester blockerade av validation schema mismatch                     |
| Edge Function health  | Medium    | Detektera 503 och visa toast (manuellt verifierat, inget automattest) |
| Onboarding full flow  | Medium    | 5 tester skippade — gammal wizard, behöver omskrivas                  |
| Dokument-drop         | Medium    | Upload + analyze-setup-documents Edge Function                        |
| Scraping pipeline     | Låg       | gather-workspace-intelligence med riktiga bedriftsnamn                |
