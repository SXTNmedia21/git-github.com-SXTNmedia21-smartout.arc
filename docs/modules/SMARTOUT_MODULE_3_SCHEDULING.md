---
title: "Module 3: Vaktplanlegging (Shift Planning)"
id: MODULE_03
version: "1.0"
status: canonical
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - MODULE_02
tags:
  - scheduling
  - shifts
  - calendar
  - staffing
  - open-shifts
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Modul 3: Vaktplanlegging (Shift Planning)

> **Smartout.ai** — Funksjonell dokumentasjon for migrering
> Versjon 1.0 | Februar 2026

---

## 1. Moduloversikt

Vaktplanlegging er en kjerneadministrasjonsside i Smartout som lar ledere planlegge, publisere og administrere vakter for alle ansatte. Modulen fungerer som den sentrale huben der bemanning, oppgaver, fravær, kostnader og kommunikasjon møtes i ett visuelt grensesnitt.

Modulen er designet rundt slik restauranter og hoteller faktisk tenker om bemanning: dekning per rolle, teamkapasitet og individuell tilgjengelighet. Grensesnittet støtter tre primære perspektiver og gir verktøy for daglig drift, maler og massepublisering.

---

## 2. Hovedlayout: Kalenderrutenett

Hovedvisningen er et rutenett (grid) med ansatte/jobber/team vertikalt på venstre side og dager horisontalt på toppen. Hver celle i rutenettet representerer én ansatt for én dag.

### 2.1 Rutenettstruktur

| Element             | Beskrivelse                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Venstre kolonne** | Liste over ansatte med profilbilde, navn, antall vakter og timer. Viser også Åpen vakt-seksjon (kollapsbar).                                                                                                         |
| **Dagkolonner**     | En kolonne per dag i valgt periode. Overskrift viser ukedag, dato, antall ansatte på jobb, antall vakter, og samlet kostnad (NOK).                                                                                   |
| **Vaktkort**        | Kort i cellen som viser: vaktnavn (f.eks. "1 vakt", "Servitør", "Vaske vakt"), tidsrom (08:00-16:00), rolle, statusindikator (grønn hake = fullført, grå sirkel = ikke påbegynt), og tannhjulikon for innstillinger. |
| **Fraværsmarkører** | Viser "Avspasering", "Ferie", "Ikke tilgjengelig" etc. som tags direkte i rutenettet med rosa/rød fargekoding.                                                                                                       |
| **+ Legg til info** | Knapp over hver dag for å legge til dagsinformasjon (f.eks. spesielle hendelser, notater).                                                                                                                           |
| **Kostnadslinje**   | Under dag-headeren vises estimert personalkostnad i NOK for den dagen.                                                                                                                                               |

### 2.2 Venstre sidebar

Sidebaren inneholder kontekstuell informasjon og filtrering:

- **Dagsinfo:** Viser informasjon om valgt dag (hendelser, notater, spesielle forhold)
- **Personalkostnad:** Kostnadssammendrag for valgt periode/dag
- **Åpen vakt:** Kollapsbar seksjon som lister upubliserte/ubesatte vakter som ansatte kan melde interesse for

---

## 3. Visningsmodi (Tre perspektiver)

Tre tabs øverst gir forskjellige perspektiver på det samme datasettet. Alle tre visninger bruker samme rutenett-layout men grupperer rader forskjellig.

| Tab      | Gruppering                                    | Brukstilfelle                                                                                                                                                    |
| -------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ansa** | Rader = individuelle ansatte                  | "Når jobber Jan denne uken?" Standard oversikt for å se alle ansattes vakter, tilgjengelighet og fravær. Beste for individuell planlegging og fraværshåndtering. |
| **Jobb** | Rader = stillingstyper (Kokk, Servitør, etc.) | "Har vi nok kokker fredag kveld?" Dekningsbasert visning som viser om roller er tilstrekkelig bemannet. Avslører hull i bemanningen per rolle.                   |
| **Team** | Rader = team (Kjøkken, Sal, Bar)              | "Er kjøkkenteamet dekket?" Teambasert overblikk for å se kapasitet per operasjonelt team. God for avdelingsledere som fokuserer på sitt eget team.               |

Alle visninger støtter søk og filtrering. Ansattvisningen inkluderer statistikk per ansatt (antall vakter, timer) under navnet.

---

## 4. Datovalg og Navigasjon

En datovelger-popup lar brukeren velge hvilken periode som vises i rutenettet. Kalenderen viser månedsoversikt med markering av valgt uke.

