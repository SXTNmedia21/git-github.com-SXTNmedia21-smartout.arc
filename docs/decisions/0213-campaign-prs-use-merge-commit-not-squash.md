---
title: "Campaign-PRs use merge-commit, not squash"
id: ADR-0213
status: accepted
layer: decision
created: 2026-04-27
updated: 2026-04-27
---

# ADR-0213: Campaign-PRs use merge-commit, not squash

## Context and Problem Statement

Long-lived `campaign/*` branches host coherent multi-phase work (Botsson Arena 8 phases, Year Wheel 5 milestones, Helpdesk Nordic Split 7 phases, Journey Engine 6 milestones). When their PRs to `development` are squash-merged, all internal commits collapse into one new commit on `development`. Two consequences emerge:

1. **ADR falsifiability erosion.** ADR-0196 mandates falsifiable status claims with grep / SQL / test verification. When ADRs cite implementation SHAs (e.g., ADR-0202 references `52822744 M5.4 partial UNIQUE index`), squash deletes those SHAs from `development`. The claim becomes unverifiable on the working branch even though the implementation IS there — under a different SHA.

2. **Recovery hazard.** Post-squash, `git rev-list --left-right --count origin/development...campaign/<name>` reports persistent divergence (year-wheel: 3538 ahead, botsson-arena: 22 ahead with 14 PR-numbered squash-artefacts). The documented recovery (`git reset --hard origin/development` + cherry-pick + `push --force-with-lease`) has been exercised twice on `campaign/journey-engine` (2026-04-22, 2026-04-23). Each force-push orphans active sub-sortie worktrees (`feat/<camp>-<sub>` based on the pre-reset campaign HEAD).

Smartout's existing local merge convention (`close-feature.sh` line 367-368: sortie→development uses `--no-ff`) already produces merge-commits up to the campaign-PR step. The squash-anomaly exists ONLY at the GitHub campaign-PR merge button. Pattern is dominant-but-not-universal: PR #259 (year-wheel M5 cleanup) was already merge-commit (2 parents), establishing precedent.

## Decision Drivers

- Preserve ADR-0196 falsifiability discipline across multi-phase work
- Eliminate the destructive `git reset --hard + force-push` recovery loop and its sub-sortie blast radius
- Align GitHub merge behavior with `close-feature.sh`'s already-merge-commit local pattern (consistency, not change)
- Keep `git log --first-parent origin/development` stable as a milestone overview surface
- Avoid touching 5 scripts (`sync-campaign.sh`, `close-feature.sh` sub-sortie path, `new-feature.sh`, `close-feature-journey-guardian.sh`) that all assume FF-clean campaign ancestry

## Considered Options

1. **Option A — Merge-commit at campaign-PR step (squash retained for short-lived feat→dev only)**
2. **Option B — Institutionalize `git reset --hard origin/development` + cherry-pick + force-push recovery in tooling**
3. **Option C — Accept divergence as cosmetic**

## Decision Outcome

Chosen option: **Option A — Merge-commit for campaign-PRs**, because it preserves ancestry at the source (the GitHub merge button), requires zero tooling changes, eliminates the destructive recovery loop, and aligns with the local merge-commit pattern `close-feature.sh` already produces.

Reject Option B: 5 scripts would need detect-divergence-and-recover logic; force-push on `campaign/*` orphans active sub-sorties; scaling a destructive operation across 7 campaigns and 2+ active sub-sorties has higher blast radius than the divergence it solves. Also requires a CLAUDE.md hard-rule exception.

Reject Option C: 3538-commit divergence visualization is symptomatic; the ADR-0196 falsifiability erosion is structural and compounds with every new ADR citing campaign-internal SHAs.

## Rules & Consequences

### Hard rules

