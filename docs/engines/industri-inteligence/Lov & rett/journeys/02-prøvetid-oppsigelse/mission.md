---
journey: 02
title: "Prøvetid-oppsigelse"
trigger: "Admin vurderer å si opp ansatt som er innenfor prøvetid"
mode: advisory
capability: legal.citeLaw + skill (Tier 3, Phase 0c+)
adr: 0078, 0234, 0249
---

# Mission — Prøvetid-oppsigelse

**Mål:** Veilede admin gjennom lovlig prøvetid-oppsigelse iht. Aml. §15-6 og §15-3 syvende ledd.

**Hvorfor det betyr noe:** Prøvetid har lavere terskel enn fast oppsigelse, men ikke "ingen grunn". Feil håndtering = ugyldig oppsigelse + erstatning + potensielt gjeninnsettelse.

**Trigger:** Admin spør Lovsen "kan jeg si opp Anna i prøvetid?" eller åpner termination-flow på ansatt med `profile.status='trainee'`.

**Lovsens svar inkluderer:**
- Sjekk om kontrakt har gyldig prøvetid-bestemmelse (§14-6 f)
- Restrekkende terskel: "manglende tilpasning, faglig dyktighet eller pålitelighet" (§15-6 1. ledd)
- Oppsigelsesfrist: 14 dager hvis ikke annet avtalt (§15-3 7. ledd)
- Sykefravær-pause-regel (§15-6 4. ledd)
- Dokumentasjons-anbefaling
- Eskaler til advokat ved tvil

**Output:** veiledning + checklist for admin, ingen automatisk handling. C4 governance gate forhindrer Lovsen i å committe oppsigelse direkte.
