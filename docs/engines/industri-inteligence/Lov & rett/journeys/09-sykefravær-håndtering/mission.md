---
journey: 09
title: "Sykefravær-håndtering"
trigger: "Ansatt er syk. Sykmelding registrert."
mode: workflow guidance
adr: 0234, 0249
---

# Mission — Sykefravær-håndtering

**Mål:** Korrekt håndtering av sykefravær iht. Folketrygdloven kap. 8 + Aml. §10-11.

**Hvorfor:** Arbeidsgiverperiode (16 dager), sykepenger fra dag 17 (NAV), refusjons-rett, oppfølgings-plan ved 4 uker, dialog-møte ved 7 uker — alt har frister.

**Trigger:** Ansatt registrerer fravær (egenmelding eller sykmelding) i `schedule_absence` med `absence_type='sick'`.

**Output:**
- Arbeidsgiverperiode-status (dag X av 16)
- Når NAV tar over
- Frister for oppfølging
- Refusjons-rett (full / 50% av brutto)
- Permisjons-vurdering ved langtid (over 6 mnd)
