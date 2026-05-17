---
title: "Dynamic-MCP-Fetch Architectural Pivot — Council Audit (Phase 7 reframe round 2)"
status: done
created: 2026-05-17
updated: 2026-05-17
module: payroll-engine
tags: [council, dynamic-tariff, mcp-bridge, riksavtalen, nho-reiseliv, lovdata, phase-7d, ADR-0350, ADR-0351, ADR-0352, ADR-0353, ADR-0354]
---

# Council Audit: Dynamic-MCP-Fetch Architectural Pivot (Phase 7 reframe round 2)

**Date:** 2026-05-17
**Chair:** system-steward
**Reviewers:** system-steward (chair), system-agent-coordinator, supervisor, lovsen, botsson-harness-builder
**Verdict:** APPROVE WITH CHANGES + DEGRADED-MODE during foundations

---

## Topic Summary

Following the Phase 7 reframe council earlier today (which established Lovdata as Riksavtalen canonical, ADR-0347/0348/0349), Pontus issued a Norwegian directive during Phase 7c-prep work. The directive constituted a major architectural pivot: the payroll capability must dynamically fetch tariff data from Lovsen MCP at workspace bootstrap — not rely solely on static schema fixtures. This council evaluates that pivot before any schema migration or bridge code is written.

---

## Pontus Verbatim Directive

> **Norwegian (original):**
> "Jeg vil at payroll-capability-et skal hente satsene dynamisk fra Lovsen MCP ved workspace-oppstart, ikke bare lese fra fixture. Lovsen er kilden til sannhet for satser. Vi bygger bro mellom Python MCP og TypeScript capability-laget nå."

> **English translation:**
> "I want the payroll capability to fetch rates dynamically from Lovsen MCP at workspace startup, not just read from fixture. Lovsen is the source of truth for rates. We build the bridge between Python MCP and the TypeScript capability layer now."

---

## Trigger Context — Phase 7c-Prep Findings

Three structural problems were surfaced during Phase 7c-prep verification (worksheet cell audit, 2026-05-17):

1. **Worksheet rates wrong year:** Several `expected/` cells carried 2025 rates (pre-lønnsoppgjør 2026). Rate 42.41 kr/t (kveldstillegg) could not be verified against the 2026 lønnsoppgjør protokoll. Static fixture approach means wrong-year rates pass CI silently.
2. **Label-swap ambiguity:** Worksheet shorthand `"Riksavtalen §6"` was applied to at least two distinct supplement types (kveldstillegg AND helgetillegg) in different cells — the same label resolves to different Lovdata canonical paragraphs depending on context. Static mapping is insufficient when the author label is ambiguous per supplement type.
3. **Helligdag structural problem:** `"Riksavtalen §5"` (helligdagstillegg) cells in `expected/` contained `paragrafRef` values that could not be resolved against taro-79 with confidence — the paragraph had been renumbered between Riksavtalen editions and the translation map entry was `TBD`. With dynamic MCP fetch, the canonical address is derived at runtime, not at fixture-author time.

These findings together created the forcing function for Pontus's pivot directive: static fixture-only approach cannot guarantee rate-year correctness, and the label-swap / helligdag problems require a live resolution mechanism.

---

## Phase 1–5 Narrative

### Phase 1 — Briefing

Briefing assembled from:
- Pontus directive (verbatim Norwegian above)
- Phase 7c-prep findings: wrong-year rates, label-swap, helligdag structural gap
- `evaluate-supplements.ts` header comment (key pre-existing evidence, see Phase 3)
- ADR-0258 §"MCP boundary" (Python MCPs, stdio transport)
- ADR-0250 (Skatteetaten integration — verified DEFERRED, see Phase 3 self-reversal)
- Current state: zero MCP calls in `packages/ai/src/capabilities/payroll/tools.ts`
- Cell count baseline: 895 CERT + 182 PENDING (briefing pre-correction; see Phase 3 supervisor finding)

Three central questions to council:

- **Q1:** Which fetch strategy? (a) static fixture only, (b) per-calc live fetch, (c) workspace-bootstrap dynamic with materialized snapshot
- **Q2:** Which capability houses the new tools (`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override`)?
- **Q3:** What is the tariff floor rule — can a workspace override NHO rates downward per Aml. §14-15?

### Phase 2 — Fact-Check Manual

Fact-checker ran against 8 briefing claims before parallel council dispatch:

