---
title: "Lovsen Citation Contract — verbatim paragraph + hash + fetched_at on every answer"
id: ADR_0256
status: accepted
accepted_at: 2026-04-29
layer: decision
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, citation, provenance, adr, p1-s0]
related_adrs: [ADR-0004, ADR-0257]
---

# ADR-0256: Lovsen Citation Contract

## Context and Problem Statement

Lovsen answers questions about Norwegian labor law (Aml., ferielov, Riksavtalen, OTP) and makes concrete assertions about paragraph requirements, salary rules, and procedural deadlines. A hallucinated paragraph number or a paraphrase of the actual law text is legally dangerous — it may cause a manager to act incorrectly on dismissal, trial period, or contract content. We need a verifiable contract that every Lovsen answer is traceable back to the exact source text used to produce it.

## Decision Drivers

- Legal-grade provenance: every assertion must be traceable to the specific paragraph text that supports it
- Staleness detection: paragraph texts change (e.g. Aml. §14-6 revised July 2024); a hash enables cache validation without re-fetching
- Downstream audit: `activity_trail` must be able to record what source text was in force when a decision was made
- Zero hallucination on paragraph numbers (Lovsen persona rule — see `docs/agents/lovsen-agent/README.md` §Operasjonelle prinsipper §6)

## Considered Options

1. **Free-text citation** — Lovsen includes a paragraph reference string in the answer text but no machine-readable fields
2. **Structured Citation with hash + URL** (chosen) — every citation is a typed object with verbatim text, SHA-256 hash, fetch timestamp, and source URL
3. **Citation by source ID only** — reference a Lovdata document ID but omit the verbatim text

## Decision Outcome

Chosen option: **Structured Citation with hash + URL**, because it provides the minimum necessary provenance for legal-grade audit: the exact paragraph text used, a hash to detect if the text has changed, and a URL for human verification.

The `Citation` type is defined in `@smartout/lovsen-contract` (`packages/lovsen-contract/src/citation.ts`). Every `LovsenAnswer` carries a non-empty `citations[]` array. A `LovsenAnswer` with zero citations is a Zod schema error.

## Rules & Consequences

- **Good, because** every Lovsen answer can be audited post-hoc by re-fetching the source URL and comparing the SHA-256 hash — if the paragraph has been amended since the answer was given, the hash mismatch is detectable
- **Good, because** `lovsen.citation.stale` telemetry event fires when age_hours exceeds freshness window (24h default per MCP server config), enabling proactive cache invalidation
- **Bad, because** every answer now requires at least one live MCP fetch before it can be composed — fixture mode must be available for offline tests and CI (ADR-0258)
- **Agent Impact:** Downstream sub-sorties (P1.S1a-S4) MUST use `CitationSchema` from `@smartout/lovsen-contract` when constructing citations. Raw string paragraph references are forbidden in `LovsenAnswer.citations`. The `hash` field is a 64-character lowercase hex SHA-256 of `verbatim_text`.

---

> Registered in `docs/decisions/0000-decision-log.md`. Cross-reference: ADR-0004 (Unified Telemetry Engine), ADR-0257 (Lovsen Confidence Model), ADR-0258 (Lovsen MCP Boundary).
