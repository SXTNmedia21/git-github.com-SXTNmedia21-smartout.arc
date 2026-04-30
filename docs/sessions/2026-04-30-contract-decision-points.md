---
title: "Contract end-to-end — design decisions before plan"
status: in_progress
updated: 2026-04-30
created: 2026-04-30
module: contracts
tags: [contracts, walt, decisions, pre-plan]
---

# Contract end-to-end — design decisions before plan

> 6 design choices that must be locked before plan can be written. Each choice has trade-offs that change downstream architecture. Plan agent should not pick blindly.

---

## Decision 1 — List-page data source (gap #1)

**Problem:** `/api/contracts` GET reads `contract` table (DocuSeal signing entity). 0 rader i dev. Admin ser empty list selv om 6 employment_contracts finnes.

**Options:**

| Option | Source | Pros | Cons |
|---|---|---|---|
| **A. LEFT JOIN** | `employment_contract` LEFT JOIN `contract` ON signing_contract_id | Holder DocuSeal-fields tilgjengelig (sent_at, signed_at fra contract) | Join-kompleksitet · UI-type må mergea begge |
| **B. Switch source** | `employment_contract` only | Enklere · matcher hva my-contract gjør | Mister contract-only fields (signing_url må fetches per-row hvis trengs) |
| **C. Two endpoints** | `/api/contracts/admin-list` (employment_contract) + behold `/api/contracts` for DocuSeal-context | Tydeligere ansvar | Mer kode · trenger ny route |

**Recommend:** **A** — én join, oppdater type. Bevarer eksisterende delete-handler (som queryer employment_contract) men gir admin synlighet i begge tabeller.

**Affected files:** `apps/web/src/app/api/contracts/route.ts`, `apps/web/src/app/dashboard/contracts/_components/contracts-data-table.tsx`, ContractStatus type

---

## Decision 2 — ID-mismatch handling (gap #5)

**Problem:** List shows `contract.contract_id`, DELETE-route expects `employment_contract.contract_id`. Surfaces så snart Decision 1 ships.

**Options:**

| Option | Approach | Pros | Cons |
|---|---|---|---|
| **A. Carry both IDs** | Type carries `contract_id` (employment) + optional `signing_contract_id` (contract) | Clear separation · matches DB | Frontend må vite hvilken ID til hvilken handler |
| **B. API resolver** | DELETE accepts either ID, resolver til employment_contract | Frontend-simpler | Server-side ambiguity · 2 lookups |
| **C. Always use employment_contract_id** | Decision 1 har already chosen JOIN with employment_contract som primary, so list-row id IS employment_contract_id | Konsistent · ingen ambiguity | Bare gyldig hvis Decision 1 = A |

**Recommend:** **C** (bundle med Decision 1 = A). employment_contract_id er primary, signing_contract_id er attribute på samme rad.

---

## Decision 3 — Login `?next=` honor (gap #2)

**Problem:** `/login` hardkoder `/dashboard` etter signin. /walt unreachable fra invite-flow.

**Options:**

| Option | Approach | Security |
|---|---|---|
| **A. Allowlist** | Read `searchParams.next`, validate mot `["/walt", "/dashboard", "/onboarding", "/dashboard/my-contract"]` | Trygg · ingen open-redirect |
| **B. Same-origin only** | Read next, kun aksepter relative paths som starter med `/` | Mer permissive · risk for /api/<callback>-misbruk |
| **C. Encrypted token** | Krypter next i ?token=, decrypt server-side | Overengineered for MVP |

**Recommend:** **A** — kort allowlist, eksplisitt. Vurder å utvide allowlist senere.

**Affected files:** `apps/web/src/app/login/page.tsx`

---

## Decision 4 — Auto-redirect employee → /walt (gap #3)

**Problem:** Employee with pending kontrakt logger inn, lander på dashboard, må vite om /walt selv.

**Options:**

| Option | Pattern | Pros | Cons |
|---|---|---|---|
| **A. Middleware** | `apps/web/src/middleware.ts` — fetch profile + pending-check, redirect på første dashboard-hit | Edge · ingen client-flicker | Hver request kost (DB lookup) · cache-stratagi nødvendig |
| **B. Server layout** | `apps/web/src/app/dashboard/layout.tsx` — server component leser pending → `redirect()` | Kun trigger på dashboard-paths · ingen middleware-overhead | Client-side nav til /dashboard sub-routes hopper layout · ikke alltid trigger |
| **C. Banner-only** | Liten banner på dashboard: "Du har en kontrakt klar — gå til /walt" | Ingen redirect · brukeren velger | Mer friksjon · nok ansatte glemmer å klikke |
| **D. Hybrid** | Server layout redirect på første-mount + banner som fallback hvis dismissed | Best UX | Mest kode · cookie-state for dismiss |

