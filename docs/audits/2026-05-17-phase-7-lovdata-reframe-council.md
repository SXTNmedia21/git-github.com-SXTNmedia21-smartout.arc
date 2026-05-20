---
title: "Phase 7 Architectural Reframe — Lovdata as Riksavtalen Canonical"
status: done
created: 2026-05-17
updated: 2026-05-17
module: payroll-engine
tags: [council, lovdata, riksavtalen, nho-reiseliv, phase-7, ADR-0347, ADR-0348, ADR-0349, ADR-0342]
---

# Council Audit: Phase 7 Architectural Reframe — Lovdata as Riksavtalen Canonical

**Date:** 2026-05-17
**Chair:** system-steward
**Reviewers:** system-steward, system-agent-coordinator, supervisor, lovsen
**Verdict:** APPROVE WITH CHANGES + 5-blocker trust gate

---

## Topic Summary

Phase 7 of the lovsen campaign (feat/payroll-lovsen-phase-7a-adrs) pre-flight surfaced a structural problem: ADR-0258 had declared NHO Reiseliv MCP as the Riksavtalen canonical source. On-demand verification (HTTP curl to nhoreiseliv.no) confirmed the URL pattern declared in ADR-0258 returns 404 — no Riksavtalen text is hosted there. The MCP exists as a service artifact, but its upstream source is fictional.

Lovdata.no (the official Norwegian legal database, operated by Lovdata Foundation) hosts Riksavtalen under a stable paragraph-addressable URL structure (HTTP 200 confirmed). The reframe proposes: Lovdata MCP becomes the Riksavtalen canonical; NHO Reiseliv MCP transitions to employer-interpretive auxiliary (workplace-specific guidance, not primary legal text). 358 cells stamped `lovsen-mcp@v1` require re-certification (Phase 7c).

A secondary finding: the current single-hash model (`lovsenCitationHash`) conflates two legally distinct drift axes — paragraph numbering (structural notation) vs lønnsoppgjør rates (legally material). Council recommended two-hash supersession.

---

## Phase 1–5 Narrative

### Phase 1 — Briefing

Briefing assembled from:
- ADR-0258 §"MCP server map" (4 MCPs, NHO Reiseliv as Riksavtalen row)
- ADR-0341 §"Stale handling" + §"Implementation gates F6"
- ADR-0342 routing table (`nho-reiseliv` → `services/lovsen-nho-reiseliv-mcp/`)
- Live pre-flight: `curl -I https://www.nhoreiseliv.no/riksavtalen/` → HTTP 404
- Live pre-flight: `curl -I https://lovdata.no/dokument/NL/lov/...` → HTTP 200

Central question to council: **Should Lovdata replace NHO Reiseliv as Riksavtalen canonical? If yes, what is the migration model for 358 already-certified cells?**

Three sub-questions:
- Q1: Is the Lovdata paragraph-address schema stable enough to anchor `paragrafRef`?
- Q2: Does this require a new schema field on `ExpectedCell`?
- Q3: What is the safe two-lineage transition path?

### Phase 2.5 — Fact-Check (9/10 VERIFIED)

Fact-checker (haiku) ran against 10 briefing claims:

| # | Claim | Result |
|---|---|---|
| 1 | nhoreiseliv.no 404 on Riksavtalen URL | VERIFIED |
| 2 | lovdata.no HTTP 200 on paragraph-addressable URL | VERIFIED |
| 3 | ADR-0258 row 4 maps `nho-reiseliv` source to `lovsen-nho-reiseliv-mcp` | VERIFIED |
| 4 | ADR-0342 routing table routes `nho-reiseliv` → NHO MCP | VERIFIED |
| 5 | 358 cells carry `verifiedBy: lovsen-mcp@v1` in expected/ fixtures | VERIFIED (count: 732 PENDING — note drift; see supervisor finding) |
| 6 | `lovsenCitationHash` is a single SHA-256 over verbatim paragraph text | VERIFIED |
| 7 | Zero ADRs post-0342 amend the routing | VERIFIED |
| 8 | `paragrafRef` field exists on `ExpectedCell` type | VERIFIED |
| 9 | Worksheet uses "§6" notation; Lovdata canonical is "§4-3" | VERIFIED |
| 10 | Worksheet rate 42.41 kr/t matches 2026 Riksavtalen lønnsoppgjør | UNVERIFIED (rate not published as plaintext; ADR-protocol blocker) |

**Count: 9 VERIFIED, 1 UNVERIFIED (blocker)**

### Phase 3 — Four Parallel Reviews

Reviewers dispatched in parallel on the briefing and 3 sub-questions.

