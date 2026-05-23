---
title: "Journey: Ansatt sjekker hva som skjer i dag (mobile)"
status: draft
created: 2026-05-23
updated: 2026-05-23
module: day-session
tags: [journey, tidslinje, p10, employee, mobile, adr-0133]
---

# Journey: Ansatt sjekker hva som skjer i dag (mobile)

**Precondition:** Ansatt innlogget på mobile app. Aktiv vakt i dag.

1. Ansatt åpner Smartout mobile → tap `(me)` tab default → ser Min Dag (per ADR-0316)
2. Ansatt trykker `Se hele dagen →` link → mobile renderer Tidslinje-view (read-only mirror av Tidslinje-tab per mobile boundary ADR-0133: "execute, not author")
3. Ansatt ser hele dagens timeline kronologisk: hvem er på sal, hvem er på kjøkken, hvilke tasks som pågår, day_line-windows (åpningstid sal 10-22, kjøkken 11-22)
4. Ansatt ser egen vakt highlighted m/ chip "Du" + neste task hen er tildelt 🟡 "Cleaning 13:00"
5. Ansatt swiper tilbake → tar vakt-spesifikk handling

**Postcondition:** Ansatt har situasjonsforståelse. Ingen mutation skjedde (mobile = execute-side, ikke author).

**Error paths:**
- Offline → cached snapshot fra siste sync vises m/ banner "Offline — sist oppdatert 12:34"
- Ansatt prøver å trykke item de ikke eier → toast "Kun manager kan endre" + linje forblir uendret (ingen knapp i UI overhodet, men defense-in-depth)

**V1 scope note (2026-05-23):** Mobile-implementasjon er IKKE i P10-scope. Web-Tidslinje shipped P10; mobile mirror er separat sortie under mobile-campaign. Journey dokumenterer planlagt UX for fremtidig referanse.
