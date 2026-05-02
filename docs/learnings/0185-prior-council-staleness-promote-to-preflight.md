---
title: "Prior-council artifacts go stale within 24–72 hours — council preflight MUST re-verify within 7-day window"
id: L_0185
status: accepted
layer: learning
created: 2026-04-30
updated: 2026-04-30
references:
  - ADR-0246
  - ADR-0216
  - ADR-0224
---

# L-0185: Prior-council artifacts go stale within 24–72 hours — council preflight MUST re-verify within 7-day window

## Why

ADR-0246 brief (drafted 2026-04-29) did not cite ADR-0216 (accepted 2026-04-28, 1 day prior) or ADR-0224 Amendment (same day). Both forbade merge; brief proposed merge. Phase 3 Steward review caught it. Council nearly voted on a question already answered.

Five occurrences in 9 days:
- 2026-04-20 — Year Wheel Redesign Council (3 false claims in same-session-written spec)
- 2026-04-28 — /dashboard/help council (Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend layout brought new evidence)
- 2026-04-28 — ADR-0216 (Phase 3 Option A2 → Phase 5 Option B after Supervisor's 139-site blast-radius scan)
- 2026-04-29 — Botsson on Platform Admin council
- 2026-04-30 — ADR-0246 (this brief; omitted ADR-0216 + ADR-0224 from §References)

The recurrence rate signals the soft rule (call-out in Phase 3) is insufficient. Promote to council preflight as hard rule.

## How to apply

**Council preflight hard rule (added to `/run-council` skill Phase 1 INTAKE):**

> Before writing or accepting any council brief, run:
> ```bash
> git log --since='7 days ago' --name-only docs/decisions/ docs/learnings/
> ```
> For every ADR or learning touching the same subsystem as the brief's subject, the brief MUST include it in §References AND state explicitly: ratifies | amends | supersedes | unrelated.
>
> If brief does not cite a relevant prior artifact within 7-day window, briefing is rejected before Phase 3 dispatch. Re-author with §References fixed.

Skill update: `~/.claude/skills/run-council/SKILL.md` Phase 1 step 3 ("Check prior verdicts") becomes mandatory grep + presence verification, not optional state-in-intake-note.

## Pattern signature

- Brief written within 7 days of related ADR acceptance
- Brief lacks §References citing the ADR
- Brief proposes direction that contradicts the prior ADR's chosen option
- Phase 3 reviewer (typically Steward) catches it

When all four are true: brief is stale, reframe before Phase 4.

## Why hard rule, not soft

Soft rule (Phase 3 catches it) has 5 documented failures in 9 days. Soft rule wastes a Phase 3 round + a Phase 5 reframing. Hard rule (Phase 1 preflight rejects brief) costs 30 seconds of grep, saves a full council round.

ROI: 30 seconds of preflight grep ≈ saves 30+ minutes of Phase 3 + 60+ minutes of Phase 5 reframing per occurrence. At 5 occurrences in 9 days, that is ~7.5 hours of agent time saved by promoting the rule.

## Coordination

L-0185 is the council-process complement to L-0098 (which addresses global-script cutover ownership — different domain, sibling discipline of "always check upstream before changing this thing"). Pattern recurrence: don't trust your own draft's references; re-verify against fresh git log.
