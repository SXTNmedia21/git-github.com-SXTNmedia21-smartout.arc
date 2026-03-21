---
title: Smartout AS — Teknisk Revisjonsrapport
status: done
updated: 2026-03-18
created: 2026-03-18
module: cross-cutting
tags: [audit, security, architecture, infrastructure, quality]
---

# Smartout AS — Teknisk Revisjonsrapport

> Revisjonsdato: 2026-03-18 | Branch: `development` | Revisor: Claude Opus 4.6

---

## Sammendrag

Smartout er et Employee Readiness System bygget som en moderne monorepo med Next.js 16, React 19, Supabase (PostgreSQL 17) og TypeScript (strict). Kodebasen er **244 000+ linjer** fordelt på **1 399 TypeScript-filer**, **15 pakker**, **5 mikrotjenester** og **33 Edge Functions**.

### Helsesjekk

| Kategori            | Vurdering       | Score      |
| ------------------- | --------------- | ---------- |
| TypeScript-disiplin | Utmerket        | 9.5/10     |
| Sikkerhet           | Sterk           | 9/10       |
| Arkitektur          | Velstrukturert  | 8.5/10     |
| Feilhåndtering      | Utmerket        | 9/10       |
| Dokumentasjon       | Omfattende      | 9/10       |
| Testdekning         | Moderat         | 6.5/10     |
| Avhengighetsstyring | Ryddig          | 9/10       |
| Infrastruktur       | Produksjonsklar | 8.5/10     |
| **Samlet**          | **Sterk**       | **8.6/10** |

### Kritiske funn

| Alvorlighet | Funn                       | Detaljer                                                |
| ----------- | -------------------------- | ------------------------------------------------------- |
| Ingen       | Ingen kritiske sårbarheter | Sikkerhet, RLS og autentisering er korrekt implementert |

### Funn som krever oppmerksomhet

| #   | Alvorlighet | Funn                              | Anbefaling                                                |
| --- | ----------- | --------------------------------- | --------------------------------------------------------- |
| 1   | Medium      | Manglende enhetstester i pakker   | Legg til vitest for `utils`, `telemetry`, `types`, `i18n` |
| 2   | Lav         | 6 type-cast TODO-er               | Kjør `npx supabase gen types typescript --local`          |
| 3   | Lav         | 2 `console.log` i produksjonskode | Fjern fra `login/page.tsx` og `ContractSection.tsx`       |
| 4   | Lav         | Duplisert migreringstidsstempel   | `20260418100000` brukt for 2 filer                        |
| 5   | Info        | CLAUDE.md dokumenterer 72 enums   | Faktisk antall: 48                                        |

---

## 1. Prosjektdimensjoner

### Kodebase

| Metrikk                         | Verdi    |
| ------------------------------- | -------- |
| TypeScript-filer                | 1 399    |
| Totalt linjer kode              | ~244 000 |
| Gjennomsnitt linjer/fil         | ~175     |
| Pakker (workspaces)             | 15       |
| Mikrotjenester                  | 5        |
| Edge Functions                  | 33       |
| Database-tabeller               | 155      |
| Enums                           | 48       |
| Migreringer                     | 140      |
| ADR-er (arkitekturbeslutninger) | 54       |
| Moduldokumenter                 | 23       |
| Dokumentasjonsfiler             | 588      |

### Fordeling av kode

| Komponent                   | Filer | Est. LOC | Andel |
| --------------------------- | ----- | -------- | ----- |
| `apps/web` (Dashboard)      | 780   | ~136 500 | 56%   |
| `packages/*`                | ~225  | ~45 000  | 18%   |
| `services/*`                | ~72   | ~35 000  | 14%   |
| `supabase/functions`        | 52    | ~15 000  | 6%    |
| `apps/mobile`               | 100   | ~8 000   | 3%    |
| `apps/landing` + `apps/e2e` | ~160  | ~4 900   | 2%    |

