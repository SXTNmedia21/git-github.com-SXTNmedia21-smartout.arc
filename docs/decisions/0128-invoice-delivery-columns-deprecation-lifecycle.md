---
title: "invoice.delivery_* Columns Deprecation Lifecycle"
id: ADR-0128
status: proposed
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0128: invoice.delivery_* Columns Deprecation Lifecycle

## Context and Problem Statement

Fase 1 la til `invoice.delivery_channel`, `invoice.delivery_status`, og `invoice.external_reference` som enkelt-kolonner for enkelt-kanal-leveranse. Fase 2 Spor A introduserer `invoice_dispatch`-tabell med én rad per (invoice, channel, target) — støtter flerkanalsleveranse, per-kanal-status, retry. Det gjør de tre invoice-kolonnene overlappende men ikke ekvivalente. Council-syntese advarte mot "deprecated but not removed" som permanent gjeld: readere må huske hvilken kilde som er autoritativ, AI-verktøy lover feil data, Fase 3 arver komplikasjonen.

## Decision Drivers

- **Ingen skjulte kildekonflikter:** Én autoritativ kilde for "ble fakturaen levert?". To kilder = drift.
- **Migrasjonspress:** Fase 1 har kode som leser de tre kolonnene (ingen i `billing_query` AI-tool, men andre callers kan finnes). Tvunget hard cut-over i B2 ville kreve samtidig oppdatering av alle readere.
- **Time-boxing:** Deprecation uten dato blir permanent. Hver ADR som deprecates noe må navngi drop-datoen.
- **Auditbarhet av overgang:** Dual-write-perioden må være observerbar (telemetry-alert hvis legacy-kolonnene leses etter cut-over-dato).

## Considered Options

1. **Drop kolonnene i B2** — hard cut. Alle readere må oppdateres samtidig. *(Avvist — høy koordineringskost, breaking for in-flight konsumenter.)*
2. **Behold permanent som "derived"** — oppdatert av trigger som speiler `invoice_dispatch`. *(Avvist — komplisert, skjuler tech debt, invitasjon til uutbedret drift.)*
3. **Time-boxed dual-write → drop** — skriv begge under B2 (bridge), les kun fra `invoice_dispatch` fra B3 og fremover, drop kolonnene ved Fase 3-close eller 2026-Q3 (tidligste av de to). *(Valgt.)*

## Decision Outcome

Chosen option: **"Time-boxed dual-write → drop"**, fordi det gir migrasjonsluft uten å gjøre deprecation permanent.

**Livsløp:**

| Fase | `invoice.delivery_*` | `invoice_dispatch` |
|------|---------------------|-------------------|
| Fase 1 (nåværende) | Eneste kilde. Satt av `generate-monthly-invoices`. | — (eksisterer ikke) |
| **B1** (migrasjon) | Eksisterende rader uendret. | Tabell opprettes, tom. |
| **B2** (dispatch server) | Dual-write: `dispatch_invoice` action-handler skriver BÅDE til `invoice_dispatch`-raden OG oppdaterer invoice's `delivery_status` + `external_reference` ved første vellykkede kanal. `delivery_channel` settes til primær-kanal (første i dedup-rekkefølge). | Primærkilde for per-kanal-status. |
| **B3** (workspace UI merget) | **Alle readere byttet** til `invoice_dispatch`. Dual-write fortsetter som backstop, men ingen leser invoice.delivery_* lenger. | Eneste kilde. |
| **Post-B3** | Telemetry-alert: `legacy_delivery_column_read` hvis noen kode leser `invoice.delivery_channel` / `delivery_status` / `external_reference` via RLS-spor (implementeres via pg_stat_user_tables + CI-grep). | — |
| **Fase 3 close ELLER 2026-Q3 (hva som kommer først)** | **DROP COLUMN** via migrasjon. Dual-write-koden fjernes i samme migrasjon + PR. | Eneste kilde, dual-write lagene fjernet. |

**Hard drop-dato:** `2026-07-01` (slutten av Q2, begynnelsen av Q3) ELLER Fase 3 close — hvilken som kommer først. Denne datoen er bindende.

**Dual-write implementasjon (B2):**

```ts
// inside action_type 'dispatch_invoice' handler
async function onDispatchResult(dispatch: InvoiceDispatch, result: DispatchResult) {
  // 1. Primary: oppdater invoice_dispatch
  await updateInvoiceDispatch(dispatch.invoice_dispatch_id, result);

  // 2. Backstop: dual-write til invoice.delivery_* BARE hvis dette er første vellykkede dispatch
  //    (så vi ikke overskriver en tidlig success med en sen failure)
  if (result.status === 'delivered' && isFirstSuccessfulDispatch(dispatch.invoice_id)) {
    await updateInvoiceLegacyFields(dispatch.invoice_id, {
      delivery_channel: dispatch.channel,
      delivery_status: 'delivered',
      external_reference: result.external_reference,
    });
  }
}
```

**Reader-migrasjon (B3):**

- Grep for `delivery_channel`, `delivery_status`, `external_reference` i:
  - `apps/web/src/` — alle Server Actions, hooks, queries
  - `packages/ai/src/` — AI-capabilities (verifisert: ingen treff i `billing_query`)
  - `packages/billing/src/` — billing package
  - `supabase/functions/` — Edge Functions
- Hver treff → bytte til `invoice_dispatch`-spørring
- CI-gate etter B3: en lint-regel eller grep-test som failer hvis kode introduseres som leser invoice.delivery_*

## Rules & Consequences

- **Good, because** gradvis overgang uten koordineringsrisiko
- **Good, because** hard drop-dato forhindrer permanent gjeld
- **Good, because** dual-write-perioden er observerbar (telemetry-alert på legacy-reads)
- **Bad, because** ~2 måneder periode med to kilder — ved bugs kan readere få inkonsistent data hvis dual-write-bridge feiler
- **Bad, because** dual-write-koden er runtime-kostnad som må fjernes i Fase 3
- **Agent Impact:** Alle NYE Fase 2-readere bruker `invoice_dispatch` fra dag én. Alle eksisterende Fase 1-readere kartlegges i B1 og migreres innen B3. B3 acceptance criteria inkluderer "zero grep hits for invoice.delivery_channel i applikasjonskode". Fase 3-kickoff inkluderer DROP COLUMN migrasjon som første task.

---

> Register in `docs/decisions/0000-decision-log.md` and update CLAUDE.md's ADR table.
