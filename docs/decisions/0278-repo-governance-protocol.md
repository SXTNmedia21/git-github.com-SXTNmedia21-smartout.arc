---
title: "Repo Governance Protocol — retention, capability index, automated cleanup"
id: ADR_0278
status: proposed
layer: decision
created: 2026-05-05
updated: 2026-05-05
---

# ADR-0278: Repo Governance Protocol — retention, capability index, automated cleanup

## Context and Problem Statement

The Smartout monorepo accumulates artifacts faster than they retire. Concrete signals from the 2026-05-05 governance inventory (`docs/audits/2026-05-05-repo-governance-inventory.md`):

- 31 worktrees (sortie + campaign + sub-sortie) at session start, of which 8+ were merged-but-not-stepped-down, 1 was a zombie (locked:initializing), and 6 were behind 200+ commits
- 208 journey files in `docs/journeys/`, of which 23 are >60 days idle, 5 explicitly superseded, 115 done, only 3 cross-referenced from ADRs
- 51 handoff files split across `docs/HANDOFF-*.md` (root) and `docs/handoffs/` subdirectory
- 96 active plan files in root + 18 completed + 1 archive, with 13 done-plans misplaced in active root
- 271 ADRs of which 49 in `proposed` status (in-flight, age unknown)
- Pipeline gap dev → preview = 26 commits, preview → main = 24 commits

The pattern: artifacts accumulate without a defined retirement path. Manual cleanup is bursty and skips ahead of pattern-detection. The 2026-05-05 cleanup session removed 8 worktrees + 3 branches manually, but the work doesn't compose — same accumulation will recur in 30 days unless a protocol locks the retention rules and a system enforces them.

We need a written protocol that defines retention thresholds per artifact class, a derived capability index built from journey frontmatter, and an automation path that converts these rules into heartbeat jobs and ci-incident-conductor responsibilities.

## Decision Drivers

- The 2026-05-05 inventory established a baseline (31 worktrees, 208 journeys, 96 plans). Without a protocol, this baseline is the floor — accumulation only goes up.
- Pontus has scope-granted CI mechanics to `ci-incident-conductor` (ADR-0275 § Autonomous CI Operating Mode). Governance automation belongs in the same agent's roadmap, not as a separate one.
- Memory `feedback_no_unilateral_pipeline_actions.md` requires explicit per-action approval for destructive ops outside CI scope. Governance protocol must classify each retention action as either auto-allowed or human-gated.
- ADR-0213 (campaign-PRs use merge-commit, never squash; force-push forbidden) constrains how campaign branches can retire. The protocol must respect this — campaigns persist as branches even after worktree step-down.
- ADR-0075 v1.1 (knowledge system consolidation) deprecated SESSION.md and split persistence between activity-log (audit), claude-mem (memory), and DASHBOARD (git state). Governance protocol must not introduce a 4th persistence channel — it derives from existing sources.
- L-0202 promotion threshold (3rd recurrence → mandatory ADR) maps cleanly onto pattern-mining for the capability index.

## Considered Options

1. **No protocol, ad-hoc cleanup** — continue current pattern; do bursty manual cleanup when sprawl becomes uncomfortable.
   - Reject: 2026-05-05 session demonstrated this approach takes a full work-day and recurs every 30 days.
2. **Manual protocol document, no automation** — write retention rules; require human enforcement.
   - Reject: same as option 1 in practice; documents without enforcement drift.
3. **Protocol + heartbeat-driven automation + ci-incident-conductor extension** — write rules, extend ci-incident-conductor with governance scope (Phase 4 capability emission), add heartbeat jobs that surface retention candidates.
   - Recommend: aligns with existing autonomy grant, reuses agent infrastructure, makes retention enforcement a system property rather than a person's task.

## Decision Outcome

Chosen option: **Option 3 — protocol + heartbeat automation + ci-incident-conductor extension**.

### Retention rules per artifact class

#### Worktrees

| Class | Auto-cleanup threshold | Action | Approval |
|---|---|---|---|
| Sortie (`smartout.ai-wt-N`) merged to development | branch-delete event | Remove worktree + delete local branch | Auto |
| Sortie not merged, > 14 days idle, no open PR | 14 days idle | Surface in heartbeat report | Manual |
| Sortie not merged, > 30 days idle, no open PR | 30 days idle | Surface as deletion candidate; require Pontus yes | Manual |
| Sub-sortie merged to campaign | merge event | Remove worktree + delete branch | Auto |
| Sub-sortie not merged, parent campaign worktree removed | parent-removal event | Mark as orphan (preserve, log) | Auto |
| Campaign worktree, fully merged to development, > 7 days idle | 7 days idle + merged | Surface in heartbeat as step-down candidate | Manual |
| Campaign worktree, dirty | any | Never auto-touch | Manual |
| Phantom directory (filesystem, no git admin) | detection event | Surface as cleanup candidate; require operator `rm -rf` | Manual |