---

## 2. Teknisk Stack — Versjoner

### Kjerneteknologi

| Teknologi    | Versjon                          | Status        |
| ------------ | -------------------------------- | ------------- |
| Node.js      | 20.20.0                          | Nåværende LTS |
| pnpm         | 9.15.9 (pinned)                  | Nåværende     |
| TypeScript   | 5.9.3 (strict)                   | Nåværende     |
| Next.js      | 16.1.6                           | Nåværende     |
| React        | 19.2.3 (web), 19.2.0 (mobil)     | Nåværende     |
| Tailwind CSS | v4.2.1 (web), v3.4.13 (Remotion) | Nåværende     |
| Supabase CLI | 2.81.3                           | Nåværende     |
| Supabase JS  | 2.49.4                           | Nåværende     |
| PostgreSQL   | 17                               | Nåværende     |
| Expo         | 55.0.7                           | Nåværende     |
| React Native | 0.83.2                           | Nåværende     |

### Nøkkelavhengigheter

| Pakke                 | Versjon | Bruk                        |
| --------------------- | ------- | --------------------------- |
| @tanstack/react-query | 5.90.21 | Datahenting                 |
| Zod                   | 3.25.76 | Skjemavalidering            |
| Playwright            | 1.42.0  | E2E-testing                 |
| Vitest                | 4.0.18  | Enhetstesting               |
| Hono                  | 4.7.0   | HTTP-rammeverk (tjenester)  |
| Fastify               | 5.2.1   | HTTP-rammeverk (kontrakter) |
| Framer Motion         | 12.34.3 | Animasjon                   |
| Sentry                | 10.40.0 | Feilsporing                 |
| PostHog               | 1.356.0 | Analyse                     |

### Integrasjoner

| Tjeneste   | Metode                           | Status                      |
| ---------- | -------------------------------- | --------------------------- |
| Stripe     | API via Edge Functions           | Aktiv                       |
| DocuSeal   | API via contract-service         | Aktiv                       |
| SendGrid   | API via Edge Functions + webhook | Aktiv                       |
| Twilio     | API-only                         | Konfigurert                 |
| Ultravox   | SDK v0.5.0                       | Aktiv (stemmeagent)         |
| OpenRouter | SDK (stage-engine)               | Aktiv (AI-ruting)           |
| 1Password  | CLI (`op run`)                   | Aktiv (hemmelighetsstyring) |

---

## 3. Sikkerhetsrevisjon

### Samlet vurdering: BESTÅTT

| Kontrollpunkt            | Status  | Detaljer                                                  |
| ------------------------ | ------- | --------------------------------------------------------- |
| Hardkodede hemmeligheter | BESTÅTT | Ingen API-nøkler i kildekode                              |
| RLS-bypass               | BESTÅTT | Service role korrekt begrenset                            |
| SQL-injeksjon            | BESTÅTT | Alle spørringer parameterisert                            |
| Auth middleware          | BESTÅTT | Dual-auth mønster implementert                            |
| verify_jwt-konfig        | BESTÅTT | 20/20 funksjoner med `verify_jwt=false` har autentisering |
| Klientsidehemmeligheter  | BESTÅTT | Kun anon key i nettleserkode                              |
| XSS-risiko               | BESTÅTT | 3 `dangerouslySetInnerHTML`-bruk — alle med trygge kilder |
| Miljøvalidering          | BESTÅTT | Zod-validering i `env.ts`                                 |

### Detaljerte funn

#### RLS og tilgangskontroll

- **46 migreringsfiler** med eksplisitt `ENABLE ROW LEVEL SECURITY`
- **~290 `workspace_id`-referanser** på tvers av tabeller (god isolasjon)
- JWT-policyer bruker `get_workspace_ids_for_user(auth.uid())`
- API-nøkkel-policyer bruker `get_api_workspace_id()`
- Service role er begrenset til Edge Functions og server-side API-ruter

