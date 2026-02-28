# HACCP og Mattilsynet

> HACCP-governance, temperaturlogging, avvikshåndtering, sertifiseringer og inspeksjonsklar dokumentasjon.

---

## Hva er HACCP?

HACCP (Hazard Analysis and Critical Control Points) er det internasjonale systemet for mattrygghet som alle serveringssteder i Norge må følge. SmartOut integrerer HACCP direkte i den daglige driften gjennom governance-modellen.

> SmartOut erstatter ikke farevurderingen din — den hjelper deg å dokumentere, overvåke og håndheve den digitalt.

---

## Hvordan SmartOut håndterer HACCP

SmartOut kobler HACCP til governance-kjeden:

| HACCP-element         | SmartOut-konsept            | Beskrivelse                               |
| --------------------- | --------------------------- | ----------------------------------------- |
| Farevurdering         | Retningslinje (type: haccp) | Definerer risikoen og kravet              |
| Kritisk kontrollpunkt | Protokoll + Asset           | Kobles til fysisk utstyr (kjøleskap, ovn) |
| Overvåking            | Rutine (via hook)           | Automatisk utløst temperaturlogging       |
| Korrigerende tiltak   | Runbook                     | Steg-for-steg ved avvik                   |
| Verifisering          | Kontrolliste                | Sjekkliste for leder                      |
| Dokumentasjon         | Driftsøkt-historikk         | Alt lagres automatisk                     |

---

## Temperaturlogging

Temperaturlogging er en rutine som utløses av session hooks:

1. **Systemet varsler** den ansatte at det er tid for temperatursjekk
2. **Den ansatte** registrerer temperaturen for hvert kontrollpunkt
3. **Systemet sjekker** om verdien er innenfor akseptable grenser
4. **Ved avvik** — systemet eskalerer automatisk og åpner korrigerende tiltak

### Temperaturgrenser

Temperaturgrenser konfigureres per asset (utstyrenhet):

- **Kjøleskap:** 0–4 °C
- **Fryser:** Under -18 °C
- **Varmholding:** Over 60 °C

> Grensene kan tilpasses per arbeidsplass basert på egne HACCP-planer og Mattilsynets krav.

---

## Avvikshåndtering

Når en temperatur eller kontrollverdi er utenfor grensene:

1. **Avviket logges** automatisk med tidspunkt, verdi og ansvarlig
2. **Korrigerende tiltak** presenteres som en runbook
3. **Leder varsles** umiddelbart via push-notifikasjon
4. **Oppfølging** — lederen bekrefter at tiltaket er gjennomført
5. **Avviket lukkes** med dokumentasjon av hva som ble gjort

---

## Sertifiseringer

SmartOut sporer ansattes HACCP-relaterte sertifiseringer:

- **Mattrygghetskurs** — Grunnleggende mattrygghetsopplæring
- **Allergenhåndtering** — Spesialkurs for allergenbevissthet
- **Brannvern** — Brannslukningskurs og evakueringsøvelser
- **Førstehjelp** — Førstehjelpskurs

Systemet varsler automatisk når sertifiseringer nærmer seg utløpsdato.

---

## Inspeksjonsklar

SmartOut gjør deg klar for Mattilsynets tilsyn:

- **Komplett logg** — All temperaturlogging, avvik og korrigerende tiltak er dokumentert
- **Sertifiseringsoversikt** — Hvem har hvilke kurs, og når utløper de
- **Eksportfunksjon** — Last ned rapporter i formater som Mattilsynet aksepterer
- **Tidslinje** — Kronologisk oversikt over alle HACCP-hendelser

> Ved tilsyn kan du vise inspektøren en komplett digital historikk direkte fra dashbordet.
