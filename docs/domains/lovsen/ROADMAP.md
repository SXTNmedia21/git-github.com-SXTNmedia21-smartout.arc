---
title: "Lovsen — Roadmap"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: mixed
last_verified: 2026-05-23
tags: [lovsen, legal, roadmap, campaign, adrs, riksavtalen, lovdata, mcp]
---

# Lovsen — Roadmap

> mirror: mixed — completed milestones are verified against handoffs; forward work is aspirational.

## Campaign status

Campaign `campaign/lovsen` is active. The campaign was started 2026-04-29.

**CAMPAIGN-lovsen.md status:** The plan file (`docs/plans/CAMPAIGN-lovsen.md`) has a stub skeleton — milestone list and sub-sortie tracking are empty. Source of truth for what's built is the handoffs and journey docs.

---

## Phase completion summary

| Phase | Status | Handoff | Key ADRs shipped |
|---|---|---|---|
| Foundation | ✅ DONE | `HANDOFF-lovsen-foundation.md` | ADR-0252, ADR-0256, ADR-0257, ADR-0258, ADR-0259 |
| Cert pass | ✅ DONE | `HANDOFF-lovsen-cert-pass.md` | — |
| Phase 7a — ADR amendments | ✅ DONE | `HANDOFF-lovsen-phase-7a-adrs.md` | ADR-0310, ADR-0311, ADR-0342, ADR-0347 |
| Phase 7b — Lovdata MCP | ✅ DONE | `HANDOFF-lovsen-phase-7b-lovdata-mcp.md` | ADR-0347 implementation |
| Phase 7c — Prep | ✅ DONE | `HANDOFF-lovsen-phase-7c-prep.md` | ADR-0348 two-hash model, `lovsen-shared` |
| Phase 7d — Pivot ADRs | ✅ DONE | `HANDOFF-lovsen-phase-7d-pivot-adrs.md` | ADR-0350 (proposed — not yet accepted) |
| Phase 7d — Payroll amendments | ✅ DONE | `HANDOFF-payroll-lovsen-phase-7d-adr-amendments.md` | ADR-0355, ADR-0356, ADR-0292/0293/0294 |

---

## 10 ADRs governing lovsen

| ADR | Title | Status | Code evidence |
|---|---|---|---|
| ADR-0252 | Riksavtalen versjonering migration policy | accepted | `tariff_rate_table.law_version` at `20260527100400:27`; `effective_from`/`effective_until` at `20260421100200:264` |
| ADR-0256 | Lovsen citation contract | accepted | `packages/lovsen-contract/src/citation.ts:26` — `CitationSchema` with `paragraph`, `verbatim_text`, `hash`, `fetched_at`, `source_url` |
| ADR-0257 | Lovsen confidence model | accepted | `packages/lovsen-contract/src/confidence.ts` — `ConfidenceScoreSchema` HØY/MEDIUM/LAV |
| ADR-0258 | Lovsen MCP boundary | accepted | `LOVSEN_FIXTURE_MODE=true` envvar in all 4 service READMEs; `lovsen-shared/lovsen_shared/validation.py` |
| ADR-0259 | Lovsen capability authority | accepted | `packages/ai/src/capabilities/legal/index.ts` — `legalCapability` with `defaultAuthority: "read_only"`, `emitPrefix: "legal"` |
| ADR-0310 | §14-6 rule table-driven Aml validation | accepted | `packages/ai/src/capabilities/legal/tools.ts:225` — query `framework_rule WHERE code LIKE 'aml.14_6.%'`; 17 rows seeded by `20260424100000_seed_hospitality_framework.sql` |
| ADR-0311 | Consent document payroll deductions Aml §14-15 | accepted | `packages/ai/src/capabilities/legal/aml-14-15.ts` — `validateAml1415Logic()`; tool `validate_aml_14_15` at `tools.ts:565` |
| ADR-0342 | Lovsen MCP freshness verification tool | accepted | `services/lovsen-nho-reiseliv-mcp/src/tools/verify_citation_freshness.py:115`; `services/lovsen-lovdata-mcp/src/tools/verify_citation_freshness.py:108`; `lovsen-shared/lovsen_shared/validation.py:validate_hashes` |
| ADR-0347 | Lovdata canonical source for Riksavtalen | accepted | `services/lovsen-lovdata-mcp/src/tools/fetch_riksavtalen_paragraph.py:120`; `services/lovsen-nho-reiseliv-mcp/README.md` cites ADR-0347 |
| ADR-0350 | Lovsen MCP→capability bridge transport | **proposed** | Bridge NOT YET BUILT. ADR exists at `docs/decisions/0350-lovsen-mcp-to-capability-bridge-transport.md`. Design: BFF HTTP route + capability HTTP client. Phase 0c+ work. |