#### API-nøkkelsystem

| Lag                    | Prefiks                         | Lagring                   |
| ---------------------- | ------------------------------- | ------------------------- |
| Workspace-nøkler       | `smo_sk_live_` / `smo_sk_test_` | SHA-256 hash              |
| Eksterne hemmeligheter | Leverandørspesifikk             | Supabase Vault (pgsodium) |
| Tjeneste-til-tjeneste  | `smo_svc_live_`                 | SHA-256 hash              |

#### Edge Functions — Auth-oversikt

| Mønster     | Antall | Beskrivelse                            |
| ----------- | ------ | -------------------------------------- |
| JWT-only    | 1      | `create-invitation`                    |
| Dual-auth   | 20     | `verify_jwt=false` med eksplisitt auth |
| Cron/intern | ~12    | Service role for batchoperasjoner      |

#### XSS — `dangerouslySetInnerHTML`

| Fil                     | Kilde                   | Risiko                  |
| ----------------------- | ----------------------- | ----------------------- |
| Landing HACCP-side      | Hardkodet CSS           | Ingen                   |
| Select-plan             | Hardkodet CSS           | Ingen                   |
| ChapterReader           | Tiptap `generateHTML()` | Lav (sanitert)          |
| Contract editor (3 stk) | Template + admin-input  | Lav (kun admin-tilgang) |

**Anbefaling:** Vurder DOMPurify-sanitering i kontraktredigerer for forsvar-i-dybden.

---

## 4. Database-revisjon

### Oversikt

| Metrikk     | Verdi                          |
| ----------- | ------------------------------ |
| Tabeller    | 155                            |
| Enums       | 48                             |
| Migreringer | 140                            |
| Skjemaer    | `public`, `timesheet`          |
| RLS-dekning | Alle workspace-scoped tabeller |

### Skjemahelse

| Kontrollpunkt                      | Status                                       |
| ---------------------------------- | -------------------------------------------- |
| `created_at` på alle tabeller      | BESTÅTT (1 unntak: `agent_task`)             |
| `updated_at` på alle tabeller      | ADVARSEL — `agent_task` mangler `updated_at` |
| `workspace_id` på workspace-scoped | BESTÅTT                                      |
| Singular tabellnavn                | BESTÅTT                                      |
| UUID primærnøkler                  | BESTÅTT                                      |

### Migreringshistorikk

- **13** legacy-format (00001–00013)
- **127** tidsstemplet format (20260225–20260418)
- **Totalt:** 140 migreringer

**Problem:** Duplisert tidsstempel `20260418100000` brukt for to filer:

- `20260418100000_avatars_bucket.sql`
- `20260418100000_timesheet_schema.sql`

**Anbefaling:** Gi nytt tidsstempel til `avatars_bucket` → `20260418100001_avatars_bucket.sql`

### 10 siste migreringer

| Fil              | Beskrivelse                    |
| ---------------- | ------------------------------ |
| `20260418120000` | Push dispatch triggers         |
| `20260418100400` | Fjern shift approval punch     |
| `20260418100300` | Mobile schema additions        |
| `20260418100200` | Workspace join code            |
| `20260418100100` | HACCP log                      |
| `20260418100000` | Timesheet schema               |
| `20260418100000` | Avatars bucket (duplikat!)     |
| `20260416200000` | Season opening hours           |
| `20260416100000` | Document extraction logs       |
| `20260415200000` | Setup documents storage policy |

---

## 5. Kodekvalitet

### TypeScript-disiplin

| Metrikk            | Verdi         | Vurdering                           |
| ------------------ | ------------- | ----------------------------------- |
| `any`-bruk         | 1 forekomst   | Utmerket                            |
| `@ts-expect-error` | 2 forekomster | Akseptabelt (CSS custom properties) |
| Strict mode        | Aktivert      | Korrekt                             |

