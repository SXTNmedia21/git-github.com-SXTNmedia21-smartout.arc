---
title: "Campaign — order-system"
status: active
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [campaign, roadmap, invoice, order, billing, admin-app, accountant]
---

# Campaign — order-system

> Branch: `campaign/order-system` | Worktree: /home/sxtnl/dev/smartout.ai-order-system | Module: billing | Started: 2026-05-02 | Mode: **autonomous**

## Vision

Bygg ny dedikert app — `apps/admin/` deployet som `admin.smartout.ai` — som regnskapsfører Erik kan logge inn i og selv finne + laste ned grunnfakturaer (orders) per workspace, uten Pontus' hjelp.

Smartout genererer **grunnfakturaer** (base orders): vi måler bruk, beregner grunnlag, leverer ferdig PDF/CSV. Erik bygger reell faktura selv (egen integrasjon / regnskapssystem / manuelt). Smartout sender ALDRI faktura til sluttkunde.

Eksisterende `apps/web/src/app/platform-admin/billing/invoices/` overflate **løftes ut** til ny app. Funksjonelt identisk i fase 1 — samme data, samme handlinger, samme audit. Forskjellen er domenet: Pontus admin-rolle drift består i `platform-admin`; regnskapsfører Erik bruker `admin.smartout.ai`.

## Suksesskriterier

1. **Erik kan selvstendig** logge inn på `admin.smartout.ai`, finne workspace, laste ned grunnfaktura (PDF + CSV), og markere som mottatt-betalt — uten Pontus.
2. **Workspace-kartotek**: én side per workspace med all data Erik trenger — kontrakt, billing-config, member-info, order-historikk, betalingsstatus.
3. **Apps/admin synkron med platform-admin**: samme data, samme business logic. Felles kode i `packages/billing-engine/` (eller eksisterende). Ingen UI-divergens.
4. **Domain live**: `admin.smartout.ai` Vercel-deploy, auth via Supabase, accountant-rolle gateet.
5. **Autonomous build**: hele campaign kjøres uten Pontus-tilsyn. Multi-agent dispatch (architect → builders → verifier).

## Scope

### In scope

1. **Ny app `apps/admin/`** — Next.js 16 App Router, TypeScript, Tailwind v4, shadcn/ui (samme stack som apps/web). Egen Vercel-prosjekt.
2. **Domain `admin.smartout.ai`** — DNS + Vercel-binding. Subdomain routing IKKE samme som `{slug}.smartout.ai` workspace-routing — admin er flat.
3. **Auth + accountant-rolle** — Supabase Auth shared (samme `user_identity`). Ny rolle eller `company_member` med `role='accountant'` + cross-company-tilgang via dedikert grant-tabell. ADR avklarer pattern.
4. **Page: `/orders`** — løft fra `apps/web/src/app/platform-admin/billing/invoices/`. List + filter + detail + last ned. Funksjonelt 1:1.
5. **Page: `/workspaces/[id]`** — workspace-kartotek. Kontrakt-info, billing-config, members, order-historikk, payment-status. Read-only først, mutate senere hvis behov.
6. **Page: `/workspaces`** — liste alle workspaces Erik har tilgang til.
7. **Felles kode** — extract shared logic: order-tabeller, server actions, telemetry-events, PDF/CSV-generatorer. Plassering: utvid eksisterende `packages/` eller ny `packages/billing-engine/`.
8. **Auto-orientering**: Erik finner alt han trenger på max 3 klikk fra forsiden.

### Out of scope

- Workspace-rebinding av invoice/order (ADR-0118 company-scoped består).
- Stripe Invoice API-integrasjon.
- Peppol/Tickstar/Digdir OAuth (droppet 2026-05-02).
- UI-rename invoice→order i `apps/web/platform-admin` (eget rename-arbeid senere; nye apps/admin bruker "order" naturlig fra start).
- Worker-flate i apps/web — denne kampanjen er kun admin-app.
- Mobile-app for accountant — fase 2.

## Arkitektur (overordnet)

