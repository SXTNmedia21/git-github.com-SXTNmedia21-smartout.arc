---
title: "Journey 1: Rescue Prompts"
journey: first-day
role: employee
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Første arbeidsdag

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `invitation_accepted` ikke trigget innen 2 min etter `page_viewed (/invite)`

**Bruker har:** Åpnet invitasjonslenken
**Bruker har ikke:** Akseptert invitasjonen
**Sannsynlig problem:** Arbeidsplasskoden funker ikke, skjemaet er forvirrende, eller brukeren vet ikke hva de skal skrive

```
Hei! 👋 Jeg ser du har åpnet invitasjonen — bra!

Du skal nå skrive inn arbeidsplasskoden du fikk fra sjefen din.
Den er 6 siffer, f.eks. 483291. Sjekk SMS eller e-post fra arbeidsgiveren din.

Har du ikke fått noen kode? Spør lederen din — de kan sende den på nytt.

Du er nesten inne!
```

---

## Gate 2: `auth signed_up` ikke trigget innen 3 min etter `invitation_accepted`

**Bruker har:** Godtatt invitasjonen
**Bruker har ikke:** Opprettet konto
**Sannsynlig problem:** Registreringsskjemaet er forvirrende, passordkrav, eller brukeren nøler

```
Flott — du er koblet til arbeidsplassen din! 🎉

Nå trenger du bare å lage en konto. Tre ting:
1. Navnet ditt
2. E-postadressen din
3. Et passord (minst 8 tegn)

Trykk "Opprett konto" når du er klar. Det tar 30 sekunder.

Sitter du fast? Si ifra — jeg hjelper deg.
```

---

## Gate 3: `auth signed_in` ikke trigget innen 1 min etter `auth signed_up`

**Bruker har:** Opprettet konto
**Bruker har ikke:** Logget inn
**Sannsynlig problem:** Auto-innlogging feilet, brukeren ble kastet ut, eller e-postverifisering blokkerer

```
Kontoen din er opprettet! 💪

Hvis du ikke ble logget inn automatisk:
1. Trykk "Logg inn"
2. Skriv e-posten du nettopp registrerte
3. Skriv passordet ditt
4. Trykk "Logg inn"

Husker du ikke passordet allerede? Trykk "Glemt passord" — du får en lenke på e-post.
```

---

## Gate 4: `page_viewed (home)` ikke trigget innen 2 min etter `auth signed_in`

**Bruker har:** Logget inn
**Bruker har ikke:** Sett hjemskjermen
**Sannsynlig problem:** Onboarding-flow blokkerer, appen krasjet, eller brukeren lukket appen

```
Du er logget inn — nesten der! 🏁

Hvis du ser en velkomstskjerm: bare trykk "Neste" eller "Fortsett" for å komme videre.

Hvis appen ble lukket: åpne Smartout igjen — du er allerede innlogget.

Hjemskjermen venter på deg med vakten din og opplæringen du skal gjøre.
```

---

## Gate 5: `hub_action_tapped (shift_detail)` ikke trigget innen 3 min etter `page_viewed (home)`

**Bruker har:** Sett hjemskjermen
**Bruker har ikke:** Trykket på vaktkortet
**Sannsynlig problem:** Brukeren vet ikke hva de skal gjøre, eller ser ikke vaktkortet

```
Velkommen inn! Du er på hjemskjermen nå. 🏠

Ser du kortet med vakten din? Det viser når du jobber neste gang.
Trykk på det — da ser du:
• Hvem som er vaktleder i dag
• Hvilke kollegaer du jobber med
• Din rolle og avdeling

Det er din første stopp. Trykk på vaktkortet!
```

---

## Gate 6: `page_viewed (training)` ikke trigget innen 5 min etter `hub_action_tapped (shift_detail)`

**Bruker har:** Sett vaktinfo og kollegaer
**Bruker har ikke:** Åpnet opplæringslisten
**Sannsynlig problem:** Brukeren vet ikke at opplæring finnes, eller finner ikke fanen

```
Bra — du har sett vakten din og hvem du jobber med! 💼

Neste steg: opplæring. Du har noen kurs du skal fullføre før du er helt klar.

Trykk på "Opplæring" i menyen nederst på skjermen.
Der ser du kursene som er tildelt deg — ta en titt!

Ingen stress — du trenger ikke gjøre alt nå. Bare åpne listen så du vet hva som venter.
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Du er klar! 🎉

Du har:
✓ Opprettet konto
✓ Sett vakten din
✓ Møtt kollegaene dine
✓ Funnet opplæringen din

Velkommen til teamet. Hvis du lurer på noe — trykk på meg (den runde knappen) og spør. Jeg er her hele tiden.

Lykke til med første vakt! 💪
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                           |
| ------ | ------- | --------------------------------------- |
| Gate 1 | 2 min   | Vennlig — første kontakt                |
| Gate 2 | 3 min   | Hjelpsom — de er nesten inne            |
| Gate 3 | 1 min   | Rask — teknisk problem                  |
| Gate 4 | 2 min   | Rolig — kan være onboarding             |
| Gate 5 | 3 min   | Guidende — de trenger retning           |
| Gate 6 | 5 min   | Avslappet — de er inne, bare navigasjon |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
