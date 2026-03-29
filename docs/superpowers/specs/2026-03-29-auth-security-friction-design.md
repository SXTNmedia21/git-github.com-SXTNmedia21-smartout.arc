---
title: Auth, Security & Friction — Silent Auth + Deferred OTP + Data Perimeter
status: council-approved
updated: 2026-03-29
created: 2026-03-29
module: auth
tags: [auth, security, otp, rate-limiting, sandbox, telemetry, data-collection]
---

# Auth, Security & Friction Design

> SIKKERHET × FRIKSJON = KONSTANT. Når sikkerheten øker, må friksjonen holdes lav.

## Problem

Smartout har tre onboarding-wizards (Join, Onboarding, Setup) som skal føles som én friksjonsfri reise. I dag skjer auth i siste steg av Join-wizarden — brukeren vet at de oppretter en konto. OTP-koder kan ikke brukes til login. Rate limiting er svakt. Datasømmer mellom systemer er uovervåket.

## Løsning: Silent Auth + Deferred Verification

Bruker skriver e-post + passord i steg 1 av Join-wizarden. Supabase-konto opprettes stille i bakgrunnen — ingen e-post, ingen bekreftelse, ingen friksjon. Hele Join → Onboarding → Setup kjøres gjennom med aktiv sesjon. Først ved workspace-entry vises en OTP-overlay for e-postverifisering. OTP-koden fungerer også som login-metode.

### Kjerneprinsipp

| Prinsipp                      | Implementering                                                  |
| ----------------------------- | --------------------------------------------------------------- |
| Slett persondata som standard | Alt personavhengig slettes med mindre aktivt stoppet            |
| Usynlig sikkerhet             | Bruker merker aldri auth, rate limits, eller sandbox-regler     |
| Vakt i hjørnene               | Datasømmene mellom systemer overvåkes, ikke bare systemene selv |
| Aldri avslør                  | E-posteksistens, feildetaljer, interne IDer — aldri til klient  |

---

## 1. Auth-flyt

### Ny bruker (signup via wizard)

```
JOIN WIZARD
  Steg 1: E-post + passord
    → signUp({ email, password }) i bakgrunnen
    → Supabase returnerer session umiddelbart
    → Ingen e-post sendes (email confirmation AV)
    → E-post fjernes fra localStorage etter signUp()
    → Bruker merker ingenting, går videre

  Steg 2-5: Business, About, Hours, Menu
    → Autentisert sesjon (cookies satt)
    → Server actions bruker auth.uid()
    → Data lagres i DB med RLS
    → localStorage som fallback

  Steg 6: Oppsummering (ikke auth-steg lenger)
    → onComplete() provisjonerer workspace
    → workspace.status = 'provisioning' → 'pending'

ONBOARDING WIZARD
  Bruker er allerede autentisert fra steg 1
  Bekrefter departments, roles, positions, etc.

SETUP WIZARD
  Samme sesjon
  Governance, payroll, team, seasons, handbook

WORKSPACE ENTRY
  Dashboard vises med OTP-overlay:
  "Vi sendte en kode til d***@e***.no"
  [ _ _ _ _ _ _ ]

  → verifyOtp({ email, token, type: 'email' })
  → email_verified = true
  → workspace.status = 'active'
  → Overlay forsvinner
```

### Endring fra i dag

| Aspekt                  | Nå                          | Nytt                                  |
| ----------------------- | --------------------------- | ------------------------------------- |
| Auth-tidspunkt          | Steg 6 (siste)              | Steg 1 (usynlig)                      |
| E-post-bekreftelse      | Aldri                       | OTP ved workspace-entry               |
| Steg 6 innhold          | Opprett konto-form          | Oppsummering/review                   |
| Server actions steg 2-5 | Uautentisert (localStorage) | Autentisert (auth.uid())              |
| Wizard-data lagring     | localStorage alene          | DB-backed med localStorage fallback   |
| Passord i minne         | Steg 1 → 6 (hele wizard)    | Kun i signUp()-kallet (millisekunder) |

### Sikkerhetsgevinst

Auth i steg 1 eliminerer to problemer:

