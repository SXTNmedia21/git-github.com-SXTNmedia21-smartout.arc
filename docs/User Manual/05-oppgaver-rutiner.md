# Oppgaver og rutiner

> Driftsøkter, hooks, oppgavetyper, governance-kjede og signering — slik styrer SmartOut daglig drift.

---

## Driftsøkter

En **driftsøkt** (Department Session) er den daglige operative beholderen per avdeling. Alle oppgaver, notater og overleveringer skjer innenfor en driftsøkt.

Driftsøkter genereres automatisk fra avdelingens timeplan og følger en fast livssyklus:

| Status                  | Beskrivelse                                            |
| ----------------------- | ------------------------------------------------------ |
| **Kommende**            | Planlagt, ikke startet ennå                            |
| **Aktiv**               | Pågående — oppgaver kan utføres                        |
| **Venter på signering** | Alle oppgaver fullført, venter på lederens godkjenning |
| **Lukket**              | Signert av leder, avsluttet                            |
| **Ikke gjennomført**    | Ingen viste opp — automatisk registrert                |

---

## Session hooks

Hooks er tidsbaserte triggere som fyrer av oppgaver på bestemte tidspunkter i en driftsøkt:

| Hook-type     | Når den fyrer      | Typisk bruk                              |
| ------------- | ------------------ | ---------------------------------------- |
| **pre_open**  | Før åpning         | Temperatursjekk, rengjøring, klargjøring |
| **open**      | Ved åpning         | Velkommen-rutiner, daglig briefing       |
| **scheduled** | Planlagt tidspunkt | Mellomrengjøring, temperaturlogging      |
| **pre_close** | Før stenging       | Siste bestilling, opprydding             |
| **close**     | Ved stenging       | Kasseavstemming, lukkerutiner            |

> Hooks defineres i avdelingens oppsett og kan kobles til prosedyrer, rutiner eller kontrollister.

---

## Oppgavetyper

SmartOut har seks oppgavetyper som dekker ulike behov:

### Prosedyre

En steg-for-steg-instruksjon som skal følges i rekkefølge. Hvert steg kan inneholde tekst, bilder eller video.

**Eksempel:** «Slik åpner du restauranten» — 8 steg fra å låse opp til å sette på musikken.

### Rutine

En gjentagende operativ oppgave som utføres regelmessig. Rutiner kobles til hooks for automatisk aktivering.

**Eksempel:** «Temperatursjekk kjøleskap» — Utføres ved åpning og klokken 14:00.

### Runbook

En flerstegs operativ prosess for komplekse situasjoner. Mer detaljert enn en prosedyre.

**Eksempel:** «Håndtering av matvareallergi-hendelse» — Trinn-for-trinn-guide med escaleringspunkter.

### Kontrolliste

En sjekkliste som verifiserer at rutiner og runbooks er utført korrekt. Kan kreve fotodokumentasjon.

**Eksempel:** «Lukkekontroll kjøkken» — 12 punkter som må bekreftes.

### Kunnskapstest

En quiz som tester forståelse av en retningslinje. Brukes i onboarding og periodisk opplæring.

### Bekreftelse

En digital signatur for å bekrefte at innhold er lest og forstått. Anti-ghosting-mekanisme.

---

## Governance-kjeden

Alle oppgaver er organisert i en governance-kjede:

```
Retningslinje (regelen)
  └── Protokoll (håndhevingen)
        ├── Prosedyre (lær: steg-for-steg)
        ├── Rutine (gjør: gjentagende oppgave)
        ├── Runbook (gjør: flerstegs prosess)
        ├── Kontrolliste (verifiser: sjekkliste)
        ├── Kunnskapstest (bevis: quiz)
        └── Bekreftelse (bekreft: signatur)
```

> Denne strukturen sikrer at hver operativ oppgave kan spores tilbake til den regelen den håndhever.

---

## Signering og godkjenning

Når en driftsøkt er fullført, krever systemet signering:

1. **Vaktansvarlig** fullfører alle oppgaver og notater
2. **Systemet** verifiserer at alle påkrevde oppgaver er gjennomført
3. **Leder** godkjenner økten med digital signatur
4. **Økten** lukkes og arkiveres

Signeringshistorikk lagres permanent og er tilgjengelig i rapporter og ved tilsyn.
