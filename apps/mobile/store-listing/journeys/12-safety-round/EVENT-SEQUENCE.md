---
title: "Journey 12: Event Sequence"
journey: safety-round
role: manager
---

# Event Cascade — Vernerunde

Kronologisk sekvens av telemetri-events som trigges når en leder gjennomforer vernerunde.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling                   | Telemetri Event                               | Kategori   |
| ---- | -------------------------------- | --------------------------------------------- | ---------- |
| 0:00 | Åpner appen                      | `page_viewed` (page: home)                    | navigation |
| 0:05 | Trykker Sikkerhet                | `hub_action_tapped` (action: safety)          | navigation |
| 0:10 | Åpner Vernerunde                 | `page_viewed` (page: safety-round)            | navigation |
| 0:15 | Punkt 1: Ja ✓                    | `button_clicked` (button: checklist_item)     | navigation |
| 0:20 | Punkt 2: Ja ✓                    | `button_clicked` (button: checklist_item)     | navigation |
| 0:25 | Punkt 3: Ja ✓                    | `button_clicked` (button: checklist_item)     | navigation |
| 0:30 | Punkt 4: Nei — registrerer avvik | `button_clicked` (button: checklist_item)     | navigation |
| 0:45 | Avvik opprettet med bilde        | `deviation_reported` (type: safety_round)     | deviations |
| 0:50 | Punkt 5-12: Ja ✓                 | `button_clicked` (button: checklist_item) x8  | navigation |
| 1:30 | Fullforer vernerunde             | `session_task_completed` (task: safety_round) | operations |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (safety-round)
✓ button_clicked (checklist_item) — minst 12 ganger
✓ session_task_completed
```

## Feilscenarier

| Manglende event                           | Betyr                               | Tiltak                                                         |
| ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `page_viewed (safety-round)` mangler      | Brukeren fant ikke Vernerunde       | Sjekk at Sikkerhet-knappen og Vernerunde-lenken fungerer       |
| `button_clicked (checklist_item)` < 12    | Ikke alle punkter ble besvart       | Sjekk at sjekklisten viser alle 12 punkter                     |
| `deviation_reported` mangler ved Nei-svar | Avvik ble ikke opprettet automatisk | Sjekk avviks-logikk for vernerunde                             |
| `session_task_completed` mangler          | Vernerunden ble ikke fullført       | Brukeren avbryt kanskje — sjekk om "Fullfor"-knappen er synlig |