1. Passord lever ikke lenger i wizard-state (kun i signUp()-kallet)
2. Server actions kan bruke `auth.uid()` — ingen eksplisitt token-passing

### Google OAuth-unntak

Google-autentiserte brukere har allerede verifisert e-post via Google. Skipper OTP-overlay — `email_confirmed_at` settes automatisk av Supabase Auth for OAuth-brukere.

### Eksisterende bruker i Step 1

Når en bruker som allerede har Supabase-konto skriver inn sin e-post i steg 1, vil `signUp()` feile stille (Supabase returnerer en "fake user" uten session ved `double_confirm_changes = true`). Flyten:

1. `signUp()` returnerer uten error, men uten session
2. Detektér: sjekk om `data.session` er null OG `data.user?.identities?.length === 0`
3. Switch til `signInWithPassword()` — bruker har allerede konto, trenger bare å logge inn
4. Hvis passordet er feil → vis "Denne e-posten er allerede registrert. Logg inn med ditt eksisterende passord."
5. Alternativt → tilby OTP-login ("Send kode til denne e-posten")

---

## 2. OTP som login-metode

### Login-siden — tre veier inn

```
┌─────────────────────────────────────┐
│  din@epost.no                       │
│                                     │
│  [Logg inn med passord]             │
│  [Send meg en kode]                 │
│                                     │
│  ─── eller ───                      │
│                                     │
│  [Fortsett med Google]              │
└─────────────────────────────────────┘
```

### OTP login-flyt

```
1. Bruker skriver e-post
2. Klikker "Send meg en kode"
3. → signInWithOtp({ email, options: { shouldCreateUser: false } })
4. Supabase sender 6-sifret kode
5. UI bytter til kode-input:

   "Vi sendte en kode til d***@e***.no"
   [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ]
   Ikke fått koden?  Send på nytt (synlig etter 60 sek)

6. → verifyOtp({ email, token: code, type: 'email' })
7. Session → redirect til intended destination
```

### OTP-regler

| Aspekt               | Verdi                   | Begrunnelse                       |
| -------------------- | ----------------------- | --------------------------------- |
| `shouldCreateUser`   | `false`                 | OTP oppretter IKKE nye kontoer    |
| Kodelengde           | 6 sifre                 | config.toml standard              |
| Kodeutløp            | 30 min                  | Ned fra 60 — mindre misbruksvindu |
| Maks forsøk per kode | 5                       | Etter 5 → "Send ny kode"          |
| Rate limit sending   | 3 per 15 min per e-post | Forhindrer spam                   |
| E-post-masking       | `d***@e***.no`          | Avslør aldri full e-post          |
| "Send på nytt"       | Vises etter 60 sek      | Forhindrer dobbelt-klikk          |

### E-posteksistens — aldri avslør

```
Ukjent e-post → "Send meg en kode"
→ signInWithOtp({ shouldCreateUser: false })
→ Supabase returnerer feil (bruker finnes ikke)
→ VI SKJULER FEILEN
→ Viser: "Hvis denne e-posten finnes, har vi sendt en kode"
→ Identisk UI som suksess
→ Angriper får null informasjon
```

### Delt OTP-komponent

Én `OtpVerificationForm`-komponent brukes i to kontekster:

| Kontekst        | Trigger                             | Etter verifisering                           |
| --------------- | ----------------------------------- | -------------------------------------------- |
| Login           | Bruker velger "Send kode" på /login | Session → redirect                           |
| Workspace-entry | Automatisk etter wizard             | `email_verified = true`, workspace aktiveres |

Props: `context: 'login' | 'workspace_entry'`, `email: string`, `onVerified: () => void`

---

## 3. Sandbox-modell

### Workspace-livssyklus

```
signUp() stille i steg 1
  ↓
workspace.status = 'provisioning'    ← Wizard pågår
email_verified = false
verification_deadline = now() + 48h
  ↓
Wizard ferdig
  ↓
workspace.status = 'pending'         ← Venter på OTP
  ↓                    ↓
OTP bekreftet       48h utløpt
  ↓                    ↓
status = 'active'   Auto-cleanup
verified = true     Slett alt
Alt låst opp        emit('workspace.abandoned')
```

### Sandbox-regler (uverifiserte workspaces)

**KAN:**

