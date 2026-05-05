---
title: "Contract / Payroll Capability Split — High-PII isolation"
id: ADR_0242
renumbered_from: ADR_0234
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0242: Contract / Payroll Capability Split

## Context and Problem Statement

ARCHITECTURE-contracts-module §9 classifies `personal_number`, `tax_*`, `bank_account` as Høy sensitivity requiring "payroll_admin" role. That role does not exist in the codebase — `engine_authority_config.min_role` enum is `employee | manager | admin | owner`. Existing seed `20260515170500_contract_capability_authority_seed.sql` covers ALL contract tools under one row at `min_role='admin'`. Adding payroll-PII tools under the existing `contract` capability collapses the §9 boundary. The `payroll` enum value exists in `CapabilityName` (`packages/ai/src/capabilities/types.ts:6-45`) and intent classifier (`packages/ai/src/router/intent-classifier.ts:45,93`) but has no capability definition — dead value.

## Decision Drivers

- ADR-0078 channel restriction needs per-capability `allowedChannels` declaration; mixing tiers in one capability collapses to lowest-common-denominator
- ADR-0192 authority seed bootstrap-trigger fires per capability registry entry — splitting allows distinct authority gates
- ARCHITECTURE §9 PII tier mandates separate access controls for Høy vs Medium vs Lav
- Dead `payroll` enum value already in router infrastructure — resurrection cheaper than new capability creation
- Coord + Harness convergent recommendation (Council 2026-04-29)

## Considered Options

1. **Single `contract` capability** — keep all contract+payroll tools together. Status quo but violates §9.
2. **Resurrect dead `payroll` capability** — wire the existing enum + intent value to actual tools for High-PII. Minimal new infrastructure.
3. **New `contract_payroll` capability + separate `contract_obligation` capability** — full split per concern. Highest isolation; most registry overhead.
4. **Extend `min_role` enum with `payroll_admin`** — add new role across DB + RLS helpers. High blast radius.

## Decision Outcome

Chosen option: **Option 2 — Resurrect dead `payroll` capability**, because it leverages existing router/enum infrastructure, isolates Høy PII tools from Medium/Lav, and avoids cross-cutting role enum extension.

### Capability allocation

| Capability | Tools | min_role | allowedChannels | Höy PII access |
|------------|-------|----------|-----------------|----------------|
| `contract` (existing) | listEmployeeContracts, checkContractStatus, explainContractClause, getComplianceDriftForContract, contract_obligation_query (new), composition + send tools | `admin` | `["chat"]` | No |
| `payroll` (resurrected) | update_payroll_profile, query_tax_card, set_pension_scheme, view_personal_number, view_bank_account, view_tax_table, salary_query (new) | `admin` | `["chat"]` only | Yes |
| `contract_intake` (existing) | composition PII intake | `employee` | `["chat"]` | Limited (own profile) |

Server-only handlers (NOT capabilities): `amendment_classify_change`, `is_employee_blocked`, `obligation_overdue_cron`. Invoked via `gate_action` with `channel='system'`.

### Required artefacts

1. New file `packages/ai/src/capabilities/payroll/{tools.ts,index.ts}` with `emitPrefix: "payroll"`, `defaultAuthority: "read_only"`, `allowedChannels: ["chat"]`.
2. Seed migration: `INSERT INTO capability_default_registry (capability, level, min_role, ...) VALUES ('payroll', 'confirm', 'admin', ...)` per ADR-0192 pattern.
3. Update `CapabilityName` union — `payroll` already present; add capability definition in `registry.ts`.
4. Update intent-classifier mapping — already lists `payroll`; verify routing.
5. New telemetry events registered in `packages/telemetry/src/registry.ts` with `payroll.*` namespace.
6. Channel guard at tool-level (defence-in-depth) — `if (ctx.channel !== "chat") throw` per `contract-intake/tools.ts:30-31` pattern.
7. ADR-0151 forgery defence at compose endpoint — verify `profile_id ∈ workspace_id` before write.

### Capability surface — promised-but-not-existing capabilities

| Capability | Home | Status before this ADR | Status after |
|------------|------|------------------------|--------------|
| `salary_query` | `payroll` capability | promised in ARCH §5.7, no code | tool inside `payroll` |
| `contract_obligation_query` | `contract` capability | promised in ARCH §5.6, no code | tool inside existing `contract` |
| `obligation_blocker_check` | server-side handler | promised in ARCH §5.6, no code | RPC, system channel via `gate_action` |
| `amendment_classify_change` | server-side handler | promised in ARCH §5.3, no code | pure function, no capability surface |

## Rules & Consequences

