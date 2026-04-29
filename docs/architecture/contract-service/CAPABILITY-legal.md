---
title: "`legal` Capability — Norsk Arbeidsrett (Lovsen-branding)"
status: draft
updated: 2026-04-29
created: 2026-04-29
module: contract
phase: 0c
tags: [capability, legal, lovsen, arbeidsrett, hospitality]
---

# `legal` Capability — Norsk Arbeidsrett

> **Status:** Draft. Phase 0c implementation (after Phase 0a schema migration + Phase 0b `contract`/`payroll` capabilities). Per Steward synthesis 2026-04-29: NOT a separate agent — third capability sibling to `contract` (ADR-0234) + `payroll` (ADR-0234). Botsson remains sole conversational front door per ADR-0220.

## Purpose

Norsk arbeidsrett-tools for hospitality-bransjen. Validates contracts against Aml. §14-6, classifies amendment changes (MATERIAL/ADMIN/DERIVED/SYSTEM per ADR-0235), cites lov + Riksavtalen with paragraph references.

User-facing branding: **"Lovsen"** — erfaren norsk arbeidsrett-rådgiver. Voice: saklig, presis, paragraf-spesifikk, innrøm gråsoner, ikke advokat (gir veiledning, ikke juridisk rådgivning).

**Persona is output branding only, not runtime.** Botsson invokes `legal` capability tools when intent classifier routes to legal questions; Botsson speaks in Lovsen-voice with cited tool output.

## Capability registration

Location: `packages/ai/src/capabilities/legal/{tools.ts,index.ts}`.

```ts
// packages/ai/src/capabilities/legal/index.ts
export const legalCapability: CapabilityDefinition = {
  name: "legal",
  emitPrefix: "legal",
  defaultAuthority: "read_only",
  toolAuthPattern: "direct_admin",
  // per-tool allowedChannels declared on tool definition (ADR-0078 §sibling)
  tools: [validateAml146, citeLaw, classifyAmendment],
};
```

`CapabilityName` union extends with `"legal"`. Intent classifier maps Norwegian legal/arbeidsrett questions to `legal` intent.

## Tools (3)

### Tool 1: `validate_aml_14_6`

**Purpose:** Validate contract draft against Aml. §14-6 (15 påkrevde punkter post-juli 2024-revisjon).

**Channels:** `["chat"]` only — touches oppsigelse/sykefravær context, High-sensitivity per ADR-0078.

**Authority:** `gate_action: 'check'` (read-only, advisory).

**Min role:** `manager` (any leader can validate; no mutation).

**Input schema:** `{ contract_id: string }` (server-derives workspace from JWT).

**Output schema:**
```ts
{
  status: "passes" | "missing_fields" | "warnings",
  missing: Array<{ field: string; aml_paragraph: string; severity: "blocker" | "warning" }>,
  warnings: Array<{ message: string; aml_paragraph: string }>,
  citation: string, // "Aml. §14-6 (versjon juli 2024)"
}
```

**Implementation notes:**
- Reads `regulatory_framework` + `framework_rule` rows where `framework_type='national_law'` AND `code='aml_14_6'` (K1a platform-seeded).
- Validates each field against `framework_rule.validation_rule_jsonb`.
- Returns paragraph references with confidence-merking via `framework_rule.confidence` column.

**Telemetry:** `legal.aml_14_6.validated` (registered in `packages/telemetry/src/registry.ts`). Threads `nonEmpty(workspace_id)` + `nonEmpty(actor_id)` per ADR-0193.

### Tool 2: `cite_law`

**Purpose:** Look up paragraph + provide canonical norsk lovtekst-citation.

**Channels:** `["chat", "voice"]` — paragraph references, no PII.

**Authority:** `gate_action: 'check'` (read-only).

**Min role:** `employee` (any user can ask).

**Input schema:** `{ query: string, lov?: "aml" | "ferieloven" | "otp" | "bokforing" | "skattetrekk" | "riksavtalen" }`.

