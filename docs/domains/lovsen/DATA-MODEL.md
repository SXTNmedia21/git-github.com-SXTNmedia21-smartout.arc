---
title: "Lovsen — Data Model"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: verified
last_verified: 2026-05-23
tags: [lovsen, legal, data-model, k1a, tariff, framework, migrations, telemetry]
---

# Lovsen — Data Model

Lovsen owns the K1a legal authoring tables. Workspace-scoped domains (payroll, contracts) are consumers — they read K1a data but never write it.

## K1a platform tables (`public` schema)

### `tariff_rate_table`

**Migration anchor:** `20260421100200_cascade_a1_domain_tables.sql:259` — `CREATE TABLE IF NOT EXISTS public.tariff_rate_table`

**law_version column:** `20260527100400_payroll_phase1_tariff_law_version.sql:27` — `ADD COLUMN IF NOT EXISTS law_version TEXT NOT NULL DEFAULT '2025'` (default dropped at line 30 per ADR-0252 §two-step pattern).

```sql
CREATE TABLE IF NOT EXISTS public.tariff_rate_table (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID,                           -- NULL = K1a platform baseline
  rate_type       TEXT NOT NULL,
  source          tariff_source NOT NULL DEFAULT 'riksavtalen',
  effective_from  DATE NOT NULL,
  effective_until DATE,
  seniority_years INT,
  amount          NUMERIC(10,2) NOT NULL,
  unit            TEXT NOT NULL DEFAULT 'kr/t',
  law_version     TEXT NOT NULL,                 -- Added 20260527100400. e.g. '2024', '2025'
  metadata        JSONB DEFAULT '{}',
  provenance      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT excl_tariff_no_overlap EXCLUDE USING gist (...)  -- No overlap per rate_type + workspace
);
```

**Versjonering (ADR-0252):** `effective_from` / `effective_until` / `law_version` triple. Old payroll runs reproduce bit-exactly because rows are never mutated — new Riksavtalen version opens a new row with `effective_from = new_period_start` and closes the old row by setting `effective_until`. The EXCLUDE constraint prevents time-range overlaps per rate_type + workspace combination.

**RLS:**
- `jwt_select_tariff`: `workspace_id IS NULL OR workspace_id IN (get_workspace_ids_for_user(auth.uid()))` — authenticated users see platform baseline + their workspace rows.
- `api_key_read_tariff`: `workspace_id IS NULL OR workspace_id = get_api_workspace_id()` — API key access.
- `service_role_tariff`: full access for service role (K1a authoring migrations).

**Lovsen ownership:** Lovsen authors platform rows (`workspace_id IS NULL`). Platform seed migrations (`20260527100800_payroll_phase1_tariff_seed.sql`, `20260527101400_payroll_phase1_tariff_2024_close_2025_open.sql`, `20260618100000_workspace_union_binding_and_tariff_floor.sql`) insert K1a baseline rows. Payroll reads; it never inserts into `workspace_id IS NULL` rows.

---

### `regulatory_framework`

**Migration anchor:** `20260421200100_cascade_a2_framework_tables.sql:14` — `CREATE TABLE IF NOT EXISTS public.regulatory_framework`

Platform-managed framework packages. `hospitality.no.default.v1` is the canonical framework seeded by `20260424100000_seed_hospitality_framework.sql`.

**Key columns:** `framework_id UUID PK`, `code TEXT` (e.g. `hospitality.no.default.v1`), `name TEXT`, `version TEXT`, `effective_from DATE`, `parent_framework_id UUID` (optional inheritance).

**RLS:** `authenticated_select_framework` — all authenticated users can read (platform-level, no workspace scoping). Service role writes (migrations only).

---

### `framework_rule`

**Migration anchor:** `20260421200100_cascade_a2_framework_tables.sql:50` — `CREATE TABLE IF NOT EXISTS public.framework_rule`

Individual evaluable rules within a framework. The 17 Aml. §14-6 bokstaver (a–q) are stored as rows with `code LIKE 'aml.14_6.%'` under the `hospitality.no.default.v1` framework (ADR-0310).

**Key columns:** `rule_id UUID PK`, `framework_id UUID FK → regulatory_framework`, `code TEXT` (e.g. `aml.14_6.a`), `rule_type framework_rule_type`, `severity TEXT`, `evaluation_config JSONB` (bokstav, field, field_alt, required, required_when).

The `legal` capability's `validate_aml_14_6` tool reads these rows at runtime:
```typescript
// tools.ts:225 — framework_rule query
ctx.supabaseAdmin
  .from("framework_rule")
  .select("rule_id, code, evaluation_config, rule_type, severity")
  .eq("framework_id", platformFramework.framework_id)
  .like("code", "aml.14_6.%")
  .order("code");
```

**Unique constraint:** `uq_framework_rule (framework_id, code)` — one rule per code per framework.

---

### `public_holiday`

**Migration anchor:** `20260421100200_cascade_a1_domain_tables.sql:490` — `CREATE TABLE IF NOT EXISTS public.public_holiday`

Norway calendar days for supplement calculation. K1a — no workspace_id.

**Key columns:** `country_code TEXT`, `holiday_date DATE`, `name TEXT`, `is_bank_holiday BOOLEAN`. Composite PK `(country_code, holiday_date)`.

**Seeded by:** `20260422110100_payroll_config_tables.sql` + `20260422110400_payroll_seed_holidays.sql`.

---

## `packages/lovsen-contract/` — TypeScript Zod schemas

Five files defining the canonical lovsen type surface. Only Python lovsen-mcp services and the TypeScript `legal` capability consume these directly.

