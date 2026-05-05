# Beskrivelse — Amendment-klassifisering

## Use case

Pontus vil endre Annas månedslønn fra 32 000 til 34 000 (lønnsoppgjør). Han redigerer feltet på Annas profil-side.

Pre-commit hook kaller:
```
legal.classifyAmendment({
  table_name: "employment_contract",
  column_name: "monthly_salary",
  old_value: 32000,
  new_value: 34000,
  context: {
    contract_status: "active",
    is_within_trial_period: false,
    tariff_revision_triggered: false,
    field_is_workspace_default_aligned: null
  }
})
```

Lovsen returnerer:
```json
{
  "classification": "MATERIAL",
  "requires_resigning": true,
  "paragraph_ref": "Aml. §14-6 i",
  "constructive_dismissal_risk": false,
  "reason": "Endring i månedslønn er vesentlig kontraktsvilkår — krever ansatt-signering iht. §14-6 i og avtalerettslige prinsipper",
  "alternative_actions": [
    "Send amendment-tilbud til ansatt med ny signering",
    "Hvis ansatt avslår: behold gjeldende lønn"
  ]
}
```

UI viser banner: "Lønnsendring krever ny signering. Send amendment-tilbud til Anna?"

## Use case 2 — BLOCKED

Pontus prøver å sette `trial_period_months = 8`. 

Lovsen:
```json
{
  "classification": "BLOCKED",
  "requires_resigning": false,
  "paragraph_ref": "Aml. §15-6 1. ledd",
  "reason": "Prøvetid kan ikke overstige 6 måneder",
  "alternative_actions": [
    "Sett trial_period_months ≤ 6",
    "Hvis ansatt har vært syk: prøvetid forlenges automatisk med antall sykedager (§15-6 4. ledd)"
  ]
}
```

UI: hard rød feilmelding, save-knapp disabled.

## Use case 3 — ADMIN downgrade

Pontus endrer `internal_notes`-felt på kontrakt:
```json
{
  "classification": "ADMIN",
  "requires_resigning": false,
  "reason": "Internt notat-felt — påvirker ikke kontraktsvilkår"
}
```
UI: silent commit.

## Use case 4 — Constructive dismissal risk

Pontus endrer `employment_percentage` fra 100 til 60 (kutt fra fulltid til 60%).

Lovsen:
```json
{
  "classification": "MATERIAL",
  "requires_resigning": true,
  "paragraph_ref": "Aml. §14-6 j + ADR-0236",
  "constructive_dismissal_risk": true,
  "reason": "Reduksjon av stillingsprosent fra fast jobb er vesentlig forringelse. Ansatt kan kreve det likestilt med oppsigelse iht. constructive dismissal-doktrinen",
  "alternative_actions": [
    "Send amendment-tilbud med klar begrunnelse",
    "Tilby alternativ vakt-fordeling før reduksjon",
    "Hvis ansatt avslår: vurder formell oppsigelses-prosess (§15-7 saklig grunn)"
  ]
}
```

UI: banner med advarsel + tilbud om å starte amendment-flow med konsekvens-varsling.

## Hvorfor Lovsen er bra på dette

1. **Skiller MATERIAL fra ADMIN automatisk** — admin trenger ikke huske hver paragraf. Felt-classification er centralized.

2. **Constructive-dismissal-detection** — fanger reduksjons-mønstre som mange admins ikke vet er risikable. Sparer arbeidsgiver fra kjedelige tvister.

3. **Tariff-revisjon-context** — når NHO-tariff oppjusterer minstesats, lønn-justering for å matche kan klassifiseres som DERIVED (ikke MATERIAL) hvis workspace har auto-align. Sparer mange unødvendige re-signeringer.

4. **BLOCKED separate fra MATERIAL** — ulovlige verdier (§15-6 6 mnd, §15-3 1 mnd) blokker hard, ikke "krever signering". Klart skille.

## Når Lovsen IKKE skal kjøres

- Bulk tariff-revisjon hvor alle workspace's kontrakter oppdateres (egen flow med batch-classify)
- DERIVED-felt (system-beregnet) — ingen behov for klassifisering
- Template-redigering (`contract_template`) — gjelder kun kontrakt-instans

## Eskalerings-vei

- BLOCKED + admin overrider (`compliance_overrides[]`) → log audit + tillat
- Constructive dismissal-risk-flag + ansatt motsetter → eskaler til advokat
- Felt ikke i `field_classification_metadata`-tabell → returner `UNKNOWN` + flag for manuell review

## Phase 0c+ kobling

- Real `field_classification_metadata`-tabell (Phase 0c.1 seed)
- Tariff-revisjon-detection via `tariff_rate_table`-versjon-bump
- Amendment-flow auto-trigger når MATERIAL detected
- Test corpus: ~30 cases (én per common felt × 4 contexts)
