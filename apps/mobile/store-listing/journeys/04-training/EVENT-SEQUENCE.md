---
title: "Journey 4: Event Sequence"
journey: training
role: employee
---

# Event Cascade — Obligatorisk opplæring

Kronologisk sekvens av telemetri-events som trigges når en ansatt gjennomfører et kurs.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling           | Telemetri Event                       | Kategori   |
| ---- | ------------------------ | ------------------------------------- | ---------- |
| 0:00 | Åpner appen              | `page_viewed` (page: home)            | navigation |
| 0:05 | Trykker Opplæring-fane   | `page_viewed` (page: training)        | navigation |
| 0:15 | Åpner "Skjenkeansvarlig" | `page_viewed` (page: protocol-detail) | navigation |
| 0:30 | Fullfører steg 1         | `protocol_step_completed` (step: 1)   | training   |
| 1:30 | Fullfører steg 2         | `protocol_step_completed` (step: 2)   | training   |
| 3:00 | Fullfører steg 3         | `protocol_step_completed` (step: 3)   | training   |
| 5:00 | Fullfører steg 4         | `protocol_step_completed` (step: 4)   | training   |
| 7:00 | Sender inn quiz (steg 5) | `protocol_test_submitted`             | training   |
| 7:30 | Kurset markeres fullført | `protocol_completed`                  | training   |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (training)
✓ protocol_step_completed (minst 1)
✓ protocol_completed
```

## Feilscenarier

| Manglende event                   | Betyr                                             | Tiltak                               |
| --------------------------------- | ------------------------------------------------- | ------------------------------------ |
| `page_viewed (training)` mangler  | Brukeren fant ikke Opplæring-fanen                | Sjekk navigasjon — er fanen synlig?  |
| `protocol_step_completed` mangler | Brukeren åpnet kurset men fullførte ikke noe steg | UX-problem — er stegene forståelige? |
| `protocol_test_submitted` mangler | Brukeren droppet quizen                           | Sjekk om quiz er for vanskelig       |
| `protocol_completed` mangler      | Brukeren ga opp underveis                         | Send påminnelse + sjekk fremdrift    |
