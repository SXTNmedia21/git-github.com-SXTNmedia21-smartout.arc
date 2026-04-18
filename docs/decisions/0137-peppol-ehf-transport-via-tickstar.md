---
title: "Peppol EHF Transport via Tickstar SaaS Access Point"
id: ADR-0137
status: superseded
layer: decision
module: billing
created: 2026-04-17
updated: 2026-04-18
superseded_by: ADR-0139
superseded_reason: Fase 3B rescoped — EHF-transport skjer UTENFOR Smartout. Regnskapsfører genererer EHF fra månedlig CSV/PDF-eksport og sender via sitt eget Peppol Access Point. Smartout eier bare grunnlaget + viser peppol_participant_id i eksporten. Tickstar-kontrakt er ikke inngått og kan droppes.
---

# ADR-0137: Peppol EHF Transport via Tickstar SaaS Access Point

## Context and Problem Statement

Fase 3B leverer EHF-faktura-sending via Peppol-nettverket. Smartout må bestemme transport-mekanisme: egen access point (AP) eller SaaS AP som Tickstar / Pagero / Pax8. Valg påvirker sertifiseringsløp + vedlikehold + lock-in.

## Decision Drivers

- **Sertifiseringsbyrde:** Digdir-sertifisering av egen AP tar 6-12 måneder + løpende compliance. Tickstar/Pagero har allerede sertifisering — vi piggybacker.
- **Vedlikeholds-overhead:** Peppol protokoll-endringer krever AP-oppdateringer. SaaS = vendor's problem.
- **XML-generering vs transport:** Valg gjelder TRANSPORT. XML-generering (UBL 2.1 / Peppol BIS 3.0) gjør vi selv for å unngå vendor-lock-in på dataformatet.
- **Kostnad:** Tickstar har per-message-pris. Egen AP har fast infra-kostnad. Ved lavt volum: SaaS billigere.
- **Time-to-market:** SaaS = uker. Egen AP = måneder.

## Considered Options

1. **Egen Peppol AP** (via Oxalis open-source stack) — full kontroll, ingen SaaS-kostnad, 6+ måneders sertifisering. *(Avvist for 3B.)*
2. **Tickstar SaaS AP** — sertifisert, API-basert, per-message-pricing. *(Valgt.)*
3. **Pagero SaaS AP** — samme kategori som Tickstar, ulike pricing + UI. *(Alternativ ved behov.)*
4. **Egen AP + fallback til SaaS** — kompleksitet + dobbel transport-path. *(Avvist.)*

## Decision Outcome

Chosen option: **"Tickstar SaaS AP"** for Fase 3B, fordi det gir raskest path-to-production med minimal Digdir-byrde.

**Arkitektur:**

```
[invoice data] 
  → PeppolEhfAdapter.generateXML() in packages/billing/src/dispatch/adapters/peppol-ehf/
  → schematron validation (client-side, before transport)
  → POST to Tickstar API endpoint
  → Tickstar delivers via Peppol network
  → Tickstar callback (future: webhook) → invoice_dispatch.status update
```

**Smartout eier:** XML-generering + schematron + data-modell. Tickstar eier: transport + Peppol-handshake + Digdir-compliance-for-transport.

**Credentials:** Tickstar API-key lagret som `op://smartout_ai/tickstar/api_key` (platform-level, ikke per-workspace — Tickstar er Smartouts konto hos Tickstar).

**Digdir-sertifisering:** Smartout må likevel være registrert som Peppol-deltaker (sender), selv når vi bruker Tickstar. Dette er én-gangs prosess (dager, ikke uker). Orgnr-basert registration via Digdir portal.

**Ikke vendor-lock-in:** hvis vi bytter fra Tickstar til Pagero i Fase 4, endrer kun `PeppolEhfAdapter.transport()`-metoden. XML-generatoren forblir.

## Rules & Consequences

- **Good, because** time-to-production reduseres fra 6+ måneder (egen AP) til uker (Tickstar)
- **Good, because** Digdir-certification burden flyttes til Tickstar for transport
- **Good, because** XML-generering eies av Smartout → minimal vendor-lock-in
- **Good, because** ingen egen Peppol-infra å drifte
- **Bad, because** per-message-kostnad (vs. fast infra-kostnad) — break-even ved høyt volum kan favorisere egen AP
- **Bad, because** Tickstar outage = Smartout EHF-delivery outage (SPOF)
- **Agent Impact:** `PeppolEhfAdapter.send()` POSTer til Tickstar, IKKE direkte til Peppol AP. Hvis Tickstar API endrer shape, det er en kjent risk — adapter gjør bare én HTTP call + retry. Fallback til Pagero-adapter er en Fase 4-konsiderasjon, ikke 3B.

---

> Register in `docs/decisions/0000-decision-log.md`.