- Lagre wizard-data
- Kjøre I1 bootstrap
- Opprette departments, roles, positions
- Se dashboard (med OTP-overlay)

**KAN IKKE:**

- Sende invitasjoner
- Koble integrasjoner (Stripe, DocuSeal, etc.)
- Eksportere data
- Bruke API-nøkler
- Sende e-post via SendGrid

### Database-endringer (council-oppdatert)

**Email-verifisering:** Bruk `auth.users.email_confirmed_at` (Supabase-native). IKKE legg `email_verified` på workspace — det er en bruker-egenskap, ikke workspace. `verifyOtp()` setter `email_confirmed_at` automatisk. Sjekk via helper-funksjon i middleware.

**Workspace status:** Legg til ny `workspace_status` enum + kolonne. IKKE overbelast `contract_status`.

```sql
-- Ny enum for workspace-livssyklus
CREATE TYPE workspace_status AS ENUM ('sandbox', 'active', 'suspended', 'archived');

-- Ny kolonne + deadline for sandbox-utløp
ALTER TABLE workspace ADD COLUMN status workspace_status DEFAULT 'sandbox';
ALTER TABLE workspace ADD COLUMN verification_deadline timestamptz;

-- Helper-funksjon for email-verifisering (leser auth.users)
CREATE OR REPLACE FUNCTION is_email_verified(user_uuid uuid)
RETURNS boolean AS $$
  SELECT email_confirmed_at IS NOT NULL
  FROM auth.users
  WHERE id = user_uuid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**FK cascade fixes:** Engine-tabeller mangler `ON DELETE CASCADE` på workspace FK. Cleanup-cron vil feile uten dette.

```sql
-- Fiks FK cascade for engine-tabeller
ALTER TABLE engine_sessions DROP CONSTRAINT IF EXISTS engine_sessions_workspace_id_fkey,
  ADD CONSTRAINT engine_sessions_workspace_id_fkey
  FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- Samme for engine_memory, engine_authority_config, engine_inbox, engine_missions
```

### Enforcement — tre nivåer (council-oppdatert)

| Nivå       | Hvor     | Hva                                                                                                          |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| RLS        | Database | Policies på `invitation`, `platform_api_key` sjekker `is_email_verified(auth.uid())`                         |
| Middleware | App      | Blokkerer ruter til invitasjoner, integrasjoner, eksport, **og AI/agent-endepunkter** for sandbox-workspaces |
| Helper     | DB func  | `is_email_verified(uuid)` leser `auth.users.email_confirmed_at` — single source of truth                     |

**Viktig:** Stage Engine bruker `supabaseAdmin` (service role) som bypasser RLS. Sandbox-enforcement for AI-sessions MÅ skje i middleware, ikke RLS.

### Auto-cleanup (council-oppdatert)

```
Edge Function (cron, hver time, trigget av n8n på DigitalOcean):
→ Finn workspaces: verification_deadline < now() AND status = 'sandbox'
→ Verifiser at brukerens email_confirmed_at IS NULL
→ Kaskade-slett i korrekt rekkefølge:
   1. engine_inbox (FK til sessions)
   2. engine_sessions (FK til workspace, mangler CASCADE)
   3. engine_memory (FK til profile + workspace)
   4. engine_authority_config (FK til workspace + user_identity)
   5. engine_missions (FK til workspace, nullable)
   6. Cascade-tabeller: department_operating_hours, department_hours_override,
      planning_cycle, season_budget, day_factor, hour_factor, workspace_budget,
      daily_reconciliation, workspace_kpi_target, shift_cost_snapshot,
      change_proposal, framework_rule (workspace-scoped), tariff_rate_table (workspace-scoped)
   7. Governance: policy, protocol, procedure, routine, etc.
   8. Core: schedule_shift, schedule_absence, team, department, location, position
   9. profile
   10. company_member, company (hvis ingen andre workspaces)
   11. workspace
   12. user_identity + auth.users (via admin.auth.admin.deleteUser())
