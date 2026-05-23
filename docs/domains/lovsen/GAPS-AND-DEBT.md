---
title: "Lovsen — Gaps and Debt"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: lovsen
mirror: verified
last_verified: 2026-05-23
tags: [lovsen, legal, gaps, debt, phase-0c, stub, adr-0350]
---

# Lovsen — Gaps and Debt

> mirror: verified — all gaps below were found by direct code inspection. No speculation.

---

## Confirmed gaps (built-vs-planned delta)

### G1 — Legal capability is Phase 0c stub (2 of 4 tools)

| Tool | Status | Impact |
|---|---|---|
| `validate_aml_14_6` | ✅ real rule body — reads `framework_rule` K1a rows | Send-route gate is functional |
| `validate_aml_14_15` | ✅ real body — reads `payroll.consent_document` | Payroll trekk-consent gate is functional |
| `cite_law` | 🔴 Phase 0c stub — returns `[STUB — Lovdata MCP integration pending]` | Legal Q&A returns placeholder. `confidence: "LAV"`. `stub: true` in response. |
| `classify_amendment` | 🔴 Phase 0c stub — classifies every change as `"admin"` with `confidence: "LAV"` | Amendment flow cannot distinguish MATERIAL from ENDRINGSOPPSIGELSE at runtime. `amendment-classifier.ts` pure function IS complete; the tool wrapping it stubs the DB read step. |

**Fix path:** ADR-0350 bridge → connect `cite_law` to `lovsen-lovdata-mcp`. Connect `classify_amendment` to `field_classification_metadata` read per ADR-0235.

---

### G2 — ADR-0350 bridge not built

ADR-0350 (MCP→capability bridge transport) is **proposed** — not accepted, not implemented. The HTTP route in the BFF that would proxy TypeScript capability calls → Python MCP subprocess does not exist.

**Impact:** `cite_law` will always return stub. Dynamic-fetch tariff (Phase 7d design) cannot execute. `lovsen.mcp.fetch*` telemetry events registered but never emitted at runtime.

**Fix path:** ADR-0350 council review → accept → implement BFF route + capability HTTP client.

---

### G3 — CAMPAIGN-lovsen.md plan file is a stub

`docs/plans/CAMPAIGN-lovsen.md` has a stub skeleton: empty milestone list, empty sub-sortie tracking. The campaign was created 2026-04-29 but the plan file was never populated.

**Impact:** Cosmetic — actual campaign state is captured in handoffs + journey files. No functional blocker.

**Fix path:** Populate with verified milestone list from this ROADMAP.md.

---

### G4 — `verbatim_pending` column not yet used

`tariff_rate_table.verbatim_pending BOOLEAN` was added by `20260527100400_payroll_phase1_tariff_law_version.sql`. The column exists to signal that a row's verbatim text has not yet been fetched from the MCP. No code path reads or writes this column.

**Impact:** The auto-refresh tariff pipeline (Riksavtalen auto-fetch cron) cannot be built without a consumer for this flag.

**Fix path:** Phase 0c+ — build cron job that queries `WHERE verbatim_pending = true`, calls NHO Reiseliv MCP, updates `verbatim_text` + `hash` + sets `verbatim_pending = false`.

---

### G5 — `lovsen.mcp.fetch*` telemetry events registered but never emitted

Registry has 9 `lovsen.*` events (registry.ts:8061–8148). Emit call-sites: zero for `lovsen.mcp.fetch`, `lovsen.mcp.fetch.completed`, `lovsen.mcp.fetch.failed`, `lovsen.answer.composed`, `lovsen.confidence.degraded`, `lovsen.query.received`, `lovsen.query.classified`, `lovsen.skill.invoked`. `lovsen.citation.stale` IS emitted by `lovsen-shared/lovsen_shared/telemetry.py:emit_stale_event_stderr` — but the BFF T5 bridge that re-emits to `@smartout/telemetry` is NOT built (depends on ADR-0350 bridge).

**Impact:** Legal observability is blind on the MCP side. Only capability-level `legal.*` events (4 events, all wired) are observable today.

**Fix path:** ADR-0350 bridge → BFF T5 layer → `emit()` call-sites for `lovsen.mcp.*` + `lovsen.answer.composed`.

