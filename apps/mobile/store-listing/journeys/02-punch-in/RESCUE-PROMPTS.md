---
title: "Journey 2: Rescue Prompts"
journey: punch-in
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Stemple inn

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `shift_punched_in` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Stemplet inn
**Sannsynlig problem:** Brukeren finner ikke stemple-knappen, vaktkortet vises ikke, eller de vet ikke at de skal stemple inn via appen

```
Hei! 👋 Du er på hjemskjermen — bra!

Ser du vaktkortet ditt øverst? Det skal stå "Vakt starter snart" eller tidspunktet for vakten din.
Trykk på den store "Stemple inn"-knappen på kortet.

Ser du ikke vaktkortet? Det kan bety at vakten din ikke er lagt inn ennå — gi beskjed til lederen din.

Du er på rett vei!
```

---

## Gate 2: `shift_punched_out` ikke trigget innen 30 min etter vaktens sluttid (etter `shift_punched_in`)

**Bruker har:** Stemplet inn og jobbet vakten
**Bruker har ikke:** Stemplet ut
**Sannsynlig problem:** Brukeren glemte å stemple ut, fant ikke ut-knappen, eller trodde det skjedde automatisk

```
Hei — vakten din er over! ⏰

Du har stemplet inn, men ikke ut ennå. Det er viktig å stemple ut slik at timene dine blir riktige.

Åpne appen og trykk på den røde "Stemple ut"-knappen på den aktive vakten din.

Glemte du det? Ingen stress — bare gjør det nå så blir alt registrert riktig.
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Bra jobba! 🎉

Du har:
✓ Stemplet inn
✓ Jobbet vakten din
✓ Stemplet ut

Timene dine er registrert. Du finner dem igjen under "Min Side" hvis du vil sjekke.

Ses neste vakt! 💪
```

---

## Timing-regler

| Gate   | Timeout                | Aggressivitet                      |
| ------ | ---------------------- | ---------------------------------- |
| Gate 1 | 2 min                  | Vennlig — de trenger bare retning  |
| Gate 2 | 30 min etter vaktslutt | Viktig — påminnelse om utstempling |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