**system-steward:**
- Q1: Lovdata paragraph URLs follow stable scheme (`/dokument/NL/lov/<year>-<mm>-<dd>-<n>/§<sec>`). Pattern consistent since 2018 based on archive evidence. VERIFIED stable.
- Q2 (initial): Recommended adding 17th field `canonicalParagrafRef` to `ExpectedCell` to expose Lovdata ref alongside legacy NHO ref during dual-lineage transition.
- Q2 (self-reversal, Phase 3 synthesis): After receiving coordinator code-trace (see below), reversed recommendation. No new schema field. Route via `FreshnessResult` union discriminated by `source`. Schema change was layer-confused (fixture-author concern, not runtime contract).
- Q3: Proposed 4-phase transition (7a: ADRs, 7b: envvar canonicalization + paragraph-ref map, 7c: 358-cell re-cert, 7d: NHO MCP deprecation signal).

**system-agent-coordinator:**
- Code-trace: `grep -rln "paragrafRef" packages/ai/src/capabilities/ services/stage-engine/src/` → EMPTY (zero runtime consumers of `paragrafRef` outside fixture fixtures and CI runner).
- Consequence: Steward's Q2 recommendation ("add 17th field") is layer-confused. No capability tool reads `paragrafRef` at runtime. Schema change solves a fixture-author UX concern, not a runtime gap. Fix at fixture-author documentation layer.
- Also flagged: `LOVSEN_MCP_URL` envvar referenced in two places with inconsistent naming convention; needs canonicalization in Phase 7b.

**supervisor:**
- Grep on fixture cells: `grep -rn "PENDING" expected/` → 732 hits (briefing claimed 716 — drift of 16 between briefing assembly and council run).
- Confirmed Lovdata MCP service exists at `services/lovsen-lovdata-mcp/` with `verify_citation_freshness` implementation path per ADR-0342 T1.
- Flagged: ADR-0342 routing table must be amended — current table omits Lovdata as Riksavtalen target.
- Confirmed NHO Reiseliv MCP repurposable as employer-interpretive auxiliary without service deletion (service remains, its upstream `source` classification changes).

**lovsen:**
- Legal opinion: Two legally distinct drift axes are conflated by single hash.
  - **Axis 1 — Structural notation drift:** Paragraph numbering changes (§6 → §4-3) without rate change. Not legally material to wage calculation; low-urgency alert.
  - **Axis 2 — Lønnsoppgjør rate drift:** Rate values change (e.g., 42.41 kr/t revised upward by 2026 lønnsoppgjør). Legally material; high-urgency alert.
- Single `lovsenCitationHash` triggers staleness alert on both axes equally. This causes false-positive rate alerts on structural notation changes and drowns legitimate rate-change signals in noise.
- Recommendation: Two-hash model — `structureHash` (text without rate values) + `rateHash` (rate-value canonical form). Supersedes ADR-0341 §H single-hash model.
- Rate 42.41 kr/t: Could not verify against published 2026 lønnsoppgjør protokoll without live Lovdata query. Flagged as blocker (must not certify until rate verified against Lovdata canonical).

### Phase 4 — Narrator

Narrator step skipped (no narrator agent dispatched in this council run; synthesis proceeded directly from Phase 3 reviews to Phase 5).

### Phase 5 — Steward Synthesis

**Verdict: APPROVE WITH CHANGES**

The architectural reframe is sound. Lovdata is demonstrably accessible (HTTP 200, paragraph-addressable) and is the statutory authority. NHO Reiseliv MCP served a purpose when no live Riksavtalen source existed but its upstream source was never proven — ADR-0258 routing was ontology fiction.

**Steward Q2 self-reversal** (documented as 6th instance of L-0147 chair-self-reversal pattern): Initial Phase 3 recommendation to add `canonicalParagrafRef` as 17th field on `ExpectedCell` was reversed after coordinator code-trace returned EMPTY on runtime consumers. Schema change is not warranted. The concern is fixture-author UX — a translation map in `docs/reference/` serves better than a runtime schema field with zero consumers.

---

## Key Findings

