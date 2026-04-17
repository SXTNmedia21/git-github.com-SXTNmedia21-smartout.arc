---
title: Instruksjon — Bubble.io data-innhenting for Tier 2 migrering
status: draft
updated: 2026-04-17
created: 2026-04-17
module: strike-mcp
tags: [tier2, bubble, data-gathering, instruction]
---

# Instruksjon: Hva trenger vi fra Bubble.io-databasen?

> Denne instruksjonen er skrevet av migreringsagenten (Claude Opus) til
> neste sesjon eller til Pontus. Formålet: samle inn nok informasjon om
> Bubble.io sin innholdsmodell til å designe Tier 2-migreringen
> (håndbøker, opplæring, aktiviteter, oppgaver → Smartout v3).

---

## Bakgrunn

Tier 1 (identitet + struktur + operasjonelle data) er ferdig — 10/10
entiteter genererer gyldig SQL fra live Bubble API. Tier 2 handler om
**innholdsmodellen**: håndbøker, opplæringsaktiviteter, kvalitetstester
(kvisser), oppgaver, og maler. I Bubble er dette en flat struktur. I v3
er det en hierarkisk modell:

```
policy → protocol → { procedure, routine, runbook, control_list,
                       knowledge_test, confirmation }
```

For å kartlegge Bubble → v3 trenger vi å forstå Bubble-modellen i detalj.

---

## Hva vi trenger — per entitet

### 1. Håndboken (handbooks — 26 rader i Wrightegaarden)

**Spørsmål:**
- Hva er en "håndbok" i Bubble? Er det en samling av aktiviteter, eller et selvstendig dokument?
- Hvilke felter har en håndbok? (Tittel, beskrivelse, tilhørende avdeling, status, etc.)
- Har en håndbok en liste av aktiviteter (`list of activities` eller lignende felt)?
- Er håndboken knyttet til en avdeling, et team, eller hele workspacet?
- Kan en aktivitet tilhøre flere håndbøker, eller bare én?

**Data vi trenger:**
- [ ] Bubble Data Tab → handbook entity → eksporter alle felter som CSV
- [ ] Screenshot av Bubble-editoren som viser felter + felttyper
- [ ] 2-3 eksempler på faktiske håndbøker med innhold (titler, antall aktiviteter)

### 2. Aktiviteter (training — 706 rader)

**Spørsmål:**
- Hva er en "aktivitet" i Bubble? Er det en opplæringsoppgave, en prosedyre, en manual, eller alt av dette?
- Du nevnte at aktiviteter "kan være manualer eller håndboken" — betyr det at aktivitetstypen varierer? Finnes det et `type`-felt?
- Hvilke felter har en aktivitet? Spesielt:
  - Tittel, beskrivelse, innhold (rik tekst? HTML? Markdown?)
  - Type/kategori (manual, kviss, prosedyre, etc.)
  - Tilknytning til håndbok (FK-felt?)
  - Tilknytning til avdeling/team/profil
  - Status (aktiv, arkivert, utkast?)
  - Rekkefølge/sortering innad i håndboken
- Har aktiviteter "steg" (steps) eller er de enkelt-side innhold?
- Er noen aktiviteter interaktive (kviss/test), og i så fall — hvor ligger spørsmålene?

**Data vi trenger:**
- [ ] Bubble Data Tab → training entity → eksporter alle felter som CSV
- [ ] Screenshot av feltlisten med typer
- [ ] 3-5 eksempler som viser ulike typer aktiviteter (en manual, en kviss, en prosedyre)
- [ ] Hvis det finnes et `type`-felt: liste over alle unike verdier og antall per type

### 3. Kvisser / kvalitetstester

**Spørsmål:**
- Ligger kviss-spørsmål som egne entiteter i Bubble, eller er de innebygd i aktiviteten?
- Hva er strukturen? (Spørsmål → svaralternativer → riktig svar?)
- Registreres gjennomføring per ansatt? (Hvem har bestått hvilken kviss?)
- Er det en bestått/ikke-bestått-terskel?

**Data vi trenger:**
- [ ] Bubble Data Tab → quiz/question entity (hvis separat) → eksporter felter
- [ ] Eksempler på 2-3 kvisser med spørsmål + svar
- [ ] Eventuell resultat-/gjennomførings-tabell (hvem har gjort hva)

### 4. Oppgaver (tasks — 373 rader) og deloppgaver (subtasks — 265 rader)