**Output schema:**
```ts
{
  paragraph: string, // "§14-6 fjerde ledd"
  text: string, // Kanonisk lovtekst, sist oppdatert
  version: string, // "2024-07"
  effective_from: string, // "2024-07-01"
  confidence: "HIGH" | "MEDIUM" | "LOW",
  source: string, // "Arbeidsmiljøloven (LOV-2005-06-17-62), versjon 2024-07"
}
```

**Implementation notes:**
- Reads `regulatory_framework` + `framework_rule` rows for canonical lov-citations.
- `effective_from` + `version` columns drive temporal correctness (per ADR-0181 lineage pattern).
- Citation-validator: before returning, verify cited paragraph exists in `framework_rule` table — fail-closed if missing (P2 from Lovsen spec §7).

**Telemetry:** `legal.law_cited` with `paragraph` + `version` + `confidence` properties.

### Tool 3: `classify_amendment`

**Purpose:** Classify field-change as MATERIAL/ADMIN/DERIVED/SYSTEM per ADR-0235 TS const map.

**Channels:** server-only — drives mutation downstream, no chat surface.

**Authority:** `gate_action: 'enforce'`, `default_allow: false` per ADR-0099 — mutation-driving classifier MUST gate.

**Min role:** `admin` (drives `contract_amendment` insertion).

**Input schema:** `{ contract_id: string, field_changes: Array<{column: string, from: any, to: any}> }`.

**Output schema:**
```ts
{
  classifications: Array<{
    column: string,
    classification: "material" | "admin" | "derived" | "system",
    requires_employee_signature: boolean, // material → true; admin/derived/system → false
    rationale: string, // Norwegian explanation citing ADR-0001 §felt-klassifisering
    constructive_dismissal_risk: boolean, // ADR-0236 amendment §15-7 flag
  }>,
}
```

**Implementation notes:**
- Reads SAME TS const map as ADR-0235 §amendment-handler — single source.
- `constructive_dismissal_risk: true` when amendment changes `job_title` AND (`tariff_id` OR `agreed_weekly_hours` OR `monthly_salary` reduced ≥20%) per ADR-0236 §endringsoppsigelse.
- Returns rationale in Norwegian for legal-evidence-trail.

**Telemetry:** `legal.amendment_classified` with full classification breakdown for audit.

## Authority seed (ADR-0192)

In same migration as Phase 0c capability ship:

```sql
INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  ('legal', 'read_only', 'employee', false, 72,
   'Norsk arbeidsrett tools — Lovsen-branding. validate_aml_14_6 manager+chat-only; cite_law employee+chat+voice; classify_amendment admin+server-only. ADR-0234 + Lovsen review 2026-04-29.')
ON CONFLICT (capability) DO NOTHING;
```

## Knowledge base — K1a platform-shared

Norske lover seed via migration into `regulatory_framework` + `framework_rule` with `workspace_id IS NULL`:

| Framework | Type | Source |
|-----------|------|--------|
| `aml_14_6` | national_law | Arbeidsmiljøloven §14-6 (LOV-2005-06-17-62) |
| `aml_15_3` | national_law | Aml. §15-3 (oppsigelsesfrist) |
| `aml_15_6` | national_law | Aml. §15-6 (prøvetid) |
| `aml_15_7` | national_law | Aml. §15-7 (saklig grunn) |
| `aml_10_6` | national_law | Aml. §10-6 (overtid 2024-revisjon) |
| `ferieloven_10` | national_law | Ferieloven §10 |
| `bokforingsloven_13` | national_law | Bokføringsloven §13 |
| `riksavtalen_hospitality_2024` | collective_agreement | Riksavtalen Hospitality 2024-2026 |
| `hovedavtalen_lo_nho_2024` | collective_agreement | Hovedavtalen LO-NHO 2024 |

**No filesystem `knowledge/laws/*` directory.** Single source via cascade K1a layer per cascade-integrity-mandate §1.

**Versioning:** `effective_from` + `effective_to` columns drive temporal correctness. Update pattern: new migration with new version row + supersession via `effective_to` on prior. Refresh-rutine triggered by known lov-revisjon (Aml. typically 1-2x/year, Riksavtalen every 2 years).

## Implementation phases

