---
title: "Journey 3: Event Sequence"
journey: check-shifts
role: employee
---

# Event Cascade — Sjekke vakter

Kronologisk sekvens av telemetri-events som trigges når en ansatt sjekker vaktplanen sin.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling                           | Telemetri Event                         | Kategori   |
| ---- | ---------------------------------------- | --------------------------------------- | ---------- |
| 0:00 | Åpner appen                              | `page_viewed` (page: home)              | navigation |
| 0:05 | Trykker Vakter-fane                      | `page_viewed` (page: shifts)            | navigation |
| 0:15 | Ser ukevisning, blar mellom uker         | —                                       | —          |
| 0:30 | Trykker på en vakt                       | `button_clicked` (action: shift_detail) | navigation |
| 0:40 | Ser vaktdetaljer (rolle, tid, kollegaer) | `page_viewed` (page: shift-detail)      | navigation |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (shifts)
✓ button_clicked (shift_detail)
```

## Feilscenarier

| Manglende event                         | Betyr                            | Tiltak                                       |
| --------------------------------------- | -------------------------------- | -------------------------------------------- |
| `page_viewed (shifts)` mangler          | Brukeren fant ikke Vakter-fanen  | Sjekk navigasjon — er fanen synlig?          |
| `button_clicked (shift_detail)` mangler | Brukeren trykket ikke på en vakt | Sjekk om vakter finnes i planen — tom liste? |
| `page_viewed (home)` mangler            | Appen åpnet ikke riktig          | Sjekk crash-logs i Sentry                    |
