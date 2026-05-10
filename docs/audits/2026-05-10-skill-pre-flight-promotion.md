---
title: Out-of-band SKILL.md patch — Pre-claim ADR-slot + npm-package pre-flight
status: pending-operator-apply
created: 2026-05-10
updated: 2026-05-10
module: governance
phase: E
tags: [skill, run-council, pre-flight, adr-collision, npm-availability, out-of-band]
---

# Out-of-band patch — `~/.claude/skills/run-council/SKILL.md`

> Cannot be applied by Claude Code in-repo per ADR-0075 — `~/.claude/` is outside the project tree. Operator must apply manually + log to activity-log.

## Why

Pre-claim collision pattern hit 4th time on 2026-05-10 (voice-multilingual ADR-0291 squatted by `0291-journey-speed-profiles.md`, plus `ac76c266b` rename-collision history already in tree). Cost per occurrence = 15-30 min cleanup + plan churn. Pre-flight check = 30 sec.

Existing Phase 8 Step 0 covers ADR reservation **post-decision, pre-write**. Gap: **plan-time pre-claim** (Phase 2 BRIEF references specific ADR-NNNN before slot is verified). Plus new class: **npm-package availability** — orchestrator proposed `@livekit/agents-plugin-livekit` install without verifying it exists on registry or local install.

## Recurrence history (combined surface)

ADR-only class (5 prior, Phase 8 Step 0 already promoted):
1. 2026-04-13 ADR-0068 entity-drawer
2. 2026-04-15 Tripletex vs Mobile RN
3. 2026-04-16 decision log ADR-0107 TWO entries
4. 2026-04-18 implicit pre-session
5. 2026-04-19 Helpdesk council collided with `feat/overview-v2` mid-Phase-8

ADR-cross-branch class (4 new, this promotion):
6. 2026-05-06 engine-world Phase 1 → ADR-0282 collision → escalate 0290 (`learning_adr_id_squatting.md`)
7. 2026-05-08 Council R3 plan-label collision (B1 vs Phase B1 dual-gate)
8. 2026-05-09 Council R4 mid-Phase-8 renumber-cleanup
9. 2026-05-10 Voice-multilingual plan → 0291 squatted (this session)

npm-package class (1, new):
1. 2026-05-10 `@livekit/agents-plugin-livekit` proposed without `npm view` + `node_modules` check

## Patch — Phase 2 BRIEF section

Insert AFTER existing "Code-Tracer Mandate" subsection, BEFORE "Post-Implementation Briefing Addendum":

```markdown
### Pre-Claim Pre-Flight (MANDATORY when brief mentions ADR-NNNN or npm package)

If briefing references a specific ADR slot OR proposes installing an npm package, run 30-sec pre-flight BEFORE dispatching agents:

**ADR slot pre-claim:**
```bash
# Check ALL branches (worktrees commit ADRs that haven't merged)
git log --all --name-only | grep -E "docs/decisions/<NNNN>-" | head -3
ls docs/decisions/<NNNN>-*.md  # must be ENOENT
```
If slot squatted → reserve next free slot strictly greater than highest observed on ANY branch. Update brief BEFORE dispatch.

**npm package availability:**
```bash
npm view <package-name> version  # must return version, not 404
ls node_modules/<package-name>   # confirms local install if relevant
```
If package missing locally → mention install cost (size, RAM, deps, prewarm impact) in brief so reviewers can assess.

**9th occurrence promoted this rule** (2026-05-10): voice-multilingual plan claimed ADR-0291 without grep; slot taken by `0291-journey-speed-profiles.md`. Same session proposed `@livekit/agents-plugin-livekit` without npm verification. See `docs/audits/2026-05-10-skill-pre-flight-promotion.md`.
```

## Patch — Phase 8 KNOWLEDGE CAPTURE Step 0

Replace existing Step 0 paragraph "5th occurrence of this collision promoted this rule:" with updated history including the 4 new ADR-cross-branch occurrences:

```markdown
**Promoted via 9 prior occurrences:**
1-5. ADR-only class (2026-04-13 to 2026-04-19) — see prior history.
6. 2026-05-06 engine-world Phase 1 → ADR-0282 collision → escalate 0290.
7. 2026-05-08 Council R3 plan-label collision (B1 dual-gate).
8. 2026-05-09 Council R4 mid-Phase-8 renumber.
9. 2026-05-10 Voice-multilingual plan → 0291 squatted by journey-speed-profiles.

Each occurrence costs 15-30 min of cleanup. Pre-flight check is 30 sec. Phase 2 BRIEF now enforces pre-claim check (added 2026-05-10).
```

Add new Step 0.5 between Step 0 and Step 1:

```markdown
### Step 0.5 — npm-package availability (MANDATORY if ADR proposes new dep)

If the ADR proposes installing a new npm package, verify availability + cost upfront:

```bash
npm view <package-name>
# Capture: latest version, license, dependencies, unpacked size
ls node_modules/<package-name>  # confirms or shows install needed
```

Document install cost in ADR's "Consequences" section: bundle size delta, RAM cost (esp. for native bindings / ML models), prewarm latency, model-download requirements (~/.cache/ paths).

**Promoted 2026-05-10**: voice-multilingual plan proposed `@livekit/agents-plugin-livekit` install without verifying. Package exists on npm (1.4.0, 343KB, +50-200MB RAM via onnxruntime + transformer model + huggingface model-download on first prewarm). These costs were not in original plan.
```

## Apply procedure (operator)

```bash
# 1. Open SKILL.md
code ~/.claude/skills/run-council/SKILL.md

# 2. Apply Phase 2 patch (insert after Code-Tracer Mandate)
# 3. Apply Phase 8 Step 0 patch (replace promotion paragraph)
# 4. Apply Phase 8 Step 0.5 patch (insert new step)

# 5. Log to activity-log
~/.claude/scripts/log-activity.sh skill pontus "Promoted Pre-Claim Pre-Flight rule to ~/.claude/skills/run-council/SKILL.md (Phase 2 + Phase 8 Step 0/0.5). Source: docs/audits/2026-05-10-skill-pre-flight-promotion.md. Pattern hit 9 times across ADR-collision (5) + ADR-cross-branch (4) + npm-package (1). 30-sec check now enforced before any specific ADR-NNNN claim or npm install proposal."
```

## Linked ADRs / Learnings

- ADR-0075 (knowledge-system-consolidation — `~/.claude/` is out-of-band)
- L-0202 (5th-occurrence promotion threshold pattern)
- `learning_adr_id_squatting.md` (engine-world Phase 1, 2026-05-06)