```
apps/
  admin/                        ← NY (Next.js 16 — admin.smartout.ai)
    src/app/
      page.tsx                  ← landing → redirect /workspaces
      orders/                   ← lifted from platform-admin/billing/invoices
      workspaces/
        page.tsx                ← list
        [id]/page.tsx           ← kartotek
      auth/                     ← login, callback
    package.json
    next.config.ts
    middleware.ts               ← accountant-role gate

packages/
  billing-engine/               ← extract delt forretningslogikk (NY ELLER eksist.)
    src/
      orders/                   ← server-actions + queries
      kartotek/                 ← workspace-overview queries
      telemetry/                ← events
      pdf/                      ← generator
      csv/                      ← export
  ui/                           ← shadcn shared (eksisterende, evt. utvid)

supabase/migrations/            ← accountant-role + grant-tabell
```

DNS: `admin.smartout.ai` → Vercel `smartout-admin` prosjekt → samme Supabase prod DB.

## Milestones

- [ ] **M1 — Architecture & ADRs** (3-5 dager, code-architect + ADR-writer)
  - ADR: apps/admin app boundary + accountant-rolle + cross-company access pattern
  - ADR: shared billing-engine package extraction (eksisterende vs ny)
  - ADR: workspace-kartotek read-model (joins, RLS, view eller direct queries)
  - Blueprint: full file-tree + dependency graph + migration plan + DNS plan
  - Acceptance: 3 ADRs accepted, blueprint review-OK, alle build-tasker dependency-sorterte

- [ ] **M2 — apps/admin scaffold** (2-3 dager, build-agent)
  - `pnpm create-next-app` apps/admin/, copy patterns fra apps/web
  - Tailwind v4, shadcn (new-york), env.ts, design-tokens
  - Routing: /, /auth, /orders (stub), /workspaces (stub), /workspaces/[id] (stub)
  - Middleware: accountant-role gate (klar selv om rolle ikke implementert)
  - Acceptance: `pnpm --filter admin dev` på port 3070, alle stubs renderer, typecheck grønn

- [ ] **M3 — packages/billing-engine extraction** (3-5 dager, build-agent)
  - Identifisér delt logikk i apps/web/src/app/platform-admin/billing/invoices/_actions/ + _components/
  - Extract til pakke: queries, server actions (Next.js-uavhengige), PDF-generator, CSV-export
  - apps/web bruker pakken (no behavior change)
  - apps/admin bruker pakken
  - Acceptance: apps/web platform-admin/billing/invoices uendret funksjonalitet (E2E pass), pakke har egen test-suite

- [ ] **M4 — accountant-rolle + cross-company access** (2-3 dager, build-agent)
  - Migration: ny `accountant_company_grant` tabell (eller utvid `company_member` med `accountant` role + cross-grant view)
  - RLS: accountant kan SELECT orders/contracts på alle granted companies
  - Edge Function/middleware-helper: `getAccountantCompanies(user_id)`
  - Seed: Erik som accountant med grant til alle Smartout-kunder
  - Acceptance: Erik logger inn, ser alle workspaces, RLS-verifisert med pgTAP

- [ ] **M5 — /orders page (lift)** (3-4 dager, build-agent)
  - Klone alle 26 komponenter fra platform-admin/billing/invoices til apps/admin
  - Bruk billing-engine package for queries/actions
  - "order"-terminologi i UI (ikke "invoice")
  - Last-ned-PDF + last-ned-CSV som primær handlinger
  - Mark-mottatt-betalt action (ikke mark-paid — accountant tracker mottak)
  - Acceptance: Erik kan filtrere, finne, laste ned, markere mottatt — E2E spec pass

- [ ] **M6 — /workspaces/[id] kartotek** (3-4 dager, build-agent)
  - Hent: company info, contract, billing config, members, order-historikk, payment-status, recent activity
  - Layout: stacked sections, no-tabs (Erik orienterer seg ovenfra-ned)
  - Read-only fase 1
  - Acceptance: Erik kan se alt om en workspace på én side, max 1 scroll for kjernefakta

