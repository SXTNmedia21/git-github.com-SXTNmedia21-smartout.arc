# INVESTOR-RESEARCH.md — Smartout.ai

> Grundig gjennomgang av hele kodebasen for investorpresentasjon.
> Generert: 2026-03-27 | Kilde: Komplett kodebase-analyse

---

## 1. Produktoversikt

### Hva er Smartout?

Smartout er et **Employee Readiness System** for skiftbaserte virksomheter i Norge (restauranter, hoteller, kafeer, barer). Plattformen måler og sikrer at ansatte er "klare" — definert som at alle tildelte policyer er lært og alle protokoller er fullført (kunnskapstester bestått, prosedyrer trent, bekreftelser signert). Produktet erstatter en Bubble.io-prototype og er bygget med moderne tech stack, live Stripe-billing og DocuSign-kontrakter.

**Kjerneproblemet:** ~75% årlig turnover i norsk serviceindustri. Kostnad per nyansatt: ~$2,305 (timeansatt) / ~$16,770 (daglig leder). 88% av operatører rapporterer økte lønnskostnader. 27% bruker fortsatt papir/whiteboard for vaktplanlegging.

**Unik differensiering:**

- **Readiness Score** — måler ansattberedskap som førsteklasses metrikk (unikt i markedet)
- **Governance-modell** — Policy → Protokoll → Prosedyre håndhevingskjede
- **Norsk-først** — bygget for norsk arbeidslov, HACCP, A-melding, Riksavtalen
- **AI-native** — 6 stemmeagenter, 11 kapabiliteter, ikke boltet-på
- **Sesongkonsept** — operasjonelle tidsperioder med gamification og budsjettplanlegging
- **Alt-i-ett** — vaktplan + drift + opplæring + compliance i én plattform

### Moduler og features

| #   | Modul                           | Status              | Beskrivelse                                                                         |
| --- | ------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| 1   | Onboarding & Brukerregistrering | **Live**            | 15-stegs wizard, invitasjonssystem (batch/single, e-post/SMS/lenke), AI stemmeguide |
| 2   | Organisasjonsstruktur           | **Live**            | Avdelinger, lokasjoner, soner, utstyr, team, posisjoner                             |
| 3   | Vaktplanlegging                 | **Live**            | Skiftplanlegging, kalender, bemanning, åpne vakter, maler, supplement-håndtering    |
| 4   | Drift & Oppgavestyring          | **Live**            | Driftsøkter med livssyklus, session hooks, oppgaver, gamification, sign-off         |
| 4.5 | Daglig Sättelfunksjon           | **Under utvikling** | AI-drevet daglig oppgjør: bildefangst fra POS, OCR, kryss-validering, godkjenning   |
| 5   | HACCP & Matsikkerhet            | **Live**            | Kontrollpunkter, temperaturlogging, Mattilsynet-compliance, CCP-styring             |
| 6   | Opplæring & Kompetanse          | **Live**            | Protokolltildeling, kunnskapstester med spaced repetition, bekreftelsessignaturer   |
| 7   | Fravær & Permisjon              | **Planlagt**        | Ferie, sykefravær (spesifikasjon pågår)                                             |
| 8   | Lønn & Økonomi                  | **Under utvikling** | Lønnskjøring, tillegg, overtid, tariffbasert beregning, Riksavtalen-compliance      |
| 9   | Kommunikasjon                   | **Live**            | Chatkanaler, varsler, kunngjøringer, push, SMS, e-post                              |
| 10  | Rapporter & Dashboard           | **Planlagt**        | KPI-analyse, avviksrapportering, daglig avstemming                                  |
| 11  | Innstillinger                   | **Planlagt**        | Workspace-konfigurasjon, modulaktivering, GDPR                                      |
| 12  | AI-Laget (Mr. Botsson)          | **Live**            | AI-assistent med stemme (Ultravox), chat, RAG, agentpersonligheter                  |
| 13  | Multi-Tenant & Skalering        | **Live**            | RLS-basert isolasjon, workspace-arkitektur, Stripe-billing                          |
| 14  | Produksjon & Meny               | **Live**            | Ingredienser, oppskrifter, retter, produksjonsplanlegging                           |
| 15  | Sesongplanlegging & Budsjett    | **Live**            | Sesongstyring, budsjettering, dagfaktorer, timefaktorer, inntektsprognoser          |
| 17  | Plattformadministrasjon         | **Live**            | Super-admin backoffice, workspace-styring, CMS, kontrakter, audit                   |
| 18  | WebRTC Voice & Video            | **Live**            | LiveKit-basert sanntidstale/video, push-to-talk, SIP                                |
| 19  | Meny & Produksjonssystem        | **Planlagt**        | Produksjons-OS for kjøkken, matkostregnskap, AI-optimalisering                      |
| 20  | Lager & Forsyningskjede         | **Planlagt**        | Lukket lagersløyfe: bestilling → mottak → lagring → produksjon → service → svinn    |

