# Innstillinger

> Konfigurering, abonnement, GDPR, språk og integrasjoner — tilpass SmartOut til din bedrift.

---

## Arbeidsplassinnstillinger

Disse innstillingene gjelder per arbeidsplass:

### Generelt

- **Navn og logo** — Arbeidsplass navn og profilbilde
- **Adresse** — Fysisk adresse brukt i rapporter og kontrakter
- **Tidssone** — Standard: Europe/Oslo
- **Språk** — Norsk (standard), svensk, dansk, finsk eller engelsk
- **Valuta** — NOK (standard), SEK, DKK eller EUR

### Drift

- **Åpningstider** — Ukentlig timeplan for arbeidsplass og avdelinger
- **Pauseregler** — Automatisk pauseberegning basert på vaktlengde
- **Overtidsregler** — Når overtid begynner og hvilke tillegg som gjelder
- **Stemplingsur** — Aktiver/deaktiver, tillat sen stempling, geofencing

### Moduler

Hver modul kan aktiveres eller deaktiveres per arbeidsplass:

| Modul               | Standard                  |
| ------------------- | ------------------------- |
| Vaktplan            | Alltid aktiv              |
| Onboarding          | Aktiv                     |
| Oppgaver og rutiner | Aktiv                     |
| HACCP               | Aktiv for restaurant/kafé |
| Kommunikasjon       | Aktiv                     |
| Rapporter           | Aktiv                     |
| AI-assistent        | Aktiv                     |

---

## Bedriftsinnstillinger

Disse innstillingene gjelder for hele bedriften (alle arbeidsplasser):

### Abonnement

- **Plan** — Se gjeldende plan og bruk
- **Fakturering** — Administrer betalingsmetode (Stripe)
- **Fakturahistorikk** — Last ned tidligere fakturaer
- **Oppgrader/nedgrader** — Endre plan

### Brukeradministrasjon

- **Eiere** — Administrer hvem som har eiertilgang
- **Administratorer** — Administrer admin-tilganger
- **Invitasjoner** — Se ventende invitasjoner

---

## GDPR og personvern

SmartOut er bygget for GDPR-compliance fra grunnen:

### Databehandling

- **Sletting** — Ansatte kan be om sletting av persondata (rett til å bli glemt)
- **Eksport** — Ansatte kan laste ned alle sine persondata (dataportabilitet)
- **Samtykke** — Samtykkeadministrasjon for databehandling
- **Tilgangskontroll** — RLS (Row-Level Security) på alle tabeller

### Oppbevaring

- **Aktive data** — Lagres så lenge ansattforholdet varer
- **Arkiverte data** — Lagres i henhold til norsk lovgivning (typisk 5 år for lønnsdata)
- **Slettede data** — Fjernes permanent etter bekreftelse

> SmartOut lagrer all data innenfor EU/EØS i samsvar med Schrems II-dommen.

---

## Språk og lokalisering

SmartOut støtter fem språk:

| Språk   | Kode |
| ------- | ---- |
| Norsk   | `no` |
| Svensk  | `sv` |
| Engelsk | `en` |
| Dansk   | `da` |
| Finsk   | `fi` |

- **Arbeidsplass-språk** — Bestemmer standardspråket for alle ansatte
- **Personlig språk** — Hver ansatt kan overstyre med sitt foretrukne språk
- **Innholdssspråk** — Retningslinjer og protokoller kan ha oversettelser

---

## Integrasjoner

SmartOut integrerer med følgende tjenester:

| Tjeneste     | Formål                            | Status |
| ------------ | --------------------------------- | ------ |
| **Stripe**   | Fakturering og abonnement         | Aktiv  |
| **DocuSign** | Arbeidskontrakter og bekreftelser | Aktiv  |
| **SendGrid** | Transaksjons-e-post               | Aktiv  |
| **Twilio**   | SMS-varsler                       | Aktiv  |
| **PostHog**  | Produktanalyse                    | Aktiv  |

> Flere integrasjoner planlegges — inkludert lønnssystemer, POS-systemer og timeregistreringsverktøy.

---

## Varslingspreferanser

Administrer hvilke varsler du mottar og hvordan:

- **Push-notifikasjoner** — Aktiver/deaktiver per varseltype
- **SMS** — Velg hvilke hendelser som sender SMS
- **E-post** — Daglig oppsummering eller sanntidsvarsler
- **Stille timer** — Konfigurer når varsler dempes
