---
title: "Grep-count briefings undercount by 3-5x without code-trace pairing"
id: LEARNING_0059
status: canonical
layer: learning
created: 2026-04-19
updated: 2026-04-19
tags: [council, process, audit-inflation, code-trace]
---

# Learning-0059: Grep-count briefings undercount by 3-5x without code-trace pairing

## Context

System Health Audit Council (2026-04-18 / 2026-04-19). Phase 1 evidence-gathering agents returned a count of "3 web useMutation sites missing emit()" (briefing M1 finding). Supervisor in Phase 3 sampled 15 of 84 useMutation files and found 12 *additional* violations — scaling to 15+ confirmed, likely 30+ if the full 84 were audited.

The Phase 1 grep was grep-based; Supervisor's verification was code-trace (open each file, verify no emit() import OR call in the same file). Same symptom, different methodology, 5x scope delta.

## Discovery

Grep-count briefings systematically *undercount* violations because:
- Grep finds only the literal pattern the author thought to search for (e.g. specific file paths).
- Code-trace opens each candidate and checks the actual contract (import + call).
- The delta between "what I grep'd" and "what the contract requires" grows with the pattern specificity.

This is NOT the audit-inflation pattern (over-counting via double-reporting). This is the inverse: audit *deflation* via selective grep.

The previous audit-inflation pattern was promoted to Phase 2.5 fact-check in SKILL.md (2026-04-15). This is the mirror case — same fix (code-trace Layer 2 reviewer), different direction of error.

## Impact

- **Council process:** Phase 2.5 fact-check should verify COUNT claims by running the verification method differently than the briefing (if briefing grep'd, fact-check should open a sample; if briefing opened, fact-check should grep).
- **Plan authoring:** Any plan citing "N violations" must either (a) cite code-trace count, or (b) explicitly note "grep-estimate, likely undercount, full sweep needed."
- **Merge-blocker sizing:** M1 in this council was initially scoped as "small fix" (3 sites); real scope 15+ is sprint-work. Had the briefing undercount not been caught in Phase 3, the remediation plan would have been sized wrong.

## References

- Council session: 2026-04-18 / 2026-04-19 System Health Audit (COUNCIL-LOG.md entry)
- Prior related: L-0054 (grep-based site inventories inflate scope) — inverse direction
- Supervisor Phase 3 finding files: `DeviationDialog.tsx`, `DayApproval.tsx`, `DepartmentHoursTab.tsx`, `LeaderOverview.tsx`, `useGuardianSignals.ts`, 7 more
- SKILL.md Phase 2.5 (audit-inflation promotion 2026-04-15) — this learning is the symmetric case

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
