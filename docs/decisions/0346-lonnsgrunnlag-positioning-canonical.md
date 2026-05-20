---
title: "Lønnsgrunnlag positioning canonical — Smartout produces wage basis, not payslip"
id: ADR_0346
status: accepted
layer: decision
created: 2026-05-16
updated: 2026-05-16
---

# ADR-0346 — Lønnsgrunnlag positioning canonical

## Context

Project memory file `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/feedback_lonnsgrunnlag_not_lonnsslipp.md` (2026-05-08) declared the positioning rule but is project-local memory — not code-blame durable, not searchable by future developers, not enforced by `adr-contract-audit`. The rule was discovered mid-Phase 3 closure when a next-step recommendation used the noun "lønnsslipp" for Smartout's output document. ADR-0295 (feriepenger-boundary, accepted 2026-05-11) locked the positioning ONLY at the field-level (`feriepenger_basis` naming). No ADR existed for the general term boundary.

Council Payroll Sortie-Triplet 2026-05-16 graduated the project-memory rule to ADR status, classifying it as load-bearing positioning that affects UI labels, capability naming conventions, documentation, and downstream integrations.

## Decision

1. Smartout produces **lønnsgrunnlag** (wage basis document) consumed by accountants / Tripletex / Visma / equivalent downstream systems. Smartout does NOT produce **lønnsslipp** (tax-compliant payslip). The lønnsslipp belongs to the regnskapssystem downstream. This is the product boundary.

2. **UI labels** (user-facing strings in `apps/web` and `apps/mobile`) MUST use "lønnsgrunnlag" wherever the term refers to Smartout's output document. Examples: page headings, button labels, export filenames, email subjects, notification copy.

3. **Capability names, telemetry event names, internal type names KEEP existing nomenclature** even if it contains "payroll" or "payslip". These are stable contracts with downstream consumers and internal code. Example: `payroll.payslip_*` telemetry events do NOT change. TypeScript types named `PayslipLine` or similar do NOT change. Capability IDs do NOT change.

4. **Pedagogy lines** that deliberately contrast both terms (e.g., "Dette er et lønnsgrunnlag — ikke en lønnsslipp") are PRESERVED unchanged. These lines exist specifically to explain the product boundary and removing them would obscure the distinction for users.

5. **AI alt-spellings** used for fuzzy matching in industry-intelligence packages (e.g., `packages/ai/src/industry/packages/hospitality.ts:185-189` which includes "lønnslipp" as a recognized synonym for intent classification) are PRESERVED. Removing them would degrade NLU recall.

6. **Frozen artifacts** — audit reports, ADR history, prior HANDOFF files, council logs — are NOT rewritten. Historical accuracy is preserved. The rule applies to live production code and active documentation, not to the historical record.

## Consequences

- Sortie S1 (Payroll Sortie-Triplet 2026-05-16) performs an 8-hit code sweep (3 web + 5 mobile) per blast-radius analysis from council. Only live production code hits (category a) and i18n keys (category b) are in scope. Docs/frozen-audits/pedagogy/AI-alt-spellings are explicitly excluded.
- Future capability authors must wire UI labels to "lønnsgrunnlag" by default while preserving internal capability and telemetry names.
- Project memory file `feedback_lonnsgrunnlag_not_lonnsslipp.md` is superseded by this ADR. The memory file is retained as historical reference but no longer authoritative.
- `adr-contract-audit` can now verify UI label compliance against this ADR's rules (check 2 above).

## Siblings

- **ADR-0295** (feriepenger-boundary, accepted 2026-05-11) — field-level positioning precedent: `feriepenger_basis` naming locked. That ADR was the first field-level enforcement; this ADR generalizes the boundary to the product level.
- **ADR-0250** (Skatteetaten deferred — parallel boundary class) — another product boundary where Smartout produces input data for an external authority, not the authority's artifact directly.

## Council

Payroll Sortie-Triplet 2026-05-16. 5 reviewers: system-steward (chair, opus — Phase 3 + Phase 5 with two L-0147 self-reversals on S2 + S3 in same synthesis; 7th + 8th codified precedents), supervisor (opus — verified F-CL-13 closure via commit `58d40f500`; corrected briefing 122 hits → 8 live UI), system-agent-coordinator (opus — Code-Tracer at `tools.ts:1323/1559/2534` verified Pattern B recalc absent; recommended F-CL-12 as S3), frontend-designer (sonnet — provided S2 falsifiable acceptance list incl. `expo-sharing` native PDF + FlashList + a11y; truncation guard for `QuickPathCards.tsx:40` 30% width increase), general-purpose (haiku — Phase 2.5 fact-check 12/13 VERIFIED + 1 OUTDATED on inflated 122-hit count). Verdict: APPROVE WITH CHANGES. Pontus approved 2026-05-16.