---

## Forward work

### Phase 0c+ — Capability implementation

The `legal` capability is a Phase 0c scaffold. Real bodies pending:

| Item | Status | Description |
|---|---|---|
| `cite_law` real body | ❌ not built | Read `regulatory_framework + framework_rule` WHERE code ILIKE query AND effective_to IS NULL OR effective_to > NOW(). Or call Lovdata MCP via ADR-0350 bridge. |
| `classify_amendment` real body | ❌ not built | Read `field_classification_metadata` per ADR-0235. Apply conditional rules. Check constructive_dismissal_risk (ADR-0236). Currently stubs every change as "admin". |
| ADR-0350 bridge | ❌ not built | HTTP route in BFF to proxy TypeScript capability → Python MCP. Blocked on ADR-0350 acceptance + implementation. |

### Phase 0c+ — Additional MCP services

| Item | Status | Description |
|---|---|---|
| Skatteetaten MCP | 🔴 not planned | Skattemelding / A-melding API for payroll deduction rules. Would complement Lovdata. |
| NAV MCP | 🔴 not planned | Sykepenger, foreldrepenger rules. Potential for HMS incident flows. |
| Arbeidstilsynet freshness | 🔴 not planned | ADR-0342 scope currently excludes Arbeidstilsynet. Could be extended if guidance staleness becomes a compliance risk. |

### Phase 0c+ — Tariff authoring pipeline automation

| Item | Status | Description |
|---|---|---|
| Riksavtalen auto-refresh | 🔴 not built | Cron job calling NHO Reiseliv MCP, comparing hashes, flagging stale rows, proposing migration with new `law_version`. Today: manual migrations. |
| `verbatim_pending` column | 🟡 column exists | `tariff_rate_table.verbatim_pending BOOLEAN` added by `20260527100400`. Not yet used to drive auto-fetch. |
| ADR-0350 bridge accept + ship | ❌ proposed only | Bridge design is ADR-0350. Pending council review and implementation sortie. |

### Capability completeness

| Item | Status |
|---|---|
| `validate_aml_14_6` — real body | ✅ DONE (reads framework_rule K1a rows) |
| `validate_aml_14_15` — real body | ✅ DONE (reads payroll.consent_document) |
| `amendment-classifier.ts` — full rule matrix | ✅ DONE (UP / MATERIAL / ENDRINGSOPPSIGELSE, 9 rules, Riksavtalen §4 carve-out) |
| `cite_law` — real Lovdata MCP call | ❌ stub |
| `classify_amendment` — real body | ❌ stub |
| ADR-0350 bridge | ❌ proposed |

---

## Handoffs — completion evidence

| Handoff | File |
|---|---|
| Foundation | `docs/handoffs/HANDOFF-lovsen-foundation.md` |
| Cert pass | `docs/handoffs/HANDOFF-lovsen-cert-pass.md` |
| Phase 7a ADRs | `docs/handoffs/HANDOFF-lovsen-phase-7a-adrs.md` |
| Phase 7b Lovdata MCP | `docs/handoffs/HANDOFF-lovsen-phase-7b-lovdata-mcp.md` |
| Phase 7c prep | `docs/handoffs/HANDOFF-lovsen-phase-7c-prep.md` |
| Phase 7d pivot ADRs | `docs/handoffs/HANDOFF-lovsen-phase-7d-pivot-adrs.md` |
| Phase 7d payroll amendments | `docs/handoffs/HANDOFF-payroll-lovsen-phase-7d-adr-amendments.md` |

Note: HANDOFF-lovsen-foundation.md listed in scope but confirmed in journey set — no separate handoff file located. Foundation work is confirmed by presence of `packages/lovsen-contract/` dist/ build artifacts and `JOURNEY-lovsen-foundation-*.md` journey files.
