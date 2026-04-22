---
id: L-0107
title: "Tiered retention resolves capture-vs-retention false dichotomy"
status: accepted
date: 2026-04-22
module: MODULE_BOTSSON
tags: [learning, retention, pii, observability, design-pattern]
---

# L-0107 — Tiered retention resolves the false dichotomy

## Context
2026-04-22 council Q3 split:
- Steward + Supervisor (b): metadata only — "scope creep å fange full LLM I/O"
- Coordinator + Frontend (c): full LLM I/O — "admin kan ikke diagnostisere uten"

Begge hadde rett. Løsningen var å **separere capture policy fra retention policy**.

## Learning

**"Hva fanger vi?" og "hvor lenge beholder vi det?" er to ortogonale spørsmål.**

Når noen argumenterer mot full capture på grunn av kost/PII, er de ofte egentlig mot permanent retention. Når noen argumenterer for full capture på grunn av diagnostics, er de egentlig for **tilgang når det trengs**.

Tiered retention løser begge:

| Layer | Data | TTL | Formål |
|-------|------|-----|--------|
| Metadata | session, turn, verdict, latency | Permanent | Regression detection, analytics |
| Redacted | content med PII maskert | 90d | Diagnostics når noe går galt |
| Envelope | raw PII kryptert | 30d | Break-glass verifisering |
| Flagged | raw session (redacted) | 1 år | Evidence for alvorlige incidents |

Capture = full. Retention = tiered.

## Rule

Når design-konflikt oppstår mellom "fang mer" og "fang mindre":

1. Test om det virkelig er capture-konflikt eller skjult retention-konflikt
2. Hvis retention: løs med TTL-layers per sensitivity-class
3. Hvis genuint capture: verifiser at use-case er realistisk ("hvem leser det?")

Dette mønsteret passer også:
- Activity trail (metadata permanent, detail 90d)
- Engine event (workflow events permanent, payloads 180d)
- Audit logs (signature permanent, payload kan redacte)

## How to apply

- Spec-writer: Expliciter capture-policy og retention-policy som separate seksjoner
- ADR-reviewer: Forvent begge diskutert; flag hvis kun én er dekket
- DB-migration: Plan `pg_cron` purge per retention-layer fra dag 1

## References
- ADR-0184 §Decision punkt 3
- Spec §3.1 Retention policy
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22