**Recommend:** **B** med `?stay=1` query-bypass for testing. Ansattens første dashboard-hit redirector. Hvis de eksplisitt går til /dashboard?stay=1 (eller har dismissed redirect via cookie) → ingen redirect.

**Privacy:** Redirect implies "vi vet du har pending kontrakt." Akseptabelt — brukeren ER mottakeren.

**Affected files:** `apps/web/src/app/dashboard/layout.tsx`

---

## Decision 5 — Notification trigger pattern (gap #4 + bonus-funn)

**Problem:** 
- Recipient får ingenting når kontrakt sendes (unless DocuSeal-mail fyrer fra real path).
- **Bonus-funn 1:** `trg_contract_event_notify` (DB-trigger fra 2026-04-14) forventer `event_type='contract_sent'` (underscore-prefix). Alle insertere skriver `'sent'` (uten prefix). Notif-pipe har vært silent-dead i 16 dager.
- **Bonus-funn 2:** `engine_trigger` har ingen mapping for `contracts.send.submitted`. Events skrives til `engine_event` men ingen process plukker opp.

**Options:**

| Option | Approach | Notes |
|---|---|---|
| **A. Fix DB-trigger payload** | Endre alle `contract_event` insertere fra `"sent"` → `"contract_sent"` (4 sites) · trigger virker | Minimum endring · ingen ny pipe · respekterer existing arkitektur · går automatisk til `notification_outbox` |
| **B. Fix DB-trigger condition** | Endre trigger til å akseptere både `"sent"` og `"contract_sent"` | Bagvendt-kompatibilitet · men cementerer feil |
| **C. Inline i send-route** | Direct send via SendGrid Edge Function + activity_trail entry | Bypass trigger · simple · men dupliser pipe |
| **D. engine_event handler** | Registrer `engine_trigger` rad mapper `contracts.send.submitted` → process som dispatcher email + activity_trail | ADR-0186 aligned · mest "korrekt" arkitektur |

**Recommend:** **A** primary + **D** for cascade-coupling.

- A løser silent-dead notif-trigger umiddelbart, lite endring (4 insert-sites)
- D løser orphan engine_event for downstream cascade (D2 trigger, C4 authority-flip ved signed)
- Begge ortogonale: A gir notif til ansatt, D kobler cascade

**Affected files (A):** alle contract_event insert-sites:
- `apps/web/src/app/api/contracts/[id]/send/route.ts:76, 98`
- `apps/web/src/app/api/contracts/route.ts:254`
- `services/contract-service/src/routes/contracts.ts:117, 395, 459`
- `services/contract-service/src/routes/webhooks.ts:118` (allerede `event_type.replace(".", "_")` — sjekk om resultatet matcher)

**Affected files (D):** ny migration `supabase/migrations/<timestamp>_engine_trigger_contract_send.sql`, evt. `supabase/functions/engine-dispatch/` handler

---

## Decision 6 — Walt entry vs DocuSeal direct

**Problem:** Real path (DocuSeal konfigurert) sender mail som lenker direkte til DocuSeal signing URL. Det betyr ansatt kan signere uten å se /walt mottakerrom.

**Options:**

| Option | Real-path flow |
|---|---|
| **A. Always go via /walt** | Email-lenke peker til `/walt`, ikke direkte til DocuSeal. Walt resolver signing_url + redirector etter "Les og signer"-klikk | Walt får alltid sin tour i flowen · konsistent med dev-path |
| **B. Direct til DocuSeal** | Email peker direkte til DocuSeal signing URL · /walt aktiverer ikke ved magic-link-fetched fra inbox | Færre redirect-steps · ansatt går rett til signing |
| **C. Dual path** | Ansatte som logger inn på Smartout først → /walt. Ansatte som klikker email → DocuSeal direkte (skipper /walt) | Match bruker-kontekst · komplekst |

**Recommend:** **A** — Walt = canonical receiver-experience. Email lenke peker til `/walt` (med token-auth om ansatt ikke har konto). DocuSeal-signering trigger via Walt-knappen.

**Reason:** Walt rom-konsept (beskyttet plass, inviter-greeting, workspace-context) er Smartout-merkevare-moment. Direct-DocuSeal mister det.

**Affected:** `services/contract-service/src/routes/contracts.ts` send-mail-template (URL pattern), evt. magic-link-flow for unauthed visitor.

---

## Sammendrag — anbefalte valg

| Decision | Recommend | Why |
|---|---|---|
| 1 List-source | A. LEFT JOIN | Bevar contract-fields, simple type |
| 2 ID-mismatch | C (bundle med 1A) | Konsistent primary |
| 3 Login next= | A. Allowlist | Trygg + enkel |
| 4 Auto-redirect | B. Server layout + ?stay=1 | Lite overhead, eksplisitt opt-out |
| 5 Notif | A primary (fix payload) + D (engine_trigger) | Løser begge bonus-funn |
| 6 Walt entry | A. Always via /walt | Brand moment, konsistent |

