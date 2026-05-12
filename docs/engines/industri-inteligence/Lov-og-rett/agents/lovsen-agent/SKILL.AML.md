---
name: aml-14-6-validator
description: Use this skill to validate that an employment contract draft satisfies Aml. §14-6 (Norwegian arbeidsmiljølov, post juli 2024-revisjon). Triggers when contract goes from draft to pending_signature, when admin requests compliance check, when template changes, when user asks "er kontrakten komplett", "mangler noe i kontrakten", "valider §14-6", "compliance-sjekk", or any verification of statutory contract requirements. Returns pass/fail/warnings with paragraph references.
---

# §14-6-validator

Validerer at en arbeidsavtale oppfyller alle krav i Aml. §14-6 (post juli 2024-revisjon, EU-direktiv 2019/1152 implementert i norsk rett).

## Når denne skal brukes

Trigger ved:

- Kontrakt går fra `draft` → `pending_signature` (mandatory gate)
- Mal-endring trigger valideringsbehov for nye kontrakter
- Admin ber om eksplisitt compliance-sjekk (`/valider-kontrakt`)
- Compliance-revisor kjører månedlig audit
- Botsson får spørsmål av typen "er kontrakten min komplett?"

## Input

```json
{
  "contract_id": "uuid",
  "contract_data": { /* full employment_contract row + relaterte rader */ },
  "payroll_profile": { /* employee_payroll_profile row */ },
  "tariff": { /* tariff-info, valgfri */ },
  "validation_mode": "strict"
}
```

`strict` = blokkér aktivering ved error. `advisory` = rapportér men la flow gå videre.

## Validerings-prosess

1. **Hent gjeldende §14-6-tekst** via `lovdata.fetch_paragraph(law="aml", paragraph="14-6")` — bruk live-versjon med mindre context spesifiserer historisk dato.
2. **Kjør gjennom sjekklisten** under (alle 16 punkter, bokstav a–p)
3. **Sammenstill resultat** — pass/fail/pass_with_warnings + issues-array

## Sjekkliste — Aml. §14-6

Detaljert validerings-logikk per bokstav: se [references/checklist.md](./references/checklist.md).

Kort oversikt:

| Bokstav | Krav | Vanlig fail |
|---|---|---|
| a | Partenes identitet | profile.personal_number mangler |
| b | Arbeidsplassen | varierende arbeidssted ikke beskrevet |
| c | Arbeidet/tittel | job_title generisk ("ansatt") |
| d | Tidspunkt for begynnelse | start_date null eller fortid |
| e | Forventet varighet | temporary uten end_date |
| f | Prøvetidsbestemmelser | prøvetid > 6 mnd (ulovlig) |
| g | Ferie og feriepenger | holiday_allowance_pct utenfor 10.20–20.00 |
| h | Oppsigelsesfrister | notice_period_months under §15-3-minimum |
| i | Lønn og tillegg | manglende contract_pay_rule eller pension-info |
| j | Daglig/ukentlig arbeidstid | agreed_weekly_hours null |
| k | Pauser | break_minutes_per_day < 30 ved >5.5t arbeid |
| l | Særlig arbeidstidsordning | variable hours uten beskrivelse |
| m | Tariffavtaler | tariff_id satt men parter ikke listet |
| n | Innleier-info | n/a for direkte ansatte |
| o | Kompetanseutvikling (post juli 2024) | training_rights tom |
| p | Sosial trygghet og pensjon (post juli 2024) | pension_scheme_id null |

## Output

```json
{
  "validation_id": "uuid",
  "contract_id": "uuid",
  "validated_at": "2026-04-29T10:00:00Z",
  "validator_version": "aml-14-6-2024-07",
  "source_url": "https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6",
  "source_fetched_at": "2026-04-29T09:55:00Z",
  "result": "pass" | "fail" | "pass_with_warnings" | "skip",
  "issues": [
    {
      "severity": "error" | "warning",
      "paragraph": "Aml. §14-6 første ledd bokstav f",
      "field": "trial_period_months",
      "message_no": "Prøvetid 8 mnd overstiger maksimum 6 mnd iht. Aml. §15-6 første ledd",
      "remediation": "Sett trial_period_months ≤ 6, eller fjern prøvetid",
      "confidence": "HØY"
    }
  ],
  "summary_no": "Kontrakten oppfyller §14-6 med 2 advarsler. Ingen blockers."
}
```

## Edge cases

**Retroaktiv kontrakt.** `start_date` i fortid:
- Tillates kun hvis `(created_at - start_date) < 30 dager`
- Krev audit-note med begrunnelse
- Confidence: MEDIUM (gråsone)

**Lærling.** `employment_form = 'apprentice'`:
- Returnér `result: "skip"` — egen flow trengs (Opplæringsloven kap. 4)

**Sommervikar < 3 mnd.** Forenklet validering tillates iht. Aml. §14-9, men alle 16 punkter må fortsatt være dekket.

**Variable hours** (`agreed_weekly_hours = 0` + `working_hours_scheme = 'shiftWork'`):
- Krev `variable_hours_arrangement` utfylt
- Krev minimum-timer per uke spesifisert (post juli 2024-krav)

## Confidence-policy

- HØY: Direkte sitat fra Aml. §14-6 hentet fra Lovdata
- MEDIUM: Tolkning eller bransje-praksis (f.eks. retroaktiv-toleranse)
- LAV: Gråsone — returnér `result: "review_required"` og krev manuell vurdering

## Versjonering

`validator_version` reflekterer Aml.-versjon. Endring av §14-6 = ny validator-versjon. Test-corpus (15+ saker) kjøres mot ny versjon før release.

## Referanser

- Aml. §14-6 (juli 2024-versjon) — Lovdata
- Aml. §10-9 (pauser), §15-6 (prøvetid), §15-3 (oppsigelsesfrister), §14-9 (midlertidig)
- EU-direktiv 2019/1152
- Smartout ADR-0001 (felt-klassifisering)
