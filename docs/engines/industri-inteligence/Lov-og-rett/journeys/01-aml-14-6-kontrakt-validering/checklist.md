# Checklist — §14-6 alle 16 bokstaver (a–p)

Per-bokstav validation. Alle MÅ pass for `pass: true` i strict mode.

| # | Bokstav | Krav | Validation | Vanlig fail |
|---|---------|------|------------|-------------|
| a | Partenes identitet | `workspace.name` + `workspace.org_number` (9 siffer) + `profile.display_name` + `profile.personal_number` (11 siffer) | Personnummer mangler |
| b | Arbeidsplassen | `workspace.location` ELLER `contract.variable_workplace_arrangement` beskrevet | Varierende sted ikke beskrevet |
| c | Arbeidet/tittel | `contract.position_title` ikke null/empty + ikke generisk ("ansatt", "medarbeider", "personell") | Generisk tittel |
| d | Tidspunkt for begynnelse | `contract.start_date` ikke null + ikke fortid (tolerance: ≤7d for retroaktiv) | Null start_date |
| e | Forventet varighet | Hvis `employment_form ∈ {temporary, apprentice, practice}` → `end_date` påkrevd | Temporary uten end_date |
| f | Prøvetidsbestemmelser | `trial_period_months ≤ 6` (Aml. §15-6 max). 0 = ingen prøvetid | Prøvetid > 6 mnd |
| g | Ferie og feriepenger | `holiday_allowance_pct ∈ [10.20, 20.00]`. 12% = standard. 14.30% = 6. ferieuke. | Sats utenfor lovlig range |
| h | Oppsigelsesfrister | `notice_period_months ≥ 1` (mer ved lang tjeneste — Aml. §15-3 trapp). | Under §15-3-minimum |
| i | Lønn og tillegg | `contract_pay_rule` finnes for kontrakt + pension-info satt | Manglende pay_rule |
| j | Daglig/ukentlig arbeidstid | `agreed_weekly_hours` ikke null + ≤40 (eller dispensasjon dokumentert) | Null hours |
| k | Pauser | Hvis daglig arbeidstid >5.5t → `break_minutes_per_day ≥ 30` | Manglende pause-info |
| l | Særlig arbeidstidsordning | Hvis `working_hours_scheme` er variabel/turnus → ordning beskrevet | Variabel uten beskrivelse |
| m | Tariffavtaler | Hvis `workspace_framework_binding.framework_id` satt → tariff-parter listet på kontrakt | Tariff-id satt men parter mangler |
| n | Rett til opplæring | `contract.training_rights` satt (post-juli-2024 felt) | Felt mangler |
| o | Sosiale ytelser | OTP-flagg + AFP-status satt på kontrakt eller payroll_profile | OTP-info mangler |
| p | Innleier-info | Hvis `is_temp_worker=true` → innleier `legal_name` + `org_number` listet | Innleid uten innleier-info |

## Sjekke-rekkefølge

1. Hent `employment_contract` + `employee_payroll_profile` + `contract_pay_rule[]` for `contract_id`
2. Hent `workspace` + `profile` (joins)
3. Hent gjeldende `framework_rule` rader via `workspace_framework_binding`
4. Kjør hver bokstav-sjekk — samle errors[] + warnings[]
5. Marker confidence per error: HØY (direkte felt-mangel) / MEDIUM (avhenger av tolkning) / LAV (gråsone, eskaler)
6. Returner sammenstilt resultat

## Phase 0c stub vs Phase 0c+ real

- **Phase 0c (nå):** alltid `pass=true`, errors=[], warnings=[]. Hook eksisterer men passthrough
- **Phase 0c+:** real validation mot framework_rule + lov-tekst-cache. Strict mode blokkerer send. Advisory mode logger + lar gå
