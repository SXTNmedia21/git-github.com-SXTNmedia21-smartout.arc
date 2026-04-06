---
title: "Journey 7: Rescue Prompts"
journey: team-chat
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Teamchat

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `page_viewed (chat)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Åpnet Kanaler-fanen
**Sannsynlig problem:** Brukeren vet ikke at det finnes en chat, eller finner ikke Kanaler-fanen i bunnmenyen

```
Hei! 👋 Du er på hjemskjermen — fint!

Visste du at du kan chatte med kollegaene dine rett i appen?
Trykk på "Kanaler" i menyen nederst på skjermen.

Der finner du kanalen for vakten din, der teamet koordinerer seg.

Prøv å åpne den — du trenger ikke skrive noe ennå!
```

---

## Gate 2: `channel_read` ikke trigget innen 2 min etter `page_viewed (chat)`

**Bruker har:** Åpnet Kanaler-fanen
**Bruker har ikke:** Åpnet vaktkanalen
**Sannsynlig problem:** Brukeren ser kanallisten men vet ikke hvilken kanal de skal åpne, eller tør ikke trykke

```
Bra — du fant Kanaler! 🎉

Du ser en liste med kanaler. Den som heter noe med dagens vakt
eller avdelingen din — det er din kanal.

Trykk på den for å se hva teamet skriver.
Du kan bare lese først — ingen forventning om å skrive med en gang.

Bare åpne og ta en titt!
```

---

## Gate 3: `channel_message_sent` ikke trigget innen 3 min etter `channel_read`

**Bruker har:** Åpnet vaktkanalen og lest meldinger
**Bruker har ikke:** Sendt en melding
**Sannsynlig problem:** Brukeren er usikker på hva de skal skrive, redd for å si noe feil, eller vet ikke at det forventes

```
Du leser i kanalen — flott! 📖

Det er helt OK å starte enkelt. Prøv for eksempel:
"Hei, jeg er her!" eller "God vakt alle sammen!" 👋

Skriv i tekstfeltet nederst og trykk send-knappen.
Ingen meldinger er for korte — kollegaene dine setter pris på et hei!

Du er en del av teamet nå.
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Fantastisk — du sendte din første melding! 🎉

Du har:
✓ Funnet Kanaler
✓ Åpnet vaktkanalen
✓ Sendt en melding til teamet

Nå kan du koordinere med kollegaene dine når som helst.
Tips: Sjekk kanalen i starten av vakten — der kommer viktige beskjeder.

Bra jobba! 💬
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                             |
| ------ | ------- | ----------------------------------------- |
| Gate 1 | 2 min   | Guidende — brukeren trenger retning       |
| Gate 2 | 2 min   | Oppmuntrende — de er nær, bare velg kanal |
| Gate 3 | 3 min   | Varm — terskelen for å skrive er høy      |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
