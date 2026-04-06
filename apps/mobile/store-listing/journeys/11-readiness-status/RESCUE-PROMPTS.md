---
title: "Journey 11: Rescue Prompts"
journey: readiness-status
role: manager
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Readiness-status

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `page_viewed (team)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Åpnet Team-fanen
**Sannsynlig problem:** Brukeren finner ikke Team-fanen i bunnmenyen, eller vet ikke at opplæringsstatus ligger der

```
Hei! 👋 Vil du sjekke hvordan det går med teamet?

Trykk på "Team" i menyen nederst på skjermen.
Der ser du alle ansatte med en prosent-score ved siden av navnet.

Prosenten viser hvor langt hver person har kommet
i opplæringen sin — 100% betyr fullt klar.

Trykk på Team for å se oversikten!
```

---

## Gate 2: `page_viewed (team/[id])` ikke trigget innen 3 min etter `page_viewed (team)`

**Bruker har:** Åpnet Team-fanen og sett teamlisten med readiness-prosenter
**Bruker har ikke:** Trykket på en ansatt for å se detaljer
**Sannsynlig problem:** Brukeren forsto ikke at navnene er trykkbare, eller vet ikke hva de skal gjøre med prosentene

```
Du ser teamoversikten — flott! 📊

Prosentene viser readiness: hvor mye opplæring hver person har fullført.
• 100% = fullt klar for alle oppgaver
• Under 100% = har kurs eller prosedyrer igjen

Trykk på en person for å se detaljene — hvilke kurs de har
fullført og hva som gjenstår.

Prøv å trykke på et navn — du får hele bildet!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Nå har du full kontroll på teamets opplæring! 🎉

Du har:
✓ Åpnet teamoversikten
✓ Sett readiness-status for en ansatt

Nå kan du følge opp hvem som trenger støtte og hvem som er klare.
Tips: Sjekk teamoversikten ukentlig — da fanger du opp de som henger etter.

Du er en god leder som følger opp! 💪
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                                |
| ------ | ------- | -------------------------------------------- |
| Gate 1 | 2 min   | Guidende — lederen trenger retning           |
| Gate 2 | 3 min   | Oppmuntrende — de er inne, bare trykk videre |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
