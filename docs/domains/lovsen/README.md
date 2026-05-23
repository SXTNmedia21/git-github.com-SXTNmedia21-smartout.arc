---
title: "Lovsen — Domain Index"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: verified
last_verified: 2026-05-23
tags: [lovsen, legal, arbeidsrett, riksavtalen, lovdata, aml, mcp, k1a, domain, source-of-truth]
---

# Lovsen — Source of Truth

> Authoritative folder for the **lovsen** domain (Norwegian arbeidsrett legal substrate). If code contradicts this folder → **CODE wins**, update these docs.
>
> **Scope boundary:** lovsen = legal substrate AUTHORING. 5 Python MCP services fetch and verify legal text. 1 TypeScript capability exposes legal tools to the agent. Payroll, contracts, and training are consumers — they do not own legal data authoring.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| `services/lovsen-nho-reiseliv-mcp/` — Riksavtalen | ✅ | ✅ | 3 tools: `fetch_riksavtalen`, `lookup_tariff_supplement`, `verify_citation_freshness`. 6 pytest files. |
| `services/lovsen-arbeidstilsynet-mcp/` — Arbeidstilsynet | ✅ | ✅ | 2 tools: `search_guidance`, `fetch_workplace_assessment_template`. 4 pytest files. |
| `services/lovsen-lovdata-mcp/` — Lovdata canonical | ✅ | ✅ | 5 tools: `fetch_paragraph`, `search_law`, `get_law_metadata`, `fetch_riksavtalen_paragraph`, `verify_citation_freshness`. 7 pytest files. |
| `services/lovsen-mattilsynet-mcp/` — Mattilsynet | ✅ | ✅ | 3 tools: `search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement`. 5 pytest files. |
| `services/lovsen-shared/` — Shared Python lib | ✅ | — | `validate_hashes`, `emit_stale_event_stderr`, `FreshnessResult`. Consumed by nho-reiseliv + lovdata MCPs. |
| `packages/ai/src/capabilities/legal/` — TypeScript capability | 🟡 | 🟡 | Phase 0c stub. 4 tools: `validate_aml_14_6` (real rule body), `cite_law` (stub), `classify_amendment` (stub), `validate_aml_14_15` (real body). 2 test files. |
| `packages/lovsen-contract/` — Zod/TS citation schema | ✅ | ✅ | Citation + LovsenAnswer + ValidationResult + ClassificationResult + ConfidenceScore. |
| `.claude/agents/lovsen.md` — agent persona | ✅ | — | Lovsen agent character. Output branding only — Botsson remains conversational front door (ADR-0220). |
| `docs/engines/industri-inteligence/Lov-og-rett/agents/lovsen-agent/` — engine doc | ✅ | — | ROADMAP.md, SKILL.AML.md, SKILL.CLASSIFYER.md, lovsen.md, plugin.json. |
| 10 ADRs | ✅ | — | All accepted (ADR-0350 status: proposed). See ROADMAP.md. |
| K1a tables (`tariff_rate_table`, `framework_rule`, `regulatory_framework`, `public_holiday`) | ✅ | 🟡 | Lovsen AUTHORS; payroll/contracts CONSUME. See DATA-MODEL.md. |
| `supabase/migrations/20260527100400_payroll_phase1_tariff_law_version.sql` | ✅ | — | law_version column on tariff_rate_table per ADR-0252. |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix across all domains: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | verified | L1–L5 code map |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | verified | K1a tables, migrations, telemetry events |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | aspirational | Journey index (lovsen has no direct UI) |
| 5 | [ROADMAP.md](./ROADMAP.md) | mixed | Campaign status + 10 ADRs + forward work |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Phase 0c stub status + overlap + debt |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | verified | Python pytest + TS unit test coverage |

## Agent Guardrails

> Read before touching any lovsen code. These rules are load-bearing — violations are architecture errors.

- **lovsen AUTHORS the legal substrate. Downstream domains CONSUME it.** Payroll reads `tariff_rate_table`; contracts consume `validate_aml_14_6` via send-route gate; training reads `is_apprentice` via contract. Never let a consumer domain write K1a legal rows — that is lovsen's authoring monopoly.
- **Citation contract is MANDATORY per ADR-0256.** Every MCP tool response returns a Citation with `paragraph + verbatim_text + hash (SHA-256) + fetched_at (ISO-8601) + source_url`. Never quote Aml./Riksavtalen without the full triple. `packages/lovsen-contract/src/citation.ts:26` is the canonical Zod schema.
- **Freshness verification per ADR-0342.** `verify_citation_freshness` tool is implemented in both `lovsen-nho-reiseliv-mcp` (`src/tools/verify_citation_freshness.py:115`) and `lovsen-lovdata-mcp` (`src/tools/verify_citation_freshness.py:108`). Stale citations emit `lovsen.citation.stale` to stderr — telemetry bridge (ADR-0350) re-emits via `@smartout/telemetry`.
- **Tariff binding is a workspace attribute.** `payroll.workspace_settings.is_tariff_bound` (`20260527100200`) mirrors workspace-level legal binding. Auto-enforce Riksavtalen rules ONLY when this is true — never assume all workspaces are tariff-bound.
- **Confidence model per ADR-0257.** Every lovsen answer that surfaces to a user carries a confidence score: HØY (direct verbatim cite) / MEDIUM (interpretation) / LAV (gråsone). LAV + juridical consequence = automatic escalation recommendation. Never present an interpretation as fact.
- **Capability authority per ADR-0259.** `classify_amendment` has `gate_action: enforce, default_allow: false`. The gate MUST be called even on stub path — it seeds the authority surface for Phase 0c+. Fail CLOSED on RPC error (gate.ts:callGateAction). ADR-0099 L-0066 class closed by `20260520130000_legal_capability_authority_seed.sql`.
- **No parallel heuristics.** The amendment-classifier (`amendment-classifier.ts`) is the SINGLE lovsen-owned rule matrix for all §14-6 vilkår changes. No inline heuristics in payroll or contracts — they call `classifyAmendmentLogic` imported from `packages/ai/src/capabilities/legal/index.ts`.
- **Lovsen persona is OUTPUT BRANDING ONLY.** Botsson is the sole conversational front door (ADR-0220). Lovsen agent persona (`.claude/agents/lovsen.md`) provides voice+character; tools live in `legal` capability. Never bypass Botsson to call legal capability directly from a user surface.
