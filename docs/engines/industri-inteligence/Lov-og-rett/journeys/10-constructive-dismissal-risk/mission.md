---
journey: 10
title: "Constructive dismissal-risk evaluering"
trigger: "Admin foreslår vesentlig endring i ansatt-vilkår (lønn ned, stilling ned, %-reduksjon)"
mode: pre-commit warning
adr: 0235, 0236, 0249
---

# Mission — Constructive dismissal-risk

**Mål:** Detektere når en kontrakt-endring kan tolkes som "vesentlig forringelse" likestilt med oppsigelse — gir ansatt rett til å nekte + kreve sluttoppgjør.

**Hvorfor:** Constructive dismissal er den dyreste arbeidsgiver-fellen. Endring uten samtykke = ulovlig oppsigelse + erstatning + potensielt gjeninnsettelse + saksomkostninger.

**Trigger:** `classifyAmendment` returnerer MATERIAL + endring reduserer ansatts vilkår.

**Output:**
- `risk_level: HIGH | MEDIUM | LOW`
- `risk_factors[]` (lønn-ned / stilling-ned / %-reduksjon / departement-bytte / oppgave-endring)
- `escalation_advice` (samtykke / formell oppsigelses-prosess / tilrettelegging)
- Telemetry: `legal.amendment_classified` med `constructive_dismissal_risk: true`
