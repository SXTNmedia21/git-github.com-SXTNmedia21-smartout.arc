---
title: "Journey 7: Event Sequence"
journey: team-chat
role: employee
---

# Event Cascade — Teamchat

Kronologisk sekvens av telemetri-events som trigges når en ansatt sender melding i teamchat.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling        | Telemetri Event                                 | Kategori   |
| ---- | --------------------- | ----------------------------------------------- | ---------- |
| 0:00 | Åpner appen           | `page_viewed` (page: home)                      | navigation |
| 0:05 | Trykker Kanaler-fane  | `page_viewed` (page: chat)                      | navigation |
| 0:10 | Åpner aktiv vaktkanal | `channel_read` (channel: shift-channel)         | channels   |
| 0:20 | Skriver melding       | —                                               | —          |
| 0:25 | Sender melding        | `channel_message_sent` (channel: shift-channel) | channels   |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (chat)
✓ channel_read
✓ channel_message_sent
```

## Feilscenarier

| Manglende event                | Betyr                            | Tiltak                                     |
| ------------------------------ | -------------------------------- | ------------------------------------------ |
| `page_viewed (chat)` mangler   | Brukeren fant ikke Kanaler-fanen | Sjekk bunnmeny-navigasjon                  |
| `channel_read` mangler         | Vaktkanalen vises ikke           | Sjekk at brukeren er tilknyttet aktiv vakt |
| `channel_message_sent` mangler | Melding ble ikke sendt           | Sjekk nettverkstilkobling og chat-backend  |
