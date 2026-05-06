# Smartout · Payroll Phase 1 — Implementation Handoff

> Hei Claude Code 👋
>
> Designet i `design/Payroll Prototype.html` er **veldig bra** — Sofia / produkt-teamet er fornøyde med flowen og det visuelle. Du står helt fritt til å implementere det 1:1 som det ser ut, både visuelt og interaksjonsmessig. Hvis noe ikke matcher engine-virkeligheten — flagg det, ikke design rundt det.

## Hva ligger i denne mappen

```
handoff/
├── IMPLEMENTATION.md          ← du leser den nå
├── design/
│   ├── Payroll Prototype.html ← åpne denne i nettleser, dette er målbildet
│   └── source/                ← alle JSX-filene + tokens.css per komponent
└── spec/                      ← alle markdown-spec-er, kilden til sannhet
    ├── SORTIE-PHASE-1.md      ← scope + sprint-plan, start her
    ├── USER-FLOWS.md          ← de seks viktige flowene
    ├── MODULE_PAYROLL.md      ← engine-kontrakt
    ├── DATA-MODEL.md          ← Prisma-skjema
    ├── ARCHITECTURE.md        ← calc-pipeline
    ├── TIME-BANKS.md / -LEGAL ← timebank-engine
    ├── DYNAMIC-SUPPLEMENTS.md ← regel-DSL
    ├── EXPORTS.md             ← A-melding + Tripletex
    ├── LEGAL-FRAMEWORK.md
    ├── WORKSPACE-POLICIES.md
    ├── UI-PLAN.md
    ├── TRIPLETEX-INTEGRATION.md
    ├── BENCHMARK-PLANDAY.md
    ├── PHASES.md / OPEN-QUESTIONS.md
```

## Implementasjonsrekkefølge

Følg sprint-bryllupet i `spec/SORTIE-PHASE-1.md`. Kort versjon:

1. **Sprint 1 — Engine + data-modell**
   `DATA-MODEL.md` + `ARCHITECTURE.md` + `MODULE_PAYROLL.md`. Calc-engine må være rein og deterministisk: `(shifts, rules, employee) → derivedLines`. Ingen UI før dette står og har snapshot-tester.

2. **Sprint 2 — Period close (web)**
   Implementer skjerm 01–05 fra prototypen i denne rekkefølgen:
   - `01 · Lønnsperioder` (index)
   - `02 · Periode-detalj · Linjer` (hovedflaten — én side, tre faner)
   - `03 · Drilldown · per ansatt` (drawer fra Linjer)
   - `04 · Avvik · ack` (samme side, fane to)
   - `05 · Lås periode` (modal — eneste vei til eksport)

3. **Sprint 3 — Profile + manual edits**
   - `06 · Manuelt tillegg` modal
   - `07 · Lønnsprofil + Timebank` per ansatt — inkl. timebank-historikk fra `TIME-BANKS.md`

4. **Sprint 4 — Configuration**
   - `08 · Innstillinger` (periode-konvensjon + bekreftelses-policy)
   - `09 · Tillegg-regler + tester` — DSL fra `DYNAMIC-SUPPLEMENTS.md`. Trace-ruten i prototypen er **påkrevd** — det er hovedmekanismen for å bygge tillit til engine.
   - `10 · Bot-Sson chat` — wrapper rundt eksisterende lønnsdata, ikke ny LLM-stack.

5. **Sprint 5 — Mobile**
   - `11 · Lønn` (ny tab i ansatt-appen)
   - `12 · Lønnsslipp · detalj`
   - `13 · Timebank · historikk`
   - `14 · Bekreft OT` (push-handling, manager-on-the-go)

## Ikke-forhandlbare designprinsipper

Disse er bakt inn i prototypen — ikke endre dem uten å snakke med Sofia:

- **Calc-engine deriverer alt.** Mennesket bekrefter avvik og låser. Aldri manuell editering av deriverte linjer — bare add-on `manualSupplements`.
- **Avvik må null før lås.** Lås-knappen er disabled (grå) helt til `deviations.unacked === 0`. Hard rule.
- **Trace alt.** Hver derivert linje må kunne forklares: hvilken regel, hvilken vakt, hvilke timer. Se trace-panelet i skjerm 09.
- **Lås er irreversibel.** Etter lås: bare manuelle korrigeringer i neste periode + audit-log. Ingen "unlock" knapp.
- **Tipspott er skattepliktig** og går gjennom samme A-melding-pipe som annen lønn (se `EXPORTS.md`).
- **Rød dag ≠ automatisk +100%.** Ansatt må signere i appen, leder må bekrefte. To distincte handlinger.

## Designsystem

Alt er allerede definert i `design/source/tokens.css` (Nordic Split). Bruk disse direkte — ikke bygg nytt. Komponentene i `shared.jsx` (`Btn`, `Pill`, `Avatar`, `Switch`, `Icon` osv.) er kanoniske — port dem 1:1 til prosjektets komponentbibliotek.

Fonter:
- Heading: Instrument Serif
- Body: Geist
- Mono: Geist Mono (alle tall, koder, timestamps)

## Datapunkter prototypen mocker — du må koble til ekte kilder

| Prototypen viser | Hvor det egentlig kommer fra |
|---|---|
| Periode-totaler (brutto/netto/timer) | `payroll.calc.computePeriod()` |
| Avvik (`deviations`) | `payroll.deviations` tabell, populeres av engine + sjekklister |
| Tillegg-regler | `supplementRules` i workspace-policy |
| Timebank-saldo | `timeBank.computeBalance(employeeId)` |
| Bot-Sson sine forslag | Egen `payroll/insights` modul som spør engine |
| A-melding eksport-mål | `EXPORTS.md` — Altinn + Tripletex |

## Test-strategi

- Engine: snapshot-tester per regel × rød dag × OT-grense
- UI: én happy-path E2E per sprint (Playwright). Den viktigste: "lukk april for 12 ansatte i én økt".
- Performance-budsjett: full periode-recalc < 800 ms for 50 ansatte × 30 dager.

## Spørsmål?

Sjekk `spec/OPEN-QUESTIONS.md` først — flere er allerede svart der. Resten: ping Sofia direkte, ikke prøv å gjette.

Lykke til. Designet ligger der ferdig — du trenger bare å gjøre det ekte. 🚀