---

### G6 — Arbeidstilsynet and Mattilsynet MCPs lack freshness verification

ADR-0342 `verify_citation_freshness` tool is implemented in `lovsen-nho-reiseliv-mcp` and `lovsen-lovdata-mcp`. Not implemented in `lovsen-arbeidstilsynet-mcp` or `lovsen-mattilsynet-mcp`.

**Impact:** HMS guidance and food safety citations cannot be batch-verified for staleness. Low urgency — Arbeidstilsynet guidance changes slowly.

**Fix path:** Extend ADR-0342 scope (or new ADR) → add `verify_citation_freshness` to Arbeidstilsynet and Mattilsynet services. Reuse `lovsen-shared` validation.

---

### G7 — Foundation handoff file not located

`HANDOFF-lovsen-foundation.md` is referenced in ROADMAP.md but was not found in `docs/handoffs/` during the domain-steward survey. Foundation work is confirmed by code artifacts (`packages/lovsen-contract/dist/`, journey files, ADRs).

**Fix path:** Check if handoff was committed to campaign branch and not yet merged. If missing, write from journey docs.

---

## Overlap analysis (detected edges)

| Edge | Domain | Overlap type | Status |
|---|---|---|---|
| `tariff_rate_table` authoring vs consumption | payroll | lovsen AUTHORS (K1a platform rows, `workspace_id IS NULL`); payroll READS (K1a baseline + workspace overrides). Clear boundary. | resolved (keep) |
| §14-6 validation gate in contracts send route | contracts | `/api/contracts/send/route.ts:~197` calls `validateAml146.execute()`. Contracts domain invokes lovsen capability. | resolved (documented in contracts/ARCHITECTURE.md:157) |
| §14-15 consent validation in payroll propose-line-override | payroll | `apps/web/src/app/api/payroll/propose-line-override` calls `validateAml1415Logic()` directly (bypasses tool surface, same rule logic). | resolved (ADR-0311 explicitly allows shared utility) |
| lærling / Opplæringsloven kap. 4 | training | ADR-0253 defines lærling contract block in contracts domain. Training reads `is_apprentice` from employment_contract. Lovsen is not an owner of lærling flow — edge is contracts→training, not lovsen. | resolved (training/README.md:61) |
| Lovsen capability registration in agent router | agent-harness | `legal` capability registered via `getAllCapabilities()` in harness. agent-harness ROUTES; lovsen PROVIDES. Protocol boundary not yet built (ADR-0350 pending). | open — deferred (agent-harness/GAPS-AND-DEBT.md:77) |
| Lovsen persona invocation via Botsson | botsson | Botsson front door (ADR-0220) routes legal intent → lovsen capability. No ownership ambiguity — Botsson routes, lovsen responds. | resolved |

---

## Technical debt

| Debt | Severity | Description |
|---|---|---|
| Fixture values are PLACEHOLDER | Medium | All 4 NHO Reiseliv fixture files contain documented but unverified rates (e.g. 27% kveldstillegg 2025 — per README "reflects documented changes"). Not verified against actual Riksavtalen text. Should be replaced with verbatim fetched text before Phase 0c+ live integration. |
| Legacy envvar `LOVSEN_MCP_FIXTURE=1` | Low | NHO Reiseliv and Arbeidstilsynet MCPs still accept `LOVSEN_MCP_FIXTURE=1` (legacy) alongside canonical `LOVSEN_FIXTURE_MODE=true` (ADR-0258). Cutover note says "will be removed after cert pass" — cert pass is done, legacy alias still present. |
| `classify_amendment` stub in production path | High | Contract amendment tool classifies every change as "admin". If code reaches production and a manager amends a contract, ENDRINGSOPPSIGELSE changes will silently pass as admin. **Mitigation:** stub logs `"ikke bruk i produksjon"` warning. Contractually the feature is not exposed in the UI yet (amendment flow UI not built). |
| `amendment-classifier.ts` pure function not called from tool | Medium | The real rule matrix in `amendment-classifier.ts` is complete but the `classify_amendment` tool's `execute()` function does not call it — it maps all changes to `"admin"` directly. The wire-up is a one-line change but it's blocked on the `field_classification_metadata` DB read per ADR-0235. |
