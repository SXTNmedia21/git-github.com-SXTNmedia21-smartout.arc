---
title: "Lovsen — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: aspirational
last_verified: 2026-05-23
tags: [lovsen, legal, user-flows, journeys, aml, riksavtalen, compliance]
---

# Lovsen — User Flows

Lovsen has **no direct user UI**. It is a legal substrate — flows documented here are **upstream consumer flows that exercise lovsen** when managers, employees, or agents interact with contracts, payroll, or compliance surfaces.

All 10 journeys are linked below, grouped by phase.

---

## Foundation phase

| Journey | File | Description |
|---|---|---|
| Contract package builds | `docs/journeys/JOURNEY-lovsen-foundation-contract-package-builds.md` | `packages/lovsen-contract` build + CI passes. Foundation: citation schema + Zod types shipped. |
| Foundation ADRs locked | `docs/journeys/JOURNEY-lovsen-foundation-foundation-adrs-locked.md` | ADR-0252/0256/0257/0258/0259 accepted. Legal architecture governance established. |
| Telemetry events registered | `docs/journeys/JOURNEY-lovsen-foundation-telemetry-events-registered.md` | All 13 `legal.*` + `lovsen.*` events registered in `packages/telemetry/src/registry.ts`. Emit wiring Phase 0c+. |

---

## Cert-pass

| Journey | File | Description |
|---|---|---|
| Cert pass | `docs/journeys/JOURNEY-lovsen-cert-pass.md` | Complete MCP fixture-mode test suite passes CI. All 4 services green under `LOVSEN_FIXTURE_MODE=true`. Citation shape validated per ADR-0256. |

---

## Phase 7a — ADR amendments

| Journey | File | Description |
|---|---|---|
| Phase 7a ADRs | `docs/journeys/JOURNEY-lovsen-phase-7a-adrs.md` | ADR-0310 (§14-6 rule table-driven), ADR-0311 (§14-15 consent), ADR-0342 (freshness tool), ADR-0347 (Lovdata canonical). Capability authority + K1a table-driven validation established. |

---

## Phase 7b — Lovdata MCP

| Journey | File | Description |
|---|---|---|
| Phase 7b Lovdata MCP | `docs/journeys/JOURNEY-lovsen-phase-7b-lovdata-mcp.md` | `lovsen-lovdata-mcp` service built and certified. 5 tools, 7 pytest files. Fixture mode CI green. ADR-0347 Lovdata as canonical source verified. |

---

## Phase 7c — Prep

| Journey | File | Description |
|---|---|---|
| Phase 7c prep | `docs/journeys/JOURNEY-lovsen-phase-7c-prep.md` | Riksavtalen scheduler framework rules migration. `lovsen-shared` library created. ADR-0348 two-hash model. |

---

## Phase 7d — Pivot ADRs and payroll amendments

| Journey | File | Description |
|---|---|---|
| Phase 7d pivot ADRs | `docs/journeys/JOURNEY-lovsen-phase-7d-pivot-adrs.md` | ADR-0350 MCP→capability bridge transport proposed. Phase 7d council ADRs (ADR-0351/0352/0353/0354 companions). Dynamic-fetch tariff system design. |
| Phase 7d payroll amendments | `docs/journeys/JOURNEY-payroll-lovsen-phase-7d-adr-amendments.md` | ADR-0355 + ADR-0356 (payroll-lovsen cascade delegation tools). `bind_workspace_union` + `add_supplement_rule` with actor_capability + delegated_via emit per ADR-0356 audit symmetry. |

---

## SMA-328 — Aml. §14-15 consent

| Journey | File | Description |
|---|---|---|
| SMA-328 Aml. §14-15 trekk-consent | `docs/journeys/JOURNEY-sma-328-aml-14-15-trekk-consent-lovsen-validates-paragraph-binding.md` | Manager proposes wage-line override → system validates `payroll.consent_document` against Aml. §14-15 tredje ledd nr. 1-6 via `validate_aml_14_15` capability tool. Pass = override applied. Fail = blocked with structured status. |

---

## Consumer flows that exercise lovsen

These flows are documented in other domain folders but are the primary user-visible surfaces where lovsen's capability output is observed:

### Contract send (contracts domain)

When a manager clicks "Send contract" → `/api/contracts/send/route.ts` (lines ~197) calls `validateAml146.execute()` with `channel="system"`. Returns 422 + `aml_errors[]` if §14-6 bokstaver a–q are not all populated. This is the most critical lovsen integration in the platform today.

**Journey docs:** `docs/journeys/` in the contracts domain folder.

### Amendment classification (contracts domain)

Manager proposes a contract amendment → stage-engine calls `classify_amendment` capability tool (server channel) → returns UP / MATERIAL / ENDRINGSOPPSIGELSE. ENDRINGSOPPSIGELSE blocks the amendment flow and requires employee re-signing with §15-3 notice period.

**Pure function used upstream:** `packages/ai/src/capabilities/legal/amendment-classifier.ts` — `classifyAmendment()` is called by `change_workspace_tariff` in the payroll capability for tariff-revision events (ADR-0356 delegation).

### Legal Q&A via Botsson chat (botsson domain)

Employee or manager types "Hva er kveldstillegg?" → Botsson intent classifier routes to `legal` capability → `cite_law` tool returns citation (Phase 0c stub, Phase 0c+ = Lovdata MCP) → response in Lovsen voice.

**No separate journey doc** — covered by botsson domain journeys.