| File | Key export | ADR |
|---|---|---|
| `src/citation.ts:26` | `CitationSchema` — `paragraph`, `verbatim_text`, `hash` (SHA-256 hex), `fetched_at` (ISO-8601), `source_url` | ADR-0256 |
| `src/confidence.ts` | `ConfidenceScoreSchema` — `level` (HØY/MEDIUM/LAV), `stale_paragraph` bool, `reasoning_no` | ADR-0257 |
| `src/lovsen-answer.ts` | `LovsenAnswerSchema` — wraps Citation + Confidence + answer text | ADR-0256 |
| `src/validation-result.ts` | `ValidationResultSchema` — §14-6 validation output | ADR-0310 |
| `src/classification-result.ts` | `ClassificationResultSchema` — amendment classification output | ADR-0252 |

---

## ADR-0342 freshness verification

`verify_citation_freshness` is implemented in two MCP services:

- `services/lovsen-nho-reiseliv-mcp/src/tools/verify_citation_freshness.py:115`
- `services/lovsen-lovdata-mcp/src/tools/verify_citation_freshness.py:108`

Both delegate to `lovsen-shared/lovsen_shared/validation.py:validate_hashes` for input validation. Both call `lovsen-shared/lovsen_shared/telemetry.py:emit_stale_event_stderr` to emit `lovsen.citation.stale` events on stale hashes. The BFF/T5 bridge (ADR-0350, proposed) picks up stderr lines and re-emits via `@smartout/telemetry`.

Not implemented in Arbeidstilsynet-mcp or Mattilsynet-mcp — ADR-0342 scope is statutory sources (Lovdata + NHO Reiseliv).

---

## Telemetry events

**Source:** `packages/telemetry/src/registry.ts`

### `legal.*` events (capability-side)

| Event | Line | Routing |
|---|---|---|
| `legal.aml_14_6.validated` | registry.ts:7799 | posthog + activity_trail + engine_event |
| `legal.law_cited` | registry.ts:7822 | posthog + activity_trail |
| `legal.amendment_classified` | registry.ts:7838 | posthog + activity_trail + engine_event |
| `legal.aml_14_15.validated` | registry.ts:10659 | posthog + activity_trail |

Routing config at `registry.ts:14088` (`legal.aml_14_15.validated`), `14174` (`legal.aml_14_6.validated`), `14178` (`legal.law_cited`), `14182` (`legal.amendment_classified`).

### `lovsen.*` events (agent/MCP side)

| Event | Line | Description |
|---|---|---|
| `lovsen.query.received` | registry.ts:8061 | Agent received a legal query |
| `lovsen.query.classified` | registry.ts:8071 | Intent classified as lovsen-scope |
| `lovsen.skill.invoked` | registry.ts:8082 | Lovsen skill invoked (agent persona) |
| `lovsen.mcp.fetch` | registry.ts:8092 | MCP fetch started |
| `lovsen.mcp.fetch.completed` | registry.ts:8103 | MCP fetch completed |
| `lovsen.mcp.fetch.failed` | registry.ts:8115 | MCP fetch failed |
| `lovsen.answer.composed` | registry.ts:8127 | Lovsen answer composed |
| `lovsen.confidence.degraded` | registry.ts:8138 | Confidence degraded (LAV) |
| `lovsen.citation.stale` | registry.ts:8148 | Stale citation detected |

Routing config at `registry.ts:14259` (`lovsen.query.received`) through `14291` (`lovsen.citation.stale`).

**Total telemetry events: 13** (4 `legal.*` + 9 `lovsen.*`).

**Emit wiring:** All 4 `legal.*` events have real `emit()` call-sites in `packages/ai/src/capabilities/legal/tools.ts`. The 9 `lovsen.*` events are registered in registry but the full emit wiring from the MCP pipeline to TypeScript is pending the ADR-0350 bridge.

---

## Related migrations (lovsen-touched)

| Migration | What |
|---|---|
| `20260421100200_cascade_a1_domain_tables.sql` | Creates `tariff_rate_table`, `public_holiday`. K1a backbone. |
| `20260421200100_cascade_a2_framework_tables.sql` | Creates `regulatory_framework`, `framework_rule`, `framework_trigger`, `workspace_framework_binding`, `workspace_rule_override`. |
| `20260422110100_payroll_config_tables.sql` | `public_holiday` seed (Norway). |
| `20260422110400_payroll_seed_holidays.sql` | Extended holiday seed. |
| `20260424100000_seed_hospitality_framework.sql` | Seeds `hospitality.no.default.v1` regulatory framework + 17 §14-6 framework_rule rows. |
| `20260515100000_employee_type_k1a.sql` | employee_type K1a classification tables. |
| `20260520130000_legal_capability_authority_seed.sql` | Seeds `engine_authority_config` row for `legal` capability (ADR-0099 gate). |
| `20260527100400_payroll_phase1_tariff_law_version.sql` | Adds `law_version` to `tariff_rate_table` per ADR-0252. |
| `20260527100800_payroll_phase1_tariff_seed.sql` | Seeds K1a Riksavtalen baseline rates. |
| `20260527101400_payroll_phase1_tariff_2024_close_2025_open.sql` | Closes 2024 rates (`effective_until`), opens 2025 rates. |
| `20260615200200_riksavtalen_scheduler_framework_rules.sql` | Riksavtalen scheduler framework_rule additions. |
| `20260618100000_workspace_union_binding_and_tariff_floor.sql` | `workspace_union_binding` table + tariff_floor trigger. |
