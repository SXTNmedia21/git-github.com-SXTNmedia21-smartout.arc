# SmartOut Brukermanual — Innhold

> Kanonisk innholdsreferanse for nettsidenes dokumentasjon (`/docs`).
> Alle dokumenter er på norsk. Hvert dokument mapper 1:1 til en nettside.

---

## Dokumenter

| #   | Dokument                                      | Nettside                 | Beskrivelse                                                               |
| --- | --------------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| 01  | [Kom i gang](01-kom-i-gang.md)                | `/docs/kom-i-gang`       | Opprett konto, konfigurer bedrift, sett opp arbeidsplass, inviter ansatte |
| 02  | [Onboarding](02-onboarding.md)                | `/docs/onboarding`       | Trainee-modus, modulreiser, protokollopplæring, readiness score           |
| 03  | [Vaktplan](03-vaktplan.md)                    | `/docs/vaktplan`         | Visningsmodi, vaktkort, maler, tilgjengelighet, vaktbytte, stemplingsur   |
| 04  | [Ansatte](04-ansatte.md)                      | `/docs/ansatte`          | Organisasjonsstruktur, profiler, roller, kompetansesporing                |
| 05  | [Oppgaver og rutiner](05-oppgaver-rutiner.md) | `/docs/oppgaver-rutiner` | Driftsøkter, hooks, oppgavetyper, governance-kjede, signering             |
| 06  | [HACCP](06-haccp.md)                          | `/docs/haccp`            | HACCP-governance, temperaturlogging, avvik, sertifiseringer, inspeksjon   |
| 07  | [Kommunikasjon](07-kommunikasjon.md)          | `/docs/kommunikasjon`    | Chat, varsler, kunngjøringer, eskalering, stille timer                    |
| 08  | [Lise AI-assistent](08-ai-assistent.md)       | `/docs/ai-assistent`     | 8 AI-motorer, autorisasjonsnivåer, stemme, hendelseslogg                  |
| 09  | [Rapporter](09-rapporter.md)                  | `/docs/rapporter`        | Daglig avstemming, KPI-dashboard, sesongavstemming, rapporttyper          |
| 10  | [Innstillinger](10-innstillinger.md)          | `/docs/innstillinger`    | Konfigurering, abonnement, GDPR, språk, integrasjoner                     |

---

## Kildedokumenter

Innholdet er bygget fra disse interne spesifikasjonene:

| Kilde                                                             | Dekker |
| ----------------------------------------------------------------- | ------ |
| `docs/modules/SMARTOUT_MODULE_1_ONBOARDING.md`                    | 01, 02 |
| `docs/modules/SMARTOUT_MODULE_2_ORG_STRUCTURE.md`                 | 01, 04 |
| `docs/modules/SMARTOUT_MODULE_3_SCHEDULING.md`                    | 03     |
| `docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md`                    | 05     |
| `docs/modules/SMARTOUT_MODULE_5_HACCP.md`                         | 06     |
| `docs/modules/SMARTOUT_MODULE_6_TRAINING.md`                      | 02, 04 |
| `docs/modules/SMARTOUT_MODULE_9_COMMUNICATION.md`                 | 07     |
| `docs/modules/SMARTOUT_MODULE_10_REPORTS.md`                      | 09     |
| `docs/modules/SMARTOUT_MODULE_11_SETTINGS.md`                     | 10     |
| `docs/modules/SMARTOUT_MODULE_12_AI.md`                           | 08     |
| `docs/modules/SMARTOUT_MODULE_13_MULTITENANT.md`                  | 10     |
| `docs/cross-cutting/SMARTOUT_CROSSCUT_LEGAL_GDPR_COMPLIANCE.md`   | 10     |
| `docs/cross-cutting/SMARTOUT_CROSSCUT_BILLING_STRIPE.md`          | 10     |
| `docs/cross-cutting/SMARTOUT_CROSSCUT_I18N.md`                    | 10     |
| `docs/architecture/SMARTOUT_WORKSPACE_ONBOARDING_ARCHITECTURE.md` | 01     |

---

## Vedlikehold

Når spesifikasjoner i `docs/modules/` endres, oppdater tilsvarende brukermanual-dokument og nettside.