**Filreferanser:** `docs/modules/SMARTOUT_MODULE_*.md` (23 moduldokumenter)

### Tech Stack

| Lag              | Teknologi                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| Frontend (Web)   | Next.js 16.1.6, React 19.2, TypeScript (strict), Tailwind v4, shadcn/ui   |
| Frontend (Mobil) | React Native + Expo                                                       |
| Backend          | Supabase (PostgreSQL 17, Auth, Storage, Edge Functions — 44 funksjoner)   |
| AI/LLM           | Vercel AI SDK 6.0, Claude Sonnet 4 via OpenRouter, text-embedding-3-small |
| Stemme-AI        | Ultravox (5 stemmemisjoner), LiveKit (WebRTC)                             |
| Integrasjoner    | Stripe (billing), DocuSeal (kontrakter), SendGrid (e-post), Twilio (SMS)  |
| Observerbarhet   | PostHog EU (analytics), Sentry (feilsporing), egendefinert telemetri      |
| Hosting          | Vercel (web + landing), Supabase Cloud (backend), DigitalOcean (n8n)      |
| Infrastruktur    | Docker Compose + Caddy, Upstash Redis (rate limiting)                     |
| Monorepo         | pnpm 9.15 + Turborepo, 19 packages, 5 microservices                       |
| Video            | Remotion (videogenerering)                                                |

---

## 2. AI-kapasitet

### Overordnet AI-arkitektur

Smartout har et omfattende AI-system med **103 TypeScript-filer** i `packages/ai/` og **38 filer** i `services/stage-engine/`. Alt ruter gjennom OpenRouter med Claude Sonnet 4 som primærmodell.

**Filreferanser:**

- `packages/ai/` — kjerne-AI-pakke
- `services/stage-engine/` — AI-runtime og session-håndtering
- `packages/walkAi/` — WalkAi-klient og misjonsrunner
- `packages/agent-sdk/` — React hooks, providers, komponenter for agent-UI

### Hva gjør AI-en konkret?

| Funksjon                     | Beskrivelse                                                                   | Hvor                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Intensjonsklassifisering** | Klassifiserer brukermeldinger i 11 kapabiliteter med konfidenspoeng (0.0-1.0) | `packages/ai/src/router/intent-classifier.ts`            |
| **Verktøyvalg**              | Dynamisk verktøyvalg basert på intensjon + workspace authority level          | `packages/ai/src/router/tool-selector.ts`                |
| **RAG-pipeline**             | Vektor-søk i platformdokumenter og workspace-spesifikke dokumenter            | `packages/ai/src/tools/docs.ts`, `workspace-docs.ts`     |
| **Embedding-generering**     | 1536-dimensjonale vektorer for semantisk søk                                  | `packages/ai/src/embedding.ts`                           |
| **Stemmeonboarding**         | AI-drevet stemmeguide som intervjuer nye kunder under oppsett                 | Ultravox misjon `onboarding-interview`                   |
| **Kontraktredigering**       | AI-assistert kontraktredigering, validering og forhåndsvisning                | `packages/ai/src/agents/contract.ts`                     |
| **Rapportgenerering**        | AI-genererte rapporter og konfigurasjon                                       | `packages/ai/src/agents/reports.ts`                      |
| **Vaktplanassistent**        | AI-hjelp med skiftplanlegging via MCP-klient                                  | `packages/ai/src/agents/schedule.ts`                     |
| **Personlighetsmotor**       | Dynamisk personlighet basert på formalitet, varme, humor, relasjonshistorikk  | `packages/ai/src/prompts/mr-botsson.ts`                  |
| **Minnehåndtering**          | Vedvarende minner (preferanser, fakta, sammendrag) med pgvector               | `engine_memory` tabell                                   |
| **Guardian-evaluering**      | Workspace-helsescoring og proaktive varsler                                   | `services/stage-engine/src/core/guardian-evaluator.ts`   |
| **Relasjonsforvaltning**     | Sporer interaksjonshistorikk og tilpasser adferd                              | `services/stage-engine/src/core/relationship-manager.ts` |

### Stemmeagenter (Ultravox-misjoner)

| Misjon                 | Navn            | Formål                                                | Stemme | Varighet |
| ---------------------- | --------------- | ----------------------------------------------------- | ------ | -------- |
| `onboarding-interview` | Botsson         | Stemmeguide under onboarding-wizard                   | Mark   | 30 min   |
| `landing-demo`         | Lise            | Landing page-ambassadør, demonstrerer produktet       | Custom | 10 min   |
| `mr-botsson`           | Mr. Botsson     | Workspace AI-assistent i dashboardet                  | Mark   | —        |
| `haccp-inspector`      | HACCP Inspector | Matsikkerhetsguide med strenge temperaturregler       | Sarah  | —        |
| `shift-assistant`      | Shift Assistant | Vaktplanassistent med direkte verktøytilgang          | —      | —        |
| `walkai-session`       | Fritt           | Fleksibelt stemme-session uten hardkodet personlighet | —      | —        |