- **`campaign/* → development` PRs MUST merge-commit.** Never squash. Never rebase-and-merge.
- **Sortie-class PRs (`feat/* → development`) MAY squash** when no internal phase structure needs preservation. `close-feature.sh` continues to use `--no-ff` locally; GitHub-side either matches or squashes (acceptable for sortie scope).
- **Sub-sortie PRs (`feat/<camp>-<sub> → campaign/<camp>`)** continue to use merge-commit via `close-feature.sh --no-ff` (no change).
- **Force-push on `campaign/*` is forbidden** going forward. Branch protection enforces.

### GitHub repository settings (Pontus runs in UI)

1. Disable "Allow squash merging" repo-wide on `smartout.ai` (sortie→dev already uses merge-commit locally; no remaining use case for GitHub squash).
2. Add branch protection rule on `campaign/*` disallowing force-push.

### Falsifiable invariants

- After every campaign-PR merge: `git rev-list --count origin/development..campaign/<name>` should equal `commits-since-last-merge-back`, **not** the full campaign history. Drops to ~0 immediately post-merge.
- For any ADR citing a campaign-internal SHA: `git cat-file -e <sha>` on `development` must succeed. Pre-Option-A, this fails for all post-squash citations.

### Existing campaign divergence

The pre-existing 3538-commit (year-wheel) and 22-commit (botsson-arena) divergence is **deferred for separate decision** (out of scope for this ADR). Two paths exist:
- Reset existing campaigns once for clean baseline (requires verifying via `git log --first-parent` that ahead-count is squash-noise, not real WIP)
- Accept historical divergence; new policy applies prospectively

### Good, because

- ADR-0196 falsifiability gates remain valid across multi-phase work
- Zero tooling change: `close-feature.sh`, `sync-campaign.sh`, `new-feature.sh`, `close-feature-journey-guardian.sh` keep their FF-clean assumptions intact (campaign tip stays an ancestor of itself going forward)
- Eliminates the cross-domain hazard of force-push on campaign branches with active sub-sorties
- `git log --grep`, conventional-commit consumers, claude-mem observation extraction, and changelog generation all see preserved per-commit messages on `development`
- Aligns GitHub UX with the local merge pattern `close-feature.sh` already enforces

### Bad, because

- `git log --oneline development` becomes denser (every campaign commit visible). Mitigation: `git log --first-parent` shows campaign-PR-as-single-line history; already standard practice for milestone review.
- GitHub PR review surface for `campaign/* → development` shows N commits not 1. Trade-off: more reviewable detail, less summary. Net positive for council audit (council often regrets squash hides defects, see L-0115).
- `preview` fast-forward from `development` absorbs merge-commits; `main` PR review surface gets denser. This is a feature for production gating per ADR-0075 release-flow design.

### Agent Impact

- **Pontus:** flip GitHub repo merge-method setting (disable squash repo-wide); add branch protection on `campaign/*` disallowing force-push
- **Claude Code (orchestrator):** when about to merge any branch via GitHub UI, verify branch class — campaign → merge-commit; sortie → merge-commit (consistent); never squash for campaigns
- **Council protocol:** ADRs may cite campaign-internal SHAs. Convention: cite at write-time; first-parent ancestry on `development` post-merge-commit keeps them reachable
- **Memory:** `reference_squash_merge_recovery.md` superseded by this ADR; kept for reference if a one-off non-campaign squash recovery is ever needed

## References

- ADR-0196 — Falsifiable status claims (the discipline this ADR protects)
- ADR-0075 — Doc hierarchy + orientation + release flow
- ADR-0202 — Cites M5.6 commits unreachable on `development` post-squash (canonical example of the breakage)
- L-0142 — Squash-merge erodes ADR falsifiability for multi-phase work (paired learning)
- L-0143 — Pattern claims should be quantified, not generalized (Phase 2.5 catch this council)
- Council 2026-04-27 — Campaign-PR merge strategy verdict
- Memory `reference_squash_merge_recovery.md` — historical recovery doc (superseded)

---

> Registered in `docs/decisions/0000-decision-log.md` and CLAUDE.md (root) Hard Rules.