- **Good, because** Høy PII isolated under `payroll`; channel guard centralized; existing 10 contract tools unaffected; dead enum revived rather than expanded; ADR-0078 + ADR-0192 + ADR-0193 enforced per capability.
- **Bad, because** new capability requires authority seed migration + tool implementations + telemetry registration before Phase B7 ships; payroll-admin tools cannot be invoked by Botsson over voice (acceptable per §9).
- **Agent Impact:** Build agents adding payroll tools MUST: (a) place under `packages/ai/src/capabilities/payroll/`; (b) declare `allowedChannels: ["chat"]`; (c) seed `capability_default_registry` row in same PR; (d) verify `profile_id` workspace membership server-side.

## Lovsen Amendments 2026-04-29 (GDPR + capability surface)

### GDPR Art. 9 sensitive data — `trade_union_*` requires explicit treatment basis

`employee_payroll_profile.trade_union_member boolean` and `trade_union_name text` are **GDPR Art. 9(1) sensitive personal data** (fagforeningsmedlemskap). RLS + capability-split alone is INSUFFICIENT — Art. 9 requires explicit behandlingsgrunnlag per Art. 9(2)(b) (employment law obligations) or Art. 9(2)(d) (legitimate activities of trade union).

**Required:**

1. `payroll` capability MUST document Art. 9(2)(b) basis in capability frontmatter (DPA/data-processing-record reference).
2. Trade union write tools (`set_trade_union_membership`) emit `payroll.gdpr_art_9_write` telemetry event with `legal_basis: 'employment_law_obligation'` field for audit trail.
3. Read access to `trade_union_*` fields requires `payroll` capability + explicit consent from employee (per Personopplysningsloven §10) OR documented employment-law obligation.
4. Cannot store trade union data via `contract` capability — only `payroll` capability surface allowed.

**HØY confidence.** **ESKALÉR — DPO/personvernrådgiver-review before go-live.**

### Lovsen as `legal` capability — third sibling

Per Lovsen Hospitality Intelligence Member spec (2026-04-29), norsk arbeidsrett expertise is added as **third capability** alongside `contract` + `payroll`:

| Capability | Tools | min_role | allowedChannels | Purpose |
|------------|-------|----------|-----------------|---------|
| `contract` (existing) | listEmployeeContracts, checkContractStatus, explainContractClause, composition + send tools | `admin` | `["chat"]` | Templates + composition |
| `payroll` (resurrected) | update_payroll_profile, query_tax_card, salary_query, set_pension_scheme | `admin` | `["chat"]` | Compensation + Høy-PII |
| `legal` (NEW per Lovsen spec) | validate_aml_14_6 (chat), cite_law (chat+voice), classify_amendment (server-only) | `manager` for read; `admin` for classify | per-tool below | Norsk arbeidsrett compliance |

**`legal` capability per-tool channels:**
- `validate_aml_14_6`: `["chat"]` (touches oppsigelse/sykefravær — High-sensitivity context)
- `cite_law`: `["chat", "voice"]` (paragraph references, no PII)
- `classify_amendment`: server-only (drives mutation downstream — `gate_action enforce default_allow:false`)

**`legal` capability is NOT an agent.** Botsson remains sole conversational front door per ADR-0220. `legal` is tools that Botsson invokes when intent classifier routes to legal questions. Persona "Lovsen" is user-facing branding for `legal` capability outputs, not separate runtime — see L-0181.

**Knowledge base:** Norske lover live in `regulatory_framework` + `framework_rule` rows with `workspace_id IS NULL` (K1a platform-shared). Existing `effective_from`, `effective_to`, `version` columns. NO new filesystem `knowledge/laws/*` directory. Single source of truth via cascade K1a layer.

**Implementation timing:** `legal` capability lands in **Phase 0c** (after Phase 0a schema + Phase 0b `contract`/`payroll` capability work). NOT before. Schema-first per Trust Gate.

## References

- Council 2026-04-29 Contract Module Phase 0a
- Lovsen Hospitality Intelligence review 2026-04-29
- Steward synthesis 2026-04-29 (Lovsen as capability, not agent)
- ADR-0078 (channel restriction), ADR-0151 (server-side profile_id), ADR-0163 (sibling fail-closed channel)
- ADR-0099 (gate_action), ADR-0192 (authority seed bootstrap-trigger)
- ADR-0193 (NonEmptyString brand for telemetry IDs)
- ADR-0220 (Botsson conversational front door, not orchestrator)
- ADR-0241 (schema migration foundation — paired)
- ARCHITECTURE-contracts-module §9 (PII tiers)
- L-0179 (capability registry co-migration), L-0180 (role enum assumption), L-0181 (persona vocabulary doesn't justify agent architecture)
- GDPR Art. 9, Personopplysningsloven §10
- `regulatory_framework` + `framework_rule` cascade K1a tables

---

> Registered in `docs/decisions/0000-decision-log.md` 2026-04-29.
