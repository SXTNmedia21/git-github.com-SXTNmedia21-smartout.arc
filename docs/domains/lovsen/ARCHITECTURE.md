---
title: "Lovsen — Architecture"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: verified
last_verified: 2026-05-23
tags: [lovsen, legal, architecture, mcp, capability, k1a, aml, riksavtalen]
---

# Lovsen — Architecture

Five layers, one domain. Legal text flows from the web into K1a tables, then out through the capability to users.

## L1 — MCP services (Python stdio)

Five Python services. Each is independent. No shared HTTP client — `lovsen-shared` provides only citation validation helpers.

### `services/lovsen-nho-reiseliv-mcp/`

**Role:** Riksavtalen (NHO Reiseliv / LO hospitality collective agreement) — tariff rates, supplements, version-aware fetching.

**Tools (3):** Registered at `src/server.py:54` (`@server.list_tools()`), dispatched at `src/server.py:168` (`@server.call_tool()`).

| Tool | File | Description |
|---|---|---|
| `fetch_riksavtalen` | `src/tools/fetch_riksavtalen.py:33` | Fetch a Riksavtalen paragraph for a specific version (`2024` or `2025`). Returns full ADR-0256 Citation. Version is REQUIRED — never defaults. |
| `lookup_tariff_supplement` | `src/tools/lookup_tariff_supplement.py:43` | Look up kveldstillegg or garantilonn for an explicit version. Returns Citation with paragraph `riksavtalen_{version}/{category}`. |
| `verify_citation_freshness` | `src/tools/verify_citation_freshness.py:115` | Batch freshness check for citation hashes against NHO Reiseliv. ADR-0342 implementation. Uses `lovsen-shared` validation. |

**Fixtures (4):** `riksavtalen_2024_kveldstillegg.json`, `riksavtalen_2025_kveldstillegg.json`, `riksavtalen_2024_garantilonn.json`, `riksavtalen_2025_garantilonn.json`. PLACEHOLDER values — real verbatim text pending Phase 7 live fetch.

**Cache:** `~/.cache/lovsen-mcp/nho-reiseliv/` — 24h TTL.

### `services/lovsen-arbeidstilsynet-mcp/`

**Role:** Arbeidstilsynet.no (Norwegian Labour Inspection Authority) — HMS guidance, workplace risk-assessment templates, arbeidstid veiledninger.

**Tools (2):** Registered at `src/server.py:49` (`@server.list_tools()`), dispatched at `src/server.py:112` (`@server.call_tool()`).

| Tool | File | Description |
|---|---|---|
| `search_guidance` | `src/tools/search_guidance.py:31` | Full-text search Arbeidstilsynet veiledninger. Optional `scope` filter: `hms`, `risikovurdering`, `arbeidstid`. Returns Citation. |
| `fetch_workplace_assessment_template` | `src/tools/fetch_workplace_assessment_template.py:39` | Fetch a risk-assessment template by ID. Returns Citation with template body. |

**Fixtures (3):** `hms_systematisk_arbeid.json` (Internkontrollforskriften §5), `arbeidstid_natt_skift.json` (Aml. §10-3), `risikovurdering_kjokken_template.json`.

**Cache:** `~/.cache/lovsen-mcp/arbeidstilsynet/` — 24h TTL.

Note: No `verify_citation_freshness` tool — Arbeidstilsynet guidance doesn't require SHA-256 hash verification per ADR-0342 (applies to statutory sources). ADR-0342 scope = Lovdata + NHO Reiseliv.

### `services/lovsen-lovdata-mcp/`

**Role:** Lovdata.no — canonical Norwegian statutory law (Aml., ferieloven, OTP, riksavtalen via lovdata mirror). Canonical source per ADR-0347.

**Tools (5):** Registered at `src/server.py:192` (`@server.list_tools()`), dispatched at `src/server.py:198` (`@server.call_tool()`).