→ emit('workspace abandoned', { workspace_id, created_at, last_step })
→ Autentisert med WATCHDOG_CRON_SECRET
```

**Alternativ:** Legg til `ON DELETE CASCADE` på alle workspace FK-er via migration. Enklere, men høyere blast radius ved feilaktig sletting i prod. Beslutning: bruk eksplisitt rekkefølge for sandbox-cleanup, legg til CASCADE kun på engine-tabellene (nyere, lavere risiko).

### Feil e-post-håndtering

Bruker som skrev feil e-post i steg 1:

1. Kommer til OTP-overlay — koden kommer aldri
2. "Ikke fått koden? Sjekk spam eller **endre e-post**"
3. Klikk → input for ny e-post
4. → `updateUser({ email: newEmail })` → ny OTP sendes
5. Verifisert med korrekt e-post

---

## 4. Datasømmer — Perimeter & Høsting

### Sømmer som må sikres

```
BRUKER (nettleser)
  │
  │ ① E-post i localStorage
  │   🔴 Slett etter signUp() lykkes
  │
  │ ② Scrapling-respons med selskapsdata
  │   🟠 Caches i nettleser — sett cache headers
  │
  │ ③ Wizard-state til server action
  │   🟠 Whitelist felter — send kun det server trenger
  │
  ↓
SUPABASE ←→ SCRAPLING (DigitalOcean)
  │
  │ ④ Scrapling container-logs
  │   🟠 Inneholder bedriftsdata — 7 dagers retention
  │
  ↓
VERCEL ←→ SUPABASE CLOUD
  │
  │ ⑤ Vercel function-logs med request body
  │   🟠 Wizard-data i error logs — retention policy
  │
  │ ⑥ Edge Function-logs
  │   🟡 Feilmeldinger kan inneholde brukerdata
```

### Data som passerer uovervåket — høstingsmuligheter

| Søm                    | Data                             | Fanges i dag? | Verdi                  |
| ---------------------- | -------------------------------- | ------------- | ---------------------- |
| Wizard steg-navigering | Hvilke steg fullfører/dropper    | ❌            | Conversion funnel      |
| Scrapling → Wizard     | Enrichment-kvalitet              | ❌            | Hit rate, datakvalitet |
| Wizard → onComplete    | Diff mellom scrapet og korrigert | ❌            | Auto-fill presisjon    |
| Wizard abandon         | Siste steg før avbrudd           | ❌            | Churn-analyse          |
| OTP-verifisering       | Tid + antall forsøk              | ❌            | Friksjonsmåling        |
| Login-metode           | Passord vs OTP vs Google         | ❌            | Hvilken metode vinner  |

### Telemetri-events å legge til (council-oppdatert: entity-verb format)

Alle events MÅ registreres i `packages/telemetry/src/registry.ts` med TypeScript interface, SmartoutEvent union entry, og EVENT_ROUTING. Nye EventCategory-er: `"wizard"`, `"security"`, `"enrichment"`.

```typescript
// Wizard funnel (anonymisert) → destination: posthog, logger
emit("wizard step_entered", { wizard_id, step_id, step_index });
emit("wizard step_completed", { wizard_id, step_id, duration_ms });
emit("wizard abandoned", { wizard_id, last_step_id, total_duration_ms });
emit("wizard completed", { wizard_id, total_duration_ms, steps_count });

// Enrichment kvalitet → destination: posthog, logger
emit("enrichment requested", { source: "brreg" | "scraping", org_number });
emit("enrichment hit", { source, fields_populated, fields_total });
emit("enrichment missed", { source, reason });
emit("enrichment corrected", { field_name, was_auto: boolean });

// Auth friksjon → destination: posthog, logger (gjenbruk eksisterende "auth signed_up" med silent: true)
emit("auth signed_up", { method: "password", silent: true }); // gjenbruk eksisterende event
emit("auth otp_sent", { context: "workspace_entry" | "login" });
emit("auth otp_verified", { attempts, duration_ms });
emit("auth otp_failed", { reason: "expired" | "wrong_code" | "max_attempts" });
emit("auth logged_in", { method: "password" | "otp" | "google" });

