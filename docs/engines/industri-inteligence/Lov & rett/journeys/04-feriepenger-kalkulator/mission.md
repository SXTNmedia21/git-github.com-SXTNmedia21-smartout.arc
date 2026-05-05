---
journey: 04
title: "Feriepenger-kalkulator"
trigger: "Sluttoppgjør, månedlig payroll, eller admin spør 'hvor mye feriepenger?'"
mode: advisory + commit (på sluttoppgjør)
adr: 0234, 0249
---

# Mission — Feriepenger-kalkulator

**Mål:** Beregn korrekt feriepenger iht. Ferieloven §10 + §11.

**Hvorfor:** Feilberegning = krav om etterbetaling + renter. Sluttoppgjør med feil sats = vanlig konflikt-årsak.

**Trigger:** Månedlig payroll-run, sluttoppgjør, ad-hoc admin-spørsmål.

**Output:**
- Feriepenger-grunnlag (årets utbetalt brutto, eks. visse poster)
- Sats: 10.20% (alle), 12% (12-trinns avtale), 14.30% (6. ferieuke)
- Beregnet beløp + breakdown
- Skatt-info (feriepenger trekkfri ved utbetaling neste år)
- Hvis sluttoppgjør: opphørsdato + fratrekk for ikke-tatt ferie