| Tool | File | Description |
|---|---|---|
| `fetch_paragraph` | `src/tools/fetch_paragraph.py:34` | Fetch a law paragraph by `lov` (e.g. `aml`, `ferieloven`) + `paragraph` + optional `ledd`. Returns Citation. Async. |
| `search_law` | `src/tools/search_law.py:47` | Full-text search across Lovdata. Optional `lov` filter. Returns list of Citations. Async. |
| `get_law_metadata` | `src/tools/get_law_metadata.py:51` | Fetch metadata for an entire law (`lov` key). Version, title, last amended. Async. |
| `fetch_riksavtalen_paragraph` | `src/tools/fetch_riksavtalen_paragraph.py:120` | Fetch a Riksavtalen paragraph via Lovdata mirror (ADR-0347 canonical source). |
| `verify_citation_freshness` | `src/tools/verify_citation_freshness.py:108` | Batch freshness check against Lovdata. ADR-0342. Uses `lovsen-shared` validation. |

**Fixtures (3):** `aml_14_6.json`, `aml_15_3.json`, `aml_15_6.json`.

**Cache:** 24h TTL. Rate-limit: 1 req/sec via asyncio token bucket.

### `services/lovsen-mattilsynet-mcp/`

**Role:** Mattilsynet.no (Norwegian Food Safety Authority) — food safety regulations, HACCP, alcohol serving rules, allergen requirements.

**Tools (3):** Registered at `src/server.py:48` (`@server.list_tools()`), dispatched at `src/server.py:131` (`@server.call_tool()`). Full module structure at `src/tools/` with per-tool files.

| Tool | File | Description |
|---|---|---|
| `search_regulation` | `src/tools/search_regulation.py` | Full-text search regulations and circulars. Returns Citation. |
| `fetch_guidance` | `src/tools/fetch_guidance.py` | Fetch a guidance document (veiledning) by topic slug. Returns Citation. |
| `lookup_food_safety_requirement` | `src/tools/lookup_food_safety_requirement.py` | Fetch a food-safety requirement by category. Returns Citation. |

**Fixtures (3):** `alkohol_servering_aldersgrense.json`, `allergener_pliktig_merking.json`, `hygiene_temperatur_kjedge.json`.

**Parser layer:** `src/parsers/citation_parser.py` converts HTML/text → Citation JSON (ADR-0256).

### `services/lovsen-shared/`

**Role:** Shared Python helpers for ADR-0342 freshness verification and ADR-0256 citation validation. Consumed by `lovsen-nho-reiseliv-mcp` and `lovsen-lovdata-mcp`.

**Modules:**

| Module | File | Purpose |
|---|---|---|
| `FreshnessResult` | `lovsen_shared/types.py` | TypedDict mirroring ADR-0342 method contract. Includes ADR-0348 optional `drift_axis` + `legacy_single_hash` fields + ADR-0347 `source` discriminator. |
| `validate_hashes` | `lovsen_shared/validation.py` | Authoritative ADR-0342 Input contract. Raises `ValueError` on: batch size 0, batch size >100, non-string entries, entries not matching `[0-9a-f]{64}`. |
| `emit_stale_event_stderr` | `lovsen_shared/telemetry.py` | Writes `lovsen.citation.stale` JSON line to stderr. Shape matches ADR-0256 registered event (`packages/telemetry/src/registry.ts:8148`). BFF/T5 re-emits via `@smartout/telemetry`. |

**ADRs governing shared lib:** ADR-0258 (LOVSEN_FIXTURE_MODE envvar), ADR-0342 (verify_citation_freshness), ADR-0347 (shared helper mandate), ADR-0348 (two-hash model).

---

## L2 — Capability bridge (ADR-0350 — proposed)

**Current state:** Bridge is PROPOSED but NOT BUILT. The HTTP route in the BFF that would proxy capability tool calls → Python MCP has not been implemented. This is Phase 0c+ work.

**Design (ADR-0350):** BFF route at `apps/web/src/app/api/` receives HTTP POST from capability tool → spawns Python MCP subprocess → sends JSON-RPC call → returns JSON. MCP stays Python; bridge is HTTP. Reuses ADR-0265 deployment pipeline conventions.

**What IS wired today:** `validate_aml_14_6` reads `framework_rule` directly from Supabase (K1a). No MCP call. `validate_aml_14_15` reads `payroll.consent_document` directly. The MCP-to-capability dynamic-fetch path is pending.

---

## L3 — Capability code (`packages/ai/src/capabilities/legal/`)

**5 files:**