**Filreferanse:** `packages/ai/src/missions/registry.ts`, `packages/ai/src/missions/ultravox.ts`

### 11 AI-kapabiliteter

| Kapabilitet     | Beskrivelse                           |
| --------------- | ------------------------------------- |
| `knowledge`     | Selskapspolicyer og FAQ               |
| `schedule`      | Skiftforespørsler og byttinger        |
| `training`      | Protokolltildelinger og tester        |
| `operations`    | Driftsøkter, sjekklister, rutiner     |
| `profile`       | Ansattinfo, teammedlemskap            |
| `communication` | Meldinger og varsler                  |
| `memory`        | Samtalehistorikk                      |
| `payroll`       | Lønn, overtid, utbetalinger           |
| `ui`            | Skjermnavigasjon, skjemautfylling     |
| `guardian`      | Workspace-helse, beredskapsvarslinger |
| `general`       | Fallback (hilsener, uklar intensjon)  |

**Authority-nivåer per kapabilitet:** autonomous, confirm, suggest, read_only, disabled
**Filreferanse:** `packages/ai/src/capabilities/`

### Modeller i bruk

| Modell                          | Bruk                                                                | Leverandør |
| ------------------------------- | ------------------------------------------------------------------- | ---------- |
| `anthropic/claude-sonnet-4`     | Alle AI-agenter (intensjon, kontrakter, rapporter, skift, journeys) | OpenRouter |
| `openai/text-embedding-3-small` | Vektor-embeddings (1536 dim) for RAG og minnehåndtering             | OpenRouter |

### "Fabrikken"

"Fabrikken" er en **landing page** (slug: `fabrikken` i `landing_config`-tabellen), ikke en separat AI-komponent. Det er en markedsføringsside som fremhever Smartouts automatiseringsfunksjoner.

**Filreferanse:** `docs/modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md`

---

## 3. Arkitektur & Skalerbarhet

### Database-struktur

| Metrikk                | Verdi                                                      |
| ---------------------- | ---------------------------------------------------------- |
| Totalt antall tabeller | 215+ (178 public + 23 payroll + 13 websites + 1 timesheet) |
| Enums                  | 124                                                        |
| Migrasjoner            | 210 SQL-filer, ~23,763 linjer                              |
| RLS-policyer           | 294+                                                       |
| pgvector-tabeller      | 2 (engine_memory, workspace_doc_chunk)                     |

**Hoveddomener:**

| Domene         | Nøkkeltabeller                                                                       | Formål                             |
| -------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| Identitet      | user_identity, company, company_member                                               | Global bruker- og selskapsregister |
| Workspace      | workspace, profile, invitation                                                       | Multi-tenant logisk separasjon     |
| Struktur       | department, location, team, zone, asset, position                                    | Organisasjonslayout                |
| Governance     | policy, protocol, procedure, routine, runbook, control_list, knowledge_test          | Compliance og opplæring            |
| Ferdigstilling | knowledge_test_attempt, confirmation_signature, procedure_step_completion            | Læringsframgang                    |
| Vaktplan       | schedule_shift, season, season_budget, day_factor, hour_factor                       | Skiftplanlegging og budsjettering  |
| Drift          | department_session, session_task, daily_reconciliation, deviation                    | Daglige operasjoner                |
| AI/Agent       | engine_memory, engine_authority_config, engine_process, engine_state, engine_trigger | Autonom AI-beslutning og læring    |
| Kontrakt       | contract_template, contract, contract_event, contract_reminder                       | E-signatur og kontraktlivssyklus   |
| Kommunikasjon  | communication_log, notification_outbox, notification_preference                      | Flerkanalsvarsling                 |

**Cascade-arkitektur (6 dimensjoner + 4 kontrollplan):**

| ID  | Dimensjon                   | Formål                              |
| --- | --------------------------- | ----------------------------------- |
| D1  | Operational Envelope        | Når/hvor/med hvilken kapasitet?     |
| D2  | Resource Availability       | Hvem er tilgjengelig?               |
| D3  | Rules & Constraints         | Hva er tillatt/påkrevd/forbudt?     |
| D4  | Demand Signal               | Hvor mye aktivitet å forberede for? |
| D5  | Service Concept             | Hva slags drift er dette?           |
| D6  | Production & Product        | Hva produseres, hva er tilstanden?  |
| C1  | Observability & Calibration | Plan vs. faktisk → korreksjon       |
| C2  | Context & Interaction       | Hva er relevant, hvordan forklare?  |
| C3  | Commercial & Outcome        | Hva er verdien, hva koster det?     |
| C4  | Policy & Governance         | Hva har systemet lov til å gjøre?   |

**Filreferanser:**

- `docs/reference/DATABASE.md` — komplett skjemareferanse
- `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` — cascade-spesifikasjon
- `supabase/migrations/` — alle migrasjoner