// Sikkerhet → destination: logger, activity_trail (IKKE posthog)
emit("security rate_limited", { endpoint, ip_hash, identifier, count });
emit("security lockout_triggered", { method, attempts });
emit("security sandbox_blocked", { action, workspace_id });
emit("workspace abandoned", { workspace_id, created_at, last_step });
```

### Dataprinsipp

**Slett som standard.** All personavhengig data slettes med mindre aktivt stoppet:

- Uverifiserte workspaces: 48 timer → slett alt
- Wizard localStorage: slett etter DB-synk
- Container-logs: 7 dager
- Vercel-logs: konfigurert retention
- Telemetri-events: anonymisert (ingen persondata i events)

---

## 5. Rate Limiting & Hardening

### Tre lag

```
Lag 1: Supabase Auth (config.toml)
  sign-in:       30/5min/IP   (ned fra 1000)
  sign-up:       10/5min/IP   (ned fra 1000)
  OTP-sending:   15/5min/IP   (ned fra 30)
  Token refresh:  150/5min    (behold)

Lag 2: App Middleware (Upstash Redis)
  Login-forsøk:       5/15min per e-post
  OTP-sending:        3/15min per e-post
  Workspace-create:   3/time per IP
  Scrapling-kall:     10/time per workspace

  FAIL-CLOSED for auth-endepunkter (Redis nede → blokkér + alert)
  FAIL-OPEN for ikke-sensitive endepunkter

Lag 3: Anomali-deteksjon (telemetri)
  Samme IP + mange e-poster → enum-angrep
  Mange mislykkede OTP → brute-force
  Burst workspace-opprettelse → spam
  → emit('security.rate_limit_hit') + alert
```

### Account lockout

```
Forsøk 1-4:    "Feil passord" / "Feil kode"
Forsøk 5:      Låst i 15 minutter
                "For mange forsøk. Prøv igjen om 15 min,
                 eller bruk en annen innloggingsmetode."
