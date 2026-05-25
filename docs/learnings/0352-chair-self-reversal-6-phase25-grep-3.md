---
title: "Chair Self-Reversal #6 / Phase 2.5 Grep-Methodology #3 — BUG-SIM-01 SET NOT NULL"
id: L-0352
status: accepted
layer: learning
created: 2026-05-25
updated: 2026-05-25
---

# L-0352: Chair Self-Reversal #6 + Phase 2.5 Grep-Methodology Failure #3

## What happened

Council 2026-05-25 (restaurant-week + hotel + festival sim verification). Phase 2.5
fact-check claimed BUG-SIM-01 mechanism description "wrong — no SET NOT NULL in migrations,
sim hallucinated." Supervisor reviewed the actual migration file independently and confirmed
`ALTER COLUMN employment_form SET NOT NULL` at
`supabase/migrations/20260519150000_contract_text_to_enum_cast.sql:160`. Steward + Chair
re-grep both confirmed Supervisor right.

Phase 2.5 had used a literal-string grep that missed the clause because the SQL is spread
across two lines (`ALTER COLUMN employment_form` on one line, `SET NOT NULL;` on the next).
A `grep "SET NOT NULL.*employment_form"` returned 0; the actual SQL needed `grep -A 1
"ALTER COLUMN employment_form"` or a semantic check.

Chair applied [[L-0294]] Chair Self-Reversal Protocol:

> Phase 3 claim "BUG-SIM-01 mechanism wrong" was **FALSE**.
> Falsifying evidence: `20260519150000:160` confirms ALTER COLUMN employment_form SET NOT NULL.
> Classification: REVERSED.

## Why it matters

This is the **6th L-0147 self-reversal precedent** AND the **3rd Phase 2.5 grep-methodology
false-negative** in 6 weeks:

| # | Date | Council | Phase 2.5 failure mode |
|---|---|---|---|
| 1 | 2026-05-16 | Chat-WhatsApp | `grep -c '"hms' site-map.json` returned 0 because keys use `"path"` not `"scope"` — wrong-scope-key |
| 2 | 2026-05-17 PM | HMS R1 site-map | "VERIFIED-missing" claim on entries that existed under different schema key |
| 3 | 2026-05-25 | Restaurant-sim | "No SET NOT NULL in migrations" — actually at line 160, spread across two lines |

3 occurrences → promote to ADR-grade per skill self-improvement protocol. Drafted as
[[ADR-0425]] — Phase 2.5 Fact-Check Methodology — Positive Absence-Evidence Required.

## Lesson learned

**Phase 2.5 absence claims must produce positive-presence evidence in addition to
literal-string-absent evidence.** Literal-string grep returning 0 hits is NOT proof of
absence; it's proof of "this exact string doesn't appear." The concept may exist under
different syntactic form (spread across lines, different JSON key, semantic equivalent
table name, etc.).

Three-strike rule: any reviewer making an absence claim that drives a verdict MUST run
BOTH:
1. Literal-string grep showing 0 hits
2. Conceptual search showing the concept under every plausible syntactic form is absent

If conceptual search produces ANY hits, claim is "POSSIBLY-PRESENT under different syntax"
— not "VERIFIED-missing."

## How to apply

- **Phase 2.5 fact-check agents:** when claiming absence, ALWAYS produce both forms of
  search per [[ADR-0425]]. Default to "POSSIBLY-PRESENT" if uncertain.
- **Phase 5 chair:** re-grep every Phase 2.5 absence claim before adopting into synthesis.
  If falsified, apply [[L-0294]] Chair Self-Reversal Protocol with canonical format.
- **Reviewers:** treat Phase 2.5 absence claims as starting points, not conclusions.
  Re-verify when basing your verdict on them.

## References

- Council 2026-05-25 — restaurant-week + hotel + festival sim Phase 5 synthesis
- [[ADR-0425]] — Phase 2.5 Methodology (this learning's enforcement ADR)
- [[L-0294]] — Chair Self-Reversal Protocol (parent)
- L-0276, L-0278 — Chat-WhatsApp wrong-scope-key precedents
- HMS R1 PM 2026-05-17 — site-map ZERO-entries false claim