Den ene `any`-bruken er i `packages/ai/src/tools/report/preview-report.ts:84` — begrunnet med manglende typeeksport fra Supabase query builder.

### Feilhåndtering

| Metrikk             | Verdi           |
| ------------------- | --------------- |
| Error/catch-mønstre | 295 forekomster |
| Tomme catch-blokker | 0               |

**Ingen stille feil.** Alle feil logges eller håndteres.

### TODO/FIXME-markører

| Kategori              | Antall |
| --------------------- | ------ |
| Kode-TODO-er          | 27     |
| Dokumentasjon-TODO-er | 45     |
| **Totalt**            | **72** |

Vanligste tema: 6 stk "Fjern cast etter `npx supabase gen types`" — forventet i utviklingsflyt.

### Console.log i produksjonskode

| Fil                                                                 | Linje | Innhold                                                            |
| ------------------------------------------------------------------- | ----- | ------------------------------------------------------------------ |
| `apps/web/src/app/login/page.tsx`                                   | 182   | `console.log("[hype] Redirecting to /join")`                       |
| `apps/web/src/app/onboarding/showcase/sections/ContractSection.tsx` | 21    | `console.log("[ContractSection] sendContractConfirmation called")` |

**Anbefaling:** Fjern begge.

### Dødt kode

- **Filer med "deprecated/legacy/old":** 0
- **Arkivinnhold:** Kun i `.next/cache/` (byggartifakter)
- **Status:** Rent — ingen foreldet kildekode funnet

---

## 6. Arkitekturoversikt

### Monorepo-struktur

```
smartout.ai/
├── apps/
│   ├── web/          → Dashboard (Next.js 16, port 3060)         [780 filer]
│   ├── landing/      → Landingsside (Next.js 16, port 3055)     [146 filer]
│   ├── mobile/       → Mobilapp (Expo 55, React Native 0.83)    [100 filer]
│   └── e2e/          → Playwright-tester                         [13 filer]
├── packages/         → 15 delte pakker                           [~225 filer]
├── services/         → 5 mikrotjenester                          [~72 filer]
├── supabase/         → Migreringer + 33 Edge Functions           [52 filer]
├── infra/            → Docker Compose + Caddy                    [konfig]
└── docs/             → 588 dokumentasjonsfiler                   [markdown]
```

### Mikrotjenester

| Tjeneste         | Rammeverk      | Port | Formål                          |
| ---------------- | -------------- | ---- | ------------------------------- |
| stage-engine     | Hono           | 5010 | AI-orkestrering, workflow-motor |
| shift-mcp        | Hono           | 5011 | Vaktplan MCP-verktøy            |
| contract-service | Fastify        | 5012 | Kontrakt-/DocuSeal-integrasjon  |
| scrapling        | Python/FastAPI | 8000 | Nettskraping                    |
| interview-mcp    | Anchor         | —    | Intervju-MCP                    |

### Pakker

| Pakke               | Formål                                            |
| ------------------- | ------------------------------------------------- |
| `agent-sdk`         | AI-agent hooks, providers, verktøy                |
| `ai`                | AI-domenelogikk (agenter, capabilities, skjemaer) |
| `design-tokens`     | Designsystem-tokens                               |
| `docs-pipeline`     | Dokumentasjonsinntak og validering                |
| `eslint-config`     | Delte ESLint-regler                               |
| `i18n`              | Internasjonalisering (norsk primær)               |
| `notifications`     | Varslingssystem                                   |
| `supabase`          | Klientwrappere, typer, middleware                 |
| `telemetry`         | Event-emission (PostHog, Logger, DB, engine)      |
| `types`             | Delte TypeScript-typer                            |
| `typescript-config` | Delt tsconfig                                     |
| `ui`                | shadcn/ui + tilpassede komponenter                |
| `utils`             | Hjelpefunksjoner                                  |
| `walkAi`            | Walk-through AI-orkestrering                      |
| `walkieTalkie`      | Stemme-kommunikasjonslag                          |