### API-endepunkter

**44 Supabase Edge Functions:**

| Funksjon                        | Formål                                       |
| ------------------------------- | -------------------------------------------- |
| `workspace-api`                 | Hoved-API gateway med 23 REST-endepunkter    |
| `engine-dispatch`               | Event Engine: trigger-matching, steg-kjøring |
| `accept-invitation`             | Prosesserer invitasjoner, oppretter profiler |
| `activate-workspace`            | Workspace-aktiveringsflyt                    |
| `analyze-workspace`             | Workspace-analyse                            |
| `call-command`                  | Samtaleorkistrering (start + svar)           |
| `contract-lifecycle`            | Kontraktlivssyklus-maskin                    |
| `create-invitation`             | Oppretter workspace-invitasjoner             |
| `extract-workspace-data`        | Dataekstraksjon                              |
| `finalize-workspace`            | Ferdigstiller workspace-oppsett              |
| `fire-delayed-triggers`         | Cron: poller forsinkede triggere             |
| `gather-workspace-intelligence` | Intelligence-innhenting                      |
| `guardian-sweep`                | Proaktiv overvåking                          |
| `guardian-notify`               | Guardian-varsler                             |
| `livekit-token`                 | LiveKit-token for sanntidstale               |
| `livekit-webhook`               | LiveKit webhook-mottaker                     |
| `health-check`                  | Helsesjekk                                   |
| `scrape-raw-data`               | Webskraping                                  |
| `sendgrid-webhook`              | E-posthendelser                              |
| `shift-lateness-check`          | Forsinkelsessjekk for skift                  |
| `validate-api-key`              | API-nøkkelvalidering                         |
| `watchdog-integrity`            | Dataintegritet                               |
| `watchdog-uptime`               | Oppetidsovervåking                           |
| `web-search-intelligence`       | Websøk for intelligence                      |
| `analyze-setup-documents`       | Dokumentanalyse                              |
| `google-places-intelligence`    | Google Places-data                           |
| `process-notifications`         | Varselprosessering                           |
| `cleanup-api-keys`              | Nøkkelopprydding                             |

**Workspace API (23 REST-endepunkter):**
Profiles, Departments, Teams, Locations, Contracts, Protocols, Assignments, Shifts, Absences, Sessions, Deviations, Reconciliations, Shift Approvals, KPI Targets, Budgets, Signals, Guardian Logs, Events, Suppliers, Waste Logs, Assets, Asset Maintenance, Asset Downtime

**Next.js API Routes (apps/web):**

- AI-agenter: `/api/onboarding-agent`, `/api/contract-agent`
- Kontekst: `/api/context/bootstrap`, `/api/search`
- LiveKit: `/api/channels/[id]/call/*` (start, token, respond, status, history)
- Webhooks: `/api/webhooks/docuseal`
- Platform Admin: 15+ endepunkter for bruker-, innholds- og kommunikasjonsstyring
- Telemetri: `/api/telemetry`
- Helse: `/api/health`

**Filreferanse:** `docs/reference/ROUTES.md`

### Autentisering og sikkerhet

**Tre ufravikelige lover:**

1. Aldri klarteksthemmeligheter i kode, konfig, logger eller DB-kolonner
2. Aldri bypass RLS for bekvemmelighet
3. Aldri commit hemmeligheter til Git

**Dual-auth-mønster:**

- **JWT-bane** (brukersesjoner): RLS via `auth.uid()` + hjelpefunksjoner
- **API-nøkkelbane** (eksterne integrasjoner): RLS via `current_setting('app.workspace_id')::uuid`

**API-nøkkelsystem:**

| Tier   | Type                   | Lagring                   | Prefiks                         |
| ------ | ---------------------- | ------------------------- | ------------------------------- |
| Tier 1 | Workspace API-nøkler   | SHA-256 hash              | `smo_sk_live_` / `smo_sk_test_` |
| Tier 2 | Eksterne hemmeligheter | Supabase Vault (pgsodium) | Leverandørspesifikt             |
| Tier 3 | Service-til-service    | SHA-256 hash              | `smo_svc_live_`                 |

**Rate limiting:** 30-1000 req/min avhengig av abonnementsnivå (Upstash Redis)

**Filreferanser:** `docs/protocols/SECURITY.md`, `docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md`

### Multi-tenant arkitektur

```
Bruker (global) → Selskap (global) → Workspace (per lokasjon/enhet) → Profil (bruker + rolle i workspace) → All operasjonell data (workspace_id scope)
```

- **Alle** workspace-scopede tabeller har `workspace_id` + indeksert + RLS-policy
- Workspace A-brukere/nøkler kan **aldri** aksessere Workspace B-data (håndhevet på DB-nivå)
- Test API-nøkler blokkert i produksjon (miljøsjekk i workspace-api)
- Transaction-local `SET LOCAL` for connection pooling-sikkerhet

