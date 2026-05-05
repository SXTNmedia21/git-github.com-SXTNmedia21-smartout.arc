---
title: "Contract send + Walt receiver — status & gap report"
status: in_progress
updated: 2026-04-30
created: 2026-04-30
module: contracts
tags: [contracts, walt, hiring, employment-contract, status]
---

# Contract send + Walt receiver — status & gap report

> Sesjons-oppsamling 2026-04-30. Hva er gjort, hva er igjen, hva ble oppdaget under council-kjøring.

---

## TL;DR

End-to-end ansetting (admin sender kontrakt → ansatt mottar i beskyttet rom → signerer) fungerer **bare delvis** i dev. Send-route bridge er fikset, `/walt` mottakerrom finnes med dev-signing-stub, men 6 separate gaps blokkerer reell flyt. To kritiske bugs oppdaget under kort council-pass: notification-trigger silent-dead siden 2026-04-14, og orphan engine_event-route uten registrert handler.

---

## Arkitektur — hvordan kontrakt + ansetting henger sammen

### To-tabell-bro

```
employment_contract       contract                  contract-service /
(HR-data, §14-6)         (DocuSeal-signing entity)  /api/contracts/send
       │                          │                        │
       │ signing_contract_id ────►│                        │
       │ (FK, set når sendt)      │                        │
       ▼                          ▼                        ▼
   draft → ready_to_send → sent → signed → active ...   DocuSeal API
```

| Tabell | Hva den eier | Status-felt | PK |
|---|---|---|---|
| `employment_contract` | HR-data: position, salary, framework_snapshot, §14-6-felt, compliance_overrides, obligations-link | `status` (contract_status enum: draft / ready_to_send / sent / viewed / pending_signature / signed / active / expired / declined / terminated / superseded / migration_incomplete / pending_data) | `contract_id` |
| `contract` | DocuSeal-signering: signing_url, recipient_email, sender_name, docuseal_submission_id, signed PDF | `status` (TEXT — har "cancelled") | `contract_id` (separat fra employment_contract) |
| Bro | `employment_contract.signing_contract_id` → `contract.contract_id` | — | — |

### Hvem leser hva

- **Dashboard contracts list (admin)** — `/api/contracts` GET → `contract`-tabell. Empty i dev.
- **People page Ansettelse-form** — `employment_contract` direkte.
- **My-contract (ansatt)** — `employment_contract` join til `contract.signing_url` via `signing_contract_id`.
- **/walt (ny, denne sesjonen)** — samme join som my-contract, plus dev-stub-fallback.
- **DocuSeal webhook** — slår opp via `docuseal_submission_id` → oppdaterer `contract.status` + propagerer til `employment_contract.status`.

---

## Hva er gjort denne sesjonen (uncommitted)

### Send-route bridge (kritisk fix)

**Fil:** `apps/web/src/app/api/contracts/send/route.ts`

**Bug før:** Route kalte `contract-service /contracts/${contractId}/send` med `employment_contract.contract_id`. Service queryer `contract`-tabell → 404. I dev-mode flippet den status uten å skape `contract`-rad → mottaker kunne aldri signere.

**Fix:** 
- Resolver `employment_contract.signing_contract_id` først
- Hvis null + contract-service tilgjengelig: kaller `POST /contracts` for å opprette signing-rad
- Hvis null + dev-mode: setter inn stub `contract`-rad med `signing_url=/walt/sign-dev/<id>`
- Bruker korrekt signing-ID i `/send`-kallet

### `/walt` protected receiver room (ny)

**Filer:**
- `apps/web/src/app/walt/page.tsx` — server component, auto-resolver pending kontrakt for innlogget user
- `apps/web/src/app/walt/_components/WaltShell.tsx` — client, 3 states: `no_profile` / `no_pending` / `pending`
- `apps/web/src/app/walt/sign-dev/[contract_id]/page.tsx` + `dev-sign-client.tsx` — dev-only signing-stub
- `apps/web/src/app/api/contracts/[id]/sign-dev/route.ts` — POST som markerer kontrakt signed (refuser hvis contract-service er konfig)

**UX:** Ingen DashboardShell, ingen sidebar, varm OKLCH-glød, fokus på enkel oppgave: review + signer. Inviter-greeting + workspace-name surfaces.

### Småfix

- `DELETABLE_STATUSES` — fjernet dead `"cancelled"` (eksisterer ikke i `contract_status` enum, bare `"terminated"`)
- `useContractReadiness` hook — pre-flight gate på dispatch drawer, blokkerer Send hvis Ansettelse-data inkomplett
- `employment-contract-actions.ts` — `hourly_rate` / `monthly_salary` propagerer nå til `employment_contract` (var silent-dropped)
- 5 nye telemetry-events i registry: `contracts.delete.dialog_opened/.confirmed`, `contract.readiness.self_fill_requested`, 4× welcome_wizard

### Verifisert

- Typecheck grønn
- `/walt` route returnerer 200 + redirect til `/login?next=/walt` for uautentisert (forventet)
- Contract-service container healthy på port 5012

---

## Gaps som blokkerer reell ende-til-ende

