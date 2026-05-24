---
id: L-0343
title: Heartbeat staleness sweeps duplicate per-push lint when lint has --max-stale-days
status: canonical
layer: learning
created: 2026-05-24
updated: 2026-05-24
module: governance
council_refs: [council-2026-05-24-domain-skill-structure-governance-audit]
tags: [learnings, council-protocol, heartbeat, lint, governance, adr-0392]
---

# L-0343 — Heartbeat sweeps duplicate per-push lints when lint has --max-stale-days

## Context

Council 2026-05-24 (Domain-skill ↔ structure governance audit, Fix E — deferred).

Chair Phase 3 proposed Fix E: a **heartbeat staleness sweep** to periodically check `docs/domains/*/README.md` `last_verified:` dates and alert when any domain spine is >14 days stale.

Supervisor code-traced `.husky/pre-push` lines 64-67 and found `domain-lint --changed --max-stale-days 45` already runs on every push. The proposed heartbeat would dispatch agents to detect what a 5-second bash script already catches on every push — adding zero detection value over what already ran.

## Discovery

Before proposing a heartbeat job for any staleness/drift detection:

1. Check if a matching **lint binary** takes `--max-stale-days` (or equivalent) flag.
2. If yes: per-push lint already covers the detection window. Heartbeat adds zero value.
3. Heartbeat is the right tool when: detection requires agent reasoning (semantic staleness, gap analysis), the lint binary does not exist, or the check needs to run on a schedule independent of push cadence (e.g. "alert even if no push happened in 7 days").

The discriminating test: **"Does the lint binary already detect this, and does it run on every push?"**

- If YES on both: heartbeat sweep = redundant for detection. The only added value would be notification routing (e.g. Telegram alert vs pre-push block), which may or may not be worth the agent dispatch cost.
- If NO on either: heartbeat adds detection capability not otherwise covered.

In this case: `domain-lint --changed --max-stale-days 45` ran on pre-push, covering 45-day window per push. The proposed heartbeat would duplicate this at 14-day window with agent overhead (~60s agent dispatch vs ~5s bash). Defer until there is a concrete case where per-push lint is insufficient (e.g. repo dormancy, production environment probe).

## Impact

- Before proposing any heartbeat staleness job, grep `.husky/pre-push` + `package.json:scripts` for matching lint command with staleness flag.
- Heartbeat jobs that duplicate lint-on-push add maintenance burden (heartbeat config, cooldown state, notification routing) without detection improvement.
- Sibling of supervisor's agent-vs-script choice pattern: if a bash script does it in 5 seconds, do not dispatch an agent to do the same thing in 60 seconds.
- Related: Fix C (close-feature.sh mechanical staleness check) ships as WARN-only and correctly avoids agent dispatch — same principle applied at closure time vs push time.

## References

- `.husky/pre-push:64-67` — existing `domain-lint --changed --max-stale-days 45` (code-trace evidence)
- ADR-0392 — domain-spine governance (domain-lint authority)
- Council session 2026-05-24 — `docs/council/COUNCIL-LOG.md`
- L-0342 — sibling (chair over-gating with new-ADR when precedent exists, same council)

---

> Registered in `docs/learnings/0000-learning-log.md`.