- [ ] **M7 — Domain + deploy** (1-2 dager, build-agent)
  - Vercel: ny prosjekt smartout-admin
  - DNS: admin.smartout.ai
  - Env vars synk via 1Password (samme vault smartout_ai_prod)
  - Auth callback URL whitelist
  - Acceptance: admin.smartout.ai live, Erik kan logge inn på prod

- [ ] **M8 — Erik UAT + iter** (variabel, build-agent + verifier)
  - Erik gjennomfører oppgaver: finn alle august-orders for workspace X, last ned PDF, marker betalt
  - Verifier-agent fanger friction-points
  - Build-agent iterer til Erik gir grønt lys
  - Acceptance: Erik 3 oppgaver på <5 min, ingen Pontus-spørsmål

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none yet — autonomous dispatch starts at M1_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).

ADRs som forventes skrevet i denne kampanjen:
- ADR-XXXX (M1) — apps/admin app boundary + accountant-rolle + cross-company access
- ADR-XXXX (M1) — billing-engine package extraction strategy
- ADR-XXXX (M1) — workspace-kartotek read-model
- ADR-XXXX (M7) — admin.smartout.ai DNS + deploy pattern

ADRs som forventes notert (ikke superseded yet):
- ADR-0118 (Invoice Engine as C3 Commercial Consumer) — apps/admin reuses, no semantic change
- ADR-0127 (Billing Dispatch Rule 2-Level Evaluation) — apps/admin doesn't expose dispatch
- ADR-0146 (Peppol EHF) — confirmed dropped (no apps/admin work)
- ADR-0148 (EHF Export CSV/PDF) — apps/admin uses CSV path

## Hard Constraints

- ⛔ NEVER bryte ADR-0118 company-scoped RLS — order forblir company-scoped.
- ⛔ NEVER duplisér forretningslogikk mellom apps/web og apps/admin — alt delt går i `packages/billing-engine`.
- ⛔ NEVER endre apps/web/platform-admin/billing UI eller funksjonalitet i denne kampanjen (drift-konsoll består).
- ⛔ NEVER deploy til prod uten at E2E pass + Erik UAT godkjent.
- ⛔ NEVER hardcode Erik som eneste accountant — grant-pattern må støtte flere accountants per kunde-base.
- ⛔ NEVER autonom dispatch uten /start-feature → sub-sortie branch (én feature = én branch = én PR).
- ⛔ NEVER skipp typecheck eller E2E før close-feature.
- ⛔ NEVER push direkte til `campaign/order-system` fra build-agents — alle endringer går via sub-sortie merge.
- ⛔ NEVER restart Peppol-arbeid (droppet 2026-05-02).

## Autonomous Dispatch Plan

Orchestrator (Claude Opus, denne sesjonen) styrer hele kjeden:

```
M1 → code-architect (opus) skriver blueprint + ADR-drafts
   → orchestrator reviewer ADRs, accepts
   → orchestrator dispatcher M2-M8 sequentially
M2 → build-agent (sonnet) scaffolder apps/admin
M3 → build-agent (sonnet) extracter billing-engine
M4 → build-agent (sonnet) bygger accountant-rolle + RLS
M5 → build-agent (sonnet) lifter orders-page
M6 → build-agent (sonnet) bygger kartotek
M7 → build-agent (sonnet) deployer
M8 → verifier (sonnet) + build-agent iterasjon
```

Hver milestone:
1. Orchestrator dispatcher med presis prompt + acceptance criteria
2. Agent jobber i sub-sortie worktree (`/start-feature m<N>-<name>` fra campaign)
3. Agent commiter, returnerer summary
4. Orchestrator verifiserer (typecheck, tests, file-existence)
5. `/close-feature` merger sub-sortie til campaign
6. Aktivitetslogg + claude-mem digest
7. Neste milestone

Stall-detect: hvis agent returnerer error eller manglende acceptance, orchestrator dispatcher repair-agent eller eskalerer til Pontus via `~/.claude/scripts/heartbeat-notify.sh telegram "<msg>"`.

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
