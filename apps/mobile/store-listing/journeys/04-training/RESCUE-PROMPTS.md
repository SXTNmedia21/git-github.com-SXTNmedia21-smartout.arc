---
title: "Journey 4: Rescue Prompts"
journey: training
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Obligatorisk opplæring

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `page_viewed (training)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Åpnet Opplæring-fanen
**Sannsynlig problem:** Brukeren vet ikke at de har opplæring, finner ikke fanen, eller tror opplæring skjer et annet sted

```
Hei! 👋 Du har kurs som venter på deg.

Trykk på "Opplæring" i menyen nederst på skjermen.
Der ser du kursene du skal fullføre — de er tilpasset rollen din.

Det tar ikke lang tid, og du kan gjøre det i ditt eget tempo!
```

---

## Gate 2: `protocol_step_completed` (steg 1) ikke trigget innen 5 min etter `page_viewed (protocol-detail)`

**Bruker har:** Åpnet et kurs og sett innholdet
**Bruker har ikke:** Fullført første steg
**Sannsynlig problem:** Innholdet virker overveldende, brukeren vet ikke hvordan de markerer et steg som ferdig, eller de leser men trykker ikke "Ferdig"

```
Du har åpnet kurset — bra start! 📖

Les gjennom innholdet i første steg i ditt eget tempo.
Når du er klar, trykk "Fullfør steg" eller haken nederst.

Du trenger ikke huske alt — poenget er å bli kjent med stoffet.
Ett steg om gangen!
```

---

## Gate 3: `protocol_test_submitted` ikke trigget innen 10 min etter siste `protocol_step_completed`

**Bruker har:** Fullført alle innholdsstegene i kurset
**Bruker har ikke:** Sendt inn quizen
**Sannsynlig problem:** Brukeren er nervøs for quizen, vet ikke at den finnes, eller ga opp rett før mål

```
Kjempebra — du har lest gjennom alle stegene! 🌟

Siste steg er en kort quiz. Ikke vær nervøs:
• Det er ingen tidsfrist
• Du kan lese spørsmålene i ro og mak
• Det handler om å vise at du har fått med deg det viktigste

Trykk på quiz-steget og gi det et forsøk. Du klarer dette!
```

---

## Gate 4: `protocol_completed` ikke trigget innen 3 min etter `protocol_test_submitted`

**Bruker har:** Sendt inn quizen
**Bruker har ikke:** Fått kurset markert som fullført
**Sannsynlig problem:** Quizen ble ikke bestått og brukeren vet ikke hva de skal gjøre, eller det er en teknisk feil

```
Du har levert quizen — bra jobba! 📝

Hvis kurset ikke er markert som fullført ennå, kan det hende du trenger å prøve quizen en gang til.
Sjekk om det står en tilbakemelding — den viser hva du bør lese på nytt.

Ingen stress. Du kan ta quizen så mange ganger du trenger. Les tips-en og prøv igjen!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Du er ferdig med kurset! 🎉

Du har:
✓ Åpnet opplæringen
✓ Lest gjennom alle stegene
✓ Bestått quizen

Flott innsats! Sjekk om du har flere kurs under Opplæring-fanen.
Jo flere du fullfører, jo mer klar er du for jobben.

Stolt av deg! 💪
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                       |
| ------ | ------- | ----------------------------------- |
| Gate 1 | 2 min   | Vennlig — navigasjonshjelp          |
| Gate 2 | 5 min   | Tålmodig — de leser kanskje         |
| Gate 3 | 10 min  | Forsiktig — quiz kan føles skummelt |
| Gate 4 | 3 min   | Støttende — de trenger oppmuntring  |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