3 lockouts:    Låst i 1 time + emit('security.repeated_lockout')
```

**Friksjonsprinsipp:** Lockout gjelder per metode. Passord låst → OTP og Google fortsatt tilgjengelig. Aldri blokkér alle veier inn.

### Bot-beskyttelse

| Endepunkt               | Beskyttelse                      | Hvorfor                              |
| ----------------------- | -------------------------------- | ------------------------------------ |
| `/signup`               | Cloudflare Turnstile (invisible) | Åpen for alle — høy risiko           |
| `/login` (etter 2 feil) | Turnstile trigger                | Null friksjon for vanlige brukere    |
| `/join` steg 1          | signUp rate limit                | Turnstile på wizard = dårlig UX      |
| OTP-sending             | Rate limit alene                 | Turnstile på e-post-input = overkill |

Turnstile er **invisible** — brukeren ser aldri CAPTCHA.

### Config.toml endringer

| Innstilling           | Nå        | Ny           | Grunn                    |
| --------------------- | --------- | ------------ | ------------------------ |
| `min_password_length` | 6         | 8            | Klient krever allerede 8 |
| `otp_expiry`          | 3600 (1h) | 1800 (30min) | Mindre misbruksvindu     |
| Sign-in rate          | 1000/5min | 30/5min      | Brute-force beskyttelse  |
| Sign-up rate          | 1000/5min | 10/5min      | Spam-beskyttelse         |

---

## 6. Komplett auth-metode-matrise

| Metode              | Signup                     | Login                       | Workspace-entry           |
| ------------------- | -------------------------- | --------------------------- | ------------------------- |
| E-post + passord    | ✅ Steg 1 av Join (stille) | ✅ Login-side               | —                         |
| OTP (6-sifret kode) | —                          | ✅ Login-side ("Send kode") | ✅ Verifisering           |
| Google OAuth        | ✅ Signup-side             | ✅ Login-side               | Skip OTP (pre-verifisert) |

### Sesjonsmodell

| Aspekt                      | Verdi                           |
| --------------------------- | ------------------------------- |
| JWT-levetid                 | 1 time (config.toml)            |
| Refresh token               | Roteres ved bruk                |
| Reuse interval              | 10 sekunder                     |
| Cookie-cleanup ved failure  | ✅ Implementert                 |
| Public routes skip auth     | ✅ Implementert                 |
| Redirect-destination lagres | NY — før login                  |
| Sesjon-utløp melding        | NY — vennlig melding, ikke loop |
| "Husk meg"                  | NY — 30 dagers refresh token    |

### Datasøm-sikring — prioritert

| #   | Søm                      | Tiltak                    | Prioritet |
| --- | ------------------------ | ------------------------- | --------- |
| 1   | E-post i localStorage    | Slett etter signUp()      | 🔴        |
| 2   | Passord i wizard-minne   | Eliminert (auth i steg 1) | 🔴        |
| 3   | Wizard-state til server  | Whitelist felter          | 🟠        |
| 4   | Scrapling container-logs | 7 dagers retention        | 🟠        |
| 5   | Vercel function-logs     | Log drain + retention     | 🟡        |
| 6   | intelligence_data RLS    | Workspace-member only     | 🟡        |

---

## 7. Operasjonell sikkerhet

### Tre lag av kontroll

| Lag          | Hva                | Hvordan                                        |
| ------------ | ------------------ | ---------------------------------------------- |
| Automatisk   | Maskinen ser       | Telemetri → PostHog dashboards → alerts        |
| Rutinemessig | Agenten sjekker    | Ukentlig sikkerhetspuls, pre-deploy sjekkliste |
| Bevisbar     | Vi kan dokumentere | Audit trail for alle sikkerhetshendelser       |

### Automatisk overvåkning

| Signal                       | Alert-trigger                                    |
| ---------------------------- | ------------------------------------------------ |
| `workspace abandoned`        | Aldri (normalt) — alert kun ved cron-feil        |
| Sandbox konverteringsrate    | < 50% over 24h                                   |
| `security rate_limited`      | > 20 treff per 5 min fra samme IP                |
| `security lockout_triggered` | Enhver lockout                                   |
| `auth otp_failed`            | > 3 feil per bruker per time                     |
| Supabase 429                 | Enhver forekomst                                 |
| Cleanup-cron feil            | Enhver feil (FK violation = datalekkasje-risiko) |

### Rutinemessig audit (ukentlig)

1. **Sandbox-status:** Aktive sandboxes, tid til verifisering, abandon-rate
2. **Auth-helse:** Login-metode fordeling, rate limit treff, lockouts, OTP-feil
3. **Datasøm-sjekk:** localStorage-artefakter, log-volum
4. **Perimeter-verifisering:** RLS intakt, sandbox-restriksjoner virker (automatiserte tester)

### Bevisbar kontroll

Hver gang en sandbox-bruker prøver noe de ikke kan (invitasjon, integrasjon, eksport), logges det via `security sandbox_blocked`. Det er beviset på at kontrollen virker.

### Eskaleringsmatrise

| Hendelse                                 | Alvorlighet | Handling                                |
| ---------------------------------------- | ----------- | --------------------------------------- |
| Enkelt rate limit hit                    | Normal      | Logg, ingen aksjon                      |
| Gjentatt lockout, samme konto            | Observer    | Sjekk om brukeren glemte passord        |
| Burst sandbox-opprettelse fra én IP      | Undersøk    | Mulig spam — vurder IP-blokkering       |
| Cleanup-cron feiler                      | Kritisk     | Orphaned data-risiko — fiks umiddelbart |
| Supabase 429 (abuse attempt)             | Kritisk     | Token storm — sjekk cookie-cleanup      |
| Tenant data tilgjengelig for feil bruker | Katastrofe  | Alt stopper. Fiks. Varsle Pontus.       |

### Protokoll-dokumentasjon

Ny fil: `docs/protocols/AUTH_SECURITY.md` — levende operasjonell dokumentasjon. Oppdateres ved hver auth-endring.

---

## Filer som påvirkes

### Endres

| Fil                                                        | Endring                                    |
| ---------------------------------------------------------- | ------------------------------------------ |
| `supabase/config.toml`                                     | Rate limits, OTP expiry, password length   |
| `apps/web/src/app/join/_components/Step1Account.tsx`       | Silent signUp() i bakgrunnen               |
| `apps/web/src/app/join/_components/Step6CreateAccount.tsx` | Blir oppsummering/review                   |
| `apps/web/src/app/join/wizard-definition.ts`               | Step 6 redefinert                          |
| `apps/web/src/app/join/_lib/setupActions.ts`               | Fjern eksplisitt token-passing             |
| `apps/web/src/app/login/page.tsx`                          | OTP-login alternativ + lockout             |
| `apps/web/src/app/signup/page.tsx`                         | Turnstile-integrasjon                      |
| `packages/supabase/src/middleware.ts`                      | Redirect-destination, sesjon-utløp melding |
| `apps/web/src/middleware.ts`                               | Sandbox-rute-blokkering for uverifiserte   |
| `apps/web/src/lib/rate-limit.ts`                           | Fail-closed for auth, per-email limits     |
| `packages/telemetry/src/registry.ts`                       | Nye events                                 |

### Nye filer

| Fil                                                                   | Formål                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/web/src/components/auth/OtpVerificationForm.tsx`                | Delt OTP-komponent (login + workspace-entry)                   |
| `apps/web/src/components/auth/OtpOverlay.tsx`                         | Workspace-entry OTP overlay                                    |
| `apps/web/src/app/dashboard/_components/VerificationGate.tsx`         | Sjekker email_confirmed_at, viser overlay                      |
| `supabase/migrations/YYYYMMDDHHMMSS_workspace_status_and_sandbox.sql` | workspace_status enum + kolonne + verification_deadline        |
| `supabase/migrations/YYYYMMDDHHMMSS_engine_fk_cascade.sql`            | ON DELETE CASCADE for engine-tabeller                          |
| `supabase/functions/cleanup-sandbox-workspaces/index.ts`              | Cron: slett sandbox-workspaces etter 48h (komplett FK-dekking) |
| `docs/protocols/AUTH_SECURITY.md`                                     | Levende operasjonell sikkerhetsdokumentasjon                   |