`Auto` = ci-incident-conductor or heartbeat job acts without per-action prompt. `Manual` = surfaces in heartbeat output, awaits Pontus confirmation per `feedback_no_unilateral_pipeline_actions.md`.

#### Branches (remote)

| Class | Auto-cleanup threshold | Action | Approval |
|---|---|---|---|
| `feat/*` merged to development via PR | PR merge event + 1 day | `git push origin --delete <branch>` (with `--no-verify`) | Auto |
| `feat/*` not merged, > 30 days idle, no open PR | 30 days idle | Surface as deletion candidate | Manual |
| `release/*` after PR merge | PR merge event | Auto-delete (matches existing 2026-05-04 pattern) | Auto |
| `campaign/*` merged to development | merge event | Branch persists (long-lived per ADR-0213); worktree may step down | Manual (worktree only) |
| `hotfix/*` merged to main | merge event + 7 days | `git push origin --delete` (with `--no-verify`) | Auto |
| Force-push, ruleset edits, branch protection changes | — | Never auto-touch | Manual |

#### Journey files

| Class | Auto-action threshold | Action |
|---|---|---|
| `status: superseded` in frontmatter | detection event | Auto-move to `docs/journeys/archive/` |
| `status: done`, no ADR cross-reference, > 60 days since `updated:` | 60 days | Surface as archive candidate |
| `status: done`, > 90 days since `updated:` | 90 days | Auto-move to `docs/journeys/archive/` |
| `status: in_progress`, > 30 days no commits | 30 days | Surface as stale-WIP warning |
| Missing `feature:` frontmatter on file matching active branch | detection | Surface as protocol-violation |

#### Handoff files

| Class | Auto-action threshold | Action |
|---|---|---|
| Missing `updated:` frontmatter | detection | Auto-add (use git log of file as fallback date) |
| `docs/HANDOFF-*.md` (root) when `docs/handoffs/HANDOFF-*.md` (sub) exists | duplicate detection | Surface as consolidation candidate |
| > 90 days since `updated:` | 90 days | Auto-move to `docs/handoffs/archive/` |

Canonical location: `docs/handoffs/HANDOFF-<feature>.md`. Root-level `docs/HANDOFF-*.md` is legacy and consolidates over time.

#### Plan files

| Class | Auto-action threshold | Action |
|---|---|---|
| `status: done` in `docs/plans/` (root, not `completed/`) | detection event | Auto-move to `docs/plans/completed/` |
| `status: draft` in `docs/plans/completed/` | detection event | Auto-update frontmatter to `status: done` |
| Naming violation (no `PLAN-` or `CAMPAIGN-` prefix) | detection event | Surface as protocol-violation |

#### ADR files

| Class | Auto-action threshold | Action |
|---|---|---|
| `status: proposed`, > 30 days since `updated:` | 30 days | Surface as stale-proposed warning (in heartbeat report) |
| `status: superseded` with successor link in frontmatter | detection event | Auto-move to `docs/decisions/archive/` |
| ADR with no `id:` field in frontmatter | detection event | Surface as protocol-violation |
| Renumber-collision detection (two files claiming same ADR-NNNN) | detection event | Surface immediately (high-severity) |

ADR retention is conservative — never auto-delete an ADR. Surface concerns; humans decide.

### Capability Index — derived from journey frontmatter

A new file `docs/CAPABILITIES.md` is auto-generated from journey frontmatter and committed to `development` on a heartbeat schedule (24h). The file is a derived view; never hand-edit.

**Derivation rule:**

```
For each docs/journeys/JOURNEY-*.md (excluding archive/):
  if frontmatter has feature: <name> AND status: verified:
    capability = <name>
    journey = <file path>
    last_verified = <updated: from frontmatter>
    persona = <derived from journey body or `persona:` frontmatter if present>
    add to CAPABILITIES.md table
```

Output format:

```markdown
---
title: Smartout Capability Index
status: derived
generated_by: heartbeat job capability-index-regen
generated_at: <ISO timestamp>
---

# Capability Index

> Auto-generated from `docs/journeys/JOURNEY-*.md` frontmatter where
> `status: verified`. Do not hand-edit. To add a capability, write a
> verified journey.

| Capability | Journey | Last Verified | Persona |
|---|---|---|---|
| ci-agent | docs/journeys/JOURNEY-ci-agent.md | 2026-05-04 | system |
| ... | ... | ... | ... |
```

This becomes the single answer to "what does the system actually do today?" — a question that has no current canonical source.

