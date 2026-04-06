---
title: "Journey 11: Event Sequence"
journey: readiness-status
role: manager
---

# Event Cascade — Readiness-status

Kronologisk sekvens av telemetri-events som trigges når en leder sjekker en ansatts opplæringsstatus.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling                | Telemetri Event                               | Kategori   |
| ---- | ----------------------------- | --------------------------------------------- | ---------- |
| 0:00 | Åpner appen                   | `page_viewed` (page: home)                    | navigation |
| 0:05 | Trykker Team                  | `page_viewed` (page: team)                    | navigation |
| 0:10 | Ser teamliste med readiness % | —                                             | —          |
| 0:15 | Trykker på Sara               | `button_clicked` (button: team_member_detail) | navigation |
| 0:18 | Ser Saras readiness-detaljer  | `page_viewed` (page: team/[id])               | navigation |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (team)
✓ page_viewed (team/[id])
```

## Feilscenarier

| Manglende event                               | Betyr                              | Tiltak                                       |
| --------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| `page_viewed (team)` mangler                  | Brukeren fant ikke Team-fanen      | Sjekk bunnmeny-navigasjon for manager-rolle  |
| `button_clicked (team_member_detail)` mangler | Brukeren trykket ikke på en ansatt | UX-problem — teamlisten kan være forvirrende |
| `page_viewed (team/[id])` mangler             | Detaljsiden lastet ikke            | Sjekk at profil-data hentes riktig           |
