---
title: "L-0288 — Single-hash conflates regulatory drift axes: structure vs rate need separate hashes"
id: L_0288
status: active
date: 2026-05-17
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [lovsen, riksavtalen, hash, stale-detection, rate, paragraph, adr-0341, adr-0348]
related_adrs: [ADR-0341, ADR-0348, ADR-0256]
related_learnings: []
---

# L-0288 — Single-hash conflates regulatory drift axes

## Discovery

Phase 7 council (2026-05-17). Lovsen reviewer analysis of the ADR-0341 single-hash model (`lovsenCitationHash` = SHA-256 over full verbatim paragraph text including rates).

Two distinct drift axes exist in Riksavtalen text changes:

| Axis | What changes | Legal significance | Alert urgency |
|---|---|---|---|
| **Structural notation** | Paragraph numbering: §6 → §4-3, section headers renamed, clause references renumbered | Not legally material to wage calculation (same clause, different address) | Low — fixture needs re-addressing, not recalculation |
| **Lønnsoppgjør rates** | Rate values: 42.41 kr/t revised by annual wage settlement, new thresholds, new supplements | Legally material — wrong rate = incorrect wage calculation = compliance defect | HIGH — cells must be recalculated and re-certified immediately |

Single `lovsenCitationHash` is a SHA-256 over the full verbatim paragraph text. Any change to either axis changes the hash and triggers a `lovsen.citation.stale` telemetry event. The events carry equal weight — there is no way for CI or the operator to distinguish "paragraph renumbered (low-urgency fixture cleanup)" from "rate revised upward by 2026 lønnsoppgjør (urgent compliance recalc)."

Consequence: structural notation changes flood `lovsen.citation.stale` events, training operators to treat staleness alerts as routine maintenance. When a legally material rate change arrives, it competes with noise and may be deprioritized.

## Rule

Regulatory citation envelopes that carry both structure (text, addresses, headers) and rates (kr/t, thresholds, percentages) MUST use separate hashes per drift axis. Minimum two:

- **`structureHash`** — SHA-256 over paragraph text with rate values normalized to sentinel (e.g., `<RATE>` tokens). Changes on paragraph renumber, clause restructure, non-rate text edits.
- **`rateHash`** — SHA-256 over rate-value canonical form only (sorted key-value pairs of numeric rates). Changes only when rate values change.

Separate hashes enable:
- CI to gate on `rateHash` staleness as HIGH urgency (recalculate + re-certify)
- CI to gate on `structureHash` staleness as LOW urgency (re-address fixture, no recalculation)
- Telemetry routing to separate `lovsen.citation.stale.structure` and `lovsen.citation.stale.rate` events (or discriminated via `drift_axis` payload field)

## Resolution

ADR-0348 supersedes ADR-0341 §H single-hash model with two-hash model. Existing `lovsenCitationHash` field maps to `structureHash` for backward compatibility during Phase 7c re-cert. New `rateHash` field added to `ExpectedCell` in Phase 7c migration.

## When this pattern applies

Any domain with regulatory text containing both:
- Structural elements (section numbering, cross-references, clause order)
- Rate values (monetary amounts, percentages, thresholds, hours)

This includes: Riksavtalen, Aml. (overtime rates), Ferieloven (feriepengegrunnlag percentages), OTP (contribution percentages), any tariff rate table. Single-hash is appropriate only for purely structural documents with no numeric rate values.