### Heartbeat jobs (added to `HEARTBEAT.md` in vault)

```markdown
- [ ] worktree-prune-scan [cooldown: 24h] — Surface step-down candidates per ADR-0278 worktree retention
- [ ] journey-orphan-scan [cooldown: 7d] — Surface stale-journey candidates per ADR-0278 journey retention
- [ ] capability-index-regen [cooldown: 24h] — Regenerate docs/CAPABILITIES.md from journey frontmatter
- [ ] adr-staleness-scan [cooldown: 7d] — Surface proposed ADRs > 30 days idle
```

Each job is a script in `~/dev/second-brain-v2/ops/scripts/`. Auto-actions (move file, regen index) commit to the smartout.ai repo on `development` branch with conventional-commit messages prefixed `chore(governance): ...`. Manual-action surfaces emit warnings to heartbeat output and the activity-log.

### `ci-incident-conductor` extension

Phase 4 of the agent (skill emission) absorbs governance pattern-mining as a sibling responsibility:

- Pattern detection threshold: 3 recurrences in 30 days promotes a pattern from RUNS.md to a candidate ADR draft
- Recurrence threshold for retention rules: if same retention rule fires > 5 times in 30 days, surface as protocol-improvement candidate (e.g. tighten threshold, change action)
- Cross-link: every governance-action commit logs an entry to `ops/ci-incidents/log.jsonl` with `failure_class: governance:<rule_id>` so retention work shows up in the same metrics dashboard as CI incidents

### Hard floors (survive automation)

The same hard floors from ADR-0275 § Autonomous CI Operating Mode apply here:

- Never push `main`
- Never push `preview` (only `promote-preview.sh` wrapper)
- Never edit secrets / 1Password vault
- Never edit migration files (`supabase/migrations/*`)
- Never edit application code (`apps/`, `packages/`, `services/`) for retention reasons
- Never force-push to protected branches
- Never edit branch protection rulesets
- Never `--no-verify` push except on `git push --delete` (per memory)
- Never auto-rollback or auto-revert

### Escape hatch — operator-controlled pause

Same as ADR-0275:

- Issue label `governance-pause` → all governance heartbeat jobs become read-only (surface only, never auto-act) within next cycle
- Resume via `governance-resume` label
- Per-rule pause: comment `pause-rule: <rule_id>` on any governance-action commit suppresses that specific rule for 7 days

### Phase progression for governance automation

| Phase | Trigger | Capabilities |
|---|---|---|
| G0 | This ADR accepted | Heartbeat jobs surface candidates only; no auto-action |
| G1 | 14 days G0 + ≥ 5 candidates surfaced + Pontus reviewed | Auto-actions enabled per the rule tables above |
| G2 | 30 days G1 stable + false-action rate < 5% | Capability index auto-commits to development |
| G3 | 60 days G2 + pattern-mining produces ≥ 1 retention rule refinement | Rule refinements ship as ADR-0278 amendments |

## Rules & Consequences

- **Good, because** retention becomes a system property — composes over time instead of bursting every 30 days
- **Good, because** the capability index answers "what does the system do today" with a derived, always-fresh artifact
- **Good, because** governance work flows through the same metrics dashboard as CI incidents (uniform visibility)
- **Good, because** hard floors survive — risky operations still require Pontus
- **Good, because** scope is bounded — operator-controlled pause is one Issue away
- **Bad, because** another set of automation surfaces to monitor (offset: heartbeat already handles surface, not new infra)
- **Bad, because** capability index commit cadence (24h) creates churn on `development` (offset: commit only when content changes; gate on diff non-empty)
- **Agent Impact:**
  - `ci-incident-conductor`: gains Phase 4 governance-pattern-mining responsibility
  - Heartbeat: 4 new jobs in vault `HEARTBEAT.md`
  - Vault scripts: 4 new handlers in `~/dev/second-brain-v2/ops/scripts/`
  - DASHBOARD: should reference `docs/CAPABILITIES.md` once first generated
  - Authors: new convention — write `feature:` + `status: verified` frontmatter on journeys to surface in capability index

## Implementation phases (out of scope for this ADR — informational)

- Phase G0a — write 4 heartbeat handler scripts (worktree-prune-scan, journey-orphan-scan, capability-index-regen, adr-staleness-scan)
- Phase G0b — register jobs in vault `HEARTBEAT.md`, set 24-hour observation period
- Phase G0c — first capability index generated, manual review, commit to `development`
- Phase G1 — flip to auto-action mode after 14d + 5 candidates surfaced
- Phase G2 — gate capability-index commits on non-empty diff
- Phase G3 — first ADR-0278 amendment from pattern-mining

Each phase ships as separate sub-sortie under `campaign/pipeline-autonomy`.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
