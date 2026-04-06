---
title: "Journey 3: Rescue Prompts"
journey: check-shifts
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Sjekke vakter

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `page_viewed (shifts)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Åpnet Vakter-fanen
**Sannsynlig problem:** Brukeren vet ikke hvor vaktlisten er, ser ikke menyen nederst, eller tror vaktkortet på hjem er alt som finnes

```
Hei! 👋 Du er på hjemskjermen — fint!

For å se alle vaktene dine: trykk på "Vakter" i menyen helt nederst på skjermen.
Der får du full oversikt over hele uken — og du kan bla frem for å se neste uke også.

Vaktkortet på hjem viser bare neste vakt. Hele planen finner du under Vakter-fanen!
```

---

## Gate 2: `button_clicked (shift_detail)` ikke trigget innen 3 min etter `page_viewed (shifts)`

**Bruker har:** Åpnet Vakter-fanen og sett ukevisningen
**Bruker har ikke:** Trykket på en vakt for å se detaljer
**Sannsynlig problem:** Listen er tom (ingen vakter planlagt), brukeren vet ikke at vaktene er trykkbare, eller de bare tittet og gikk videre

```
Bra — du ser vaktlisten din! 📋

Prøv å trykke på en av vaktene i listen. Da får du se:
• Nøyaktig tid og avdeling
• Hvem du jobber med
• Din rolle på vakten

Ser du ingen vakter? Da er planen kanskje ikke lagt ennå — spør lederen din.

Bare trykk på en vakt så ser du detaljene!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Nå har du kontroll! 🎉

Du har:
✓ Funnet vaktlisten din
✓ Sett detaljene for en vakt

Nå vet du alltid når du jobber, med hvem, og hvilken rolle du har.
Sjekk innom Vakter-fanen jevnlig — planen kan oppdateres.

Du har full oversikt! 💪
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                                       |
| ------ | ------- | --------------------------------------------------- |
| Gate 1 | 2 min   | Vennlig — navigasjonshjelp                          |
| Gate 2 | 3 min   | Guidende — de trenger å vite at vakter er trykkbare |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
