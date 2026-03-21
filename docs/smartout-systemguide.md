---
title: "Smartout — Systemguide"
audience: power-user
language: no
updated: 2026-03-05
tags: [overview, system, operations, readiness, ai, onboarding]
note: "Norwegian version. Swedish version: SMARTOUT_SYSTEM_OVERVIEW.md"
---

# Smartout — Systemguide

> For deg som kjenner restaurantbransjen godt, men er ny med plattformen.

---

## Hva er Smartout?

Smartout er et operativt styringssystem for skiftbaserte virksomheter — restauranter, hoteller, kafeer og butikker. Det er verken et bemanningsbyrå, et lønnsystem eller et HR-verktøy. Det er plattformen som binder sammen alt det du allerede gjør hver dag: hvem som jobber, hva de skal gjøre, om de faktisk kan jobbet, og hvordan virksomheten presterer — dag for dag, sesong for sesong.

Kjernen i hele systemet er ett enkelt spørsmål: **Er personalet klart?**

Klart til å åpne kjøkkenet. Klart til å ta imot gjestene. Klart til å håndtere et mattrygghetsavvik. Klart for en ny sesong. Det er det Smartout måler, driver og rapporterer tilbake.

> **Mr. Botsson — din digitale kollega**
> Botsson er ikke et tillegg du kan velge å bruke. Han er stemmen og intelligensen i hele plattformen — alltid til stede, alltid i kontekst. En ny trainee møter én versjon av Botsson. En erfaren leder møter en annen.

---

## Organisasjonsstruktur — scenen som settes først

Før en eneste vakt kan planlegges eller en eneste oppgave opprettes, må virksomheten kartlegges. Smartout trenger å vite hvem dere er, hva dere gjør og hvor dere gjør det.

Smartout modellerer organisasjonen i følgende lag:

- **Avdelinger** — Kjøkken, Service, Bar — de operative enhetene i driften
- **Lokaler og soner** — de fysiske rommene: kjøkken, spisesal, bar, fryserom
- **Team** — dynamiske grupper innenfor en avdeling, gjerne sesongbaserte
- **Posisjoner** — roller som Servitør, Kokk, Bartender — ikke personer, men arbeidsoppgaver
- **Eiendeler (Assets)** — fryseskrinet, kaffemaskinen, kjølen ved dish — alt som krever daglig kontroll

Dette handler ikke om å tegne et tradisjonelt organisasjonskart. Det handler om å gi systemet et presist kart over virksomheten — slik at alt som skjer etterpå kan knyttes til riktig sted, riktig tidspunkt og riktig person.

---

## Sesongen — rammeverket alt henger på

En sesong er den operative tidsperioden virksomheten planlegger rundt. Det kan være sommersesong, julesesong, vintersesong eller et helt kalenderår. Sesongen er rammen — alt annet henger på den.

### Tre dimensjoner i én sesong

**1. Driften**
Hvilke team er aktive denne perioden? Hvilke retningslinjer gjelder? Hvilke menyer er tilgjengelige?

**2. Budsjettet**
Hva er omsettningsmålet for hele perioden? Smartout bryter det ned automatisk — ned til dag, ned til time — ved hjelp av tre inngangsverdier:

- Totalmålet for sesongen
- Dagsprofil — hvor stor andel av ukens omsetning faller på lørdag kontra mandag?
- Timeprofil — hvordan ser en typisk middagsservice ut time for time?

Fra disse tre verdiene genererer systemet et fullstendig omsetningsmål per time gjennom hele sesongen. Det er ikke en gjetning — det er et konkret mål. Og det målet driver direkte bemanningsbehovet.

> **Bemanning som et mål, ikke en gjetning**
> Når du vet hva du skal omsette klokken 19 på en fredag, vet du også omtrent hvor mange du trenger på jobb. Smartout kobler disse to tingene direkte.

**3. Spillifisering og anerkjennelse**
Sesongen har egne poängregler og ledertavler. Medarbeidere samler poeng gjennom perioden for utført arbeid, kompetanseutvikling og tilstedeværelse. God jobb blir synlig — ikke bare for ledelsen, men for hele teamet.

Når sesongen er over, avsluttes den formelt. Historikken lever videre som grunnlag for sammenligning, læring og planlegging av neste sesong.

---

## Vaktplanen — hvem, hva og når

Vaktplanen i Smartout er bygget som et rutenett: medarbeidere loddrett, dager vannrett. Hver celle er en vakt. Men en vakt er mer enn en tid — den er en **arbeidspakke**:

- Hvem som jobber — person og rolle
- Hvilke oppgaver som hører til vakten
- Hvilken sone eller posisjon medarbeideren dekker
- Tilknyttede rutiner og prosedyrer

Vaktplanen kjenner til fravær, åpne vakter og kostnad per dag. Det er et beslutningsgrunnlag — ikke bare en kalender.

### Lønn og arbeidsrettslige regler

Lønnstillegg, overtidsregler og avspasering styres av arbeidsmiljøloven og gjeldende tariffavtaler. Smartout beregner automatisk timelønn, kveld- og nattillegg, helgetillegg og overtid — basert på hver medarbeiders ansettelsesform, avtalte timer og faktisk arbeidstid. Du legger inn vakten. Systemet regner ut lønnsgrunnlaget.

---

## Den daglige driften — avdelingsøkten

Det finnes ett konsept i Smartout som er viktigere enn alle andre å forstå: **avdelingsøkten**.

Hver dag, for hver aktive avdeling, oppretter systemet automatisk en økt. Den er avdelingens «dag» som en styrt enhet — en container for alt som skjer fra åpning til stenging.

### Øktens livssyklus

```
Kommende → Aktiv → Venter på signering → Stengt
```

| Status              | Hva det betyr                                               |
| ------------------- | ----------------------------------------------------------- |
| Kommende            | Vakten er planlagt, men dagen har ikke begynt               |
| Aktiv               | Avdelingen er åpen — oppgaver kjøres, sjekklister fylles ut |
| Venter på signering | Driften er ferdig — ansvarlig leder går gjennom dagen       |
| Stengt              | Leder har signert — dagen er låst og arkivert               |

### Hva som finnes inne i en økt

- **Vaktene** som bemanner dagen
- **Tidspunktbaserte triggere** som automatisk aktiverer prosedyrer ved bestemte tider — åpning, lunsj, pre-stenging, stenging
- **Oppgavetavlen** — alle oppgaver for dagen, uansett om de stammer fra en vakt, en rutine, en trigger eller opprettes ad-hoc av en leder
- **Signering** — når dagen er over signerer ansvarlig leder. Uavsluttede oppgaver krever en kommentar. Overleverings-notater skrives til neste økt.

> **En økt kan ikke forsvinne**
> Den kan ikke manipuleres i etterkant. Den er et revisjonsspor — dokumentasjon på hva som skjedde, hvem som var ansvarlig og hva resultatet ble.

---

## Veikart, Reise og Protokoll

Alle arbeidsflyter i Smartout — en onboarding, en HACCP-kontroll, en daglig stenging — følger det samme underliggende mønsteret:

```
START-TRIGGER → [hendelse → hendelse → hendelse] → SLUTT-TRIGGER
```

Dette kalles et **Veikart (Roadmap)** — blueprinten som definerer hva som skal skje, i hvilken rekkefølge og med hvilke krav.

Når et Veikart kjøres i virkeligheten kalles det en **Reise (Journey)** — live-instansen som en medarbeider faktisk gjennomgår, guidet av Botsson.

Når en leder ser inn på status og fremdrift kalles det et **Protokoll** — samme data, sett fra et oversikts- og kontrollperspektiv.

| Perspektiv  | Navn              | Hva du ser                                |
| ----------- | ----------------- | ----------------------------------------- |
| Oppskriften | Veikart (Roadmap) | Blueprinten — trinn, krav, rekkefølge     |
| Opplevelsen | Reise (Journey)   | Live-instansen, guidet av Botsson         |
| Oversikten  | Protokoll         | Lederens blikk — status, beredskap, avvik |

---

## Avstemming — den digitale avleveringen

Smartout er bygget på én grunnleggende idé: hver dag må avsluttes ordentlig. Det skjer gjennom tre nivåer av avstemming.

### 1. Personalets daglige handoff

Når dagen er over gjennomfører personalet sin daglige avlevering — et strukturert sjekkpunkt med hva som er gjort, hva som gjenstår, avvik som har oppstått, og tallene systemet trenger: omsetning, kassaunderlag og notater.

Det erstatter Post-it-lappen på kjøleskapet, den muntlige praten i korridoren og Excel-arket som ingen finner igjen i morgen. Hva som skal inngå er konfigurerbart — virksomheten definerer selv sine sjekkpunkter.

### 2. Administratorens dagavstemmning