| Phase | Scope |
|-------|-------|
| 0c.1 | Seed migration: 9 K1a `regulatory_framework` rows + N `framework_rule` rows |
| 0c.2 | `legal` capability code: `tools.ts` + `index.ts` + 3 tools |
| 0c.3 | Capability registry tuple migration (ADR-0192 pattern) |
| 0c.4 | Telemetry events registered: `legal.aml_14_6.validated`, `legal.law_cited`, `legal.amendment_classified` |
| 0c.5 | Botsson intent classifier extended: `legal` intent |
| 0c.6 | Per-tool E2E tests (channel guard verified, gate_action verified, citation-validator verified) |

## ADR compliance

- **ADR-0078** channel restriction: per-tool allowedChannels declared (chat / chat+voice / server-only)
- **ADR-0099** gate_action: `check` for read tools, `enforce` + `default_allow:false` for classifier
- **ADR-0151** server-side profile_id: tools derive `profileId` from JWT, not request body
- **ADR-0163** sibling fail-closed channel: `legal` tools do not bypass channel guard
- **ADR-0192** authority seed: registry tuple in same PR
- **ADR-0193** NonEmptyString brand: all telemetry threads non-empty IDs
- **ADR-0220** Botsson sole front door: `legal` is tools, not agent — Botsson invokes
- **ADR-0233** schema migration foundation: `framework_rule` validation_rule_jsonb consumed by `validate_aml_14_6`
- **ADR-0234** capability split: third sibling to `contract` + `payroll`
- **ADR-0235** obligation lifecycle: `classify_amendment` reads SAME TS const as amendment-handler
- **ADR-0236** amendment flow: `classify_amendment` returns `constructive_dismissal_risk` for §15-7 protection

## Risks / Open Questions

1. **TS const vs framework_rule duplication:** ADR-0235 puts field classification in TS const; this capability reads from `framework_rule`. Decision needed: which is canonical for `classify_amendment`? Recommend TS const (compile-time enforcement) with `framework_rule` as user-facing display source.

2. **Riksavtalen 2024-2026 versjon-binding:** Riksavtalen revideres 1. april 2026. Migration must include version-flip plan.

3. **Citation hallucination risk:** Lovsen spec P6 (no hallusinasjon på paragraf-numre). Citation-validator MUST run before tool output returns.

4. **Lokal avtale vs Arbeidstilsynet-vedtak modeling:** Aml. §10-6 hybrid-model (ADR-0233 amendment §8) — `overtime_agreement_type` enum needs sub-tools to validate.

5. **GDPR Art. 9 compliance for trade-union queries:** `legal` capability MUST NOT expose `trade_union_*` data even in advisory tools — only `payroll` capability per ADR-0234.

6. **ESKALÉR-flagg propagation:** Tools must return `escalate_to_attorney: boolean` field when confidence is LOW or scenario hits Lovsen ESKALÉR list (oppsigelse / lønnstrekk / prøvetid-utvidelse / endringsoppsigelse / lærling).

## Test corpus

30+ reelle case per Lovsen spec §8. Lives in `packages/ai/src/capabilities/legal/__tests__/test-corpus/`. Per case: spørsmål + forventet kilde (paragraf + dokument) + forventet confidence + edge cases.

Run on every release + on `regulatory_framework` migration to detect breaking changes.

## References

- Council 2026-04-29 Contract Module Phase 0a + Lovsen integration
- Steward synthesis 2026-04-29 (Lovsen as capability, not agent)
- Lovsen Hospitality Intelligence Member original spec (user message 2026-04-29)
- ADR-0078, 0099, 0151, 0163, 0192, 0193, 0220
- ADR-0233 (schema migration), 0234 (capability split — paired), 0235 (obligation lifecycle), 0236 (amendment flow)
- L-0175 (persona vocabulary doesn't justify agent architecture) — primary learning
- Aml. §10-6, §14-5, §14-6, §15-3, §15-6, §15-7, §15-15
- Ferieloven §10, OTP-loven, Bokføringsloven §13
- Riksavtalen Hospitality 2024-2026, Hovedavtalen LO-NHO
- Cascade Core Foundation cascade-integrity-mandate §1, §7