**Spørsmål:**
- Er "tasks" operasjonelle vaktoppgaver (f.eks. "dekk bord", "sjekk temperatur") eller administrative oppgaver?
- Er de knyttet til en vakt (shift), et team, en avdeling, eller et tidspunkt?
- Hva er forholdet mellom task og subtask? (Ren parent-child hierarki?)
- Er de gjenbrukbare maler, eller opprettet per-instans?
- Har de en gjennomføringsstatus per ansatt/vakt?

**Data vi trenger:**
- [ ] Bubble Data Tab → task entity → eksporter alle felter
- [ ] Bubble Data Tab → subtask entity → eksporter alle felter
- [ ] 3-5 eksempler på oppgaver med deloppgaver
- [ ] Hvis tilknyttet vakt: eksempler på oppgaver med shift-FK

### 5. Tillegg (supplements — 117 rader)

**Spørsmål:**
- Er dette leverandører/vareleverandører (supplier) i Bubble?
- Eller er det tilleggsinformasjon knyttet til noe annet?

**Data vi trenger:**
- [ ] Bubble Data Tab → supplement entity → eksporter alle felter
- [ ] 2-3 eksempler

### 6. Vaktmaler (shift_templates — 75 rader)

**Spørsmål:**
- Er dette forhåndsdefinerte vaktmaler (f.eks. "Lunsj-vakt 11-15")?
- Hvilke felter har de? (start_time, end_time, role, team, etc.)
- Brukes de til å opprette nye vakter automatisk (schedule generation)?

**Data vi trenger:**
- [ ] Bubble Data Tab → shift_template entity → eksporter alle felter
- [ ] 3-5 eksempler

### 7. Inventar (inventory — 32 rader)

**Spørsmål:**
- Hva spores som inventar? (Utstyr, råvarer, eller annet?)
- Er det tilknyttet en lokasjon?

**Data vi trenger:**
- [ ] Bubble Data Tab → inventory entity → eksporter alle felter

---

## Eksisterende MCP-typer

Hvis du har et eksisterende MCP (eller TypeScript-prosjekt) som modellerer
disse entitetene:

- [ ] Kopier typedefinisjonene (`.ts`-filer med `interface` eller `type`) til `docs/source/bubble-mcp-types/`
- [ ] Kopier eventuelle JSON-schemaer til `docs/source/bubble-mcp-schemas/`
- [ ] Kopier eventuelle verktøy/tool-definisjoner som viser CRUD-operasjonene

Vi trenger IKKE det kjørende MCP-et — bare typefilene så vi kan se formen
på dataen.

---

## Relasjonskartet

Den viktigste enkelt-tingen: **hvordan henger dette sammen?**

```
Håndbok
  └── har mange → Aktiviteter
        ├── type: manual (tekst/prosedyre)
        ├── type: kviss (spørsmål + svar)
        └── type: ???
              └── har mange → ???

Oppgave
  └── har mange → Deloppgaver
  └── tilknyttet → Vakt? Avdeling? Team?
```

Tegn dette kartet (eller beskriv det i tekst) og legg i
`docs/source/bubble-content-model.md`. Det er den viktigste filen for
neste sesjon.

---

## Hvor legger du filene?

```
~/dev/strike-mcp/docs/source/
├── INSTRUKSJON-BUBBLE-DATA-INNHENTING.md  ← denne filen
├── bubble-content-model.md                ← relasjonskart + modellbeskrivelse
├── bubble-mcp-types/                      ← kopierte TypeScript-typer fra MCP
│   ├── training.ts
│   ├── handbook.ts
│   └── ...
├── bubble-exports/                        ← CSV-eksporter fra Bubble Data Tab
│   ├── training.csv
│   ├── handbooks.csv
│   ├── tasks.csv
│   ├── subtasks.csv
│   └── ...
└── examples/                              ← screenshots eller markdown med eksempler
    ├── handbook-example.md
    └── quiz-example.md
```

---

## Hva skjer i neste sesjon?

1. Claude leser alt i `docs/source/`
2. Foreslår Bubble → v3 governance-hierarki-kartlegging
3. Kjører council-review på de vanskelige beslutningene
4. Attesterer de enklere entitetene (supplements, shift_templates)
5. Designer strukturell transformasjon for training → v3 policy/protocol/knowledge_test

---

*Skrevet 2026-04-17 av migreringsagenten etter Tier 1-ferdigstilling.*
