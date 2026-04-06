---
title: "Journey 5: Rescue Prompts"
journey: report-deviation
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Melde avvik

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `hub_action_tapped (deviation)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Trykket "Meld avvik"
**Sannsynlig problem:** Brukeren finner ikke avviksknappen, vet ikke at de kan melde avvik i appen, eller er usikre på om det de oppdaget faktisk er et avvik

```
Hei! 👋 Vil du melde et avvik?

På hjemskjermen finner du "Meld avvik"-knappen. Den ligger blant snarveiene.
Trykk på den for å komme i gang.

Usikker på om det er et avvik? Meld det uansett — det er bedre å si ifra en gang for mye enn en gang for lite!
```

---

## Gate 2: `deviation_reported` ikke trigget innen 5 min etter `hub_action_tapped (deviation)`

**Bruker har:** Åpnet avviksskjemaet
**Bruker har ikke:** Sendt inn avviket
**Sannsynlig problem:** For mange felter i skjemaet, usikker på hvilken kategori, kameraet ber om tillatelse og brukeren avviser, eller beskrivelsen føles vanskelig å formulere

```
Du har startet avviksmeldingen — bra at du sier ifra! 🛡️

Slik fyller du ut:
1. Velg kategori — den som passer best, den trenger ikke være perfekt
2. Velg alvorlighet — er det farlig akkurat nå? Da er det "Høy"
3. Bilde er valgfritt — men det hjelper lederen din å forstå
4. Skriv en kort beskrivelse — to setninger holder

Trykk "Send" når du er klar. Lederen din får beskjed med en gang!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Avviket er meldt! 🎉

Du har:
✓ Funnet avviksskjemaet
✓ Fylt ut og sendt inn meldingen

Lederen din har fått beskjed og følger opp. Det du gjorde nå gjør arbeidsplassen tryggere for alle.

Takk for at du sa ifra! 💪
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                               |
| ------ | ------- | ------------------------------------------- |
| Gate 1 | 2 min   | Vennlig — hjelp med å finne knappen         |
| Gate 2 | 5 min   | Støttende — skjemaet kan føles overveldende |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
