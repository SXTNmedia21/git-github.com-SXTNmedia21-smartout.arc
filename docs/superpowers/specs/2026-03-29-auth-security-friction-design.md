---
title: Auth, Security & Friction — Silent Auth + Deferred OTP + Data Perimeter
status: draft
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

Google-autentiserte brukere har allerede verifisert e-post via Google. Skipper OTP-overlay, setter `email_verified = true` direkte.

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

### Database-endringer

```sql
ALTER TABLE workspace ADD COLUMN email_verified boolean DEFAULT false;
ALTER TABLE workspace ADD COLUMN verification_deadline timestamptz;
```

Sjekk om workspace allerede har en status-enum som kan utvides med 'provisioning' og 'pending'. Hvis ikke, bruk de eksisterende statusene og legg til `email_verified` som gate.

### Enforcement — to nivåer

| Nivå       | Hvor     | Hva                                                                                                |
| ---------- | -------- | -------------------------------------------------------------------------------------------------- |
| RLS        | Database | Policies på `invitation`, `platform_api_key`, integrasjonstabeller sjekker `email_verified = true` |
| Middleware | App      | Blokkerer ruter til invitasjoner, integrasjoner, eksport for uverifiserte                          |

### Auto-cleanup

```
Edge Function (cron, hver time):
→ Finn workspaces: verification_deadline < now() AND email_verified = false
→ Kaskade-slett: workspace + relatert data + bruker
→ emit('workspace.abandoned', { workspace_id, created_at, last_step })
→ Autentisert med WATCHDOG_CRON_SECRET
```

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

### Telemetri-events å legge til

```typescript
// Wizard funnel (anonymisert)
emit("wizard.step_entered", { wizard_id, step_id, step_index });
emit("wizard.step_completed", { wizard_id, step_id, duration_ms });
emit("wizard.abandoned", { wizard_id, last_step_id, total_duration_ms });
emit("wizard.completed", { wizard_id, total_duration_ms, steps_count });

// Enrichment kvalitet
emit("enrichment.requested", { source: "brreg" | "scraping", org_number });
emit("enrichment.hit", { source, fields_populated, fields_total });
emit("enrichment.miss", { source, reason });
emit("enrichment.corrected", { field_name, was_auto: boolean });

// Auth friksjon
emit("auth.signup_silent", { method: "password" });
emit("auth.otp_sent", { context: "workspace_entry" | "login" });
emit("auth.otp_verified", { attempts, duration_ms });
emit("auth.otp_failed", { reason: "expired" | "wrong_code" | "max_attempts" });
emit("auth.login", { method: "password" | "otp" | "google" });

// Sikkerhet
emit("security.rate_limit_hit", { endpoint, ip_hash, identifier, count });
emit("security.lockout_triggered", { method, attempts });
emit("security.sandbox_blocked", { action, workspace_id });
emit("workspace.abandoned", { workspace_id, created_at, last_step });
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

| Fil                                                             | Formål                                          |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `apps/web/src/components/auth/OtpVerificationForm.tsx`          | Delt OTP-komponent (login + workspace-entry)    |
| `apps/web/src/components/auth/OtpOverlay.tsx`                   | Workspace-entry OTP overlay                     |
| `apps/web/src/app/dashboard/_components/VerificationGate.tsx`   | Sjekker email_verified, viser overlay           |
| `supabase/migrations/YYYYMMDDHHMMSS_workspace_verification.sql` | email_verified + verification_deadline kolonner |
| `supabase/functions/cleanup-unverified-workspaces/index.ts`     | Cron: slett uverifiserte etter 48h              |

### Berørt men ikke endret

| Fil                                                     | Grunn                                   |
| ------------------------------------------------------- | --------------------------------------- |
| `apps/web/src/app/onboarding/wizard-definition.ts`      | Allerede krever auth — fungerer uendret |
| `apps/web/src/app/dashboard/setup/wizard-definition.ts` | Allerede krever auth — fungerer uendret |
| `supabase/functions/_shared/auth-middleware.ts`         | Allerede fungerer — ingen endring       |

---

## Utenfor scope

- Google OAuth i Join-wizard (egen spec, referert som "Part B" i SESSION.md)
- Passord-kompleksitetskrav utover lengde 8 (vurderes senere)
- IP-basert anomali-deteksjon utover rate limiting (fase 3)
- Session-revokering (admin logger ut brukere) (fase 3)
- Godmode audit logging (egen oppgave)
- GDPR data retention policies per datatype (policy, ikke kode)
- Mobile app auth-endringer (bruker allerede SecureStore + autoRefresh)
