---
journey: 03
title: "Amendment-klassifisering"
trigger: "Admin redigerer felt på aktiv kontrakt eller lønnsprofil"
mode: pre-commit gate
capability: legal.classifyAmendment
adr: 0235, 0236, 0249
---

# Mission — Amendment-klassifisering

**Mål:** Avgjøre om en felt-endring krever ansatt-signering (MATERIAL), kan committes direkte (ADMIN/DERIVED/SYSTEM), eller er ulovlig (BLOCKED).

**Hvorfor det betyr noe:** Endring av lønn, stilling eller arbeidstid uten signering = ugyldig kontraktsendring. Kan i verste fall regnes som "vesentlig endring" likestilt med oppsigelse (constructive dismissal). Arbeidsgiver bærer risiko.

**Trigger:** Admin endrer felt på `employment_contract`, `employee_payroll_profile`, `contract_pay_rule`, eller bulk tariff-revisjon propagerer.

**Output:**
- `classification: MATERIAL | ADMIN | DERIVED | SYSTEM | BLOCKED`
- `requires_resigning: bool`
- `paragraph_ref` (hvis relevant — Aml. §14-6 / §15-7)
- `constructive_dismissal_risk: bool` (ADR-0236)
- Telemetry: `legal.amendment_classified`

**Postcondition:** Admin handler.tsx fanger response, viser banner med klassifisering. MATERIAL → re-sign-flow. ADMIN → commit. BLOCKED → hard stop.