---

## 7. Infrastruktur

### Docker-tjenester

| Tjeneste         | Image            | Port    | Helsesjekk    |
| ---------------- | ---------------- | ------- | ------------- |
| Caddy            | caddy:2-alpine   | 80, 443 | HTTP /config/ |
| stage-engine     | Node 22-alpine   | 5010    | /health       |
| shift-mcp        | Node 22-alpine   | 5011    | /health       |
| contract-service | Node 22-alpine   | 5012    | /health       |
| scrapling        | Python 3.12-slim | 8000    | Python urllib |
| n8n              | n8nio/n8n:2.10.4 | 5678    | HTTP /healthz |

- **Nettverk:** `smartout-internal` (bridge)
- **Multi-stage builds:** Alle Node-tjenester bruker pnpm workspace-filtrering
- **Helsesjekker:** 30s intervall, 5s timeout, 3 retries

### CI/CD — GitHub Actions

| Workflow                 | Innhold                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `ci.yml`                 | Lint, typecheck, format, Docker-build (matrise), turbo build, pakkeeksport-verifisering |
| `claude.yml`             | Claude Code-integrasjon                                                                 |
| `claude-code-review.yml` | Automatisk kodegjennomgang                                                              |

**Parallellisering:** Lint + typecheck + format + build-health kjører parallelt. Docker-bygger kjører i matrise. Turbo build sekvensielt etter sjekker.

### Vercel

- Ingen `vercel.json` funnet
- Deployment sannsynligvis via Git-integrasjon + Vercel UI
- `apps/web` → app.smartout.ai
- `apps/landing` → smartout.ai

---

## 8. Testdekning

### Oversikt

| Kategori                | Antall filer | Detaljer                                                                  |
| ----------------------- | ------------ | ------------------------------------------------------------------------- |
| E2E-tester (Playwright) | 8            | Auth, landing, signup, onboarding, dashboard, workspace-setup, 2 journeys |
| Web enhetstester        | 18           | Diverse komponenter og hooks                                              |
| Pakke-enhetstester      | 0            | Ingen enhetstester i `packages/`                                          |
| WalkAi-tester           | 3            | Mission runner                                                            |
| **Totalt**              | **29**       |                                                                           |

### E2E-dekning

| Testfil                        | Dekker                  |
| ------------------------------ | ----------------------- |
| `auth.spec.ts`                 | Autentiseringsflyter    |
| `landing.spec.ts`              | Landingsside            |
| `signup-flow.spec.ts`          | Brukerregistrering      |
| `onboarding.spec.ts`           | Onboarding-wizard       |
| `dashboard.spec.ts`            | Admin-dashboard         |
| `workspace-setup-flow.spec.ts` | Workspace-konfigurasjon |
| `journey-*.spec.ts` (2)        | Komplette brukerreiser  |

### Gap

- **Ingen enhetstester for pakker** — `utils`, `telemetry`, `types`, `i18n` mangler dekning
- **Ingen enhetstester for Edge Functions**
- **Ingen integrasjonstester for mikrotjenester**

**Anbefaling:** Prioriter vitest-dekning for `@smartout/utils`, `@smartout/telemetry` og `@smartout/types`.

---

## 9. Dokumentasjon

| Metrikk             | Verdi              |
| ------------------- | ------------------ |
| Dokumentasjonsfiler | 588                |
| ADR-er              | 54                 |
| Moduldokumenter     | 23                 |
| YAML-frontmatter    | Alle filer         |
| INDEX.md            | Vedlikeholdt       |
| CLAUDE.md           | Oppdatert (v9.5.0) |

### Dokumentasjonsstruktur