### Microservices (5 tjenester)

| Tjeneste         | Stack                         | Port | Formål                                           |
| ---------------- | ----------------------------- | ---- | ------------------------------------------------ |
| Stage Engine     | TypeScript, Hono, AI SDK      | 5010 | Universell AI-gateway (stemme, tekst, WebSocket) |
| Shift MCP        | TypeScript, Hono, MCP         | 5011 | Skiftplanlegging via Model Context Protocol      |
| Contract Service | TypeScript, Fastify, DocuSeal | 5012 | Kontraktlivssyklus og e-signatur                 |
| Interview MCP    | TypeScript                    | —    | Stemmeagent-orkistrering (Ultravox)              |
| Scrapling        | Python 3                      | 8000 | Dataekstraksjon og dokumentparsing               |

**Filreferanse:** `services/`

---

## 4. Landing Pages & Personas

### Sider og struktur

**Hovedsider:**

| Rute            | Formål                                           |
| --------------- | ------------------------------------------------ |
| `/`             | Hjemmeside — workspace analyzer, features, CTAer |
| `/pricing`      | Prisplaner og funksjonssammenligning             |
| `/om-oss`       | Om selskapet                                     |
| `/blog`         | Innhold og thought leadership                    |
| `/waitlist`     | Tidlig tilgang-påmelding                         |
| `/free-forever` | Gratis-for-alltid tilbud                         |
| `/compare`      | Sammenligning med konkurrenter                   |

**Feature-sider:**

| Rute                                | Feature                       |
| ----------------------------------- | ----------------------------- |
| `/features/shiftplanner`            | AI-drevet vaktplanlegging     |
| `/features/punchclock-timetracking` | Stempling og tidsregistrering |
| `/features/staff-training`          | Opplæring og kompetanse       |
| `/features/task-rutines`            | Oppgavestyring og rutiner     |
| `/features/haccp-complience`        | HACCP-compliance              |
| `/features/communications`          | Teamkommunikasjon             |

**Konseptsider:**

| Rute                      | Konsept            |
| ------------------------- | ------------------ |
| `/concepts/seasons`       | Sesongplanlegging  |
| `/concepts/lokations`     | Flerlokasjonsdrift |
| `/concepts/procedures`    | Prosedyrestyring   |
| `/concepts/daily-session` | Daglig driftsøkt   |

**Dokumentasjonsportal (`/docs`):**

- Kom i gang, Onboarding, Ansatte, Vaktplan, Oppgaver & Rutiner, HACCP, Kommunikasjon, Rapporter, AI-assistent, Innstillinger, API

### Personas og konverteringsflyt

| Persona           | Plattform     | Smertepoeng                                   | Konverteringssti                                          |
| ----------------- | ------------- | --------------------------------------------- | --------------------------------------------------------- |
| Eier/Admin        | Desktop (90%) | Oppsett, governance, oversikt, lønnskostnader | Landing → Waitlist/Signup → Onboarding wizard → Dashboard |
| Manager/Teamleder | Begge (50/50) | Planlegging, daglig drift, reviewing          | Landing → Feature-sider → Signup → Dashboard              |
| Ansatt            | Mobil (95%)   | Vite hva som skal gjøres nå                   | Invitasjon → App → My Schedule/Training                   |
| Trainee           | Mobil (90%)   | Lære systemet trygt før første vakt           | Invitasjon → App → Trainee-modus                          |

**CMS-system:** Block-basert builder i Platform Admin (ADR-0046). `landing_config` + `landing_config_version` tabeller med versjonshåndtering og publiseringsflyt.

**Filreferanser:** `apps/landing/src/app/`, `docs/modules/SMARTOUT_MODULE_17_PLATFORM_ADMIN.md`

---

## 5. Integrasjoner

