---
journey: 08
title: "A-melding validator"
trigger: "Månedlig A-melding-rapport skal sendes til Skatteetaten"
mode: pre-submit gate
adr: 0234, 0249
---

# Mission — A-melding validator

**Mål:** Verifisere at A-melding er fullstendig + korrekt før innsending til Skatteetaten.

**Hvorfor:** Feil A-melding = retting + bot + ekstra arbeid. Manglende felt = avvist innsending.

**Trigger:** Månedlig payroll-run ferdig, før innsending til altinn.

**Output:**
- `pass: bool`
- `errors[]` (manglende felt) + `warnings[]` (suspicious data)
- Per-ansatt-breakdown
- Lønnskoder verifisert (10/11/20/22/23 etc.)
- Summer matcher (brutto = sum poster, skatt = sum trekk)
