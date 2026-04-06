---
title: "Journey 5: Event Sequence"
journey: report-deviation
role: employee
---

# Event Cascade — Melde avvik

Kronologisk sekvens av telemetri-events som trigges når en ansatt melder et avvik.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling              | Telemetri Event                         | Kategori   |
| ---- | --------------------------- | --------------------------------------- | ---------- |
| 0:00 | Åpner appen                 | `page_viewed` (page: home)              | navigation |
| 0:05 | Trykker "Meld avvik"        | `hub_action_tapped` (action: deviation) | navigation |
| 0:15 | Velger kategori (Sikkerhet) | —                                       | —          |
| 0:20 | Velger alvorlighet (Høy)    | —                                       | —          |
| 0:40 | Tar bilde                   | —                                       | —          |
| 1:00 | Skriver beskrivelse         | —                                       | —          |
| 1:30 | Trykker "Send"              | `deviation_reported`                    | deviations |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (home)
✓ hub_action_tapped (deviation)
✓ deviation_reported
```

## Feilscenarier

| Manglende event                         | Betyr                                         | Tiltak                                |
| --------------------------------------- | --------------------------------------------- | ------------------------------------- |
| `page_viewed (home)` mangler            | Appen åpnet ikke riktig                       | Sjekk crash-logs i Sentry             |
| `hub_action_tapped (deviation)` mangler | Brukeren fant ikke "Meld avvik"-knappen       | UX-problem — er snarveien synlig nok? |
| `deviation_reported` mangler            | Brukeren startet skjemaet men sendte ikke inn | Sjekk om skjemaet er for komplisert   |
