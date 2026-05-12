---
name: amendment-classifier
description: Use this skill to classify a proposed contract or payroll-profile field change as MATERIAL, ADMIN, DERIVED, SYSTEM, or BLOCKED. Triggers when admin edits a contract field, when bulk tariff revision propagates, when user asks "krever dette ny signering", "må ansatt signere på nytt", "kan jeg endre dette", "hva er konsekvensen av å endre X". Returns classification + paragraph reference + warnings + alternative actions.
---

# Amendment-classifier

Klassifiserer felt-endringer for å avgjøre om de krever ansatt-signering (MATERIAL), kan committes direkte (ADMIN/DERIVED/SYSTEM), eller er ulovlige (BLOCKED).

Bygger på `field_classification_metadata`-tabellen (ADR-0001), men løser conditional rules tabellen ikke kan håndheve direkte.

## Når denne skal brukes

- Admin redigerer felt på kontrakt eller lønnsprofil → handler kaller før commit
- Mal-endring vurderes for propagering til eksisterende kontrakter
- Tariff-revisjon trigger amendment-tilbud — klassifiserer hvilke felt som faktisk endrer seg materielt
- Botsson får spørsmål "må jeg signere på nytt hvis admin endrer X?"
- Bulk-operasjon trenger klassifiserings-batch

## Input

```json
{
  "table_name": "employment_contract",
  "column_name": "monthly_salary",
  "old_value": 32000,
  "new_value": 34000,
  "context": {
    "contract_status": "active",
    "contract_id": "uuid",
    "is_within_trial_period": false,
    "tariff_revision_triggered": false,
    "field_is_workspace_default_aligned": null,
    "extension_reason": null
  },
  "actor": {
    "user_id": "uuid",
    "role": "admin"
  }
}
```

## Klassifiserings-prosess

1. **Slå opp base-klassifisering** i `field_classification_metadata`
2. **Evaluer conditional rule** hvis satt — se [references/conditional-rules.md](./references/conditional-rules.md)
3. **Sjekk spesial-saker** som overstyrer (lønn ned, employment_form-konvertering, prøvetid-forlengelse)
4. **Bygg output** med kilde-sitat fra Lovdata om relevant

## Spesial-saker (overstyrer base-regler)

| Felt + endring | Resultat |
|---|---|
| `monthly_salary` / `hourly_rate` synker | Alltid MATERIAL + krev begrunnelse + advokat-disclaimer |
| `notice_period_months` synker | Alltid MATERIAL + advarsel om ansatt-fordel-reduksjon |
| `tariff_id` endres | MATERIAL alltid + foreslå "ny kontrakt" som alternativ |
| `employment_form` permanent → temporary | BLOCKED — Aml. §14-9 krever saklig grunn |
| `employment_form` temporary → permanent | MATERIAL — ansatt-fordel, krever consent |
| `trial_period_months` forlengelse uten sykefravær | MATERIAL — kan ikke forlenges ensidig |
| `trial_period_months` forlengelse pga sykefravær | ADMIN — Aml. §15-6 fjerde ledd, men dokumentasjon kreves |

## Output

```json
{
  "classification": "material" | "admin" | "derived" | "system" | "blocked",
  "requires_resigning": true | false,
  "confidence": "HØY" | "MEDIUM" | "LAV",
  "reasoning_no": "Lønn økes; krever amendment iht. felt-klassifisering material. Aml. §14-6 første ledd bokstav i.",
  "paragraph_references": ["Aml. §14-6 første ledd bokstav i"],
  "source_urls": ["https://lovdata.no/dokument/NL/lov/2005-06-17-62/§14-6"],
  "warnings": [
    {
      "type": "employee_disadvantage",
      "message_no": "Endring reduserer ansatt-fordel. Krever spesielt grundig consent."
    }
  ],
  "blocked_reason": null,
  "alternative_actions": [
    "Opprett ny kontrakt og terminer eksisterende"
  ]
}
```

## Edge cases

**Bulk-endring fra tariff-revisjon.** Riksavtalen reforhandles → 100 kontrakter må oppdateres:
- Hver endring klassifiseres individuelt
- `tariff_revision_triggered: true` i context
- Mest blir ADMIN (rate_value-endring der framework_rule_id er satt)
- Workspace-batch-flow tilbyr én amendment per ansatt med samlet diff

**Ansatt-initiert endring.** `actor.role = 'employee'`:
- Ofte ADMIN selv om felt normalt er MATERIAL (f.eks. opt-out av pensjon)
- Krever audit + admin-godkjenning hvis arbeidsgiver-plikt-implikasjoner

**Multiple felt samtidig.** Stillings-bytte = job_title + monthly_salary + tariff_id + obligations:
- `multi_field: true` med array av klassifiseringer
- `requires_resigning = true` hvis MINST ETT felt er MATERIAL
- Foreslå konsolidert amendment (én signering for hele bunten)

**Tilbakeføring innen 24t.** Hvis admin angrer:
- Ikke signert: trekk amendment, behandle som SYSTEM
- Signert: ny amendment for tilbakeføring kreves

## Confidence-policy

- HØY: Direkte regel-match + ingen conditional rule, ELLER eksplisitt lovbestemmelse støtter klassifisering
- MEDIUM: Conditional rule krever tolkning av kontekst
- LAV: Ingen klar regel — eskalér til menneske

LAV → returnér `classification: "review_required"` og krev manuell admin-vurdering før commit.

## Audit

Hver klassifisering loggføres med 5 års retensjon (Bokføringsloven §13):

```json
{
  "classification_id": "uuid",
  "performed_at": "timestamp",
  "actor_user_id": "uuid",
  "input": { /* hele input */ },
  "output": { /* hele output */ },
  "skill_version": "amendment-classifier-2024-07"
}
```

## Versjonering

`skill_version` følger Aml.-versjonen. Endring i `field_classification_metadata` = ny skill-versjon. Gamle klassifiseringer beholder sin versjon for audit.

## Referanser

- Smartout ADR-0001 (felt-klassifisering)
- Aml. §14-6, §14-9, §15-6 fjerde ledd, §15-7 — Lovdata
- Skattetrekkforskrift §3
- Bokføringsloven §13
- [references/conditional-rules.md](./references/conditional-rules.md)
