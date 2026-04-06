---
title: "Journey 10: Event Sequence"
journey: haccp-logging
role: manager
---

# Event Cascade — HACCP-logging

Kronologisk sekvens av telemetri-events som trigges når en leder logger temperaturer.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling            | Telemetri Event                                      | Kategori   |
| ---- | ------------------------- | ---------------------------------------------------- | ---------- |
| 0:00 | Åpner appen               | `page_viewed` (page: home)                           | navigation |
| 0:05 | Trykker HACCP             | `hub_action_tapped` (action: haccp)                  | navigation |
| 0:08 | Ser kjøleenhet-liste      | `page_viewed` (page: haccp)                          | navigation |
| 0:20 | Registrerer 3.2°C (OK)    | `button_clicked` (button: log_temperature)           | navigation |
| 0:35 | Registrerer 7.8°C (avvik) | `button_clicked` (button: log_temperature)           | navigation |
| 0:40 | Automatisk avviksrapport  | `deviation_reported` (type: temperature, auto: true) | deviations |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (haccp)
✓ button_clicked (log_temperature) — minst 1 gang
```

## Feilscenarier

| Manglende event                            | Betyr                                       | Tiltak                                                        |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------- |
| `page_viewed (haccp)` mangler              | Brukeren fant ikke HACCP-knappen            | Sjekk at HACCP vises på hjemskjermen for manager              |
| `button_clicked (log_temperature)` mangler | Ingen temperaturer ble logget               | Sjekk at kjøleenhet-listen laster riktig                      |
| `deviation_reported` mangler ved avvik     | Automatisk avviksrapport ble ikke opprettet | Sjekk avviks-logikk — grenseverdier kan være feil konfigurert |
