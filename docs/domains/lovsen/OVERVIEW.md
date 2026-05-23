---
title: "Lovsen — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: verified
last_verified: 2026-05-23
tags: [lovsen, legal, arbeidsrett, riksavtalen, lovdata, aml, mcp, k1a, overview]
---

# Lovsen — Overview

## What

Lovsen is Smartout's **Norwegian arbeidsrett legal substrate**. It provides the legal text fetching, tariff versioning, citation verification, and compliance validation infrastructure that the rest of the platform consumes.

Lovsen answers: "Does this contract comply with Aml. §14-6?" "What is the Riksavtalen kveldstillegg for 2025?" "Is this amendment MATERIAL or ENDRINGSOPPSIGELSE?" "Has this Lovdata paragraph changed since last fetch?"

The Lovsen persona (`.claude/agents/lovsen.md`) is an AI colleague with expertise in hospitality arbeidsrett — saklig, presis, never preachy. The persona is output branding. The engineering infrastructure underneath it is the lovsen domain.

## Why

Norwegian hospitality has the highest regulatory complexity per employee in Smartout's target market: Riksavtalen (NHO Reiseliv / Fellesforbundet) + Arbeidsmiljøloven + Mattilsynet + Arbeidstilsynet all apply simultaneously. A restaurant manager cannot hold these simultaneously in their head. Lovsen makes compliance a byproduct of normal operation, not a separate review step.

Key design principles:
- **Legal text is fetched, not hardcoded.** Riksavtalen rates change yearly. Lovdata paragraphs are updated by legislative amendments. Hardcoded values drift — MCP-fetched text doesn't.
- **Citation contract enforces verifiability.** Every legal claim carries `paragraph + verbatim_text + SHA-256 hash + fetched_at + source_url`. Staleness is detectable by re-hash.
- **Confidence is explicit.** HØY = direct verbatim cite. MEDIUM = interpretation. LAV = gråsone requiring advokat. The system never presents an interpretation as settled law.
- **Tariff binding is workspace-level.** Not all workspaces are tariff-bound. The `is_tariff_bound` flag (on `payroll.workspace_settings` and `employee_payroll_profile`) gates Riksavtalen enforcement.

## Cascade placement

Lovsen sits at **K1a Industry substrate** — the platform-level legal authoring tier. It is not workspace-scoped in the cascade sense; it provides the legal foundation that workspace-scoped logic (D3 Rules, C4 Governance) consumes.

```
K1a Industry (platform-level)
  ├── tariff_rate_table         ← lovsen AUTHORS (NHO Reiseliv MCP → law_version + effective_from)
  ├── regulatory_framework      ← hospitality.no.default.v1 (seeded by 20260424100000)
  ├── framework_rule            ← 17 aml.14_6.a–q rules (seeded per ADR-0310)
  └── public_holiday            ← Norway calendar (seeded by 20260422110100)

Workspace-scoped consumers:
  ├── D3 Rules: workspace_framework_binding, workspace_rule_override
  ├── payroll: tariff_rate_table (reads K1a baseline + workspace overrides)
  ├── contracts: validate_aml_14_6 (reads framework_rule via legal capability)
  └── training: is_apprentice (reads employment_category from contracts)
```

## The 5-MCP architecture

Each Python stdio MCP server covers one legal source. They are independent — no shared HTTP client, no shared parse logic. `lovsen-shared` provides the citation validation and freshness-check infrastructure shared by the two sources that implement `verify_citation_freshness` (nho-reiseliv and lovdata).

| Service | Source | Tools | ADRs |
|---|---|---|---|
| `lovsen-nho-reiseliv-mcp` | Riksavtalen (NHO Reiseliv / LO) | `fetch_riksavtalen`, `lookup_tariff_supplement`, `verify_citation_freshness` | ADR-0256, ADR-0258, ADR-0347 |
| `lovsen-arbeidstilsynet-mcp` | Arbeidstilsynet.no | `search_guidance`, `fetch_workplace_assessment_template` | ADR-0256, ADR-0258 |
| `lovsen-lovdata-mcp` | Lovdata.no (Aml., ferielov, OTP) | `fetch_paragraph`, `search_law`, `get_law_metadata`, `fetch_riksavtalen_paragraph`, `verify_citation_freshness` | ADR-0256, ADR-0258, ADR-0342, ADR-0347 |
| `lovsen-mattilsynet-mcp` | Mattilsynet.no | `search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement` | ADR-0256, ADR-0258 |
| `lovsen-shared` | (shared lib) | `validate_hashes`, `emit_stale_event_stderr` | ADR-0258, ADR-0342, ADR-0347, ADR-0348 |

All services:
- Expose tools via MCP stdio transport (JSON-RPC over stdin/stdout)
- Rate-limit to 1 req/sec per source domain (ADR-0258)
- Cache responses 24h to `~/.cache/lovsen-mcp/<service>/`
- Support fixture mode (`LOVSEN_FIXTURE_MODE=true`) for CI/offline (ADR-0258 canonical envvar)
- Return ADR-0256-compliant Citation JSON (verbatim text + SHA-256 + ISO-8601 fetched_at + source_url)

## Capability bridge (ADR-0350)

The MCP services are Python stdio. The `legal` capability (`packages/ai/src/capabilities/legal/`) is TypeScript running in the Node/stage-engine process. ADR-0350 defines the bridge: an HTTP route in the BFF (`apps/web/src/app/api/`) acts as a proxy — receiving capability tool calls over HTTP, spawning the Python MCP, and returning JSON. This bridge is **proposed** (ADR-0350 status: proposed) — the full dynamic-fetch tariff system is Phase 0c+ work.

The current Phase 0c `legal` capability tools use:
- `validate_aml_14_6` — real rule body reading `framework_rule` rows from K1a (no MCP call yet)
- `validate_aml_14_15` — real body reading `payroll.consent_document` (no MCP call)
- `cite_law` — Phase 0c stub returning placeholder text
- `classify_amendment` — Phase 0c stub classifying all changes as "admin"

The `amendment-classifier.ts` pure function IS real and complete — full rule matrix for §14-6 + §15-7 + Riksavtalen §4 carve-out.

## Mr. Botsson positioning

Botsson is Smartout's AI-kollega som forbereder (onboarding), guider (daily support), and vedlikeholder (continuous competence). Lovsen is Botsson's legal sibling — the specialist he calls when an employee or manager asks a Norwegian labour law question. Per ADR-0220, Botsson remains the sole conversational front door. The `legal` capability is registered in the agent router's intent classifier; Botsson's intent classifier routes `arbeidsrett` / `§14-6` / `Riksavtalen` intent to the legal capability, which responds in Lovsen voice.

The lovsen agent file (`.claude/agents/lovsen.md`) defines that voice: saklig, paragraf-presis, tørr humor — not a pekefinger. Always cites the exact paragraph. Acknowledges gråsoner. Escalates when confidence is LAV.