| # | Claim | Result |
|---|---|---|
| 1 | Zero MCP calls in payroll capability `tools.ts` today | VERIFIED |
| 2 | `evaluate-supplements.ts` contains a design comment about dynamic fetch | VERIFIED — header reads "designed for dynamic rate resolution at runtime" |
| 3 | ADR-0250 covers workspace-tariff dynamic supplements | UNVERIFIED — see Phase 3 self-reversal |
| 4 | Aml. §14-15 prohibits downward override of tariff-bound rates | VERIFIED |
| 5 | `is_tariff_bound` column exists on `workspace_settings` | VERIFIED |
| 6 | `payroll` capability already owns `workspace_settings` FKs in tools.ts | VERIFIED |
| 7 | Cell count: 358 CERT + 716 PENDING (briefing claim) | UNVERIFIED — supervisor corrected to 895+182 |
| 8 | No existing bridge between TypeScript capability and Python MCP | VERIFIED |

### Phase 3 — Five Parallel Reviews

Reviewers dispatched in parallel. Narrator step was **skipped** — no narrator agent dispatched; synthesis proceeded directly from Phase 3 to Phase 5.

**system-steward (initial):**
- Q1: Recommended (c) workspace-bootstrap dynamic. Rationale: per-calc fetch (b) adds MCP latency per shift calculation — unacceptable for a payroll run over 600 shifts. Static fixture (a) cannot guarantee rate-year correctness per Phase 7c-prep findings.
- Q3: ADR-0250 covers the workspace-tariff domain per ADR index — flagged as "survives this pivot."
- **(Self-reversal in synthesis):** After Lovsen code-trace (see Lovsen below), reversed ADR-0250 claim. ADR-0250 is Skatteetaten integration (deferred), not workspace-tariff supplements. ADR-0250 has zero intersection with this pivot.

**system-agent-coordinator:**
- Code-trace Q2: `grep -rn "workspace_settings\|is_tariff_bound\|active_union\|active_binding_id" packages/ai/src/capabilities/` — all hits in `payroll/tools.ts`. Zero hits in any other capability.
- Consequence: new tools `setup_workspace_tariff` + `change_workspace_tariff` + `add_supplement_override` MUST live in `payroll` capability. Splitting into a new `tariff_admin` capability would violate ADR-0173 frozen-4 boundaries (schema FK ownership determines capability home).
- Flagged: `add_supplement_override` requires a separate policy ADR before implementation — the override floor rule (Q3) has not yet been formalized.

**supervisor:**
- Re-grep on fixture cells: `grep -rn "CERT\|PENDING" expected/ packages/payroll-calculate/` → 895 CERT + 182 PENDING. Briefing claimed 358 CERT + 716 PENDING — stale by 2 days (Phase 7a+7b commits landed between briefing assembly and council run).
- Confirmed `evaluate-supplements.ts` header: "// ARCHITECTURE NOTE: This module is designed for dynamic rate resolution at runtime. Tariff rates should be fetched from workspace snapshot at evaluation time, not hardcoded." — the engine was already designed dynamic; the capability tools are the missing piece, not the engine itself.
- Flagged: workspace-bootstrap snapshot materialization is needed to make (c) safe. Without a materialized snapshot, each supplement evaluation would need a live MCP call — collapsing (c) into (b). Snapshot contract = ADR-0353.

**lovsen:**
- Code-trace ADR-0250: `grep -n "Skatteetaten\|skatteetaten\|A-melding\|a-melding" docs/decisions/0250-*.md` → ADR-0250 title: "Skatteetaten integration — A-melding reporting (DEFERRED)." Subject is entirely Skatteetaten integration, not workspace-tariff or supplement dynamics. Chair's Phase 1 claim "ADR-0250 survives" was based on wrong ADR-number-to-subject mapping.
- Legal opinion Q3: Norwegian Arbeidsmiljøloven §14-15 establishes that tariff-bound workspaces cannot pay below the Riksavtalen minstelønn floor. A workspace can supplement above (positive deviation) but NEVER override downward. Aml. §14-15 is lex specialis — no internal workspace policy can derogate.
- Consequence: `add_supplement_override` tool may only create positive deviations (additions above tariff floor). The capability MUST reject any override that results in a net rate below the NHO Reiseliv tariff floor for the workspace's bound agreement. This requires a tariff-floor enforcement ADR (ADR-0351).

