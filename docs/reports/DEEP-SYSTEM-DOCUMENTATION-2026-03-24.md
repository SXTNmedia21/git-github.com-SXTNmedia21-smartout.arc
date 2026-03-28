---
title: "Deep System Documentation — Smartout.ai"
status: done
updated: 2026-03-24
created: 2026-03-24
module: all
tags: [architecture, deep-dive, production-readiness, gaps]
---

# Deep System Documentation — Smartout.ai

> Fullstendig teknisk dokumentasjon av hvordan alt henger sammen.
> Hvert system, hver flyt, hver kobling, hvert gap, og avstand til produksjon.
> Dato: 2026-03-24 | Branch: `development` | 7 deep-dive agenter + direkte kodeanalyse

---

## Innholdsfortegnelse

1. [Systemarkitektur — Helhetsbilde](#1-systemarkitektur)
2. [Auth & Identity — Hele flyten](#2-auth--identity)
3. [Workspace Resolution & RLS](#3-workspace-resolution--rls)
4. [Cascade Core — Implementasjonsstatus](#4-cascade-core)
5. [Event Engine & Telemetry](#5-event-engine--telemetry)
6. [Dashboard — Dataflyter per modul](#6-dashboard-dataflyter)
7. [Mobilapp — Skjerm for skjerm](#7-mobilapp)
8. [Landingsside & Onboarding Pipeline](#8-landingsside--onboarding)
9. [Services & Edge Functions](#9-services--edge-functions)
10. [AI Agent System](#10-ai-agent-system)
11. [Design System & Tokens](#11-design-system)
12. [i18n — Oversettelsessystemet](#12-i18n)
13. [Sikkerhet & RLS](#13-sikkerhet)
14. [Infrastruktur & Deploy](#14-infrastruktur)
15. [Production Readiness — Per område](#15-production-readiness)
16. [Komplett gap-analyse](#16-gap-analyse)

---

## 1. Systemarkitektur

### 1.1 Overordnet arkitektur

```
                        ┌──────────────┐
                        │   Brukere    │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
      ┌───────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
      │  Landing     │ │  Dashboard  │ │  Mobile      │
      │  (Vercel)    │ │  (Vercel)   │ │  (Expo)      │
      │  port 3055   │ │  port 3060  │ │  native      │
      └───────┬──────┘ └──────┬──────┘ └───────┬──────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Supabase Cloud    │
                    │   ┌─────────────┐   │
                    │   │ 38 Edge     │   │
                    │   │ Functions   │   │
                    │   └──────┬──────┘   │
                    │   ┌──────▼──────┐   │
                    │   │ PostgreSQL  │   │
                    │   │ 17 + Vault  │   │
                    │   │ 215 tables  │   │
                    │   │ 704 RLS     │   │
                    │   └─────────────┘   │
                    │   ┌─────────────┐   │
                    │   │ Auth/Storage│   │
                    │   │ Realtime    │   │
                    │   └─────────────┘   │
                    └─────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
      ┌───────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
      │ Stage Engine │ │ Shift MCP   │ │ Contract Svc │
      │ (Hono:5010)  │ │ (Hono:5011) │ │ (Fastify:5012)│
      └──────────────┘ └─────────────┘ └──────────────┘
              │                                │
      ┌───────▼──────┐                ┌───────▼──────┐
      │ Scrapling    │                │ DocuSeal     │
      │ (Python:8000)│                │ (external)   │
      └──────────────┘                └──────────────┘
```

### 1.2 Datapunkter

| Komponent        | Teknologi                         | Lokasjon            | Status                          |
| ---------------- | --------------------------------- | ------------------- | ------------------------------- |
| Web Dashboard    | Next.js 16, React 19, Tailwind v4 | apps/web            | Vercel, produksjonsklart        |
| Landing Page     | Next.js, React 19, Tailwind v4    | apps/landing        | Vercel, produksjonsklart        |
| Mobile App       | React Native + Expo SDK 55        | apps/mobile         | Utvikling, ikke i butikk        |
| Database         | PostgreSQL 17 + pgsodium Vault    | Supabase Cloud      | Produksjonsklart                |
| Edge Functions   | Deno 2 runtime                    | Supabase Cloud      | 38 funksjoner, produksjonsklart |
| Stage Engine     | Hono + WebSocket                  | DigitalOcean Docker | Produksjonsklart                |
| Shift MCP        | Hono + MCP SDK                    | DigitalOcean Docker | Produksjonsklart                |
| Contract Service | Fastify + DocuSeal                | DigitalOcean Docker | Produksjonsklart                |
| Scrapling        | FastAPI + Playwright              | DigitalOcean Docker | Produksjonsklart                |
| Reverse Proxy    | Caddy 2 + auto-HTTPS              | DigitalOcean Docker | Produksjonsklart                |

---

## 2. Auth & Identity

### 2.1 Identitetsmodell

```
auth.users (Supabase Auth)
    │ trigger: handle_new_user()
    ▼
user_identity (public) — 1:1 med auth.users
    │ is_godmode: platform admin
    │
    ├── company (eier) ← company_member (rolle: owner/admin/member)
    │       │
    │       └── workspace (1+ per company)
    │               │
    │               └── profile (1 per user per workspace)
    │                       │ role: employee/manager/admin/owner
    │                       │ profile_status: trainee/active/inactive/offboarding
    │                       │
    │                       └── [all workspace-scoped data]
    │
    └── invitation (pre-profile record)
```

### 2.2 Signup-flyt (Join Wizard)

**Rute:** `/join` → 6 steg → `/onboarding` → `/dashboard/setup`

```
1. /join (AnimatedWizardShell)
   ├── Step1Account: email + passord → supabase.auth.signUp()
   │   → trigger: handle_new_user() → INSERT user_identity
   │
   ├── Step2Business: org-nummer → /api/scrape/brreg → Brønnøysund-oppslag
   │   → lagrer company_scraped_data
   │
   ├── Step3About: adresse, kontakt, ant. ansatte
   │   → intelligence pipeline: gather-workspace-intelligence EF
   │   → google-places-intelligence EF → web-search-intelligence EF
   │
   ├── Step4Hours: åpningstider per dag
   │
   ├── Step5Menu: bransjevalg (hospitality default)
   │   → loads industry package (hospitality.ts)
   │
   └── Step6CreateAccount: oppsummering + bekreftelse
       → onComplete: lagrer alt til localStorage (!)
       → VIKTIG: Ingen DB-skriving her ennå
       → Redirect til /onboarding

2. /onboarding (post-join, autentisert)
   ├── Laster workspace context fra /api/context/bootstrap
   ├── 5 bekreftelsessteg (bekrefter data fra join)
   └── Siste steg: finalize-workspace Edge Function
       → CREATE company
       → CREATE workspace
       → CREATE profile (owner)
       → bootstrap-cascade EF:
           → Seeder D1 (departments, locations, hours)
           → Seeder D3 (regulatory framework, tariff rates)
           → Seeder K1a (public holidays)
       → workspace.onboarding_completed = true

3. /dashboard/setup (post-onboarding)
   ├── WorkspaceSetupWizard (11 valgfrie steg)
   │   ├── WelcomeStep
   │   ├── TeamSetupStep
   │   ├── EmploymentSetupStep
   │   ├── GovernanceSetupStep
   │   ├── HandbookSetupStep
   │   ├── PayrollSetupStep
   │   ├── SeasonSetupStep
   │   ├── ShiftTemplateSetupStep
   │   ├── DocumentDropStep
   │   ├── BotsTip
   │   └── HelpTip
   └── Tracks progress i signup_progress tabell
```

### 2.3 Login-flyt

```
1. /login → supabase.auth.signInWithPassword() ELLER signInWithOAuth({ provider: 'google' })
2. Success → /api/auth/callback (OAuth) ELLER direkte redirect
3. Middleware:
   a. updateSession() — refresh JWT
   b. extractSubdomain() — sjekk om {slug}.smartout.ai
   c. Sett x-workspace-slug header
   d. Redirect til /dashboard ELLER /select-workspace (hvis ingen slug)
4. /dashboard/layout.tsx:
   a. getUser() — verifiser auth
   b. getWorkspaceBySlug(slug) — hent workspace
   c. getProfileInWorkspace(userId, workspaceId) — hent profil
   d. enforceWorkspaceAccess() — sjekk contract_status
   e. Wrap i WorkspaceProvider + QueryProvider + DashboardShell
```

### 2.4 Invite Accept-flyt

```
1. /invite/[token] → hent invitation fra DB
2. Bruker klikker "Aksepter"
3. accept-invitation Edge Function:
   a. Valider token + status
   b. UPSERT auth.user (hvis ny bruker)
   c. INSERT company_member (rolle fra invitation)
   d. INSERT profile (workspace_id, profile_status: 'trainee')
   e. UPDATE invitation.status = 'accepted'
   f. emit('invitation accepted')
4. Redirect til /welcome → /dashboard
```

### 2.5 Mobil auth-flyt

```
1. (auth)/welcome.tsx — velkomstskjerm
2. Bruker skriver e-post/telefon
3. supabase.auth.signInWithOtp({ email/phone })
4. (auth)/verify.tsx — OTP-kode fra SMS/e-post
5. supabase.auth.verifyOtp({ token })
6. (auth)/workspace-select.tsx — velg workspace (hvis flere)
7. Token lagres i Expo SecureStore
8. Redirect til (app)/(home)/index.tsx
```

### 2.6 Viktig klargjoring: Join wizard OG DB

Deep-dive avdekket at `completeSignup()` i `apps/web/src/app/join/_lib/setupActions.ts` FAKTISK skriver til DB:

- Kaller `provision_onboarding_workspace()` RPC → oppretter workspace (`contract_status='onboarding'`, `company_id=NULL`)
- Oppretter profile (admin, active)
- Lagrer intelligence_data, company_details, opening_hours, social_media, signup_progress
- Workspace eksisterer i DB etter join, men company opprettes forst under finalisering

**Flyten er:** Join wizard → `completeSignup()` → workspace i DB (onboarding status) → `/onboarding` → `finalize-workspace` EF → company opprettes → cascade bootstrap

### 2.7 Gaps til produksjon — Auth

| Gap                           | Alvorlighet | Beskrivelse                                        | Estimat |
| ----------------------------- | ----------- | -------------------------------------------------- | ------- |
| Ingen password-reset på mobil | MEDIUM      | Web har /reset-password, mobil mangler             | 1 dag   |
| Ingen MFA/2FA                 | LAV         | Supabase støtter det, ikke aktivert                | 2 dager |
| Trainee first-day redirect    | MEDIUM      | Ingen redirect til my-training etter invite accept | 0.5 dag |

---

## 3. Workspace Resolution & RLS

### 3.1 Hvordan workspace-isolasjon fungerer

**Prinsipp:** Alle workspace-scoped tabeller har `workspace_id` kolonne. RLS policies bruker to mekanismer:

**For JWT-autentiserte brukere (web/mobil):**

```sql
CREATE FUNCTION get_workspace_ids_for_user(uid uuid)
RETURNS SETOF uuid AS $$
  SELECT workspace_id FROM profile WHERE user_id = uid AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Brukes i RLS:
CREATE POLICY "user_read" ON schedule_shift
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
```

**For API-nøkkel-autentiserte brukere (ekstern integrasjon):**

```sql
CREATE FUNCTION get_api_workspace_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Brukes i RLS:
CREATE POLICY "api_key_read" ON schedule_shift
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
```

**Workspace-context for API-nøkler settes i Edge Functions:**

```typescript
// I workspace-api gateway:
await supabase.rpc("set_config", { key: "app.workspace_id", value: workspaceId });
```

### 3.2 RLS-dekning

| Metrikk             | Verdi                          |
| ------------------- | ------------------------------ |
| Tabeller med RLS    | 196 av ~215                    |
| Totale RLS policies | 704                            |
| JWT-policies        | ~350                           |
| API-key-policies    | ~350                           |
| Tabeller uten RLS   | ~19 (platform-admin, metadata) |

### 3.3 Middleware — Workspace-oppløsning

```typescript
// apps/web/src/middleware.ts
export async function middleware(request: NextRequest) {
  // 1. Oppdater auth-sesjon (refresh JWT)
  const response = await updateSession(request);

  // 2. Sjekk for subdomain: {slug}.smartout.ai
  const slug = extractSubdomain(request.headers.get("host"));

  // 3. Sjekk for showcase-modus
  if (slug && request.nextUrl.pathname === "/dashboard") {
    // Sett x-workspace-slug header for layout
    response.headers.set("x-workspace-slug", slug);
  }

  // 4. Godmode-cache for platform admin
  const isGodmode = await getCachedGodmodeStatus(adminClient, userId);

  // 5. Sett x-showcase-mode for demo workspace
  if (isShowcase) {
    response.headers.set("x-showcase-mode", "1");
  }
}
```

---

## 4. Cascade Core

### 4.1 Arkitektur — I1 + 6D + 4C + K1a/K1b

Cascade er det organiserende prinsippet for hele systemet. Ikke en enkelt tjeneste, men en modell som styrer hvordan data organiseres, regler evalueres, og beslutninger tas.

```
I1 (Industry Bootstrap) → Laster bransjestandarder ved workspace-opprettelse
    │
    ├── D1 Driftsrammer → department, location, hours, overrides, planning_cycle
    ├── D2 Resurstilgang → profile, team, contract, payroll, absence
    ├── D3 Regler → regulatory_framework, framework_rule, tariff_rate_table
    ├── D4 Etterspørsel → season, budget, day_factor, hour_factor
    ├── D5 Driftskonsept → hospitality.ts, niche config (parameteriserer alt)
    └── D6 Produksjon → schedule_shift, department_session, deviation
        │
        ├── C1 Kalibrering → daily_reconciliation, EWMA (IKKE IMPLEMENTERT)
        ├── C2 Kontekst → buildEntityContext(), semantic search (DELVIS)
        ├── C3 Kommersiell → shift_cost_snapshot, tariff resolution (DELVIS)
        └── C4 Styring → change_proposal, engine_authority_config (SCHEMA KUN)
```

### 4.2 Pure Functions — 9 implementert, alle testet

| Funksjon                      | Dimensjon | Fil                            | Inputt                              | Output                               | Testet |
| ----------------------------- | --------- | ------------------------------ | ----------------------------------- | ------------------------------------ | ------ |
| `resolveEffectiveHours()`     | D1        | resolve-hours.ts               | dept, date, overrides, season hours | EffectiveHours med open/close/source | JA     |
| `computeAnchoredTime()`       | D6        | compute-anchored-shift.ts      | shift, anchor_type                  | Beregnet start/slutt/varighet        | JA     |
| `evaluateFrameworkRules()`    | D3        | evaluate-framework-rules.ts    | workspace rules, trigger, entity    | RuleEvaluation[] med enforcement     | JA     |
| `resolveTariffRate()`         | D3/C3     | resolve-tariff-rate.ts         | profile, date, tariff tables        | Beregnet timerate med tillegg        | JA     |
| `validateProposalFreshness()` | C4        | validate-proposal-freshness.ts | proposal, current state             | Fresh/stale med state hash           | JA     |
| `buildEntityContext()`        | C2        | build-entity-context.ts        | entity ref, workspace               | Full context object                  | JA     |
| `computeProposalPreview()`    | C4        | compute-proposal-preview.ts    | proposal, current state             | Preview av endringer                 | JA     |
| `propagateBudgetTargets()`    | D4        | propagate-budget-targets.ts    | season budget, day/hour factors     | Daglige budsjettmål                  | JA     |
| `getTariffContext()`          | D3        | get-tariff-context.ts          | profile_id, date                    | DB-query for tariff data             | JA     |

### 4.3 Bootstrap — Hva skjer ved workspace-opprettelse

```
finalize-workspace EF
    │
    ├── 1. CREATE company (fra onboarding data)
    ├── 2. CREATE workspace (slug, settings)
    ├── 3. CREATE profile (owner, admin rolle)
    ├── 4. INSERT department_operating_hours (fra Step4)
    │
    └── 5. bootstrap-cascade EF:
        ├── Laster 13 SQL templates fra supabase/templates/restaurant/
        │   ├── 01-departments.sql → department inserts
        │   ├── 02-locations.sql → location inserts
        │   ├── 03-positions.sql → position inserts
        │   ├── 04-teams.sql → team inserts
        │   ├── 05-policies.sql → policy inserts
        │   ├── 06-protocols.sql → protocol inserts
        │   ├── 07-procedures.sql → procedure + steps
        │   ├── 08-routines.sql → routine inserts
        │   ├── 09-control-lists.sql → control_list inserts
        │   ├── 10-knowledge-tests.sql → knowledge_test inserts
        │   ├── 11-confirmations.sql → confirmation inserts
        │   ├── 12-engine-processes.sql → engine_process seeding
        │   └── 13-runbooks.sql → runbook + steps
        │
        ├── Seeder tariff_rate_table (K1a baseline rates)
        ├── Seeder public_holiday (Norway 2026)
        └── _apply.sql orkestrerer alt i rekkefølge
```

### 4.4 Framework Seed — hospitality.no.default.v1

**Nylig seedet i migrasjon `20260424100000`:**

- 1 regulatory_framework record (hospitality.no.default.v1)
- 19 framework_rule records (gate + constraint + advisory typer)
- 7 framework_trigger records (state_change + time_based + threshold)
- 4 tariff_rate_table records (base rates, kveld, helg, helligdag)

**VIKTIG BUG:** `hospitality.ts` i `apps/web/src/lib/industry/packages/` har FEIL tariffverdier:

- kveldstillegg: 56 NOK (skal være 15.65 NOK per Riksavtalen 2024)
- helgetillegg: 56 NOK (skal være 29.74 NOK)
- helligdagstillegg: 133% (skal være 100%)

Korrekte verdier finnes nå i `tariff_rate_table` (seedet), men `hospitality.ts` er ikke oppdatert til å lese derfra.

### 4.5 Gaps til produksjon — Cascade

| Gap                          | Dimensjon | Alvorlighet | Beskrivelse                                            | Estimat   |
| ---------------------------- | --------- | ----------- | ------------------------------------------------------ | --------- |
| hospitality.ts feil rater    | D5/C3     | KRITISK     | Hardkodede rater er feil, brukes i beregninger         | 1 dag     |
| C1 EWMA kalibrering          | C1        | HØY         | Ingen korreksjonsloop, planlagt vs faktisk             | 3-5 dager |
| C4 change proposal lifecycle | C4        | HØY         | Preview finnes, apply mangler                          | 3 dager   |
| Handbook → RAG pipeline      | K1b       | MEDIUM      | Kapitler lagres men chunkes ikke for semantisk søk     | 2-3 dager |
| Shift publish → Session      | D6        | HØY         | End-to-end-flyten er ikke testet                       | 1-2 dager |
| C3 kostberegning pipeline    | C3        | MEDIUM      | shift → tariff → shift_cost_snapshot ikke automatisert | 2-3 dager |
| D2 resource resolver         | D2        | MEDIUM      | Ingen tilgjengelighetsberegning                        | 3-5 dager |
| Phase D adapters             | Alle      | LAV         | Tripletex, ERP, kalender — ikke startet                | 2-4 uker  |

---

## 5. Event Engine & Telemetry

### 5.1 Event Engine — Universal Workflow Runtime

```
engine_process (blueprint, TEXT PK)
    │ definerer steg
    └── engine_step (action_type + action_payload)

engine_trigger (event → process matching)
    │ matcher events til prosesser
    ▼
engine_event (immutable event log)
    │ mottatt fra emit()
    ▼
engine_state (running instance)
    │ tracker nåværende steg
    └── engine_state_step (per-steg tracking)
```

**Action Types i engine-dispatch:**

1. `wait_for_event` — Vent på spesifikk event
2. `assign_task` — Opprett oppgave
3. `send_notification` — Send notifikasjon (STUB)
4. `update_entity` — Oppdater entitet i DB
5. `create_deviation` — Opprett avvik
6. `validate_settlement` — Valider oppgjør
7. `lock_checkout` — Lås utsjekking
8. `schedule_control` — Planlegg kontroll (reservert)
9. `start_process` — Start ny prosess (rekursivt)
10. `upsert_session` — Opprett/oppdater department_session

**Aktive prosesser:**

| Prosess            | Entity              | Trigger                 | Status     |
| ------------------ | ------------------- | ----------------------- | ---------- |
| Signup Onboarding  | user_identity       | signup.completed        | E2E BEVIST |
| Workspace Setup    | workspace           | workspace.created       | E2E BEVIST |
| Daily Close        | department_session  | session.pending_signoff | Seedet     |
| Onboarding Journey | profile             | invitation.accepted     | Seedet     |
| Training Protocol  | protocol_assignment | protocol.assigned       | Seedet     |
| Session Hooks      | department_session  | session.opened          | Seedet     |
| HACCP Daily        | department_session  | session_hook.pre_open   | Planlagt   |

### 5.2 Telemetry System — 178 events, 4+1 destinasjoner

**Package:** `@smartout/telemetry`

```typescript
emit(event) →
  ├── posthog (analytics) — PostHog EU, browser + server
  ├── logger (debugging) — Strukturert stdout
  ├── activity_trail (audit) — INSERT til activity_trail tabell
  ├── engine_event (automation) — POST til engine-dispatch EF
  └── notifications (planlagt) — IKKE IMPLEMENTERT
```

**178 registrerte event-typer** organisert i kategorier:

- auth: 3 (signed_up, signed_in, signed_out)
- navigation: 2 (page viewed, button clicked)
- org_structure: 3 (department CRUD)
- scheduling: 23 (shift CRUD, publish, punch, break, supplement, adhoc, call)
- operations: 7 (session CRUD, hook_fired, task_completed)
- training: 5 (assigned, step_completed, test_submitted, confirmation_signed, completed)
- contracts: 7 (CRUD, signed, cancelled, declined, expired)
- channels: 18 (CRUD, messages, members, reactions, calls, PTT)
- website: 18 (CRUD, publish, pages, sections, spokesperson)
- payroll: 15 (settings, salary codes, groups, shift types, supplements, breaks, meals, holidays)
- wizard: 8 (started, completed, step_completed, skipped, back, abandoned, validation_failed)
- misc: 15+ (season, budget, guardian, leader_pulse, handbook, help_request)

### 5.3 Gaps til produksjon — Event Engine & Telemetry

| Gap                               | Alvorlighet | Beskrivelse                                                 | Estimat                      |
| --------------------------------- | ----------- | ----------------------------------------------------------- | ---------------------------- |
| send_notification STUB            | HØY         | Action handler eksisterer men gjør ingenting                | 2-3 dager                    |
| Notifications destination         | HØY         | Deklarert i type-systemet men ikke implementert             | Del av notifikasjonssystemet |
| Seedede prosesser ikke testet E2E | MEDIUM      | Daily Close, Training, Session Hooks seedet men aldri kjørt | 2-3 dager testing            |
| fire-delayed-triggers             | LAV         | Eksisterer men uten cron-schedule i prod                    | 0.5 dag                      |

---

## 6. Dashboard — Dataflyter per modul

### 6.1 Dashboard Shell

**Fil:** `apps/web/src/components/dashboard/DashboardShell.tsx`

Shells hele dashboardet. Inneholder:

- **Sidebar navigation** — rollebasert (admin vs ansatt)
- **Mission routing** — mapper ruter til AI-missions for kontekstuell assistent
- **Voice assistant** — Mr. Botsson overlay
- **Global search** — Cmd+K palette

**Rollebasert navigasjon:**

- **Admin/Manager:** Oversikt, Vaktplan, Ansatte, Driftskontroll, Rapporter, Sesong, Avstemming, Styringsverktøy, HMS, Organisasjon, Kommunikasjon, Nettside, Innstillinger
- **Ansatt:** Min vaktplan, Min opplæring, Min lønn, Min profil, Hjelp

### 6.2 Oversikt (/)

**Admin → AdminDashboard:**

- 5 tabs: Taktisk, Strategisk, Avstemming, Aktivitet, Vakt
- **TacticalView:** Ukentlige vakter, dekningsgrad, leader pulse, avviksalarmer, guardian signals
  - Query: schedule_shift (denne uka), department_session (aktive), deviation (siste)
- **StrategicView:** KPI-kort, omsetning vs mål, arbeidskostnad %, lokasjonssammenligning
  - Query: workspace_kpi_target, workspace_budget, daily_reconciliation

**Ansatt → EmployeeDashboard:**

- Dagens vakt, kommende vakter, readiness score, åpne vakter å ta
- Query: schedule_shift (mine), protocol_assignment (progress)

### 6.3 Vaktplan (/dashboard/schedule)

**Fullverdig vaktplanlegger:**

- Uke/dag/måned-visninger
- Drag & Drop for vakt-tildeling
- Day Control Panel (daglig vaktinfo)
- Publiser-arbeidsflyt (draft → published)
- Ad-hoc vakt-opprettelse
- Åpne vakter (claim-system)
- Malbibliotek (schedule_template)
- Realtime på 6 tabeller

**Tabeller:** schedule_shift, schedule_template, schedule_template_shift, schedule_open_shift, schedule_day_message, schedule_day_task, schedule_day_booking, schedule_audit_log

**Mutations:** createShift, updateShift, deleteShift, publishShifts, claimOpenShift, createAdHocShift

### 6.4 Ansatte (/dashboard/people)

**DataTable med:**

- Profiler med rolle, status, avdeling
- Invite-status tracking
- Readiness score (% protokoller fullført)
- Employee cards med quick actions
- Row actions: edit, invite, deactivate

**Tabeller:** profile, department, team, invitation, protocol_assignment

### 6.5 Styringsverktøy (/dashboard/governance)

**Full CRUD med 5 skjemaer:**

1. **PolicyForm** — Opprett/rediger policies (type: operational/haccp/hr/safety/access/payroll/custom)
2. **ProtocolForm** — Opprett/rediger protokoller med prosedyrer
3. **ProcedureBuilder** — Steg-for-steg prosedyrebygger
4. **KnowledgeTestBuilder** — Spørsmål/svar-bygger for kunnskapstester
5. **ConfirmationForm** — Sign-off maler

**Readiness scoring:**

```
Readiness = (completed_assignments / total_assignments) * 100%
Beregnes fra: protocol_assignment.status = 'completed'
```

### 6.6 Innstillinger (/dashboard/settings)

**16 tabs, 11 fungerer, 5 placeholder:**

| Tab             | Status      | Cascade | Hva det styrer              |
| --------------- | ----------- | ------- | --------------------------- |
| Åpningstider    | FUNGERER    | D1      | department_operating_hours  |
| Lønn            | FUNGERER    | C3      | Payroll settings            |
| Tillegg         | FUNGERER    | D3      | supplement_rule             |
| Måltider        | FUNGERER    | D3      | meal_rule                   |
| Vakter          | FUNGERER    | D6      | shift_type                  |
| Pauser          | FUNGERER    | D3      | break_rule                  |
| Arbeidstid      | FUNGERER    | D3      | working_time_rules          |
| Helligdager     | FUNGERER    | K1a     | public_holiday              |
| Rammeverk       | FUNGERER    | D3      | regulatory_framework viewer |
| Tariffer        | FUNGERER    | D3/C3   | tariff_rate_table           |
| Endringsforslag | FUNGERER    | C4      | change_proposal             |
| Generelt        | PLACEHOLDER | —       | Workspace-innstillinger     |
| KPI             | PLACEHOLDER | C1      | KPI-mål                     |
| Varsler         | PLACEHOLDER | —       | Notification preferences    |
| Team            | PLACEHOLDER | D2      | Team config                 |
| Sikkerhet       | PLACEHOLDER | —       | API keys, tilgang           |

### 6.7 Stemplingsur (/dashboard/shift-clock)

**Full punch-clock implementasjon:**

Web + mobil, med:

- GPS-geofence validering (useGPSGuard)
- Pause-tracking med break_rule-logikk (useBreakRules)
- Tilleggsberegning (useSupplements)
- Vakt-notater (useShiftNotes)
- Vakt-chat (useShiftChat)
- Poeng-kalkulator
- Leader overview med realtime status

**Edge Function:** `shift-clock-compliance` — validerer GPS-avstand, hvileperioder, ukentlige timer

**Package:** `packages/shift-clock` — 21 tester, state machine, GPS distance, break classifier

### 6.8 Sesongplanlegging (/dashboard/season)

**4 tabs:**

1. **Oversikt** — Sesong-status, tidsperiode, grunnleggende info
2. **Budsjett** — season_budget: total_target, labor_pct, avg_hourly_wage, base_price_per_guest
3. **Dagfaktorer** — day_factor: vekting per ukedag (man=0.8, lør=1.5, etc.)
4. **Timefaktorer** — hour_factor: vekting per time (11:00=0.5, 18:00=1.5, etc.)

**Beregningsmotor:** `apps/web/src/lib/season-calculations.ts` — rene funksjoner, ingen DB-avhengigheter

---

## 7. Mobilapp

### 7.1 Navigasjonsstruktur

```
Root (_layout.tsx)
├── (auth)/ — Pre-auth
│   ├── welcome — Velkomst + innlogging
│   ├── verify — OTP-kode
│   ├── workspace-select — Velg workspace
│   ├── pending — Ventende invitasjon
│   └── invite/[token] + confirm — Aksepter invitasjon
│
└── (app)/ — Post-auth (5 tabs)
    ├── (home)/ — Hjem-tab
    │   ├── index — Fasebevisst dashboard (ingen vakt / før / under / etter)
    │   ├── punch-clock — Fullskjerm stemplingsur
    │   ├── haccp — Temperaturkontroll sjekkliste
    │   ├── deviation — Rapporter avvik
    │   ├── team — Teamliste + /[id] detalj
    │   ├── edit-profile — Rediger profil
    │   └── spokesperson-approval — Godkjenn innhold
    │
    ├── (shifts)/ — Vakter-tab
    │   ├── index — Vaktliste med swipe-bekreftelse
    │   └── [id] — Vaktdetaljer
    │
    ├── (komm)/ — Kanaler-tab
    │   ├── index — Kanalliste
    │   └── [id] — Kanaldetaljer
    │
    ├── (chat)/ — Chat (skjult fra tab bar)
    │   ├── index — Samtaleliste
    │   └── [id] — Chat-detaljer
    │
    └── (me)/ — Meg-tab
        ├── index — Profilkort + logout
        ├── payroll — Lønnshub
        ├── payroll-supplements — Tilleggsdetaljer
        ├── payslip — Lønnsslipp-liste
        ├── timebank — Timebank-saldo
        ├── absence-balance — Fraværssaldo
        └── absence-request — Søk om fravær
```

### 7.2 Fasebevisst hjemmeside

Hjemmeskjermen endrer seg basert på vakt-fase:

```
useShiftPhase() → Zustand store
  ├── NO_SHIFT → NoShiftView (ingen aktiv vakt, viser neste + åpne vakter)
  ├── BEFORE_SHIFT → BeforeShiftView (countdown til vakt)
  ├── DURING_SHIFT → DuringShiftView (aktiv klokke, pause, notater)
  └── AFTER_SHIFT → AfterShiftView (oppsummering, timebekreftelse)
```

### 7.3 Offline Sync

```
SQLite queue (lib/sync/queue.ts)
  │
  ├── enqueue("confirm_shift", { shift_id, ... }) — Legger til i kø
  ├── Nettverksbrudd → operasjoner samles i SQLite
  ├── Gjenoppkobling → use-sync-status detekterer
  └── Auto-sync: sender køen til server i rekkefølge
```

### 7.4 Gaps til produksjon — Mobil

| Gap                             | Alvorlighet | Beskrivelse                                                                   | Estimat   |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------- | --------- |
| Ingen admin/manager-skjermer    | HØY         | Kun ansatt-perspektiv. Vaktplanlegger, innstillinger, styringsverktøy mangler | 4-6 uker  |
| HACCP demo-data                 | MEDIUM      | Sjekkliste bruker demo-data, ikke koblet til haccp_log                        | 2 dager   |
| Avviksrapportering delvis       | MEDIUM      | Skjema finnes men integrasjon ikke fullstendig                                | 1 dag     |
| Trening/opplæring mangler       | MEDIUM      | Låst i Me-tab, ingen skjermer implementert                                    | 1-2 uker  |
| Push-notifikasjoner ikke koblet | MEDIUM      | Expo Notifications konfigurert, push-dispatch EF finnes, ikke koblet          | 2-3 dager |
| App ikke i butikk               | HØY         | Trenger TestFlight/Google Play registrering, app review                       | 1-2 uker  |
| 0% i18n                         | MEDIUM      | All tekst i strings.ts, planlagt for V2                                       | 1 uke     |
| React 19 removeChild bug        | LAV         | Expo web har bug på route transitions — test på native                        | Undersøk  |

---

## 8. Landingsside & Onboarding Pipeline

### 8.1 Landingsside — Arkitektur

**34 sider + 8 API-ruter:**

```
/ (VariantMLanding) — Norsk hjemmeside
  ├── BlockRenderer → HeroBlock, FeaturesGridBlock, TestimonialBlock, etc.
  ├── 19 blokk-typer (Hero, Features x3, Testimonial, Stats, CaseStudy,
  │   PricingPreview, LogoStrip, Image, Text, CTA, FAQ, VoiceWidget,
  │   WorkspaceAnalyzer, ThemeProvider)
  └── Variant-system (8 arkiverte, 1 aktiv)

/en — Engelsk versjon (URL-basert)
/features/* — 6 feature-sider
/concepts/* — 4 konseptsider
/docs/* — Dokumentasjon fra markdown-filer
/demo/* — 6 interaktive demo-journeys med AI
/blog/* — Blogg
/pricing — Prising
```

### 8.2 Demo-system

```
/demo → DemoShell
  ├── 6 journeys:
  │   ├── journey-1-punch-in — Stempling
  │   ├── journey-2-schedule-ai — Vaktplan med AI
  │   ├── journey-3-quiz — Kunnskapstest
  │   ├── journey-4-deviation — Avviksrapportering
  │   ├── journey-5-haccp — HACCP-logging
  │   └── journey-6-onboarding — Onboarding
  │
  ├── Hver journey har:
  │   ├── Feature-komponent (UI-simulering)
  │   ├── AssistantPanel (AI chat)
  │   └── JourneyProgress (steg-tracker)
  │
  └── useDemoJourney hook — state machine for steg-progresjon
```

### 8.3 Analytics & Tracking

**Dual tracking:**

```
Brukerinteraksjon
  │
  ├── PostHog (analytics) — page_view, cta_click, scroll_depth
  │
  └── Supabase (custom) via /api/track:
      ├── landing_event — Hvert event (klikk, CTA, scroll)
      ├── landing_visitor — Unik besøkende (first_referrer, variant, IP)
      └── landing_session — Sesjon (sider sett, klikk, maks scroll, varighet)

4 tracking hooks:
  ├── useTracking() — Generisk event-sender
  ├── usePageTracking() — Page view ved mount
  ├── useScrollTracking() — Scroll-dybde ved 25/50/75/100%
  └── useSessionLifecycle() — Start/heartbeat/slutt
```

### 8.4 Gaps til produksjon — Landing

| Gap                      | Alvorlighet | Beskrivelse                                         | Estimat     |
| ------------------------ | ----------- | --------------------------------------------------- | ----------- |
| 8 arkiverte varianter    | LAV         | Klutter i kodebasen, bør slettes                    | 0.5 dag     |
| Ingen per-side OG tags   | MEDIUM      | Social sharing-bilder mangler per side              | 1 dag       |
| UntypedClient i tracking | LAV         | Type-cast workaround pga manglende tabeller i types | 0.5 dag     |
| Docs er filbaserte       | LAV         | Endringer krever git commit, ingen CMS              | Akseptabelt |

---

## 9. Services & Edge Functions

### 9.1 Stage Engine (port 5010)

**Hono + WebSocket, AI-agent orkestrator**

```
Ruter:
  GET  /health — Helsesjekk
  POST /sessions — Opprett/hent AI-sesjon
  POST /store — Lagre sesjonstilstand
  POST /fetch — Hent sesjonstilstand
  POST /advance — Gå til neste steg
  POST /agent/chat — Agent-samtale (SSE streaming)
  POST /adapters/ultravox — Voice AI adapter
  WS   /ws/:sessionId — WebSocket for sanntid
  WS   /guardian — Guardian WebSocket
```

**Bakgrunnsprosesser:**

- Sesjon-utløp: Rydder stale sesjoner
- Minneopprydding: Rydder utløpte memories
- Guardian-evaluering: Sjekker alle aktive sesjoner hvert 30s
- Kalender-guardian: Sjekker sesong-livssyklus hvert 60s

### 9.2 Shift MCP (port 5011)

**Model Context Protocol server — 5 verktøy for AI-agenter:**

```
Tools:
  1. create_shift — Opprett vakt med auto arbeidstid-beregning
  2. update_shift — Endre vakt, rekalkuler timer
  3. get_shift — Hent vakdetaljer
  4. list_shifts — Spør vakter med filter
  5. delete_shift — Slett vakt
```

Workspace-context via MCP transport, stateless per request.

### 9.3 Contract Service (port 5012)

**Fastify + DocuSeal e-signatur:**

```
Ruter:
  /contracts — CRUD kontrakter
  /templates — Kontraktmaler
  /sync — Bidirectional DocuSeal sync
  /webhooks — DocuSeal event-mottak (signert, utløpt, etc.)
```

### 9.4 Scrapling (port 8000)

**FastAPI (Python) — web scraping + dokumentutpakking:**

- Playwright for web scraping
- PyMuPDF + pdfplumber for PDF
- python-docx for Word
- openpyxl for Excel

### 9.5 Kritiske Edge Functions

| Funksjon                 | Trigger             | Hva den gjør                                          |
| ------------------------ | ------------------- | ----------------------------------------------------- |
| `engine-dispatch`        | POST fra emit()     | Kjører workflow-steg (13 action handlers)             |
| `finalize-workspace`     | POST fra onboarding | Oppretter company + workspace + profile + bootstrap   |
| `bootstrap-cascade`      | POST fra finalize   | Seeder D1-D6 + K1a fra SQL templates                  |
| `guardian-sweep`         | Cron ~15 min        | Genererer signaler (utløpte oppgaver, stale sesjoner) |
| `shift-clock-compliance` | POST fra punch      | Validerer GPS, hvileperioder, ukentlige timer         |
| `workspace-api`          | POST/GET            | API-gateway med 23 ruter, dual-auth, scope-guard      |
| `push-dispatch`          | POST                | Push-notifikasjoner via Expo + SMS fallback           |

---

## 10. AI Agent System

### 10.1 Arkitektur

```
packages/ai/
  ├── adapters/     — Integrasjoner (OpenRouter, Ultravox)
  ├── agents/       — Agent-definisjoner
  ├── capabilities/ — Hva agenten kan gjøre
  ├── context/      — Workspace + profil kontekst
  ├── engine/       — Kjøretidsmotor
  ├── generators/   — Innholdsgenerering
  ├── journey/      — Journey-logikk
  ├── missions/     — Strukturerte oppgaver
  ├── prompts/      — System-prompts
  ├── router/       — Intent-klassifisering
  ├── schemas/      — Zod-validering
  └── tools/        — Verktøy for agenten
```

### 10.2 Konsepter

- **Mission mode:** Strukturerte sekvensielle steg (onboarding, trening)
- **Agent mode:** Fri samtale med kontekst (Mr. Botsson)
- **Authority config:** Per-workspace, per-capability tillatelsesnivåer (5 nivåer × 9 capabilities)
- **Engine memory:** Persistent pgvector embeddings per profil
- **Agent profile:** Personlighet, posture, voice DNA

### 10.3 Mr. Botsson

AI-assistenten tilgjengelig på dashboard. Kontekstuell — missions endres basert på rute:

- `/dashboard/schedule` → shift-assistant mission
- `/dashboard/governance` → governance-assistant mission
- `/dashboard/reports` → reports-assistant mission

---

## 11. Design System

### 11.1 "Ren og Varm" — Designspråk

**Stilguide:** `docs/design/ren-og-varm-styleguide.html` (24 seksjoner, interaktiv)
**Live:** `design.smartout.ai`

**Fargeformat:** OKLCH gjennomgående (perceptuelt uniform)

**Tokens-arkitektur:**

```
packages/design-tokens/src/tokens.ts (kilde)
  ├── tokens.css (CSS variabler for web)  ← 7+ AVVIK FRA KILDEN
  └── native.ts (hex-verdier for mobil)   ← Korrekt konvertering
```

**KRITISK PROBLEM:** tokens.ts og tokens.css matcher IKKE:

| Token            | tokens.ts        | tokens.css           | Avvik                  |
| ---------------- | ---------------- | -------------------- | ---------------------- |
| background (lys) | oklch(1 0 0)     | oklch(0.99 0.004 60) | Varmere, lavere lyshet |
| foreground (lys) | oklch(0.145 0 0) | oklch(0.145 0.01 50) | Tillagt chroma         |
| card (lys)       | oklch(1 0 0)     | oklch(0.99 0.004 60) | Varmere                |
| border (lys)     | oklch(0.922 0 0) | oklch(0.91 0.006 55) | Annen lyshet + chroma  |
| ring (lys)       | oklch(0.708 0 0) | oklch(0.65 0.22 40)  | HELT annen farge       |

**Fonter:**

- Instrument Serif (headings, `font-heading`)
- Geist Sans (body)
- Geist Mono (data/kode)

**Bevegelse:**

- Spring physics: stiffness 30-45, damping 20-24, mass 2-2.5
- Min 250ms exit, 500ms entrance
- IKKE TOKENISERT — spredt i komponenter

---

## 12. i18n

### 12.1 Systemet

**Package:** `@smartout/i18n` — egenlaget, 0 dependencies

```
createTranslator(locale, namespace) → t(key, params?)
  ├── Laster JSON fra locales/{locale}/{namespace}.json
  ├── Interpolasjon: "Hei {name}" → "Hei Pontus"
  └── Fallback: returner key-string hvis ikke funnet
```

### 12.2 Dekning

| Overflate     | Totale strenger | Oversatte      | Dekning |
| ------------- | --------------- | -------------- | ------- |
| Web dashboard | ~3,329          | 455 (t() kall) | 12%     |
| Mobilapp      | ~493            | 0              | 0%      |
| Landingsside  | ~1,752          | 0 (URL-basert) | 0%      |
| **Totalt**    | **~5,574**      | **455**        | **~8%** |

### 12.3 Kritisk bug

6 deklarerte språk (sv, da, pl, ar, so, fi) har INGEN oversettfiler. Hvis bruker velger svensk → all tekst vises som rå nøkkelstrenger.

---

## 13. Sikkerhet

### 13.1 Tre lover

1. **Aldri klartekst-hemmeligheter** i kode, config, logger, eller DB
2. **Aldri bypass RLS** for bekvemmelighet
3. **Aldri commit hemmeligheter** til Git

### 13.2 API-nøkkelsystem

```
Opprettelse:
  1. Generer tilfeldig nøkkel med prefix (smo_sk_live_, smo_sk_test_, smo_svc_live_)
  2. SHA-256 hash → lagre hash i platform_api_key
  3. Vis rånøkkel ÉN gang til bruker
  4. Aldri lagre rånøkkel

Validering:
  1. Motta X-Api-Key header
  2. SHA-256 hash innkommende nøkkel
  3. Slå opp hash i platform_api_key
  4. Sjekk versjon (current/previous), utløp, grace period
  5. Returner: keyId, workspaceId, scopes, rate limit
  6. Oppdater last_used_at
```

### 13.3 HSTS & Headers

Caddy setter:

- `Strict-Transport-Security: max-age=31536000`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` (blokkerer mikrofon/kamera/geo i iframe)
- `-Server` (fjerner server-header)

---

## 14. Infrastruktur

### 14.1 Deploy-topologi

```
Vercel ←── apps/web (Dashboard)
Vercel ←── apps/landing (Landingsside)
DO Droplet ←── Docker Compose:
  ├── Caddy (reverse proxy, auto-HTTPS)
  ├── Stage Engine (:5010)
  ├── Shift MCP (:5011)
  ├── Contract Service (:5012)
  ├── Scrapling (:8000)
  └── n8n (:5678, definert men ikke aktivt brukt)
Supabase Cloud ←── Database + Auth + Storage + Edge Functions
```

### 14.2 CI/CD

```
GitHub Actions → ci.yml:
  ├── lint (pnpm lint)
  ├── typecheck (pnpm typecheck)
  ├── format (pnpm format:check)
  ├── build-health (turbo build + artifact)
  ├── docker-build (4 Docker images parallelt)
  ├── build (web + landing)
  └── verify (type-check exports)

Vercel: auto-deploy på push til development/main
DO: manuell deploy via infra/scripts/deploy.sh
```

### 14.3 Hemmeligheter

```
1Password CLI:
  op run --env-file=.env.template -- pnpm dev

.env.template = single source of truth (119 variabler)
Aldri .env.local
```

---

## 15. Production Readiness — Per område

### Skala: 1-5

- 1 = Ikke startet
- 2 = Prototype/stub
- 3 = Fungerer men mangler kritiske ting
- 4 = Nesten klart, mindre gaps
- 5 = Produksjonsklart

| Område                   | Score | Blokkerende gaps                                      | Estimat til 5         |
| ------------------------ | ----- | ----------------------------------------------------- | --------------------- |
| **Auth & Identity**      | 4     | Join lagrer til localStorage, ikke DB                 | 3 dager               |
| **Workspace Resolution** | 5     | —                                                     | Klart                 |
| **RLS & Sikkerhet**      | 4.5   | 19 tabeller mangler muligens RLS                      | 1 dag audit           |
| **Dashboard Shell**      | 5     | —                                                     | Klart                 |
| **Vaktplan**             | 4.5   | Minor: open shift UI polish                           | 1-2 dager             |
| **Ansatte**              | 4.5   | Minor: invite UX                                      | 1 dag                 |
| **Styringsverktøy**      | 4     | PolicyForm scope picker bug                           | 0.5 dag               |
| **Stemplingsur**         | 4     | dept_session_id kobling                               | 1-2 dager             |
| **Sesongplan**           | 4.5   | Ingen daglig target-propagering UI                    | 1 dag                 |
| **HMS**                  | 3.5   | Noen sider er shells                                  | 1 uke                 |
| **Innstillinger**        | 3     | 5 placeholder-tabs                                    | 1-2 uker              |
| **Rapporter**            | 3     | Spørringer stubbet                                    | 1 uke                 |
| **Avstemming**           | 4     | Minor UI polish                                       | 1-2 dager             |
| **Operasjoner**          | 4.5   | Live dashboard fungerer                               | Minor polish          |
| **Chat**                 | 3.5   | Shell eksisterer, realtime delvis                     | 1 uke                 |
| **Handbook**             | 4     | Mangler RAG pipeline                                  | 2-3 dager             |
| **Cascade D1-D6**        | 3.5   | D5 feil rater, C1-C4 mangler runtime                  | 3-6 uker              |
| **Event Engine**         | 3.5   | send_notification stub, seedede prosesser ikke testet | 2-3 uker              |
| **Telemetry**            | 4.5   | 178 events, 4 destinations fungerer                   | Notifications mangler |
| **Landing**              | 4.5   | Minor: OG tags, variant-opprydding                    | 1-2 dager             |
| **Mobilapp**             | 3     | Ingen admin, push ikke koblet, ikke i butikk          | 4-8 uker              |
| **i18n**                 | 1.5   | 92% hardkodet, 6 stub-språk                           | 2-4 uker              |
| **Tester**               | 1.5   | Nesten null dekning                                   | 2-4 uker for basic    |
| **Design Tokens**        | 3     | tokens.ts/css mismatch, hardkodede farger             | 1 uke                 |
| **API Gateway**          | 4.5   | 23 ruter, dual-auth, rate limiting                    | Minor docs            |
| **Services**             | 4     | Alle kjører, health checks                            | Minor hardening       |
| **Infrastruktur**        | 4     | CI/CD, Docker, Caddy                                  | Monitoring mangler    |

---

## 16. Komplett Gap-analyse

### Tier 1 — Blokkerer lansering

| #   | Gap                                     | Område     | Alvorlighet | Estimat  | Detaljer                                                                                                                                                                                              |
| --- | --------------------------------------- | ---------- | ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ~~Join wizard lagrer til localStorage~~ | Auth       | RETTET      | —        | Deep-dive viste at `completeSignup()` faktisk skriver til DB via `provision_onboarding_workspace()` RPC. Workspace opprettes i DB med `contract_status='onboarding'`. Opprinnelig vurdering var feil. |
| 2   | hospitality.ts feil tariffrater         | Cascade D5 | KRITISK     | 1 dag    | Kveldstillegg 56→15.65, helgetillegg 56→29.74, helligdag 133%→100%                                                                                                                                    |
| 3   | tokens.ts/css mismatch                  | Design     | HØY         | 1 dag    | 7+ surface-farger avviker mellom kilde og CSS                                                                                                                                                         |
| 4   | send_notification STUB                  | Engine     | HØY         | 3 dager  | Action handler gjør ingenting. Del av notifikasjonssystem                                                                                                                                             |
| 5   | Mobilapp ikke i butikk                  | Mobile     | HØY         | 2 uker   | TestFlight + Google Play registrering + review                                                                                                                                                        |
| 6   | 6 stub-språk krasjer UI                 | i18n       | HØY         | 0.5 dag  | Fjern fra config ELLER legg til fallback-kjede                                                                                                                                                        |
| 7   | Null testdekning                        | Kvalitet   | HØY         | 2-4 uker | E2E tester for kritiske flyter minimum                                                                                                                                                                |
| 8   | Cascade migrasjoner ikke validert       | Database   | HØY         | 0.5 dag  | Kjør supabase db reset                                                                                                                                                                                |

### Tier 2 — Viktig for brukeropplevelse

| #   | Gap                             | Område    | Estimat   |
| --- | ------------------------------- | --------- | --------- |
| 9   | 5 placeholder innstillingstabs  | Dashboard | 1-2 uker  |
| 10  | Rapportspørringer stubbet       | Dashboard | 1 uke     |
| 11  | C1 EWMA kalibrering             | Cascade   | 3-5 dager |
| 12  | C4 change proposal apply        | Cascade   | 3 dager   |
| 13  | Push-notifikasjoner ikke koblet | Mobile    | 2-3 dager |
| 14  | Handbook → RAG pipeline         | K1b       | 2-3 dager |
| 15  | Shift publish → Session E2E     | D6        | 1-2 dager |
| 16  | 30+ filer med hardkodede farger | Design    | 1 uke     |
| 17  | Mobile admin-skjermer mangler   | Mobile    | 4-6 uker  |
| 18  | i18n dashboard-ekstraksjon      | i18n      | 1-2 uker  |

### Tier 3 — Plattformmodenhet

| #   | Gap                            | Område  | Estimat   |
| --- | ------------------------------ | ------- | --------- |
| 19  | D2 resource resolver           | Cascade | 3-5 dager |
| 20  | C3 cost pipeline               | Cascade | 2-3 dager |
| 21  | Phase D adapters (Tripletex)   | Cascade | 2-4 uker  |
| 22  | OpenAPI docs for workspace-api | API     | 1 uke     |
| 23  | Centralized motion tokens      | Design  | 1 dag     |
| 24  | Sentry alerting                | Infra   | 1 dag     |
| 25  | Missing journey docs (5)       | Docs    | 2-3 dager |
| 26  | Mobile trening/opplæring       | Mobile  | 1-2 uker  |
| 27  | Oversettelse sv/da/pl          | i18n    | 2-4 uker  |
| 28  | README for packages            | Docs    | 1 uke     |

### Deep-dive korreksjoner

Etter deep-dive ble Gap #1 (Join wizard localStorage) fjernet — `completeSignup()` skriver faktisk til DB via `provision_onboarding_workspace()` RPC.

**Nye funn fra deep-dive:**

| Funn                                                 | Kilde          | Konsekvens                                          |
| ---------------------------------------------------- | -------------- | --------------------------------------------------- |
| ActivityView heatmap bruker MOCK-data                | deep-dashboard | Viser generert data, ikke ekte DB-data              |
| StrategicView har 2 KPI-stubs                        | deep-dashboard | "Task Completion" og "Time-to-Ready" er placeholder |
| ReconciliationView "Approve Day" er kun visuell      | deep-dashboard | Skriver ikke til DB                                 |
| Stage Engine guardian evaluator hvert 30s            | deep-services  | Mer produksjonsklart enn antatt                     |
| Bootstrap cascade 10-steg, idempotent, resumable     | deep-cascade   | Mer robust enn antatt                               |
| Pricing: Free 0kr, Premium 995kr/mnd, Pro 2500kr/mnd | deep-landing   | Bekreftet                                           |
| Mobile offline sync med SQLite kø + SyncWorker       | deep-mobile    | Mer sofistikert enn antatt                          |

### Samlet estimat til MVP-lansering

**Tier 1 (blokkerende):** ~3-4 uker (redusert etter korreksjon)
**Tier 2 (viktig):** ~6-8 uker (kan parallelliseres)
**Tier 3 (modenhet):** ~8-12 uker (lopende)

**Kritisk bane:** Fix tariffrates (1d) → Fix tokens (1d) → Fix stub-sprak (0.5d) → Validere migrasjoner (0.5d) → E2E tester (2w) → Mobilapp i butikk (2w) → **~3-4 uker**

---

_Generert av Claude Opus 4.6 (1M context) den 2026-03-24._
_7 deep-dive agenter + direkte kodelesing av 50+ nøkkelfiler._
_Oppdateres etter hvert som agentresultater kommer inn._
