---
title: "Journey — avstemming-pages (M7c)"
feature: avstemming-pages
branch: feat/order-system-avstemming-pages
status: verified
verified_at: 2026-05-02
updated: 2026-05-02
created: 2026-05-02
module: billing
tags: [journey, billing, avstemming, accountant, apps-admin]
---

# Journeys — Avstemming (M7c)

Disse journeys dekker den månedlige avstemmingsprosessen i `apps/admin` (admin.smartout.ai).
Eneste aktør er accountant Erik. Ingen employee/manager/admin/owner er involvert.

---

## Roles touched

| Rolle | Involvert | Merknad |
|-------|-----------|---------|
| `accountant` | Ja — Erik | Eneste rolle i apps/admin |
| `employee` | Nei | Har ikke tilgang til apps/admin |
| `manager` | Nei | Har ikke tilgang til apps/admin |
| `admin` | Nei | Har ikke tilgang til apps/admin |
| `owner` | Nei | Har ikke tilgang til apps/admin |

---

## Mobile parity status

`apps/admin` er **web-only** innenfor campaign/order-system scope. Dette er ikke et brudd på mobile-parity-regelen i `CLAUDE.md`.

**Begrunnelse:** ADR-0133 definerer grensen "web composes, mobile executes." Accountant-verbene er Author/Compose/Plan (period locking, settlement run, artifact generation) — disse hører hjemme på web-siden av grensen. M6 (mobile-app for accountant) er eksplisitt Fase 2 per `CAMPAIGN-order-system.md` (linje 49–50) og utenfor denne campaign-scope. Arkitekturen er mobilklar: server-actions og API-routes er rene HTTP-endepunkter som en fremtidig mobile client kan kalle.

---

## Journey 1 — Accountant orienterer seg på dashboard

**Precondition:**
- Erik er autentisert via Supabase Auth.
- `requireAccountant()` bekrefter `accountant`-rolle (ellers 401/redirect).
- Erik har minst én granted company via `accountant_company_grant`.

1. Erik åpner `admin.smartout.ai` → System kjører `requireAccountant()` middleware → Validering passerer, Erik sendes til `/dashboard`.
2. Server Component kaller `compute_period_aggregates` RPC for forrige måned → System returnerer aggregerte data per company/workspace.
3. Erik ser `DashboardCTA`-kort: forrige måneds periode, estimert NOK-total, og en "Kjør avstemming"-knapp.
4. Erik ser `QuickTasks`-kort: liste over pending invoices som venter på behandling.
5. Erik ser `RecentSettlement`-kort: siste `settlement_run` med status `succeeded`, dato, og en "Vis pakke"-lenke til `/avstemming/[run_id]`.
6. Erik skanner kortene og danner seg et bilde av hva som er klart for kjøring og hva som er åpne saker.

**Postcondition:**
- Erik vet hvilken periode som er klar for avstemming.
- Erik ser pågående saker (pending invoices) og kan navigere til siste fullførte kjøring.

**Error paths:**
- Erik mangler `accountant`-rolle → `requireAccountant()` kaster 401 → Browser redirectes til `/auth/login`.
- `compute_period_aggregates` RPC feiler eller returnerer null → Dashboard viser graceful zeros på alle tallfelter — ingen crash, ingen error-skjerm.
- Erik har ingen granted companies → Kortene viser empty-state tekst, ingen data, ingen crash.

---

## Journey 2 — Accountant kjører månedsavstemming

**Precondition:**
- Erik er autentisert og på `/dashboard`.
- Forrige måned er ferdig (alle workspace-transaksjoner er lukket).
- Minst én workspace er tilgjengelig via `accountant_company_grant`.

1. Erik klikker "Kjør avstemming" på `DashboardCTA`-kortet → Browser navigerer til `/avstemming/run`.
2. Server Component henter tilgjengelige workspaces (via RLS-scopet query) og period-defaults (forrige måned, start- og sluttdato).
3. Erik ser `RunConfirmation`-visningen: alle workspaces forhåndsvalgt i en liste, datovelger satt til forrige måned, estimert NOK-total beregnet.
4. Erik gjennomgår listen — alle workspaces er korrekt → Ingen endringer nødvendig.
5. Erik trykker "Kjør" → Client kaller `runSettlement` server-action med valgte workspaces og periode.
6. Server kjører `requireAccountant()` → emitter `settlement run_initiated`-telemetry-event → kaller `executeSettlementRun` (M7b) som beregner per-workspace totaler, VAT, avvik og genererer 4 artifacts.
7. `executeSettlementRun` returnerer `status: "succeeded"` og `run_id` → Server-action returnerer `{ runId }` til client.
8. Client kjører `router.push("/avstemming/" + runId)` → Erik lander på `/avstemming/[run_id]` med ferdig pakke.

**Postcondition:**
- `settlement_run`-rad med `status = "succeeded"` er persistert i databasen.
- 4 artifacts (Sammendrag PDF, Detalj-linjer CSV, Faktura-bunke PDF, Avvik-liste PDF) er generert og lagret permanent i Supabase Storage.
- Perioden er "lukket" og kan ikke kjøres på nytt med overlappende datoer.
- Telemetry-event `settlement run_initiated` er emittet.

