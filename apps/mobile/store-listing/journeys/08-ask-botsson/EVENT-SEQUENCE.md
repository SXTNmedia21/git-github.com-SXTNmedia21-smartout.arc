---
title: "Journey 8: Event Sequence"
journey: ask-botsson
role: employee
---

# Event Cascade — Spørre Mr. Botsson

Kronologisk sekvens av telemetri-events som trigges når en ansatt spør Mr. Botsson et spørsmål.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling            | Telemetri Event                              | Kategori   |
| ---- | ------------------------- | -------------------------------------------- | ---------- |
| 0:00 | Trykker Mr. Botsson FAB   | `button_clicked` (button: botsson_fab)       | navigation |
| 0:03 | Velger stemme eller tekst | `agent_session_started` (mode: voice/text)   | agent      |
| 0:10 | Stiller spørsmål          | `agent_tool_called` (tool: knowledge_lookup) | agent      |
| 0:15 | Mottar svar               | —                                            | —          |
| 0:25 | Gar tilbake               | `agent_session_closed`                       | agent      |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ button_clicked (botsson_fab)
✓ agent_session_started
✓ agent_session_closed
```

## Feilscenarier

| Manglende event                        | Betyr                          | Tiltak                                                    |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `button_clicked (botsson_fab)` mangler | Brukeren fant ikke FAB-knappen | Sjekk at FAB vises i bunnmeny                             |
| `agent_session_started` mangler        | Agenten startet ikke           | Sjekk agent-backend og nettverkstilkobling                |
| `agent_tool_called` mangler            | Agenten brukte ikke verktoy    | Sjekk agent-konfigurasjon og tilgjengelige tools          |
| `agent_session_closed` mangler         | Sesjonen ble ikke avsluttet    | Sjekk om appen krasjet eller brukeren forlot uten a lukke |