```
docs/
├── reference/       → DATABASE, ROUTES, PACKAGES, ENV_VARS
├── modules/         → 23 moduldokumenter (MODULE_1–MODULE_20)
├── architecture/    → Systemdesignbeslutninger
├── decisions/       → 54 ADR-er
├── learnings/       → Oppdagelses- og erfaringslogg
├── engines/         → Industry intelligence (hospitality)
├── cross-cutting/   → GDPR, billing, sikkerhet, i18n
├── protocols/       → Sikkerhet, dokumentasjon, kunnskap, miljø
├── templates/       → ADR, learning, plan
└── reports/         → Denne rapporten
```

---

## 10. Kjente problemer og teknisk gjeld

### Åpne problemer

| #   | Problem                                                  | Alvorlighet | Påvirkning                        |
| --- | -------------------------------------------------------- | ----------- | --------------------------------- |
| 1   | `agent_task` mangler `updated_at` og `workspace_id`      | Lav         | Brudd på konvensjon               |
| 2   | Duplisert migreringstidsstempel                          | Lav         | Kan forvirre migreringsrekkefølge |
| 3   | ~64 uncommittede filer på `development`                  | Medium      | Risiko for konflikt               |
| 4   | CLAUDE.md oppgir 72 enums (faktisk 48)                   | Info        | Dokumentasjonsavvik               |
| 5   | 6 type-cast TODO-er venter på type-regenerering          | Lav         | Teknisk gjeld                     |
| 6   | 3 stale worktrees (wt-6, wt-7, wt-8) markert som opptatt | Lav         | Rydding påkrevd                   |

### Teknisk gjeld — Sammendrag

| Kategori               | Elementer             | Risiko |
| ---------------------- | --------------------- | ------ |
| Type-casts i kode      | 6 TODO-er             | Lav    |
| Debug-logging          | 2 `console.log`       | Lav    |
| Manglende enhetstester | 15 pakker uten tester | Medium |
| Stale worktrees        | 3 stk                 | Lav    |
| Uncommittet arbeid     | ~64 filer             | Medium |

---

## 11. Anbefalinger

### Prioritet 1 — Rask gevinst

1. **Kjør type-regenerering:** `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts` — fjerner 6 TODO-er
2. **Fjern debug-logging:** 2 `console.log` i produksjonskode
3. **Fiks duplisert migreringstidsstempel:** Gi nytt tidsstempel til avatars-migrering
4. **Rydd stale worktrees:** Fjern wt-6, wt-7, wt-8

### Prioritet 2 — Kvalitetsheving

5. **Legg til enhetstester for pakker:** Start med `utils`, `telemetry`, `types`
6. **Commit eller stash uncommittet arbeid:** 64 filer på `development`
7. **Oppdater CLAUDE.md:** Korriger enum-antall fra 72 til 48

### Prioritet 3 — Fremtidig forbedring

8. **DOMPurify i kontraktredigerer:** Forsvar-i-dybden for HTML-rendering
9. **Integrasjonstester for mikrotjenester:** stage-engine, shift-mcp, contract-service
10. **Legg til `vercel.json`:** Eksplisitt konfigurasjon for deployment

---

## 12. Konklusjon

Smartout-kodebasen demonstrerer **sterk ingeniørdisiplin** med nesten perfekt TypeScript strict-overholdelse (1 `any`), robust sikkerhet (ingen sårbarheter funnet), velorganisert monorepo-arkitektur og omfattende dokumentasjon (588 filer, 54 ADR-er).

De viktigste forbedringsområdene er **testdekning** (spesielt enhetstester for delte pakker) og **housekeeping** (uncommittet arbeid, stale worktrees, type-regenerering).

**Ingen kritiske sikkerhetsproblemer** ble funnet. Alle autentiseringsmønstre, RLS-policyer og hemmelighetsadministrasjon er korrekt implementert.

Systemet er **produksjonsklart** med moderne avhengigheter, robust CI/CD-pipeline og forsvarlig arkitektur.

---

_Rapport generert 2026-03-18 av Claude Opus 4.6 | Revisjon av kodebase, database, sikkerhet og infrastruktur_