### 4.1 Periodevalg

| Alternativ | Beskrivelse                           | Kolonner i rutenett |
| ---------- | ------------------------------------- | ------------------- |
| Dag        | Viser kun én dag                      | 1 kolonne           |
| **Uke**    | Mandag til søndag (standard, markert) | 7 kolonner          |
| To uker    | To uker fra valgt start               | 14 kolonner         |
| Måned      | Hel kalendermåned                     | 28–31 kolonner      |
| Tilpasset  | Brukerdefinert start- og sluttdato    | Variabelt           |

"I dag"-knapp navigerer direkte til gjeldende uke. Piler navigerer fremover/bakover i valgt periodemodus.

---

## 5. Dag-operasjoner (Kontekstmeny)

Hver dagkolonne har en kebab-meny (tre prikker) som åpner en kontekstmeny med følgende operasjoner:

| Handling              | Beskrivelse                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Velg dag**          | Markerer dagen for masseoperasjoner (avkrysningsboks)                                                               |
| **Publiser dag**      | Publiserer alle vakter for denne dagen til ansatte. Utløser varsler basert på kanalinnstillinger.                   |
| **Avpubliser dag**    | Trekker tilbake publisering. Ansatte ser ikke lenger vaktene som publiserte.                                        |
| **Kopiere denne dag** | Kopierer hele dagens bemanningsplan til en annen valgt dag. Kopierer alle vakter med roller, tider og tilordninger. |
| **Lagre som mal**     | Lagrer dagens vaktoppsett som en gjenbrukbar mal med navn. Kan brukes som grunnlag for lignende dager.              |
| **Last inn mal**      | Laster en tidligere lagret mal inn på valgt dag. Fyller rutenettet med vakter fra malen.                            |

Malsystemet er spesielt nyttig for restauranter med faste ukemønstre (f.eks. "Fredagsoppsett" med ekstra servitører, "Mandagsminimum" med redusert bemanning).

---

## 6. Vaktdetaljer (Redigeringsmodal)

Når en vakt klikkes eller opprettes, åpnes en modal med seks faner som gir full kontroll over vakten.

### 6.1 Detaljer-fanen

| Felt                   | Beskrivelse                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Tid & dato**         | Start- og sluttid (f.eks. 08:00 – 12:00). Datoen vises i modal-headeren.                            |
| **Jobb**               | Dropdown for å velge jobbtype/vaktnavn (f.eks. "1 vakt", "Vaske vakt", "4 vakt")                    |
| **Team**               | Dropdown med team og lokasjon (f.eks. "Kokk – Bårdshaug Vegkro")                                    |
| **Ansatt**             | Dropdown for å tilordne vakten til en spesifikk ansatt                                              |
| **Vakt info**          | Viser beregnet arbeidstid (f.eks. "4,0 timer") og vaktstatus ("Ikke påbegynt", "Pågår", "Fullført") |
| **Publiseringsstatus** | Toggle mellom "Ikke publisert" og "Publisere". Kontrollerer om ansatte kan se vakten.               |
| **Varslingskanaler**   | Push / E-post / SMS knapper for å sende varsel om vakten til den ansatte                            |

### 6.2 Funksjoner-fanen

Tilleggsfunksjoner og spesialkonfigurasjoner for vakten. Innholdet her er kontekstavhengig basert på workspace-innstillinger.

### 6.3 Historie-fanen

Komplett audit trail som logger alle endringer gjort på vakten med dato, tid, hendelsestype og kommentar:

- **Created:** Når vakten ble opprettet
- **Feltendringer:** Hvilke felt som ble endret (f.eks. "new endDate")
- **Statusendringer:** Publisert, stemplet inn, fullført etc.
- Alle hendelser har tidsstempel

### 6.4 Lønnsgrunnlag-fanen

Viser lønnsrelatert informasjon for denne spesifikke vakten. Inkluderer grunnlønn, tillegg (kveld, helg, overtid etc.), og beregnet total kompensasjon. Kobles til Modul 8 (Lønn & Økonomi).

### 6.5 Oppgaver-fanen

Viser oppgavene som er tilordnet denne vakten, strukturert som en sjekkliste:

- Nummererte oppgaver med beskrivelse (f.eks. "1. Slå på oppvaskmaskinene")
- Avkrysningsboks/grønn hake for fullførte oppgaver
- To underfaner: **Oppgaver** (konkrete gjøremål) og **Rutiner** (standardprosedyrer)
- Oppgavene er predefinert per jobbtype/stilling og arves automatisk
- Status: Emoji-indikator ("Jobb utfør, bra jobbet!" med stjerne ved fullføring)
- Kan inkludere HACCP-relevante oppgaver som temperaturmålinger

