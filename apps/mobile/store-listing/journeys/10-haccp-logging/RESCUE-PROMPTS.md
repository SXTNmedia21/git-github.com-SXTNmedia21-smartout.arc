---
title: "Journey 10: Rescue Prompts"
journey: haccp-logging
role: manager
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — HACCP-logging

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `hub_action_tapped (haccp)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Trykket på HACCP-knappen
**Sannsynlig problem:** Brukeren finner ikke HACCP-knappen på hjemskjermen, eller vet ikke hva HACCP betyr i appen

```
Hei! 👋 Klar for temperaturkontroll?

På hjemskjermen ser du en HACCP-knapp — den kan se ut
som et termometer-ikon eller stå under "Mattrygghet".

Trykk på den for å komme til temperaturloggingen.
Der registrerer du temperaturer på kjøleskap og frysere.

Det tar bare et par minutter — trykk for å starte!
```

---

## Gate 2: `page_viewed (haccp)` ikke trigget innen 1 min etter `hub_action_tapped (haccp)`

**Bruker har:** Trykket på HACCP-knappen
**Bruker har ikke:** Sett kjøleenhet-listen
**Sannsynlig problem:** Siden lastet ikke, nettverksproblemer, eller appen krasjet ved navigasjon

```
Du trykket på HACCP — bra! 🌡️

Hvis siden ikke lastet: prøv å trekke ned for å oppdatere.
Hvis den fortsatt er tom: sjekk at du har internettforbindelse.

Kjøleenhet-listen skal vise alle enheter du trenger å logge
med navn og siste registrerte temperatur.

Prøv igjen — det ordner seg!
```

---

## Gate 3: `button_clicked (log_temperature)` ikke trigget innen 3 min etter `page_viewed (haccp)`

**Bruker har:** Sett kjøleenhet-listen
**Bruker har ikke:** Logget noen temperatur
**Sannsynlig problem:** Brukeren vet ikke hvordan de registrerer, er usikre på hva riktig temperatur er, eller nøler fordi de er redde for å gjøre feil

```
Du ser kjøleenhetene — nå er det bare å logge! 📋

Trykk på en kjøleenhet og skriv inn temperaturen du leser av.
• Kjøleskap: skal være mellom 0°C og 4°C
• Fryser: skal være under -18°C

Bare skriv det termometeret viser — appen sjekker selv
om verdien er OK eller om det er et avvik.

Du trenger ikke vurdere — bare registrer!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Temperaturene er logget! 🎉

Du har:
✓ Åpnet HACCP-logging
✓ Registrert temperaturer

Hvis noe var utenfor grenseverdiene, har appen automatisk
opprettet et avvik — du trenger ikke gjøre noe ekstra.

Mattrygghet i boks. Bra jobba! 🌡️
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                                        |
| ------ | ------- | ---------------------------------------------------- |
| Gate 1 | 2 min   | Guidende — lederen trenger hjelp til å finne knappen |
| Gate 2 | 1 min   | Rask — teknisk problem sannsynlig                    |
| Gate 3 | 3 min   | Trygg — brukeren trenger faglig trygghet             |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