| Tjeneste          | Bruk                             | Status                             | Filreferanse                                                                             |
| ----------------- | -------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| **Stripe**        | Abonnementsfakturering, planvalg | Live (API-only via Edge Functions) | `packages/types/src/identity.ts` (subscription_plan, subscription_status, trial_ends_at) |
| **DocuSeal**      | Kontraktsignering, e-signatur    | Live                               | `apps/web/src/app/api/webhooks/docuseal/route.ts`, `@docuseal/react` v1.0.71             |
| **SendGrid**      | E-postlevering, hendelsesporing  | Live                               | `supabase/functions/sendgrid-webhook/`, `@sendgrid/mail` v8.1.0                          |
| **Twilio**        | SMS-varsler                      | Live (begrenset)                   | `supabase/functions/_shared/twilio.ts`, `twilio` v5.5.0                                  |
| **Ultravox**      | Stemme-AI for 5 misjoner         | Live                               | `packages/ai/src/missions/ultravox.ts`                                                   |
| **LiveKit**       | WebRTC sanntidstale/video        | Live                               | `supabase/functions/livekit-token/`, `livekit-client` v2.17.3                            |
| **PostHog**       | Produktanalyse (EU-instans)      | Live                               | `packages/telemetry/src/providers/posthog.ts`                                            |
| **Sentry**        | Feilsporing og ytelsesovervåking | Live                               | `apps/web/sentry.client.config.ts` (10% sample rate)                                     |
| **Upstash Redis** | Rate limiting og caching         | Live                               | `@upstash/ratelimit` v2.0.8                                                              |
| **OpenRouter**    | LLM-routing (Claude Sonnet 4)    | Live                               | `@openrouter/ai-sdk-provider` v2.2.3                                                     |
| **Remotion**      | Videogenerering og animasjon     | Integrert                          | `@remotion/*` v4.0.428+                                                                  |
| **n8n**           | Workflow-automatisering          | Satt opp (DigitalOcean)            | Ekstern tjeneste                                                                         |
| **1Password**     | Hemmelighetsstyring (op://)      | Live                               | `.env.template` med op://-referanser                                                     |

### Betalingsflyt

- **Abonnementsmodell:** Felter på `company`-tabellen: `subscription_plan`, `subscription_status`, `trial_ends_at`, `billing_email`
- **Stripe-integrasjon:** API-only via Edge Functions (ingen klient-SDK)
- **Free Forever:** Egen landing page for gratis-for-alltid tilbud (`/free-forever`)
- **Prissider:** `/pricing` og `/compare` for plansammenligning

### E-postflyt

- **SendGrid** for transaksjonelle e-poster (invitasjoner, varsler, påminnelser)
- **Webhook-integrasjon** sporer: åpninger, klikk, bounces, avmeldinger, spam-rapporter
- **Hendelser** lagres i `platform_communication_recipient` og `platform_email_suppression`

---

## 6. Roadmap & Status

### Aktive utviklingsbrancher

| Branch                         | Status           | Beskrivelse                                         |
| ------------------------------ | ---------------- | --------------------------------------------------- |
| `feat/cascade-task-surface`    | Klar for lukking | Cascade-oppgaveoverflate, alle quality gates grønne |
| `feat/emma-arena-views`        | Under arbeid     | Spesifikasjon + innstillingspersistens definert     |
| `feat/landing-token-migration` | Trenger arbeid   | 12 commits, blokker/demo/footer ikke migrert        |
| `feat/sjohuset-simulator`      | Parkert          | 10 commits, divergert fra PR                        |
| `feat/production-gaps-tier1`   | Klar for lukking | Produksjonsgap-fiks, alle gates grønne              |
| `feat/setup-flow-redesign`     | Klar for lukking | Oppsettsflyt redesignet, alle gates grønne          |

**Filreferanse:** `docs/STATE.md`, `docs/DASHBOARD.md`

### Teknisk gjeld (TODO/FIXME/HACK)

| Type       | Antall    | Andel |
| ---------- | --------- | ----- |
| TODO       | 2,683     | 96.8% |
| FIXME      | 89        | 3.2%  |
| HACK       | 4         | 0.1%  |
| **Totalt** | **2,773** | 100%  |

**Mest betydningsfulle områder:**

- **Database type-generering** — Flere tjenester venter på regenerering av `database.types.ts` etter migrasjoner
- **E2E-testblokkeringer** — Validerings-skjema mismatch blokkerer join-wizard tester (steg 2-7)
- **Uferdige AI-funksjoner** — Mobil AI-panel bruker mock-data istedenfor ekte API-kall
- **i18n-migrering** — HMS-komponenter har hardkodede norske strenger
- **Dashboard-data** — Rapporter og søk bruker placeholder-data
- **Kontekstbygging** — Bootstrap-kontekst mangler rolle-, protokoll- og søkehistorikk-henting

### Beslutninger og arkitekturdokumenter

| Dokument                               | Antall | Plassering           |
| -------------------------------------- | ------ | -------------------- |
| ADR-er (Architecture Decision Records) | 63     | `docs/decisions/`    |
| Læringsnotater                         | 19     | `docs/learnings/`    |
| Moduldokumenter                        | 23     | `docs/modules/`      |
| Arkitekturdokumenter                   | Flere  | `docs/architecture/` |
| Protokoller                            | 4      | `docs/protocols/`    |

**Nøkkeldokumenter:**

- `docs/architecture/SMARTOUT_FOUNDATION_PRODUCT_IDENTITY.md` — Marked, prising, personas
- `docs/architecture/SMARTOUT_CORE_ARCHITECTURE_v2.md` — Teknisk stack, autentisering
- `docs/STATE.md` — Nåværende systemstatus, gaps, ukentlig plan

### Nøkkelavhengigheter

| Pakke                 | Versjon | Formål            |
| --------------------- | ------- | ----------------- |
| next                  | 16.1.6  | Web-framework     |
| react                 | 19.2.3  | UI-bibliotek      |
| typescript            | 5.9.3   | Typesikkerhet     |
| tailwindcss           | 4.2.1   | Styling           |
| @tanstack/react-query | 5.90.21 | Server state      |
| @tanstack/react-table | 8.21.3  | Datagrids         |
| framer-motion         | 12.34.3 | Animasjoner       |
| ai (Vercel AI SDK)    | 6.0.103 | LLM-integrasjon   |
| @supabase/supabase-js | 2.49.4  | Database-klient   |
| zod                   | 3.25.76 | Schema-validering |
| @sentry/nextjs        | 10.40.0 | Feilsporing       |
| @tiptap/\*            | 3.20.0  | Rik tekst-editor  |
| turborepo             | 2.8.11  | Monorepo-bygging  |
| pnpm                  | 9.15.9  | Pakkehåndtering   |

---

## 7. Kodekvalitet & Modenhet

### Kodebasestørrelse

| Område              | Filer            | Linjer       |
| ------------------- | ---------------- | ------------ |
| apps/web/src        | 1,061 TS/TSX     | 187,618      |
| packages/           | 518 TS/TSX       | 102,962      |
| services/           | 139 TS + Python  | 12,902       |
| supabase/functions/ | 62 TS            | 12,490       |
| **Totalt**          | **1,780 TS/TSX** | **~316,000** |

### Testdekning

| Type         | Antall        | Verktøy     | Plassering                                |
| ------------ | ------------- | ----------- | ----------------------------------------- |
| E2E-tester   | 22 spec-filer | Playwright  | `apps/e2e/tests/`                         |
| Enhetstester | 37 test-filer | Vitest/Jest | Spredd i apps/web, apps/mobile, packages/ |

**E2E-testsuiter:** Landing page, autentisering, dashboard, join/onboarding-flyter, HMS-funksjoner, journey-funksjoner, ytelses-gates, kunnskapsinntak, telemetri

**Konfigurasjon:**

- `apps/e2e/playwright.config.ts` — Playwright E2E
- `apps/web/vitest.config.ts` — Vitest for enhetstester
- `apps/mobile/jest.config.js` — Jest for React Native

### CI/CD Pipeline

**3 GitHub Actions workflows** i `.github/workflows/`:

**Hoved-CI (`ci.yml`) — 7+ parallelle jobber:**

1. **Lint** — ESLint via `pnpm lint`
2. **Type Check** — TypeScript via `pnpm typecheck`
3. **Format Check** — Prettier via `pnpm format:check`
4. **Build Health** — Kvalitetsrapport (artifact: `build-health-report.json`)
5. **API Docs Guard** — Verifiserer API-dokumentasjon
6. **Docker Build** — 4 Docker images (stage-engine, shift-mcp, contract-service, scrapling)
7. **Build** — Full monorepo-bygging med Turbo (Node 20, pnpm)
8. **Post-Build Verification** — Validerer pakkeeksporter for @smartout/{types, supabase, ui, telemetry}

**Andre workflows:**

- `claude.yml` — Claude-integrasjon
- `claude-code-review.yml` — Automatisert kode-review

### Monorepo-struktur

```
smartout.ai/
├── apps/           4 applikasjoner (web, mobile, landing, e2e)
├── packages/       19 delte biblioteker
├── services/       5 microservices
├── supabase/       210 migrasjoner, 44 Edge Functions, seed.sql
├── infra/          Docker Compose + Caddy
└── docs/           Komplett dokumentasjon (INDEX.md som masterindeks)
```

**Pakkehåndtering:** pnpm workspaces + Turborepo med caching
**Kodekvalitet:** Commitlint (conventional commits), Husky (pre-commit hooks), ESLint, Prettier, TypeScript strict mode

### Modenhetsvurdering

**Styrker:**

- Moderne monorepo med Turbo + pnpm og optimalisert caching
- Omfattende E2E-testsuite (22 tester over kritiske flyter)
- Sterk CI/CD med parallelle jobber
- God kodekvalitetshåndhevelse (typesjekking, linting, formatering)
- Modulær pakkearkitektur (19 pakker)
- Microservice-arkitektur med Docker-støtte
- 63 dokumenterte arkitekturbeslutninger (ADR-er)
- Fullstendig multi-tenant sikkerhet med RLS

**Utfordringer:**

- Høy teknisk gjeld (2,683 TODO-kommentarer)
- Blokkerte tester (join-wizard validering)
- Uferdige funksjoner i mobil-appen
- i18n-migrering ufullstendig
- Noen dashboard-sider bruker placeholder-data

**Modenhetsnivå:** **Tidlig produksjon** — Solid engineering-praksis med rask funksjonsutvikling. Kodebasen vokser raskt men har god arkitektonisk disiplin.

---

## 8. Forretningslogikk

### Prismodell

- **Per-ansatt/per-måned SaaS** med abonnementsplaner
- Felter på `company`: `subscription_plan`, `subscription_status`, `trial_ends_at`, `billing_email`
- **Free Forever-tilbud** med egen landing page og waitlist
- **Rate limiting-tiers:** 30-1000 req/min avhengig av plan
- **API-nøkkel scopes:** Ulike tilgangsnivåer per abonnementsnivå

**Filreferanse:** `packages/types/src/identity.ts`, `apps/landing/src/app/free-forever/`, `apps/landing/src/app/pricing/`

### Subscription/billing-logikk

- Stripe API-only integrasjon (ingen klient-SDK)
- Abonnementsstatus-sporing på selskapsnivå
- Prøveperiode med `trial_ends_at`
- Plattformadmin har full Stripe-synkronisering og billing-oversikt (`/platform-admin/billing`)

### Brukerroller og tilgangsnivåer

**4 workspace-roller (hierarkisk):**

| Rolle      | Tilgang                                           |
| ---------- | ------------------------------------------------- |
| `employee` | Egne data, skift, opplæring, håndbok              |
| `manager`  | Teamdata, vaktplan, driftsstyring, rapporter      |
| `admin`    | Full workspace-tilgang, governance, innstillinger |
| `owner`    | Alt + billing + workspace-sletting                |

**4 profilstatuser:**

| Status        | Betydning                                |
| ------------- | ---------------------------------------- |
| `trainee`     | Ny ansatt i opplæring, begrenset tilgang |
| `active`      | Fullt operativ ansatt                    |
| `inactive`    | Midlertidig inaktiv                      |
| `offboarding` | Under avslutning                         |

**Platform-nivå:**

- `is_godmode` på `user_identity` gir platform-admin tilgang
- Separate company member-roller: `owner`, `admin`, `member`

**Filreferanse:** `packages/types/src/enums.ts`

### Onboarding-flyt for nye kunder

**10-seksjoners wizard med AI-stemmeguide:**

1. **Welcome** — Velkomst og introduksjon
2. **Business** — Selskapsinformasjon (auto-utfylling via BRREG-oppslag)
3. **Departments** — Avdelingsoppsett
4. **Locations** — Lokasjonsdefinisjon
5. **Procedures** — Prosedyrekonfigurasjon
6. **Contract** — DocuSeal-integrasjon for kontraktsignering
7. **Season** — Sesongoppsett
8. **Done** — Ferdigstilling

**AI-integrasjon:** `useBotsson()` hook aktiverer Ultravox-misjon `onboarding-interview` — en stemmeguide som intervjuer kunden gjennom oppsettet.

**Dataflyt:** Wizard → `finalize-workspace` Edge Function → I1 Industry Intelligence Bootstrap → Workspace med alle dimensjoner seeded

**Filreferanser:**

- `apps/web/src/app/onboarding/` — Wizard-komponenter
- `apps/web/src/app/onboarding/WizardContext.tsx` — Tilstandshåndtering
- `supabase/functions/finalize-workspace/` — Backend-ferdigstilling

---

## Oppsummering for investorer

### Nøkkeltall

| Metrikk                   | Verdi                      |
| ------------------------- | -------------------------- |
| Kodebase                  | ~316,000 linjer TypeScript |
| Database-tabeller         | 215+                       |
| Edge Functions            | 44                         |
| AI-stemmeagenter          | 6                          |
| AI-kapabiliteter          | 11                         |
| Migrasjoner               | 210                        |
| ADR-er                    | 63                         |
| Moduler (live)            | 14                         |
| Moduler (under utvikling) | 2                          |
| Moduler (planlagt)        | 4                          |
| Integrasjoner             | 12+                        |
| Microservices             | 5                          |
| Packages (monorepo)       | 19                         |
| CI/CD-jobber              | 7+ parallelle              |
| E2E-tester                | 22                         |
| Enhetstester              | 37                         |

### Konkurransefordeler

1. **Eneste "Readiness Score"-plattform** — ingen konkurrenter måler ansattberedskap som førsteklasses metrikk
2. **AI-native, ikke AI-boltet** — 6 stemmeagenter, 11 kapabiliteter, RAG, personlighetsmotor
3. **Norsk-først** — bygget for Riksavtalen, HACCP, A-melding fra dag én
4. **Alt-i-ett** — erstatter 4-5 separate verktøy (vaktplan + opplæring + drift + compliance + kommunikasjon)
5. **Cascade-arkitektur** — unik 6D+4C modell for helhetlig forståelse av driftsvirkeligheten
6. **Stemmeonboarding** — AI-drevet wizard som intervjuer nye kunder (ingen konkurrenter har dette)

### Risikofaktorer

1. **Teknisk gjeld** — 2,773 TODO/FIXME-kommentarer indikerer raskt utviklingstempo
2. **Uferdige moduler** — 4 moduler er planlagt men ikke påbegynt
3. **Mobil-app** — Arkitektur på plass, men mange features mangler mobil-UI
4. **Enmannsshow** — Primært utviklet av én person med AI-assistanse
5. **i18n** — Noen komponenter har hardkodede norske strenger