### 6.6 Innstillinger-fanen

Vaktspesifikke innstillinger som overstyrer standardverdier. Kan inkludere pauser, særregler, eller spesielle betingelser for denne vakten.

---

## 7. Fravær og Tilgjengelighet

Fravær og tilgjengelighet håndteres direkte fra vaktplanleggingsrutenettet via en popover-meny.

### 7.1 Popover-handlinger

| Handling   | Beskrivelse                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------- |
| **Fravær** | Registrerer fravær (sykefravær, permisjon etc.) for ansatt på valgt dag. Kobles til Modul 7. |
| **Ferie**  | Registrerer ferie for ansatt. Trekker fra feriesaldo. Kobles til Modul 7.                    |

### 7.2 Visuelle markører

- **Avspasering:** Rosa/rød tag med ikon, viser at ansatt tar ut opparbeidet tid
- **Ikke tilgjengelig:** Rød tag nederst i cellen, indikerer at ansatt har meldt seg utilgjengelig
- **Ferie:** Markering som blokkerer vaktplanlegging for den perioden
- Fraværsmarkører tar prioritet over vaktkort i rutenettet

---

## 8. Vaktkort-anatomi

Hvert vaktkort i rutenettet er et kompakt visuelt element med følgende informasjon:

| Element                | Detaljer                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Vaktnavn**           | F.eks. "1 vakt", "Servitør", "Vaske vakt", "4 vakt"                                                |
| **Tidsrom**            | Start–slutt (f.eks. "08:00-16:00"). Viser klokkeikon med faktisk stemplingstid der relevant.       |
| **Rolle**              | Stilling/rolle (f.eks. "Servitør", "Kokk")                                                         |
| **Statusindikator**    | Grønn hake = fullført. Grå sirkel = ikke påbegynt. Kan også vise pågående-status.                  |
| **Innstillinger-ikon** | Tannhjul-ikon for hurtighandlinger og innstillinger                                                |
| **Kantlinjefarge**     | Fargekoding per type: blå = standard aktiv, gul = spesifikke roller, rød/rosa = fravær/avspasering |

---

## 9. Dag-headerstatistikk

Hver dagkolonne viser aggregerte tall i headeren som gir rask oversikt over bemanningssituasjonen:

| Ikon        | Metrikk       | Beskrivelse                                                |
| ----------- | ------------- | ---------------------------------------------------------- |
| Person-ikon | Ansatte       | Antall unike ansatte som har vakt denne dagen              |
| Liste-ikon  | Vakter        | Totalt antall planlagte vakter (kan være flere per ansatt) |
| Klokke-ikon | Timer/kostnad | Samlet arbeidstimer eller estimert personalkostnad i NOK   |

---

## 10. Søk og Filtrering

Modulen støtter søk og filtrering for raskt å finne rett ansatt, rolle eller team i et potensielt stort rutenett:

- Søk etter ansattnavn i ansattvisningen
- Filtrer per avdeling, team, lokasjon eller stilling
- Åpen vakt-seksjonen kan kollapes/ekspanderes for å fokusere på aktive ansatte
- Tre visningsmodi (Ansa/Jobb/Team) fungerer som primær filtrering

---

## 11. Vaktlivssyklus

En vakt gjennomgår følgende tilstander fra opprettelse til ferdigstillelse:

1. **Opprettet:** Vakten finnes i systemet men er ikke synlig for ansatte. Kan redigeres fritt.
2. **Tilordnet:** En ansatt er koblet til vakten. Fortsatt ikke synlig for ansatte.
3. **Publisert:** Vakten er synlig for den ansatte. Varsel sendes via valgte kanaler (Push/E-post/SMS).
4. **Pågår:** Ansatt har stemplet inn (via Punchclock i Modul 3.6). Oppgaver kan utføres.
5. **Fullført:** Ansatt har stemplet ut. Alle oppgaver er fullført. Vakten er lukket og inngår i lønnsgrunnlag.
6. **Avpublisert:** Vakten er trukket tilbake. Ansatte ser den ikke lenger. Kan republiseres.

---

## 12. Publisering og Varsling

Publisering er nøkkelmekanismen som gjør vakter synlige for ansatte.

### 12.1 Publiseringsnivåer

