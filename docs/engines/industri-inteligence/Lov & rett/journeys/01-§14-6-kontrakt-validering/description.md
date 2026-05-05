# Beskrivelse — §14-6 kontrakt-validering

## Use case

Restaurantsjef Pontus har lagt inn ny servitør Anna i Smartout. Han har fylt ut Ansettelse-skjemaet, valgt Riksavtalen-binding, og trykker Send på kontrakten.

I bakgrunnen, før Smartout ringer DocuSeal:

```
POST /api/contracts/send
  → resolve employment_contract via existing_contract_id
  → freeze framework_snapshot
  → CALL legal.validateAml146({ contract_id, validation_mode: "strict" })
  → if !pass: return 422 + errors[]
  → else: continue to DocuSeal dispatch
```

Lovsen kjører gjennom alle 16 bokstaver i §14-6 og rapporterer:

```
{
  "pass": false,
  "errors": [
    {
      "letter": "f",
      "paragraph": "Aml. §15-6",
      "field": "trial_period_months",
      "actual": 8,
      "max": 6,
      "message": "Prøvetid kan ikke overstige 6 måneder",
      "confidence": "HØY",
      "fix_url": "/dashboard/people/<id>?section=ansettelse&focus=trial_period_months"
    },
    {
      "letter": "k",
      "paragraph": "Aml. §10-9",
      "field": "break_minutes_per_day",
      "actual": null,
      "required_when": "agreed_weekly_hours > 27.5",
      "message": "Pauser må spesifiseres for skift over 5.5 timer",
      "confidence": "HØY",
      "fix_url": "/dashboard/people/<id>?section=ansettelse&focus=break_minutes_per_day"
    }
  ],
  "warnings": [],
  "validator_version": "lovsen-v0.2.0"
}
```

Drawer fanger 422, viser badge per felt med Lovsen-melding, deep-link tilbake til redigering.

## Hvorfor Lovsen er bra på dette

1. **Kjenner alle 16 bokstaver post-juli-2024** — EU-direktiv 2019/1152 ble implementert med nye felt (rett til opplæring, sosiale ytelser, innleier-info). Mange systemer har gamle 12-bokstavs-checklists.

2. **Konfidens-merker hver feil** — admin ser om dette er hard-blokk eller gråsone. Eksempel: timelønn under tariff-min er BLOCKED med override-mulighet (compliance_overrides), ikke hard fail.

3. **Eksplisitt paragraf-referanse** — "Aml. §15-6" ikke "noe i §15". Admin kan slå opp og forstå selv.

4. **Deep-link til fix** — ikke bare "feil" men "fiks her". Reduserer friksjon fra error → action.

5. **Framework-snapshot integration** — ved historisk audit (compliance-revisor) bruker validator snapshot fra send-tidspunktet, ikke nåtidig lov-tekst. ADR-0244.

## Når Lovsen IKKE skal kjøres

- Kontrakter i `draft` status uten send-intent (la admin lagre work-in-progress)
- Bulk-import fra eksisterende systemer (`source='bubble_migration'`) — bruk advisory mode + flag, ikke blokk
- Templates (`contract_template`) — validator gjelder kontrakt-instans, ikke mal-spec

## Eskalerings-vei

- LAV confidence på en error = "kontakt advokat før send"
- Hvis admin overrider med `compliance_overrides[]` JSONB på contract → log audit + tillat send
- Recurring fail-pattern på samme workspace = flag i compliance-revisor (Tier 3)

## Phase 0c+ kobling

- Real lov-tekst via Lovdata MCP (`fetch_paragraph(law="aml", paragraph="14-6")`)
- Framework_rule-tabell brukes for tariff-min sammenligning
- Test corpus dekker alle 16 bokstaver med happy-path + fail-cases
