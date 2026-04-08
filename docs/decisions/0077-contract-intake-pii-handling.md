---
title: Contract Intake — PII Handling and Storage
id: ADR_0077
status: proposed
layer: decision
created: 2026-04-08
updated: 2026-04-08
---

# ADR-0077: Contract Intake — PII Handling and Storage

## Context and Problem Statement

Contract composition engine (ADR-0076) trenger å samle inn særlig kategori
personopplysninger fra ansatte: personnummer (fødselsnummer), bankkonto og
adresse. Dette skjer via en `contract_data_intake` engine_process som kan
utføres enten via statisk UI eller via Mr. Botsson agent i chat.

Personnummer er særlig kategori under Personopplysningsloven §9 og GDPR Art 9.
Bankkonto og adresse er vanlige personopplysninger under GDPR Art 6 men må
fortsatt behandles som sensitive. Dagens profile-tabell har allerede kolonner
for disse feltene (migration 00012), men det finnes ingen definert innhentings-
prosess, ingen redaction i `engine_memory`, og ingen no-echo-regel for agent-
tools.

Council session 2026-04-07 identifiserte fire kritiske risikoer som må
adresseres før noen intake-kode ship:

1. LLM-context-lekkasje: personnummer i prompt/response → lagres i logs
2. `engine_memory` embedding-store embedder PII permanent uten retention
3. Tool-echo: intake-tool returnerer lagret verdi tilbake til LLM-context
4. Voice-channel: personnummer snakket høyt over telefon ender i transcript

## Decision Drivers

- GDPR Art 5(1)(c) dataminimisering — aldri samle mer enn nødvendig
- GDPR Art 9 særlig kategori — personnummer krever eksplisitt legal basis
- GDPR Art 17 right to erasure — retention policy må være definert
- Personopplysningsloven §8 — legal basis for behandling
- Cascade invariant #1 — én source of truth per datum
- Council decision: tekst-only for kritisk datainnsamling (aldri voice)
- Botsson-arkitekturen bruker `engine_memory` som embedding store — PII må
  ikke havne der uten sensitivity-tagging

## Considered Options

1. **Store in `profile` table som nå, legg til encryption** — bruk Supabase
   Vault for personnummer, pgsodium for bankkonto. Alle data i én tabell.
2. **Separate `employment_identity` table** — flytt personnummer, bankkonto,
   og andre sensitive HR-felt ut av `profile` til en egen tabell med strammere
   RLS. Profile beholder ikke-sensitiv data.
3. **Hybrid: profile beholder kolonner (backwards compat), men all skrive- og
   lese-access må gå via stored procedures med audit + encryption** —
   migration-smertefri, enforcement via DB.

## Decision Outcome

Chosen option: **"Hybrid: profile-kolonner beholdes men access går via
RLS-beskyttede functions med sensitivity-flagging"**, because det respekterer
eksisterende schema uten stor migration, men enforcer GDPR-krav via enforcement-
lag. Option 2 (separat tabell) er arkitektonisk renere men krever migrering av
all eksisterende contract-logikk samtidig — det er scope creep.

### Storage rules

1. **Personnummer** lagres i `profile.personal_number` med pgsodium encryption
   (migration kreves). Aldri i plaintext i database, logs, backups, eller
   telemetry. Leses via `rpc_read_personal_number(profile_id)` som har RLS
   som krever samme profile eller workspace admin.

2. **Bankkonto** lagres i `profile.bank_account`, samme pgsodium-mekanisme.
   Leses via `rpc_read_bank_account(profile_id)` med samme RLS.

3. **Adresse** (`address_line_1`, `postal_code`, `city`) er ikke særlig
   kategori, lagres i plaintext men med RLS som krever workspace-tilknytning.

### No-echo rule for agent tools

**Mandatory rule for all intake tools:**

- `submit_personal_number(value)` — lagrer via rpc, returnerer
  `{ saved: true, field: 'personal_number' }`. **Aldri** returnerer `value`
  tilbake i output.
- `submit_bank_account(value)` — samme mønster
- `submit_address(value)` — samme mønster (selv om adresse er mindre sensitivt,
  konsistent regel er tryggere)

Botsson sin prompt må ha eksplisitt regel: "When you collect a personnummer or
bank account from the user, acknowledge verbally only: 'Takk, lagret.' Never
restate the value. Never confirm the digits back to them."

