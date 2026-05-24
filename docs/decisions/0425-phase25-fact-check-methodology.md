---
title: "Phase 2.5 Fact-Check Methodology — Positive Absence-Evidence Required"
id: ADR-0425
status: accepted
layer: decision
created: 2026-05-25
updated: 2026-05-25
---

# ADR-0425: Phase 2.5 Fact-Check Methodology — Positive Absence-Evidence

## Context and Problem Statement

Council `run-council` skill Phase 2.5 fact-check has produced false-NEGATIVE absence claims
in 3 sessions across 6 weeks:

| Date | Council | Failure mode |
|---|---|---|
| 2026-05-16 | Chat-WhatsApp briefing | `grep -c '"hms' site-map.json` → 0 because keys use `"path"` not `"scope"` — wrong-scope-key. Briefing said "ZERO entries"; reality 5 entries. (L-0276/L-0278 family) |
| 2026-05-17 PM | HMS R1 site-map | "VERIFIED-missing" claim on entries that existed under different schema key |
| 2026-05-25 | Restaurant-sim BUG-SIM-01 | "No `SET NOT NULL` exists in migrations" — Supervisor + Steward + Chair re-grep all found `20260519150000:160` ALTER COLUMN ... SET NOT NULL |

Pattern: Phase 2.5 fact-checker runs a literal-string grep, gets 0 hits, concludes
"VERIFIED-missing." The actual code has the concept under a different syntactic form
(SQL clause spread across lines, JSON key by different name, etc.).

This violates the council's core trust contract: "Phase 2.5 verifies facts." A false-negative
absence claim becomes a "verified" briefing input → reviewers waste cycles refuting → chair
makes false synthesis call → Phase 5 must reverse via L-0294 protocol.

3 occurrences in 6 weeks → ADR-grade per skill self-improvement protocol.

## Decision Drivers

- Reviewers trust Phase 2.5 verdicts; false-negatives propagate
- Chair reversal protocol (L-0294) catches the failure but at high cycle cost
- Methodology is fixable: positive-evidence requirement instead of literal-string absence
- Sibling rule: `system-agent-coordinator` Code-Tracer Mandate already requires positive
  evidence on write-paths; Phase 2.5 absence claims need same discipline

## Considered Options

1. **A** — Document the failure pattern, rely on reviewer discipline
2. **B** — Require Phase 2.5 to always pair grep with positive-presence search before
   claiming absence
3. **C** — Mandate Phase 5 chair re-verification of any Phase 2.5 absence claim that drives
   a reviewer's verdict

## Decision Outcome

**Chosen: Option B + Option C as defense-in-depth.**

### Rule B — Positive Absence-Evidence (Phase 2.5)

When Phase 2.5 wants to claim "X does not exist" or "X is missing," it MUST produce TWO
search artifacts:

1. **Literal-string grep** showing 0 hits for the obvious search term
2. **Conceptual search** showing that the concept under EVERY plausible syntactic form is
   absent

Examples:
- "No `SET NOT NULL` on employment_form" → must grep `ALTER COLUMN employment_form` AND
  `ALTER TABLE.*employment_form` AND look for spread-across-lines clauses
- "No `event` table" → must grep `CREATE TABLE.*event` AND look at table comments for
  semantic equivalents (`planning_event`, `event_session`, etc.)
- "No site-map entry for hms" → must check BOTH `"path":"/dashboard/hms..."` AND
  `"scope":"hms"` AND any other schema key in the JSON

If the conceptual search produces hits, the claim is "POSSIBLY-VERIFIED, ambiguous syntactic
form" → NOT "VERIFIED-missing."

### Rule C — Phase 5 Chair Re-verification

When a Phase 2.5 absence claim drives a reviewer's verdict (i.e. reviewer cites the absence
as part of their reasoning), Phase 5 chair MUST re-run the search before adopting the claim
into synthesis. Canonical format on chair self-reversal applies if claim falsified
([[L-0294]] protocol).

## Rules & Consequences

- **Good:** Closes the 3-occurrence false-negative pattern
- **Good:** Phase 5 chair re-verification step formalized — chair no longer adopts Phase 2.5
  absence claims unchecked
- **Good:** Sibling defenses match Code-Tracer Mandate strength
- **Bad:** Phase 2.5 takes 30-60s longer per absence claim (positive-presence search adds
  one grep per concept)
- **Bad:** Chair Phase 5 work expands by re-verification step

## Agent Impact

Phase 2.5 fact-check agents: when claiming absence, ALWAYS produce both literal-string AND
conceptual-form searches. Default to "POSSIBLY-PRESENT under different syntax" if you have
ANY uncertainty.

Phase 5 chair: re-grep every Phase 2.5 absence claim before adopting into synthesis. If
falsified, apply L-0294 self-reversal protocol with canonical format.

## References

- 11-agent restaurant-week sim council 2026-05-25 (BUG-SIM-01 false-negative)
- L-0276, L-0278 — Chat-WhatsApp wrong-scope-key precedent
- HMS R1 PM 2026-05-17 — site-map ZERO-entries false claim
- [[L-0294]] — Chair Self-Reversal Protocol
- L-0352 — this learning (chair self-reversal #6 / Phase 2.5 #3)
- `.claude/skills/run-council/SKILL.md` Phase 2.5 section
