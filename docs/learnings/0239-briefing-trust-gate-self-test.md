---
title: "L-0239 — Retrospective briefings are claims, not contracts"
id: L-0239
status: accepted
created: 2026-05-13
updated: 2026-05-13
module: governance
tags: [council, retrospective, l-0147, trust-gate]
related: [L-0147, L-0176, L-0192, L-0193, L-0194]
---

# L-0239: Retrospective briefings are claims, not contracts (6th L-0147 precedent)

## Trigger

Session retrospective council 2026-05-13. Briefing claimed:
- "stray Sortie A.2 migration bundled into 5b close" — wrong. A.2 already merged independently to development.
- "2 lint-staged collisions this session" — wrong per supervisor. Commit-message-template reuse, not parallel-agent race.
- "council false-positive rate ~30%" — unverifiable from briefing alone.
- "0 council escalations during build" — partial truth; ignored mid-flight scope expand in Sortie 4 (BFF route asymmetry).

Chair signed verdict on these premises Phase 3. Code-trace by reviewers falsified 3 of 4.

## Pattern

Retrospective briefings are written from working memory + session narrative. Working memory drifts within minutes; session narrative is selective. When chair builds Phase 3 verdict on un-verified briefing claims, the verdict inherits the falsity.

Same anti-pattern class as L-0193 (audit-from-memory hook myth) and L-0194 (agents drift on own knowledge bundles). Difference: those were about codebase + bundle drift. This is **process artifact drift** — the briefing itself.

## Falsification mechanism

Council Phase 2.5 fact-check is mandatory for codebase claims but NOT enforced for retrospective briefings. The skill text says "fact-check claims that can be verified against the codebase." Retrospective claims about session arc (commit hashes, stray migrations, lint-staged behavior) ARE verifiable against git log + working tree — they just don't get checked.

## Rule

**Retrospective briefings MUST pass Phase 2.5 fact-check.** Specifically verify:
1. Commit hashes referenced exist on claimed branches (`git log <branch> | grep <sha>`).
2. "Stray" migration claims (`git log --all --oneline <file>` — did it land elsewhere first?).
3. Sortie count (`git log --merges --grep="feat(merge)" | wc -l`).
4. Council escalation count (re-read prior agent reports — did mid-flight scope expand count?).
5. "Failed" / "broken" claims about hook/lint-staged behavior (timestamp the alleged collision; if >5 min apart, not a collision).

This is the 6th L-0147 precedent (Trust Gate beyond agents). Promote to SKILL.md after this occurrence — L-0147 already promoted to SKILL.md, this is a domain extension (briefings + retrospectives).

## Mitigation

Add to `run-council` SKILL.md Phase 2.5:

> **Retrospective addendum:** For `post-implementation` retrospectives, Phase 2.5 MUST verify every commit hash, branch claim, stray-file claim, and parallel-agent collision claim against git log. Working memory has expired by the time the retrospective starts — assume drift.

## Sibling references

- L-0147 (chair self-reversal protocol — promoted 2026-04-15)
- L-0193 (audit-from-memory hook myth)
- L-0194 (agents drift on own knowledge bundles)
- L-0238 (council chair branch verification preflight)