### engine_memory sensitivity tagging

Legg til kolonne:

```sql
ALTER TABLE engine_memory
  ADD COLUMN sensitivity TEXT CHECK (sensitivity IN ('normal', 'pii', 'legal'))
  DEFAULT 'normal';
```

Memory-manager (`services/stage-engine/src/core/memory-manager.ts`) må:

1. **Ved write:** redact personnummer (regex `/\d{6}\s?\d{5}/`) og bankkonto
   (regex for norsk kontonummer `/\d{4}\.?\d{2}\.?\d{5}/`) før embedding
2. **For intake-sessions:** alle memory-rows tagges `sensitivity='pii'` og
   får `expires_at = NOW() + INTERVAL '7 days'` (innhentings-session er
   kortvarig, ingen grunn til lang retention)
3. **Ved query:** respekter expires_at, ekskluder pii-rows fra cross-session
   context-injection

### Channel restriction

Per ADR-0078 (Engine Process Channel Restriction), `contract_data_intake`
engine_process har `allowed_channels = ['chat']`. Voice-sessions kan ikke
starte intake-prosessen — dispatcher refuser med klar feil.

Botsson sin `contract_intake` capability har `allowedChannels: ['chat']`
hardkodet som defence in depth. Tool-level guard inspekterer
`AgentToolContext.channel` ved hver tool-call og refuser hvis ikke chat.

### Retention policy

- **Aktive ansatte:** personnummer og bankkonto beholdes så lenge ansatt er
  aktiv + oppsigelsestid + 3 år etter offboarding (arbeidsmiljøloven §14-15
  om dokumentasjonskrav, bokføringsloven §13 for lønnsdata)
- **Inviterte, aldri aktiverte:** 30 dager fra invitasjon, deretter purge
- **Intake-sessions (engine_memory):** 7 dager etter siste aktivitet,
  automatisk purge via cron
- **Audit av tilgang:** hver rpc-read logger til `activity_trail` med
  `actor_id`, `target_profile_id`, `field_accessed`, `timestamp`

### Legal basis

- **GDPR Art 6(1)(b):** behandling nødvendig for å oppfylle arbeidskontrakt
- **GDPR Art 9(2)(b):** særlig kategori (personnummer) behandles for å
  oppfylle forpliktelser under arbeidsrett og sosial sikkerhet
- **Personopplysningsloven §6:** supplerer GDPR for norsk rett

## Rules & Consequences

- **Good, because** personnummer aldri er i plaintext i database eller logs
- **Good, because** agent kan ikke accidentally leake verdier tilbake til
  LLM-context via tool-echo
- **Good, because** engine_memory får expired automatically — ingen PII
  akkumulerer over tid
- **Good, because** voice-channel kan ikke starte intake — personnummer
  snakkes aldri høyt
- **Good, because** alle lesninger er auditable via activity_trail
- **Bad, because** pgsodium krever ekstra Supabase-oppsett og nøkkelhåndtering
- **Bad, because** rpc-baserte reads er mer komplekse enn direkte column-
  access — developer experience dårligere
- **Bad, because** regex-redaction i memory-manager kan miste edge cases
  (f.eks. personnummer med bindestrek, bankkonto uten separator)
- **Agent Impact:**
  - Alle intake-tools må følge no-echo-mønster eller avvises
  - Botsson sin system-prompt må ha eksplisitt PII-seksjon
  - `contract_intake` capability må ha `allowedChannels: ['chat']` hardkodet
  - Memory-manager må ha PII-redaction-middleware før embedding
  - Telemetry må aldri inkludere PII-verdier i `event.properties`
- **BLOKKERER implementasjon** av `contract_data_intake` engine_process og
  alle tilknyttede intake-tools inntil denne ADR-en er akseptert

## References

- Council session 2026-04-07 (Contract Composition Engine)
- ADR-0076 (Contract Composition as Cascade Derivation) — denne ADR-en er
  blokkerende forutsetning
- ADR-0078 (Engine Process Channel Restriction) — complementær
- docs/cross-cutting/gdpr.md (hvis eksisterer — verifiseres før implementasjon)
- docs/handoffs/HANDOFF-employee-contract-management.md (eksisterende open
  GDPR item, denne ADR resolver den)

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
