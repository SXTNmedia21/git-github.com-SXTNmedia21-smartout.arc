---
title: "Journey 3: Event Sequence"
journey: check-shifts
role: employee
---

# Event Cascade — Sjekke vakter

Kronologisk sekvens av telemetri-events som trigges når en ansatt sjekker vaktplanen sin.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling                           | Telemetri Event                    | Kategori   |
| ---- | ---------------------------------------- | ---------------------------------- | ---------- |
| 0:00 | Åpner appen                              | `page_viewed` (page: home)         | navigation |
| 0:05 | Trykker Vakter-fane                      | `shift list_viewed`                | scheduling |
| 0:15 | Ser ukevisning, blar mellom uker         | —                                  | —          |
| 0:30 | Trykker på en vakt                       | `shift detail_viewed`              | scheduling |
| 0:40 | Ser vaktdetaljer (rolle, tid, kollegaer) | `page_viewed` (page: shift-detail) | navigation |

> Journey Harness PoC (2026-04-07): `shift list_viewed` og `shift detail_viewed` er
> de to events som driver `engine_process = journey_03_check_shifts`. Begge må emittes
> server-side (Server Action) for å unngå dev-mode short-circuit i `engine-event.ts`.
> Properties må inneholde flat `entity_type: "profile"` + `entity_id: <profile_id>`
> så `engine_state`-instansen dedupliseres per ansatt.

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ shift list_viewed
✓ shift detail_viewed
```

## Feilscenarier

| Manglende event               | Betyr                            | Tiltak                                       |
| ----------------------------- | -------------------------------- | -------------------------------------------- |
| `shift list_viewed` mangler   | Brukeren fant ikke Vakter-fanen  | Sjekk navigasjon — er fanen synlig?          |
| `shift detail_viewed` mangler | Brukeren trykket ikke på en vakt | Sjekk om vakter finnes i planen — tom liste? |
| `page_viewed (home)` mangler  | Appen åpnet ikke riktig          | Sjekk crash-logs i Sentry                    |