**Error paths:**
- Erik deselekterer alle workspaces → "Kjør"-knapp forblir disabled — ingen submit mulig.
- Server-action kaster unhandled exception → Sonner toast vises med feilmelding → Erik forblir på `/avstemming/run`, ingen data er korrupt.
- `executeSettlementRun` returnerer `status: "failed"` → Server-action kaster error → Error bubbles til client → Sonner toast med feilmelding, `settlement_run`-rad persistert med `status = "failed"` for revisjonsformål.
- Session utløpt mellom klikk og server-action-kall → `requireAccountant()` kaster 401 → Client får 401-respons → Redirect til `/auth/login`.

---

## Journey 3 — Accountant laster ned artefakter fra ferdig avstemming

**Precondition:**
- Erik er autentisert.
- `settlement_run` med gitt `run_id` finnes i databasen med `status = "succeeded"`.
- `initiated_by` på kjøringen er Eriks `userId` (cross-accountant isolation).
- Alle 4 artifacts er persistert i Supabase Storage.

1. Erik navigerer til `/avstemming/[run_id]` (via "Kjør"-flow eller "Vis pakke"-lenke).
2. Server Component kjører `requireAccountant()` → fetcher `settlement_run` og tilhørende artifacts parallelt (via `Promise.all`) → utfører defense-in-depth ownership-sjekk: `run.initiated_by !== userId` → kaster notFound hvis mismatch.
3. Erik ser `SettlementSummaryView`: tabell med per-workspace rader (navn, beløp, VAT, avvik), totalsummer nederst, avviksoversikt fra `summary`-JSONB-feltet.
4. Erik ser `ArtifactDownloads`-seksjonen: 4 kort med navn, filtype og "Last ned"-knapp for hver artifact.
5. Erik klikker "Last ned" på Sammendrag PDF-kortet → Client sender `GET /api/avstemming/[run_id]/artifact/summary_pdf`.
6. Route handler kjører auth-validering → RLS-scopet query bekrefter run-tilgang → ownership-sjekk (`initiated_by === userId`) → henter signert URL fra Supabase Storage (60 sekunders TTL) → emitter `settlement artifact_downloaded`-telemetry-event → returnerer `302 redirect` til signert URL.
7. Browser følger redirect → PDF åpnes i ny fane.
8. Erik gjentar steg 5–7 for de resterende 3 artifacts (Detalj-linjer CSV, Faktura-bunke PDF, Avvik-liste PDF).

**Postcondition:**
- Erik har lastet ned alle 4 artifacts lokalt.
- 4 `settlement artifact_downloaded`-telemetry-events er emittet (én per nedlasting).
- Smartout genererer base-fakturaer kun — Erik bygger den endelige fakturaen selv i sitt regnskapssystem basert på nedlastet materiale.

**Error paths:**
- `run_id` finnes ikke i databasen, eller RLS-query returnerer null → Server Component kaller `notFound()` → 404-side.
- `run.initiated_by !== userId` (cross-accountant isolation) → Server Component kaller `notFound()` → 404-side (ingen lekking av at kjøringen eksisterer).
- Artifact-rad mangler i databasen → Route handler returnerer 404.
- Supabase Storage-kall feiler ved signed URL-generering → Route handler returnerer 404.
- Session utløpt → Route handler får 401 fra `requireAccountant()` → Redirect til `/auth/login`.

---

## Journey 4 — Accountant finner historisk avstemming

**Precondition:**
- Erik er autentisert.
- Minst én `settlement_run` med `status = "succeeded"` eller `status = "failed"` eksisterer og er RLS-tilgjengelig for Erik.

1. Erik klikker "Historikk" i sidebar → Browser navigerer til `/avstemming/historikk`.
2. Server Component kjører `requireAccountant()` → fetcher siste 50 `settlement_run`-rader (alle statuser: `succeeded`, `failed`) sortert på `created_at` DESC via RLS-scopet query.
3. Erik ser `HistoryTable`: kolonner for periode (f.eks. "April 2026"), status (badge), total NOK, og en "Vis pakke"-lenke per rad.
4. Erik finner kjøringen fra april 2026 og klikker "Vis pakke" → Browser navigerer til `/avstemming/[run_id]`.
5. Journey 3 (artefakt-nedlasting) gjentas fra steg 2.

**Postcondition:**
- Erik kan revisitere alle tidligere kjøringer permanent uten tidsbegrensning.
- Alle historiske artifacts forblir tilgjengelig i Supabase Storage.

**Error paths:**
- Ingen `settlement_run`-rader eksisterer ennå → `HistoryTable` viser empty-state: "Ingen kjørte avstemninger."
- Andre accountants' kjøringer → filtreres automatisk bort av RLS — Erik ser aldri andre accountants' data.
- Erik klikker "Vis pakke" på en `status = "failed"`-rad → `/avstemming/[run_id]` vises, men artifacts er tomme/manglende → `ArtifactDownloads`-kortet viser "Ingen artifacts tilgjengelig" per artifact som mangler.
- Session utløpt → `requireAccountant()` kaster 401 → Redirect til `/auth/login`.
