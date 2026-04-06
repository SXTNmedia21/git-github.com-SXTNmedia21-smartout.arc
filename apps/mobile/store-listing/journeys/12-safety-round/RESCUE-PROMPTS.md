---
title: "Journey 12: Rescue Prompts"
journey: safety-round
role: manager
trigger: failed gate → Botsson intervenes
---

# Rescue Prompts — Vernerunde

Når en gate failer, sender systemet en prompt til Mr. Botsson som umiddelbart kontakter brukeren med støtte, veiledning og motivasjon. Botsson vet hvor brukeren er, hvor de har vært, og hvor de skal.

---

## Gate 1: `hub_action_tapped (safety)` ikke trigget innen 2 min etter `page_viewed (home)`

**Bruker har:** Åpnet appen og sett hjemskjermen
**Bruker har ikke:** Trykket på Sikkerhet-knappen
**Sannsynlig problem:** Brukeren finner ikke Sikkerhet-knappen på hjemskjermen, eller vet ikke at vernerunden starter derfra

```
Hei! 👋 Klar for vernerunde?

På hjemskjermen finner du en "Sikkerhet"-knapp.
Trykk på den — der starter du vernerunden.

Vernerunden er en sjekkliste med 12 punkter som sikrer
at arbeidsplassen er trygg for alle.

Det tar ca. 10 minutter. Trykk for å starte!
```

---

## Gate 2: `page_viewed (safety-round)` ikke trigget innen 1 min etter `hub_action_tapped (safety)`

**Bruker har:** Trykket på Sikkerhet-knappen
**Bruker har ikke:** Åpnet selve vernerunden
**Sannsynlig problem:** Sikkerhet-menyen har flere valg og brukeren vet ikke at de skal velge "Vernerunde", eller siden lastet ikke

```
Du er i Sikkerhet-seksjonen — bra! 🛡️

Trykk på "Vernerunde" for å åpne sjekklisten.
Hvis du ser flere valg — det er Vernerunde du skal ha.

Hvis siden ikke laster: prøv å trekke ned for å oppdatere.

Sjekklisten venter på deg!
```

---

## Gate 3: `button_clicked (checklist_item)` (første) ikke trigget innen 3 min etter `page_viewed (safety-round)`

**Bruker har:** Åpnet vernerunde-sjekklisten
**Bruker har ikke:** Besvart første punkt
**Sannsynlig problem:** Brukeren leser alle punktene først og nøler, er usikker på hva "Ja" og "Nei" betyr i praksis, eller vet ikke at de skal starte øverst

```
Du ser sjekklisten — perfekt! 📋

Start med punkt 1 øverst. For hvert punkt:
• Ja ✓ = alt er i orden
• Nei ✗ = noe må fikses (du får registrere avvik)

Du trenger ikke inspisere noe fysisk først — svar ut fra
det du allerede vet og ser.

Bare trykk Ja eller Nei på første punkt — resten følger!
```

---

## Gate 4: `button_clicked (checklist_item)` (4-6 av 12) ikke trigget innen 5 min etter forrige punkt

**Bruker har:** Besvart de første punktene
**Bruker har ikke:** Fortsatt videre i sjekklisten
**Sannsynlig problem:** Brukeren stoppet opp ved et punkt de er usikre på, eller ble avbrutt av noe annet på jobben

```
Du er godt i gang — allerede gjennom de første punktene! 💪

Hvis du er usikker på et punkt: svar det du tror er riktig.
Det er bedre å svare "Nei" og opprette et avvik enn å hoppe over.

Ble du avbrutt? Ingen stress — sjekklisten husker hvor du var.
Bare fortsett der du slapp.

Du er nesten halvveis!
```

---

## Gate 5: `button_clicked (checklist_item)` (7-11 av 12) ikke trigget innen 5 min etter forrige punkt

**Bruker har:** Fullført omtrent halvparten av sjekklisten
**Bruker har ikke:** Fortsatt til de siste punktene
**Sannsynlig problem:** Utmattelse — sjekklisten føles lang, eller brukeren ble avbrutt igjen

```
Halvveis! Du har gjort en solid jobb så langt 🙌

Bare noen få punkter igjen. Ta dem én etter én.

Husk: for hvert "Nei"-svar kan du ta bilde av problemet
slik at det dokumenteres automatisk.

Du er nesten ferdig — hold ut!
```

---

## Gate 6: `session_task_completed` ikke trigget innen 3 min etter siste `button_clicked (checklist_item)`

**Bruker har:** Besvart alle 12 punkter i sjekklisten
**Bruker har ikke:** Fullført vernerunden
**Sannsynlig problem:** Brukeren finner ikke "Fullfør"-knappen, eller vet ikke at de må trykke for å avslutte

```
Alle punktene er besvart — bare ett steg igjen! ✅

Trykk på "Fullfør vernerunde"-knappen nederst på skjermen.
Da lagres alt og vernerunden registreres som gjennomført.

Eventuelle avvik du opprettet følges opp automatisk.

Trykk fullfør — du er i mål!
```

---

## Journey fullført — Gratulasjon

Trigges når alle suksesskriterier er oppfylt:

```
Vernerunden er gjennomført! 🎉

Du har:
✓ Åpnet vernerunden
✓ Gått gjennom alle 12 sjekkpunkter
✓ Fullført og lagret runden

Eventuelle avvik er registrert med bilder og sendt videre.
Arbeidsplassen er tryggere takket være deg.

Fantastisk innsats! 🛡️
```

---

## Timing-regler

| Gate   | Timeout | Aggressivitet                                       |
| ------ | ------- | --------------------------------------------------- |
| Gate 1 | 2 min   | Guidende — lederen trenger retning til riktig knapp |
| Gate 2 | 1 min   | Rask — teknisk problem sannsynlig                   |
| Gate 3 | 3 min   | Vennlig — første steg er størst terskel             |
| Gate 4 | 5 min   | Støttende — de kan ha stoppet opp                   |
| Gate 5 | 5 min   | Oppmuntrende — utmattelse er reell                  |
| Gate 6 | 3 min   | Tydelig — de trenger bare å finne knappen           |

**Tone:** Aldri mas. Aldri klandre. Alltid: "Du er på rett vei, her er neste steg."
