---
title: "L-0289 — Chair Phase 3 must verify ADR-number references correct subject before claiming survival"
id: L_0289
status: active
date: 2026-05-17
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [council, chair, adr-reference, self-reversal, L-0147, phase-7d]
related_adrs: [ADR-0250, ADR-0350, ADR-0351]
related_learnings: [L-0147]
---

# L-0289 — Chair Phase 3 must verify ADR-number references correct subject before claiming survival

## What happened

Steward Phase 1 briefing (dynamic-MCP-fetch pivot council, 2026-05-17) listed "ADR-0250 survives this pivot" — assuming ADR-0250 was the workspace-tariff dynamic supplements ADR. Lovsen Phase 3 code-traced the actual file: ADR-0250 title is "Skatteetaten integration — A-melding reporting (DEFERRED)." The subject is entirely Skatteetaten A-melding integration, with zero intersection with workspace-tariff or supplement dynamics. Chair claimed ADR survival without reading the current subject of the ADR.

Steward self-reversal issued in Phase 5 synthesis. Documented as 6th L-0147 occurrence.

## Rule

Before claiming "ADR-XXXX survives" or "ADR-XXXX supersedes" in any council phase, chair MUST:

1. `grep docs/decisions/0000-decision-log.md -n "ADR-XXXX"` — read the title on the log line
2. Open the file and confirm subject matches the claimed topic
3. Only then assert survival or supersession

ADR-by-number references without subject verification are unreliable. Numbers drift as ADRs are renumbered, inserted, and superseded — title is the stable identifier.

## Pattern context

6th L-0147 occurrence (chair self-reversal pattern). Frequency: chair ADR-survival claims falsified in 6 of the last 15 sessions (~40% miss rate). This frequency warrants promotion to a mandatory pre-Phase-3 fact-check step in the council protocol.

**Recommended council protocol addition:** Before Phase 3 dispatch, chair runs `grep -n "ADR-[0-9]\{4\}" briefing.md | while read match; do echo $match; grep "$(echo $match | grep -oE 'ADR-[0-9]{4}')" docs/decisions/0000-decision-log.md; done` and verifies each ADR number maps to the claimed subject.