**botsson-harness-builder:**
- Confirmed: no bridge transport exists. `packages/ai/src/capabilities/payroll/tools.ts` uses `supabaseAdmin` and direct DB calls — no HTTP client pattern exists in the capability layer today.
- ADR-0350 (bridge transport) is a foundational blocker. ADRs 0351–0354 all depend on the bridge being defined first. Proposed ship sequence: 0350 (bridge) → 0351 (floor) → 0352 (derive_supplement_set) → 0353 (binding lifecycle) → 0354 (freshness ops).
- Flagged: without the bridge, no capability tool can call a Lovsen MCP method — all companion ADRs are contingent on 0350 acceptance.

### Phase 4 — Narrator

Narrator step **skipped** (no narrator agent dispatched). Synthesis proceeded directly from Phase 3 reviews.

### Phase 5 — Steward Synthesis

**Verdict: APPROVE WITH CHANGES + DEGRADED-MODE**

The pivot is architecturally sound. The engine was already designed for dynamic rate resolution (`evaluate-supplements.ts` header — Supervisor confirmed). The capability layer is the missing piece, not the engine. Pontus's directive aligns with the engine's original intent.

**Q1 resolution:** (c) chosen — workspace-bootstrap dynamic with materialized snapshot. (b) per-calc fetch is REJECTED — MCP latency per supplement evaluation over a 600-shift period is untenable. (a) static fixture only is REJECTED — cannot guarantee rate-year correctness and has no remediation path for label-swap / helligdag class of bugs.

**Q2 resolution:** New tools (`setup_workspace_tariff`, `change_workspace_tariff`, `add_supplement_override`) live in `payroll` capability. Coordinator code-trace evidence is conclusive — schema FKs owned by payroll capability. ADR-0173 frozen-4 boundaries enforced.

**Q3 resolution:** Tariff floor is a hard enforcement rule per Aml. §14-15. `add_supplement_override` is gated on a separate policy ADR before implementation (ADR-0351). DEGRADED-MODE declared for the period between bridge acceptance (ADR-0350) and floor ADR acceptance (ADR-0351) — only read-path tools (`setup_workspace_tariff`, `change_workspace_tariff`) may ship in that window; `add_supplement_override` ships only after ADR-0351 acceptance.

**Chair self-reversals (2 — 6th L-0147 precedent instances):**
1. ADR-0250 misread: Initial Phase 1 claim "ADR-0250 survives" reversed after Lovsen code-trace confirmed ADR-0250 = Skatteetaten integration DEFERRED. ADR-0250 has zero relevance to this pivot.
2. Source-priority claim: Initial framing presented NHO cirkulær and Lovdata as co-equal date authorities. Lovsen Phase 3 review established the correct hierarchy: NHO Reiseliv lønnsoppgjør cirkulær `official_effective_date` = PRIMARY legal date authority (explicit `virkningsdato` field); Lovdata = SECONDARY verbatim-text authority (mirrors text weeks/months after lønnsoppgjør). Using Lovdata date as legal binding date = wrong rate for current period.

---

## Key Findings

| Finding | Severity | Source |
|---|---|---|
| Engine ALREADY designed for dynamic rates — `evaluate-supplements.ts` header confirms "designed for dynamic rate resolution at runtime" | HIGH | Supervisor code-trace |
| Q1=(c) workspace-bootstrap dynamic chosen; (b) per-calc REJECTED on latency grounds | HIGH | Steward synthesis |
| Foundational blocker: no Lovsen→capability bridge exists today (ADR-0350 required) | HIGH | Harness finding |
| ADR-0350 blocks all companion ADRs (0351–0354): capability tools cannot call Python MCP without bridge | HIGH | Harness finding |
| ADR-0250 misread — subject is Skatteetaten DEFERRED, not workspace-tariff | MEDIUM | Lovsen code-trace + Steward self-reversal |
| Source-priority reversed: NHO cirkulær `official_effective_date` = PRIMARY date authority; Lovdata = verbatim text SECONDARY | MEDIUM | Lovsen Phase 3 + Steward self-reversal |
| 895 CERT + 182 PENDING (corrected from briefing 358+716 — stale by 2 days) | LOW | Supervisor re-grep |
| Aml. §14-15 prohibits downward override: `add_supplement_override` gated on floor ADR (ADR-0351) | HIGH | Lovsen legal opinion |
| Q2: all 3 new tools live in payroll capability — ADR-0173 frozen-4 FK ownership is conclusive | HIGH | Coordinator code-trace |

---

## Verdict + 3 Blockers + Phase Plan

### Verdict

**APPROVE WITH CHANGES + DEGRADED-MODE** — Proceed with ADR drafts (Phase 7d). Schema migration and bridge code deferred to Phase 7d-followup. DEGRADED-MODE: `add_supplement_override` blocked until ADR-0351 accepted.

