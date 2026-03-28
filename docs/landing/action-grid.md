section: action_grid
id: what-do-you-need
h2: "Hva trenger du å gjøre?"
subtitle: "Trykk på det som gjelder deg."

layout:
desktop: 4×3 grid med klikkbare kort
mobile: 2-kolonne grid, scroll

cards: # Alle 12

- id: smart-cover
  title: "Finn vikar"
  icon: 🔍
  one_liner: "Noen er syk. Hvem kan ta vakten?"
  expanded: "Systemet finner ledige + kvalifiserte → sender push →
  første ja fyller hullet. Leder godkjenner eller det skjer automatisk."

- id: daily-session
  title: "Dagens drift"
  icon: ✅
  one_liner: "Hva skal gjøres i dag?"
  expanded: "Automatisk sjekkliste per avdeling. Ansatte kvitterer.
  Leder ser status i sanntid."

- id: shift-tasks
  title: "Mine oppgaver"
  icon: 📋
  one_liner: "Ansatte vet hva de skal gjøre."
  expanded: "Ved skiftstart: push med oppgavene. Kvitter med ett trykk.
  Avvik med bilde. Sjefen slipper å bli spurt."

- id: daily-bulletin
  title: "Dagens beskjed"
  icon: 📢
  one_liner: "Én melding til alle på vakt."
  expanded: "Skriv → push til alle på vakt → kvittering synlig.
  Erstatter Facebook-gruppen."

- id: shift-swap
  title: "Vaktbytter"
  icon: 🔄
  one_liner: "Ansatte bytter. Systemet sjekker."
  expanded: "Foreslå bytte → kompetanse + arbeidstid sjekkes →
  motpart godtar → leder godkjenner."

- id: timesheet-export
  title: "Timer til lønn"
  icon: 💰
  one_liner: "Fra stempling til lønnsgrunnlag."
  expanded: "Stempling inn/ut → tillegg beregnes automatisk
  (kveld, helg, helligdag) → eksporter til regnskapsfører."

- id: shift-handoff
  title: "Overlevering"
  icon: 🤝
  one_liner: "Neste skift vet alt."
  expanded: "Dagskift oppsummerer: gjort, gjenstår, avvik.
  Kveldsskift ser alt før de starter."

- id: quick-onboard
  title: "Ny på jobb"
  icon: 👤
  one_liner: "Fra invitasjon til klar."
  expanded: "Inviter → kontrakt signeres → prosedyrer tildeles →
  readiness-score synlig → klar eller ikke klar."

- id: compliance-check
  title: "Temperatur og kontroll"
  icon: 🌡️
  one_liner: "HACCP uten permer."
  expanded: "Push til rett person → sjekk + registrer → avvik flagges →
  dokumentasjon alltid klar."

- id: week-pulse
  title: "Ukeoversikt"
  icon: 📊
  one_liner: "Alt lederen trenger. Én skjerm."
  expanded: "Bemanning, hull, forespørsler, fravær, budsjett vs. faktisk."

- id: targeted-broadcast
  title: "Melding til gruppe"
  icon: 📨
  one_liner: "Filtrer. Skriv. Send. Se hvem som leste."
  expanded: "Velg mottakere etter avdeling, rolle, vakt eller team.
  Lesekvittering per person i sanntid."

- id: escalation-alerts
  title: "Eskaleringsvarsler"
  icon: ⚠️
  one_liner: "Ingen ting glipper."
  expanded: "Ingen svar innen X min → eskaleres automatisk oppover.
  Vikarforespørsel, fravær, temperatur, oppgaver."

behavior:

- Kort viser title + one_liner som default
- Klikk → kort ekspanderer med expanded-tekst (accordion)
- Klikket kort tracker: action_card_clicked { id }
- Bransjevariant: rekkefølgen endres basert på profil.industry
  - Restaurant: smart-cover, daily-session, compliance-check først
  - Kafé: daily-bulletin, shift-tasks, timesheet-export først
  - Hotell: quick-onboard, targeted-broadcast, escalation-alerts først

```

---

## Oppdatert seksjonsflyt — komplett og endelig
```

1.  header
2.  hero
3.  qualifier ← "Hva driver du?"
4.  pain_points ← Bransjevariant (3 smertekort)
5.  action_grid ← "Hva trenger du å gjøre?" (12 handlingskort) ← NY
6.  feature_deep_0 ← Nettside (lokkemiddelet)
7.  feature_deep_1 ← Vaktplan (+ AI + cascade)
8.  feature_deep_2 ← HACCP (+ HMS-inspektør)
9.  feature_deep_3 ← Opplæring (+ reiseassistent)
10. feature_deep_4 ← Daglig drift (+ event engine)
11. feature_deep_5 ← Kommunikasjon (+ walkie-talkie + video)
12. time_savings ← "8–15 timer spart per uke"
13. comparison ← Før/etter
14. ai_section ← Mr. Botsson
15. norwegian ← Norske regler
16. social_proof
17. pricing_preview
18. founder
19. poll
20. final_cta
21. footer

```

---

## Avgrensning mot cockpit-runtime

Denne 12-korts action-griden er en **landing discovery-seksjon** for å hjelpe besøkende å kjenne igjen behov.
Den er ikke modellen for runtime first-screen i drift.

Runtime first-screen for Hospitality Operations Cockpit V1 er definert her:
`docs/superpowers/specs/2026-03-28-hospitality-operations-cockpit-v1-design.md`
```
