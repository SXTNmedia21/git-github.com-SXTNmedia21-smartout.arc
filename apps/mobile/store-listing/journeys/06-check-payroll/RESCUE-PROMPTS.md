---
title: "Journey 6: Rescue Prompts"
journey: check-payroll
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Sjekke lønn

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `page_viewed (me)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Åpnet Min Side-fanen
**Sannsynlig problem:** Brukeren vet ikke hvor de finner lønnsinformasjon, ser ikke Min Side i menyen, eller leter etter "Lønn" som egen fane

```
Hei! 👋 Vil du sjekke lønnen din?

Lønnsoversikten finner du under "Min Side" — trykk på fanen helt til høyre i menyen nederst.
Der ser du lønnsestimatet ditt og alle lønnslippene dine.

Det er ikke en egen "Lønn"-fane — alt ligger samlet under Min Side!
```

---

## Gate 2: `hub_action_tapped (payroll)` ikke trigget innen 3 min etter `page_viewed (me)`

**Bruker har:** Åpnet Min Side
**Bruker har ikke:** Trykket på lønnsestimatet
**Sannsynlig problem:** Lønnsestimatet er ikke synlig (ingen lønnsdata ennå), brukeren scroller ikke langt nok ned, eller de ser ikke at det er trykkbart

```
Du er på Min Side — bra! 💰

Ser du lønnsestimatet ditt? Det viser hva du har tjent så langt denne perioden.
Trykk på det for å se hele oversikten.

Ser du ikke noe lønnsestimat? Det kan bety at du ikke har stemplet noen vakter ennå.
Etter første vakt dukker tallene opp automatisk!
```

---

## Gate 3: `page_viewed (payslip-detail)` ikke trigget innen 3 min etter `hub_action_tapped (payroll)`

**Bruker har:** Sett lønnsestimatet
**Bruker har ikke:** Åpnet en lønnslipp for detaljer
**Sannsynlig problem:** Ingen lønnslipp å trykke på (for ny ansatt), brukeren forstår ikke at de kan trykke videre, eller de er fornøyd med estimatet og trenger ikke mer detaljer

```
Flott — du ser lønnsestimatet ditt! 📊

For å se hele beregningen med grunntimer, tillegg og trekk:
Trykk på en lønnslipp i listen under estimatet.

Der får du se nøyaktig hva hver time er verdt og hvilke tillegg du har fått.

Ingen lønnslipp i listen? Den dukker opp etter at lønnsperioden er avsluttet.
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Nå har du oversikt over lønnen din! 🎉

Du har:
✓ Funnet Min Side
✓ Sett lønnsestimatet ditt
✓ Åpnet en lønnslipp med detaljer

Nå kan du alltid sjekke hva du har tjent. Estimatet oppdateres etter hver vakt.

Full kontroll! 💪
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                       |
| ------ | ------- | ----------------------------------- |
| Gate 1 | 2 min   | Vennlig — navigasjonshjelp          |
| Gate 2 | 3 min   | Hjelpsom — kan være tomt for data   |
| Gate 3 | 3 min   | Avslappet — de har kanskje sett nok |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