### Berørt men ikke endret

| Fil                                                     | Grunn                                   |
| ------------------------------------------------------- | --------------------------------------- |
| `apps/web/src/app/onboarding/wizard-definition.ts`      | Allerede krever auth — fungerer uendret |
| `apps/web/src/app/dashboard/setup/wizard-definition.ts` | Allerede krever auth — fungerer uendret |
| `supabase/functions/_shared/auth-middleware.ts`         | Allerede fungerer — ingen endring       |

---

## Utenfor scope

- Google OAuth i Join-wizard (egen spec, referert som "Part B" i SESSION.md)
- Cloudflare Turnstile bot-beskyttelse (egen PR — krever env vars, CSP headers)
- Passord-kompleksitetskrav utover lengde 8 (vurderes senere)
- IP-basert anomali-deteksjon utover rate limiting (fase 3)
- Session-revokering (admin logger ut brukere) (fase 3)
- Godmode audit logging (egen oppgave)
- GDPR data retention policies per datatype (policy, ikke kode)
- Mobile app auth-endringer (bruker allerede SecureStore + autoRefresh)
- "Husk meg" / langvarig refresh token (vurderes separat)

## Council-beslutninger (2026-03-29)

| Beslutning                                                  | Begrunnelse                                        | Agent       |
| ----------------------------------------------------------- | -------------------------------------------------- | ----------- |
| `email_confirmed_at` fra auth.users, ikke workspace-kolonne | Email-verifisering er en bruker-egenskap           | Steward     |
| `workspace_status` enum (ny kolonne)                        | `contract_status` er allerede overbelastet         | Steward     |
| ON DELETE CASCADE kun på engine-tabeller                    | Nyere tabeller, lavere risiko                      | Agent Coord |
| Entity-verb telemetri-format                                | Registry standard, ikke dot-notation               | Supervisor  |
| Gjenbruk `auth signed_up` med `silent: true`                | Unngå duplikat-events                              | Supervisor  |
| Sandbox-gate i middleware, ikke engine                      | Stage Engine er workspace-ubevisst by design       | Agent Coord |
| Turnstile som egen PR                                       | Uavhengig scope, reduserer risiko                  | Supervisor  |
| `double_confirm_changes` håndtering                         | Config-endring eller wrapper for email-korrigering | Supervisor  |
| AI/agent-ruter i middleware blocklist                       | service_role bypasser RLS                          | Agent Coord |
| OTP-input som packages/ui komponent                         | Gjenbruk across login + overlay                    | Frontend    |
