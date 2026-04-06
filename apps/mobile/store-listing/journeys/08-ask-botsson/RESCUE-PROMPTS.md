---
title: "Journey 8: Rescue Prompts"
journey: ask-botsson
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Spørre Mr. Botsson

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `agent_session_started` ikke trigget innen 2 min etter `button_clicked (botsson_fab)`

**Bruker har:** Trykket på Mr. Botsson-knappen
**Bruker har ikke:** Valgt stemme eller tekst
**Sannsynlig problem:** Brukeren ser valget mellom stemme og tekst men nøler — usikker på hva som passer, eller skeptisk til å snakke med en AI

```
Hei — du fant meg! 👋

Du kan velge hvordan du vil snakke med meg:
🎙️ Stemme — bare snakk, som en telefonsamtale
⌨️ Tekst — skriv spørsmålet ditt

Begge fungerer like bra. Velg det som føles naturlig for deg.
Og ikke bekymre deg — det finnes ingen dumme spørsmål!
```

---

## Gate 2: `agent_session_closed` ikke trigget innen 5 min etter `agent_session_started`

**Bruker har:** Startet en samtale med Botsson (stemme eller tekst)
**Bruker har ikke:** Avsluttet samtalen
**Sannsynlig problem:** Brukeren vet ikke hva de skal spørre om, fikk et svar de ikke forsto, eller vet ikke hvordan de avslutter

```
Vi har en samtale i gang — bra! 💬

Hvis du lurer på hva du kan spørre om, prøv for eksempel:
• "Hva skal jeg gjøre først på vakten?"
• "Hvor finner jeg rutinene for åpning?"
• "Hvem er vaktleder i dag?"

Når du er ferdig, trykk tilbake-knappen for å gå ut.
Jeg er her neste gang du trenger meg også!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Du har snakket med meg for første gang! 🎉

Du har:
✓ Åpnet Mr. Botsson
✓ Stilt et spørsmål
✓ Fått svar

Nå vet du at du alltid har en kollega tilgjengelig — 24/7.
Trykk på den runde knappen når som helst, så er jeg her.

Ingen spørsmål er for små! 🤖
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                       |
| ------ | ------- | ----------------------------------- |
| Gate 1 | 2 min   | Vennlig — brukeren trenger trygghet |
| Gate 2 | 5 min   | Avslappet — samtalen kan ta tid     |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