| # | Gap | Sted | Severity |
|---|---|---|---|
| 1 | Dashboard list tom i dev | `/api/contracts` GET reads `contract` (0 rader). 6 employment_contracts usynlig | **Høy** — admin kan ikke se sendte kontrakter |
| 2 | Login `?next=` ignoreres | `apps/web/src/app/login/page.tsx` hardkoder `/dashboard` | **Medium** — Walt unreachable fra invite-flow |
| 3 | Ingen auto-redirect ansatt → /walt | Employee logger inn på dashboard, må vite om /walt selv | **Medium** — onboarding-friksjon |
| 4 | Ingen notif-trigger på send | Recipient får ingenting unless DocuSeal-mail fyrer | **Høy** — ansatt vet ikke at de har kontrakt |
| 5 | ID-mismatch list vs delete | List viser `contract.contract_id`, DELETE forventer `employment_contract.contract_id` | **Medium** — surfaces når gap 1 fikses |
| 6 | Cancel-route status-string | Skriver `"cancelled"` til text-kolonne på `contract` (OK), men hvis kalles på employment_contract enum vil det feile | **Lav** — bare `contract`-tabellen i dag |

---

## Bonus-funn fra council-pass (council ble stoppet, men disse rakk å overflate)

### KRITISK: `contract_event` trigger silent-dead

`trg_contract_event_notify` (migration 2026-04-14) fires på `event_type IN ('contract_sent', 'contract_created', ...)` — **med underscore**. Hver send-route inserterer `event_type: "sent"` / `"created"` / `"send_failed"` / `"send_queued"` — **uten prefix**. Notification-path har vært død i 16 dager.

**Impact:** Selv hvis vi bygger inline notif-handler nå, må vi velge: (a) endre alle insertere til prefixet, eller (b) endre trigger-condition. Begge sider av kontrakten kjører i dag uten å snakke.

**Touchpoints:** 
- `apps/web/src/app/api/contracts/send/route.ts` (ny + eksisterende inserter)
- `apps/web/src/app/api/contracts/route.ts` line 251 (insert ved POST)
- `services/contract-service/src/routes/contracts.ts` (om service skriver contract_event)
- DB: `supabase/migrations/<2026-04-14>*contract_event*.sql`

### KRITISK: orphan `engine_event` route for contract.send_initiated

Telemetry-registry router events til `engine_event` destination (riktig per ADR-0186), men ingen `engine_trigger` rad mapper `contract.send_initiated` → process. Samme pattern som helpdesk Phase 0 P0 orphan. Events skrives til engine_event men ingenting forbruker dem.

**Impact:** Cascade-coupling (D2 update, C4 authority-flip ved signed) trigger-pipe er ikke koblet på contract-events. Engine_event tabellen samler bare data uten konsumenter.

---

## Anbefalt sekvens (uten å bygge ennå)

### Fase 0 — verifiser bonus-funn (ikke bygg)

1. Bekreft `trg_contract_event_notify` payload-mismatch ved å lese migration-fil + grep alle insertere på `contract_event`
2. Bekreft orphan engine_event ved å query `engine_trigger` for kontrakt-events
3. Output: 1 ADR eller 1 mini-fix-plan per funn

### Fase 1 — fix list-page (lav risk, høy synlighet)

- Endre `/api/contracts` GET til å lese `employment_contract` LEFT JOIN `contract` via `signing_contract_id`
- Oppdater `ContractsDataTable` type til å bære `employment_contract_id` som primary
- DELETE bruker derav alltid riktig ID

### Fase 2 — login next= + auto-redirect

- Login leser `searchParams.next`, valider mot allowlist (`/walt`, `/dashboard`, `/onboarding`)
- DashboardShell server-side check: hvis caller er employee + har pending kontrakt → redirect til /walt på første dashboard-hit
- `?stay=1` query-param for å skippe redirect (bypass for testing)

### Fase 3 — notif-trigger (etter bonus-funn løst)

- Velg én av:
  - (a) Inline i send-route → email via SendGrid Edge Function + activity_trail entry
  - (b) Fix engine_event-pipe + ADR-0186 handler tar over notif
- Hvis (b): krever migration som registrerer `engine_trigger` for `contract.send_initiated`

### Fase 4 — journey-doc patch + E2E

- Patch `JOURNEY-contract-module.md` Journey 2 + 3 med Walt-entry + dev-stub-path
- Skriv `apps/e2e/contract-walt-receiver.spec.ts` — admin sender → ansatt logger inn → /walt → sign-dev → my-contract viser signed
- Manual test checklist `MANUAL-TEST-walt-receiver.md`

---

## Referanser

- ADR-0076 / 0077 / 0078 / 0079 — composition engine, PII, channel restriction, framework binding
- ADR-0114 — Server Actions canonical mutation primitive
- ADR-0151 — forgery defence (workspace_id from JWT)
- ADR-0186 — Stage Engine → Platform Admin guardian pipe
- ADR-0244 — framework_snapshot freeze on send
- L-0181 — single canonical emit producer per event name
- `docs/architecture/contract-service/JOURNEY-contract-module.md` — 5 canonical journeys

---

## Filer berørt denne sesjonen

```
M apps/web/src/app/api/contracts/send/route.ts
M apps/web/src/app/api/employment-contracts/[id]/route.ts
M apps/web/src/components/contracts/ContractDispatchDrawer.tsx
M apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx
M apps/web/src/app/dashboard/people/_actions/employment-contract-actions.ts
M apps/web/src/app/dashboard/my-contract/page.tsx
M apps/web/src/app/invite/[token]/invite-token-client.tsx
M packages/i18n/locales/nb/contracts.json
M packages/i18n/locales/en/contracts.json
M packages/telemetry/src/registry.ts
?? apps/web/src/app/walt/
?? apps/web/src/app/api/contracts/[id]/sign-dev/
?? apps/web/src/hooks/contracts/use-contract-readiness.ts
```

Komm/notif-pakken (apps/web/src/app/dashboard/komm/*) er separat WIP, ikke del av kontrakt-bundle.
