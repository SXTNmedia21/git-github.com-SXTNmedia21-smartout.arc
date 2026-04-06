---
title: "Journey 1: Event Sequence"
journey: first-day
role: employee
---

# Event Cascade — Første arbeidsdag

Kronologisk sekvens av telemetri-events som trigges når en ny ansatt gjennomfører Journey 1.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling             | Telemetri Event                             | Kategori   |
| ---- | -------------------------- | ------------------------------------------- | ---------- |
| 0:00 | Åpner invitasjonslenke     | `page_viewed` (deeplink: /invite)           | navigation |
| 0:15 | Aksepterer invitasjon      | `invitation_accepted`                       | onboarding |
| 0:30 | Oppretter konto            | `auth signed_up`                            | auth       |
| 0:45 | Logger inn første gang     | `auth signed_in`                            | auth       |
| 1:00 | Onboarding steg 1 fullført | `onboarding_step_completed` (step: profile) | onboarding |
| 1:30 | Ser hjemskjermen           | `page_viewed` (page: home)                  | navigation |
| 2:00 | Trykker på vaktkort        | `hub_action_tapped` (action: shift_detail)  | navigation |
| 2:30 | Ser vaktleder              | `page_viewed` (page: shift-hub)             | navigation |
| 3:00 | Ser opplæringsliste        | `page_viewed` (page: training)              | navigation |
| 3:30 | Åpner første kurs          | `protocol_assigned` (auto-tildelt)          | training   |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ auth signed_up
✓ auth signed_in
✓ invitation_accepted
✓ page_viewed (home)
✓ hub_action_tapped (shift_detail)
```

## Feilscenarier

| Manglende event               | Betyr                                   | Tiltak                     |
| ----------------------------- | --------------------------------------- | -------------------------- |
| `auth signed_up` mangler      | Brukeren kom aldri gjennom registrering | Sjekk invitasjonslenken    |
| `invitation_accepted` mangler | Koden ble ikke godtatt                  | Sjekk arbeidsplasskode     |
| `page_viewed (home)` mangler  | Appen krasjet etter login               | Sjekk crash-logs i Sentry  |
| `hub_action_tapped` mangler   | Brukeren fant ikke vaktkort             | UX-problem — redesign hjem |
