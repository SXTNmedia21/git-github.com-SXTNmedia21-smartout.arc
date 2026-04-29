---
title: "@smartout/lovsen-contract — Lovsen Type Contract"
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [lovsen, contract, types, zod]
---

# @smartout/lovsen-contract

Canonical Zod schemas and TypeScript types for the Lovsen Norwegian labor-law advisor agent. Import from this package whenever you produce or consume Lovsen answers, citations, confidence assessments, §14-6 validation results, or amendment classification results. Every type has a runtime-validating Zod schema (for use at MCP boundaries and API edges) and a matching `z.infer<>`-derived TypeScript type (for static type safety throughout the codebase). The schema shapes are derived directly from the Lovsen agent spec (`docs/agents/lovsen-agent/SKILL.AML.md`, `SKILL.CLASSIFYER.md`, `lovsen.md §Confidence-policy`) so downstream sub-sorties (P1.S1a–S4) can build against a stable, governed interface without re-inventing field names or validation logic. See [ADR-0242 — Lovsen Citation Contract](../../docs/decisions/0242-lovsen-citation-contract.md) for the provenance requirement (every citation must carry verbatim text + SHA-256 hash + fetched_at + source_url) and [ADR-0243 — Lovsen Confidence Model](../../docs/decisions/0243-lovsen-confidence-model.md) for the dual HØY/MEDIUM/LAV + numeric score representation.
