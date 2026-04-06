---
title: "Journey 6: Event Sequence"
journey: check-payroll
role: employee
---

# Event Cascade — Sjekke lønn

Kronologisk sekvens av telemetri-events som trigges når en ansatt sjekker lønnen sin.
Hvert event er et bevis. Hele sekvensen = journeyen er fullført.

## Tidslinje

| T+   | Brukerhandling                         | Telemetri Event                       | Kategori   |
| ---- | -------------------------------------- | ------------------------------------- | ---------- |
| 0:00 | Åpner appen                            | `page_viewed` (page: home)            | navigation |
| 0:05 | Trykker Min Side-fane                  | `page_viewed` (page: me)              | navigation |
| 0:15 | Ser lønnsestimat                       | `hub_action_tapped` (action: payroll) | navigation |
| 0:25 | Trykker på lønnslipp                   | `page_viewed` (page: payslip-detail)  | navigation |
| 0:40 | Ser beregning med grunntimer + tillegg | —                                     | —          |

## Suksesskriterier

Journey er **fullført** når ALLE disse events er registrert for samme `actor_id`:

```
✓ page_viewed (home)
✓ page_viewed (me)
✓ page_viewed (payslip-detail)
```

## Feilscenarier

| Manglende event                        | Betyr                              | Tiltak                                   |
| -------------------------------------- | ---------------------------------- | ---------------------------------------- |
| `page_viewed (home)` mangler           | Appen åpnet ikke riktig            | Sjekk crash-logs i Sentry                |
| `page_viewed (me)` mangler             | Brukeren fant ikke Min Side-fanen  | Sjekk navigasjon — er fanen synlig?      |
| `hub_action_tapped (payroll)` mangler  | Brukeren fant ikke lønnsestimat    | UX-problem — er lønn synlig på Min Side? |
| `page_viewed (payslip-detail)` mangler | Brukeren trykket ikke på lønnslipp | Sjekk om det finnes lønnsdata å vise     |