- **NHO Reiseliv URL was ontology fiction (404 since ADR-0258):** nhoreiseliv.no does not host Riksavtalen at any HTML URL matching the ADR-0258 declared pattern. The MCP's upstream source was speculative, declared as canonical, never proven against a live HTTP response.
- **Lovdata is accessible:** HTTP 200 confirmed on paragraph-addressable URL. Norwegian statutory authority. Stable URL scheme since 2018.
- **Worksheet "§6" is shorthand vs Lovdata canonical "§4-3":** Worksheet authors use NHO shorthand notation. Lovdata uses the full paragraph reference. A translation map is needed (ADR-0349).
- **Worksheet rate 42.41 kr/t unverified against 2026 lønnsoppgjør:** Rate in fixtures could not be verified against the 2026 annual wage settlement (lønnsoppgjøret) during this council. This is a hard blocker — cells must not be certified until rate confirmed from Lovdata canonical.
- **Zero runtime consumers of `paragrafRef` (coordinator code-trace):** `grep -rln "paragrafRef" packages/ai/src/capabilities/ services/stage-engine/src/` returned EMPTY. Schema-field recommendation (steward Phase 3 initial) was layer-confused — concern belongs at fixture-author documentation, not runtime schema.
- **Steward Phase 3 self-reversal on Q2:** After coordinator code-trace evidence, steward reversed Q2 recommendation from "add 17th schema field" to "no new field — route via FreshnessResult union." Documented as 6th L-0147 occurrence.
- **Supervisor grep: 732 PENDING (not 716):** Briefing claimed 716 PENDING-stamped cells. Supervisor live grep returned 732. Drift of 16 between briefing assembly and council execution.
- **Lovsen: two hash axes needed (structure vs rate):** Single `lovsenCitationHash` conflates paragraph numbering (structural, low-urgency) with lønnsoppgjør rates (legally material, high-urgency). Two-hash model required. ADR-0348 supersedes ADR-0341 §H.

---

## Verdict + 5 Blockers + 4-Phase Plan

### Verdict

**APPROVE WITH CHANGES** — Proceed with Phase 7a ADR drafts. Do NOT certify any cells against Lovdata until all 5 blockers are resolved.

### 5 Blockers (must resolve before Phase 7b)

| # | Blocker | Owner |
|---|---|---|
| B1 | **Live curl proof attached to ADR-0347** — HTTP 200 + parseable response body shape from Lovdata Riksavtalen URL, committed as acceptance evidence | A1 |
| B2 | **Rate 42.41 kr/t verified against 2026 lønnsoppgjør protokoll** — Lovdata query or published tariff document confirming the rate. If unverifiable → update fixture to "RATE_UNVERIFIED" sentinel | Lovsen + Phase 7b |
| B3 | **ADR paragraph-ref translation map reviewed** — ADR-0349 draft reviewed against at minimum 5 worksheet §-shorthand examples with Lovdata canonical counterparts | A3 |
| B4 | **`LOVSEN_MCP_URL` envvar canonicalized** — Inconsistent naming across services resolved; single canonical envvar name declared in ADR-0347 or ADR-0342 amendment | Phase 7b |
| B5 | **`verify_citation_freshness` mirrored to lovdata-mcp** — ADR-0342 T1 implementation in `services/lovsen-lovdata-mcp/` verified present (existing service) before Phase 7c cell re-cert begins | Phase 7b |

### 4-Phase Plan

- **Phase 7a (current sortie):** Draft ADR-0347, ADR-0348, ADR-0349. Amend ADR-0342. No cell certification yet.
- **Phase 7b:** Envvar canonicalization, paragraph-ref translation map population (ADR-0349), live curl evidence attached to ADR-0347, `verify_citation_freshness` mirror verified in lovdata-mcp. Rate blocker (B2) must resolve here.
- **Phase 7c:** 358 already-certified cells re-certified against Lovdata canonical. Dual-lineage transition: cells carry `source: lovdata` going forward; legacy `source: nho-reiseliv` cells marked `HISTORICAL` in fixture comments.
- **Phase 7d:** NHO Reiseliv MCP deprecation signal. Service remains (employer-interpretive auxiliary); `source` field in new cells no longer routes to NHO. README updated.

---

## ADRs Proposed

| ADR | Title | Status |
|---|---|---|
| ADR-0347 | Lovdata as Riksavtalen canonical + NHO MCP repurposed as employer-interpretive auxiliary | proposed |
| ADR-0348 | Two-hash stale-detection model — structureHash + rateHash (supersedes ADR-0341 §H) | proposed |
| ADR-0349 | Paragraph-ref translation map (NHO shorthand §N → Lovdata canonical §M-P) | proposed |
| ADR-0342 | AMENDED — routing updated from NHO to Lovdata for Riksavtalen citations | amended |

---

## Learnings Referenced

- L-0286 — Ontology fiction in ADRs (ADR-0258 routing was never proven against live source)
- L-0287 — Layer-confused schema recommendations (zero runtime consumers → fix at data-author layer)
- L-0288 — Single-hash conflates regulatory drift axes (structure vs rate need separate hashes)
- L-0147 — Chair self-reversal pattern (6th occurrence; steward reversed Q2 after coordinator code-trace)