Dagen etter åpner administrator sin dagavstemmning og bekrefter at alle avvik er håndtert, meldinger er fulgt opp og omsetningen er registrert og godkjent. Dagen er ikke stengt før administrator har kvittert. Systemet markerer den som verifisert og låser den.

### 3. Uke- og månedsoversikt

Fordi hver dag registrerer sin omsetning og sine sjekkpunkter, bygges uke- og månedsoversikter automatisk opp. Ingen manuell oppsummering. Ingen ekstrapolering. Tallene finnes — fordi de ble registrert riktig, hver eneste dag.

---

## Beredskap — det viktigste målet i systemet

Beredskap er det aller viktigste begrepet i Smartout. En medarbeider er **klar** når de har fullført alle protokoller tildelt basert på rolle, avdeling og team. Ikke nesten ferdig. Ferdig.

```
Beredskapsprosent = (fullførte protokoller / tildelte protokoller) × 100
```

- **100 %** = grønt
- **Under 100 %** = i prosess
- **Trainee på første vakt uten fullført opplæring** = en risiko du kan se — og håndtere

### Styringsmodellen

| Nivå                   | Hva det er                                                   |
| ---------------------- | ------------------------------------------------------------ |
| Retningslinje (Policy) | Et regelverk, f.eks. Mattrygghet eller Brannsikring          |
| Protokoll              | Det en ansatt må gjennomføre for å oppfylle retningslinjen   |
| Prosedyre              | Trinn-for-trinn-instruksjoner som skal læres og gjennomføres |
| Kunnskapstest          | Quiz for å verifisere forståelse                             |
| Bekreftelse            | Digital signatur: «Jeg har lest og forstått dette»           |

Når en medarbeider begynner i et team, tildeles de automatisk riktige retningslinjer, riktige protokoller og riktig opplæringsinnhold. Systemet driver dem gjennom beredskapsreisen. En leder kan til enhver tid se nøyaktig hvor hver enkelt person befinner seg.

---

## HACCP og mattrygghet — som en del av driften

HACCP i Smartout er ikke et separat system. Det er den samme styringsmodellen — Retningslinje → Protokoll → Prosedyre → Rutine — anvendt på mattrygghet.

Temperaturlogging skjer via en tidsstyrt oppgave som aktiveres automatisk. Medarbeideren fyller inn temperaturen. Avvik flagges umiddelbart. Eskalering skjer automatisk etter forhåndsdefinerte regler. Korrigerende tiltak dokumenteres.

Alt er tidsstemplet. Alt er sporbart. Alt er klart for Mattilsynet.

---

## Mr. Botsson — den digitale kollegaen

Botsson er ikke en chatbot. Han er kollegaen som alltid er til stede — i onboarding, i daglig drift, i HACCP, i opplæring. Han har en tydelig personlighet og husker samtalene han har hatt.

### Tre agentroller

- **Botsson (onboarding-agenten)** — driver oppsettsintervjuet når en ny arbeidsplass konfigureres. Han stiller spørsmål, fyller inn felt og setter opp avdelinger. Her leder Botsson.
- **Mr. Botsson (den daglige assistenten)** — dashboard-hjelpen i hverdagen. Vaktplan, opplæring, operasjoner og HACCP. Her leder du.
- **Spesialagenter** — HACCP-inspektøren, vaktassistenten og andre kontekstspesifikke stemmer for bestemte arbeidsflyter.

Botsson opererer alltid med tre lag av kontekst: hvem han er og hvilken stemme han har, hvem han snakker med og hvilken historikk de har, og hva oppdraget er akkurat nå. Han er ikke generisk — han er tilpasset situasjonen.

---

## Helheten — plan, utfør, mål og lær

```
Sesongen settes opp     →  Mål, team, retningslinjer og budsjett
        ↓
Vaktplanen legges       →  Riktig person, riktig tid, riktig rolle
        ↓
Dagen åpner             →  Avdelingsøkten aktiveres automatisk
        ↓
Vaktene er i gang       →  Oppgaver, sjekklister, HACCP og Botsson
        ↓
Dagen stenger           →  Signering, daglig avstemming og låsing
        ↓
Sesongen avsluttes      →  KPI-er, rapporter, læring og neste sesong
```

**Personal er ikke en kostnad å minimere. De er en kapasitet å optimere.** Smartout gjør det målbart — fra det øyeblikket en medarbeider skriver under kontrakten, til den siste kvelden av sesongen er stemplet og låst.