---

## Etter at decisions er låst — plan skal dekke

1. **Build-rekkefølge** med eksplisitte deps:
   - 1A blokkerer 2C
   - 5A er parallel med alt
   - 5D krever migration → trenger Supabase Local restart
   - 4B krever 3A (login next= må virke før redirect har point)
2. **Test-strategi** per gap (unit / integration / E2E)
3. **Migration-spec** for 5D (engine_trigger insert)
4. **Tear-down** for dev-stub (når DocuSeal er på, /walt/sign-dev skal ikke fyre)
5. **Rollback-plan** hvis notif-trigger-fix gir double-fire (allerede døde insertere må ikke retroaktivt re-emit)
6. **E2E coverage** for Journey 2 + Journey 3 (real-path + dev-path varianter)
7. **Manual checklist** for UAT med ekte DocuSeal-key

---

## Ikke-decisions (allerede locked av ADRs)

- workspace_id derivation server-side (ADR-0151)
- Voice forbidden for kritisk PII (ADR-0078)
- Edge Functions via workspace-api gateway for data-endpoints (ADR-0039)
- framework_snapshot freeze på send (ADR-0244)
- Server Actions canonical for mutations (ADR-0114)
- "Web composes, mobile executes" (ADR-0133) — Walt er web-only

---

## Lovsen-integration — fremtidig hook (Phase 0c)

> Per `docs/agents/lovsen-agent/` + `docs/architecture/contract-service/CAPABILITY-legal.md`. Lovsen-persona er output-branding på `legal` capability. Lever på sin egen plugin-bane, scaffold-stadium per 2026-04-30.

**Skills som påvirker contract-flow:**

| Skill | Hook-punkt | Status |
|---|---|---|
| `aml-14-6-validator` | Mandatory gate når kontrakt går `draft → pending_signature` (eller `ready_to_send → sent`). Skal blokke send hvis §14-6-felt mangler/ugyldig | Spec ferdig, ikke koblet i send-route |
| `amendment-classifier` | Kalles når admin redigerer felt på active kontrakt → MATERIAL (re-sign) / ADMIN / DERIVED / SYSTEM / BLOCKED | Spec ferdig, ikke koblet i amendment-route |
| `riksavtalen-lookup` | Surfaces tariff-info i Walt + my-contract | Spec ferdig |
| `contract-drafter` | Foreslår kontrakt-utkast fra ansettelse-data | Spec ferdig |
| `overtid-evaluator` + `tipsregel-rådgiver` | Lønns-regel-validering | Spec ferdig |

**Plan-implikasjon:**

- Current send-route bruker frontend-`useContractReadiness` (kun required-field check, ingen §14-6 deep validation). Lovsen-`aml-14-6-validator` er strengere gate som skal kobles ved Phase 0c.
- Amendment-flow (Journey 5) trenger `amendment-classifier` før det kan skipte i prod — i dag er klassifisering hardkodet i frontend.
- Plan SKAL ikke implementere Lovsen-hooks nå (utenfor scope), men SKAL legge igjen integration-points (TODO-kommentar i send-route + amend-route + ADR-0237 reservert spor).

**Naming-ankre for plan:**

- `legal` capability = sibling til `contract` (ADR-0234) + `payroll` (ADR-0234). Phase 0a (schema) → Phase 0b (contract+payroll) → Phase 0c (legal).
- "Lovsen" = persona-branding, ikke runtime. Botsson som forblir conversational front door (ADR-0220).

---

## Canonical docs som plan må være konsistent med

| Doc | Rolle |
|---|---|
| `docs/architecture/contract-service/PRD-contracts-module.md` | Product requirements — kontrakt som levende komponent, ikke død PDF |
| `docs/architecture/contract-service/ARCHITECTURE-contracts-module.md` | Tre-lags arkitektur, designprinsipper, scope |
| `docs/architecture/contract-service/CONTRACT_COMPONENTS.md` | Component inventory med 🟢🟡🔴⚫-status (oppdatert 2026-04-30 med Walt + sign-dev + send-bridge) |
| `docs/architecture/contract-service/JOURNEY-contract-module.md` | 5 canonical journeys (Journey 2 + 3 patchet 2026-04-30 med Walt-entry + bridge-flow + bonus-funn) |
| `docs/architecture/contract-service/CAPABILITY-legal.md` | Lovsen capability spec (Phase 0c — etter denne sesjonen) |
| `docs/architecture/contract-service/schema/` | Authoritative schema-filer per tabell |

ADR-0233/0234/0235/0236 — superseder gamle ADR-0001 i contract-service (capability split, schema migration, obligation lifecycle, amendment flow).

L-0181 + L-0184 — single canonical emit producer per event name (kritisk for Decision 5).