| File | Purpose | Status |
|---|---|---|
| `tools.ts` | 4 tool definitions: `validate_aml_14_6`, `cite_law`, `classify_amendment`, `validate_aml_14_15` | `validate_aml_14_6` + `validate_aml_14_15` = real; `cite_law` + `classify_amendment` = Phase 0c stubs |
| `gate.ts` | `callGateAction()` wrapper around Postgres `gate_action` RPC (ADR-0099) | ✅ real |
| `amendment-classifier.ts` | Pure function: `classifyAmendment(prev, next, ctx)` → `AmendmentClassification`. Full §14-6 + §15-7 + Riksavtalen §4 rule matrix. Zero I/O. | ✅ real, complete |
| `aml-14-15.ts` | Shared utility: `validateAml1415Logic()`. Reads `payroll.consent_document` via admin client. Shared between tool and BFF route. | ✅ real |
| `index.ts` | `legalCapability: CapabilityDefinition`. `allowedChannels: ["chat", "system"]`. `emitPrefix: "legal"`. | ✅ real |

**Tool channel matrix (ADR-0078 + ADR-0163 §rule 4):**

| Tool | chat | voice | system | autonomous |
|---|---|---|---|---|
| `validate_aml_14_6` | ✅ | ❌ | ✅ | ❌ |
| `cite_law` | ✅ | ❌ | ✅ | ❌ |
| `classify_amendment` | ❌ | ❌ | ✅ | ✅ |
| `validate_aml_14_15` | ❌ | ❌ | ✅ | ❌ |

Voice excluded for all legal tools (ADR-0163 §rule 4 — AML content is chat-only; F-CL-11 closed voice from `cite_law` per audit 2026-05-13).

**`__tests__/` (2 files):** `tools.test.ts` (6 unit tests — channel guards + integration shape) + `amendment-classifier.test.ts` (classifier rule coverage).

---

## L4 — Data (`packages/lovsen-contract/` + K1a tables)

### `packages/lovsen-contract/src/` — TS Zod schemas

| File | Export | Description |
|---|---|---|
| `citation.ts:26` | `CitationSchema` | `paragraph`, `verbatim_text`, `hash` (SHA-256), `fetched_at` (ISO-8601), `source_url`. ADR-0256 canonical schema. |
| `confidence.ts` | `ConfidenceScoreSchema` | `level` (HØY/MEDIUM/LAV), `stale_paragraph`, `reasoning_no`. ADR-0257. |
| `lovsen-answer.ts` | `LovsenAnswerSchema` | Wraps Citation + ConfidenceScore + answer text. |
| `validation-result.ts` | `ValidationResultSchema` | Contract validation output (used by contracts consumer). |
| `classification-result.ts` | `ClassificationResultSchema` | Amendment classification output. |

### K1a tables (Supabase `public` schema)

| Table | Migration | Role |
|---|---|---|
| `tariff_rate_table` | `20260421100200_cascade_a1_domain_tables.sql:259` | Versioned rates. `workspace_id IS NULL` = platform K1a baseline. `law_version` added `20260527100400:27`. `effective_from` + `effective_until` date range with EXCLUDE constraint for no-overlap. |
| `regulatory_framework` | `20260421200100_cascade_a2_framework_tables.sql:14` | Framework packages (e.g. `hospitality.no.default.v1`). Platform-managed. |
| `framework_rule` | `20260421200100_cascade_a2_framework_tables.sql:50` | Individual evaluable rules. 17 `aml.14_6.a–q` rows seeded by `20260424100000_seed_hospitality_framework.sql`. |
| `public_holiday` | `20260421100200_cascade_a1_domain_tables.sql:490` | Norway calendar days for supplement calculation. |

---

## L5 — Agent persona

**`.claude/agents/lovsen.md`** — Lovsen agent character. Frontmatter: `name: lovsen`, `model: sonnet`, `color: indigo`. Voice rules: paragraph-explicit citations, short answer first, acknowledge gråsoner, LAV confidence → escalate. Confidence policy: HØY/MEDIUM/LAV per ADR-0257.

**`docs/engines/industri-inteligence/Lov-og-rett/agents/lovsen-agent/`** — Engine doc set: `README.md`, `ROADMAP.md`, `SKILL.AML.md`, `SKILL.CLASSIFYER.md`, `checklist.md`, `learnings/`, `lovsen.md`, `plugin.json`.

Persona is OUTPUT BRANDING ONLY. Botsson is the sole conversational front door (ADR-0220). Legal capability is the fifth registered capability (ADR-0249), registered by the agent router alongside contract, payroll, task, and schedule capabilities.
