---
title: "Journey 9: Rescue Prompts"
journey: who-is-working
role: manager
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Hvem er på jobb

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `page_viewed (shift-hub)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Trykket på vaktkortet
**Sannsynlig problem:** Brukeren ser ikke vaktkortet, eller vet ikke at det er trykkbart — ledervisningen kan se annerledes ut enn forventet

```
Hei! 👋 Du er på hjemskjermen.

For å se hvem som jobber i dag: trykk på vaktkortet øverst.
Det viser dagens vakt med klokkeslett og avdeling.

Når du trykker, får du full oversikt:
• Hvem som er på jobb
• Hvem som er vaktleder
• Status på hver ansatt

Trykk på kortet — oversikten venter!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Nå har du full oversikt! 🎉

Du har:
✓ Åpnet vakthub
✓ Sett hvem som er på jobb

Herfra kan du se status, ringe ansatte, og planlegge vakten.
Tips: Statusfargene betyr — grønn = klar, gul = delvis klar, rød = trenger oppfølging.

God vakt! 💼
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                                       |
| ------ | ------- | --------------------------------------------------- |
| Gate 1 | 2 min   | Guidende — lederen trenger retning til riktig knapp |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
