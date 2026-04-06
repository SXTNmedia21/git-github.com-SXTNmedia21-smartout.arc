---
title: "Journey 9: Event Sequence"
journey: who-is-working
role: manager
---

# Event Cascade — Hvem er på jobb

Kronologisk sekvens av telemetri-events som trigges når en leder sjekker vakt-status.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling          | Telemetri Event                           | Kategori   |
| ---- | ----------------------- | ----------------------------------------- | ---------- |
| 0:00 | Åpner appen             | `page_viewed` (page: home)                | navigation |
| 0:05 | Trykker på vaktkort     | `page_viewed` (page: shift-hub)           | navigation |
| 0:15 | Ser listen over ansatte | —                                         | —          |
| 0:20 | Trykker ring-knapp      | `hub_action_tapped` (action: call_leader) | navigation |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (home)
✓ page_viewed (shift-hub)
```

## Feilscenarier

| Manglende event                           | Betyr                                       | Tiltak                                         |
| ----------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `page_viewed (home)` mangler              | Appen åpnet ikke riktig                     | Sjekk crash-logs i Sentry                      |
| `page_viewed (shift-hub)` mangler         | Brukeren fant ikke vaktkort på hjemskjermen | Sjekk at vaktkort vises for manager-rolle      |
| `hub_action_tapped (call_leader)` mangler | Brukeren ringte ikke                        | Ikke kritisk — brukeren valgte kanskje a vente |