- **Enkeltvakt:** Via Detaljer-fanen i vaktmodalen ("Publisere"-knapp)
- **Hel dag:** Via dagkontekstmenyen ("Publiser dag")
- **Masseoperasjon:** Velg flere dager via "Velg dag" og publiser samlet

### 12.2 Varslingskanaler

Ved publisering kan leder velge varslingskanal per vakt:

- **Push:** In-app push-notifikasjon (standard, foretrukket)
- **E-post:** Via SendGrid-integrasjon
- **SMS:** Via Twilio integrasjon
- Varslingsvalg kan også konfigureres globalt per workspace

---

## 13. Malsystem for Dager

Malsystemet adresserer det faktum at de fleste restauranter har gjentakende bemanningsmønstre. En typisk uke følger samme mønster uke etter uke, med variasjoner for sesong og arrangementer.

### 13.1 Lagre som mal

- Lagrer alle vakter for én dag med roller, tider og teamtilknytning
- Malnavn gis av brukeren (f.eks. "Fredag kveld", "Rolig mandag", "Julesesong")
- Ansatttilordninger kan valgfritt inkluderes eller ekskluderes

### 13.2 Last inn mal

- Velg en eksisterende mal fra liste
- Fyller den valgte dagen med vakter fra malen
- Håndterer konflikter (eksisterende vakter på dagen) via brukervalg

### 13.3 Kopier dag

En raskere variant av malsystemet for engangskopier: kopierer alle vakter fra én dag direkte til en annen dag uten å lagre en permanent mal.

---

## 14. Integrasjonspunkter

Vaktplanleggingsmodulen er den mest sammenkoblede modulen i Smartout og berører nesten alle andre moduler:

| Modul                    | Integrasjon                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| **2. Organisasjon**      | Avdelinger, team, stillinger og lokasjoner brukes for filtrering og gruppering.          |
| **4. Oppgaver**          | Oppgaver tilordnes per vakt via Oppgaver-fanen. Fullførte oppgaver vises med grønn hake. |
| **5. HACCP**             | Temperaturmålinger og hygiene-sjekklister kan være del av vaktoppgavene.                 |
| **7. Fravær**            | Fravær og ferie registreres direkte fra rutenettet og blokkerer vaktplanlegging.         |
| **8. Lønn**              | Lønnsgrunnlag beregnes per vakt (fanen i modalen). Vaktdata er input til lønnskjøring.   |
| **9. Kommunikasjon**     | Publiseringsvarsler sendes via Push/E-post/SMS. Skift-overlevering bruker vaktdata.      |
| **12. AI (Mr. Botsson)** | Operasjonsmotoren bruker vaktdata for proaktive varsler og forslag.                      |

---

## 15. Dataentiteter (forenklet)

Følgende er de sentrale dataentitetene som ligger bak vaktplanleggingsmodulen. Disse skal detaljeres ytterligere i den fullstendige datamodellen (Modul 0.3).

| Entitet           | Nøkkelfelter                                                        | Relasjoner                    |
| ----------------- | ------------------------------------------------------------------- | ----------------------------- |
| **Shift**         | id, startTime, endTime, status, isPublished, dayCategory, workHours | Employee, Job, Team, Location |
| **ShiftTemplate** | id, name, shifts[], createdBy, workspace                            | Workspace                     |
| **ShiftTask**     | id, title, isCompleted, completedAt, order                          | Shift, Task                   |
| **ShiftHistory**  | id, shiftId, eventType, timestamp, comment                          | Shift, User                   |
| **DayInfo**       | id, date, notes, dayStats                                           | Workspace, Location           |
| **Absence**       | id, type, startDate, endDate, status                                | Employee, ApprovedBy          |

---

## 16. Migreringsnotater

Spesifikke hensyn for migrering fra Bubble til Next.js/Supabase:

- Rutenettet bør bygges som en virtualisert tabell (kun synlige celler rendres) for ytelse med mange ansatte
- Drag-and-drop bør implementeres for å flytte vakter mellom ansatte/dager
- Sanntidsoppdatering via Supabase Realtime for flerbrukerkollaborasjon
- Malsystemet lagres som JSON-strukturer i Supabase med workspace-scoping
- Publiseringslogikk utløser Edge Functions for varsling
- Vakthistorikk implementeres som append-only tabell for audit trail
- Fargekoding konfigureres per workspace, ikke hardkodes
- Kostnadsberegning per dag kjøres som aggregert view/funksjon i PostgreSQL
- RLS-policyer sikrer at ansatte kun ser publiserte vakter i sin avdeling
- Offline-støtte for stemplingsfunksjonalitet via React Native lokal lagring