### 3 Hottest Blockers

| # | Blocker | Severity | Owner |
|---|---|---|---|
| B1 | **Bridge ADR delay** — ADR-0350 (bridge transport) must be accepted before any capability tool can call Lovsen MCP | HIGH | Phase 7d sortie |
| B2 | **Override floor missing** — ADR-0351 (tariff floor enforcement) must be accepted before `add_supplement_override` ships; DEGRADED-MODE until resolved | MEDIUM | Phase 7d-followup |
| B3 | **`is_tariff_bound` ownership leak** — `workspace_settings.is_tariff_bound` is currently readable by multiple capabilities; ADR-0353 must declare payroll as the canonical owner before schema migration | MEDIUM | Phase 7d-followup |

### Phase Plan

- **Phase 7d (this sortie):** 5 ADRs proposed (0350–0354). Council audit doc + 3 learnings + 4 ADR amendments. No schema migration. No bridge code.
- **Phase 7d-followup (next sortie):** Schema migration for `workspace_framework_binding` table (ADR-0353). Bridge HTTP route wiring (ADR-0350 T1–T3). DEGRADED-MODE lifted when ADR-0351 accepted.
- **Phase 7e:** Bridge code implementation — `derive_supplement_set` MCP tool wired to capability HTTP client. `setup_workspace_tariff` + `change_workspace_tariff` tools ship.
- **Phase 7f:** `add_supplement_override` tool (ADR-0351 dependency resolved). Capability tests + UI integration.

---

## ADRs Proposed

| ADR | Title | Status |
|---|---|---|
| ADR-0350 | Lovsen MCP→capability bridge transport — HTTP-via-BFF route + capability HTTP client | proposed |
| ADR-0351 | Workspace supplement policy — tariff floor enforcement per Aml. §14-15 | proposed |
| ADR-0352 | `derive_supplement_set` MCP contract — workspace-bootstrap dynamic supplement derivation | proposed |
| ADR-0353 | `workspace_framework_binding` lifecycle — bootstrap, active binding, change events | proposed |
| ADR-0354 | Snapshot freshness and staleness operations — heartbeat cron + drift detector | proposed |

---

## ADR Amendments Required

| ADR | Amendment Summary |
|---|---|
| ADR-0341 | Cell schema 16-field lock SURVIVES at fixture-author layer. Citation envelope fields now sourced from tariff_snapshot (ADR-0353) at re-cert time, not standalone Lovdata fetch. F6 gate refactored per ADR-0354. |
| ADR-0342 | `verify_citation_freshness` role splits: (a) CI/batch staleness consumer + (b) production drift detector (heartbeat cron per ADR-0354). MCP method contract unchanged. |
| ADR-0348 | Two-hash model refined — splits to (a) audit-provenance consumer (`shift_pay_calculation_event.provenance` JSONB per Bokf. §13) + (b) CI/batch staleness consumer. ADR-0354 implements (b) at production layer. |
| ADR-0349 | Translation map LOAD-BEARING for ADR-0352 `derive_supplement_set`. Phase 7c-prep (2026-05-17) verified 6/6 rows. Map now consumed by Python MCP at synthesis time, not just re-cert tool. |

---

## Learnings Created

- **L-0289** — Chair Phase 3 must verify ADR-number references correct subject before claiming survival
- **L-0290** — NHO cirkulær `official_effective_date` = legal date authority; Lovdata = verbatim-text authority only
- **L-0291** — Capability tool boundary follows existing schema FK ownership — do not split capabilities mid-pivot

---

## Source-Priority Clarification (Steward self-reversal #2)

The correct authority hierarchy for tariff rate data (established by Lovsen Phase 3 + Steward synthesis):

| Authority | Role | Field |
|---|---|---|
| NHO Reiseliv lønnsoppgjør cirkulær | PRIMARY — legal binding date and rate values | `official_effective_date` (virkningsdato) |
| Lovdata | SECONDARY — verbatim paragraph text | citation envelope (`lovsenCitationText`, `lovsenCitationUrl`) |

Both are stored in the tariff snapshot envelope (ADR-0353). Neither is optional. Lovdata date alone as the binding date produces wrong-period rates — lønnsoppgjør cirkulær is published weeks before Lovdata mirrors the updated text.

---

> Motoren var allerede designet for dynamikk. Capability-laget var det som manglet. Nå bygger vi broen.
