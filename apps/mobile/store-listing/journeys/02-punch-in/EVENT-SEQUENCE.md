---
title: "Journey 2: Event Sequence"
journey: punch-in
role: employee
---

# Event Cascade — Stemple inn

Kronologisk sekvens av telemetri-events som trigges når en ansatt stempler inn, tar pause, og stempler ut.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+      | Brukerhandling                        | Telemetri Event                    | Kategori   |
| ------- | ------------------------------------- | ---------------------------------- | ---------- |
| 0:00    | Åpner appen                           | `page_viewed` (page: home)         | navigation |
| 0:10    | Ser vaktkort med "Vakt starter snart" | —                                  | —          |
| 0:20    | Trykker "Stemple inn"                 | `shift_punched_in`                 | shifts     |
| 0:30    | Ser live timer                        | `page_viewed` (page: active-shift) | navigation |
| 2:00:00 | Trykker "Start pause"                 | `shift_break_started`              | shifts     |
| 2:30:00 | Trykker "Avslutt pause"               | `shift_break_ended`                | shifts     |
| 5:00:00 | Legger til notat                      | `shift_note_added`                 | shifts     |
| 8:00:00 | Trykker "Stemple ut"                  | `shift_punched_out`                | shifts     |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (home)
✓ shift_punched_in
✓ shift_punched_out
```

## Feilscenarier

| Manglende event               | Betyr                                 | Tiltak                                |
| ----------------------------- | ------------------------------------- | ------------------------------------- |
| `page_viewed (home)` mangler  | Appen åpnet ikke riktig               | Sjekk crash-logs i Sentry             |
| `shift_punched_in` mangler    | Brukeren fant ikke stemple-knappen    | UX-problem — sjekk vaktkort-synlighet |
| `shift_break_started` mangler | Brukeren tok ikke pause (kan være OK) | Informer om pauserett                 |
| `shift_punched_out` mangler   | Brukeren glemte å stemple ut          | Push-varsel etter vaktens sluttid     |
