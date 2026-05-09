---
title: "Root CLAUDE.md isolation from campaign-scoped variants"
id: ADR-0214
status: accepted
layer: decision
created: 2026-04-27
updated: 2026-04-27
---

# ADR-0214: Root CLAUDE.md isolation from campaign-scoped variants

## Context and Problem Statement

Long-lived campaign worktrees ship a campaign-scoped `CLAUDE.md` at the worktree root (per `/start-campaign` convention). The campaign-scoped variant narrows project rules to the campaign's purpose — e.g., `# CLAUDE.md — campaign/journey-engine` declares "Dette worktree-et implementerer KUN Journey Engine. Ingen unntak." This is correct inside the campaign worktree: Claude Code auto-loads the root `CLAUDE.md`, and the scoped variant ensures agents stay inside campaign boundaries.

The defect: when a campaign PR merges to `development`, the campaign-scoped `CLAUDE.md` rides along and clobbers the project-root `CLAUDE.md`. Three consecutive merges produced this drift on `development`:

| Merge | Date | Δ on `CLAUDE.md` | Result |
|---|---|---|---|
| #229 `Campaign/daily operation` (`348142c9`) | 2026-04-21 | -167 +176 | "Smartout v3" project file (247 lines) → daily-op-scoped (256 lines) |
| #233 `campaign/journey-engine — M1–M6` (`ea69d98c`) | 2026-04-22 | -130 +183 | → journey-engine-scoped (309 lines) |
| #239 `campaign/journey-engine — Phase 0 honesty remediation` (`d0258817`) | 2026-04-23 | -3 +7 | → 313 lines, current `development` HEAD prior to recovery |

Self-evidence of the regression: the file at `development:CLAUDE.md` instructs readers to "read full Smartout v3 project rules via `git show development:CLAUDE.md`" — a circular reference proving the file is no longer the project-wide source of truth it claims to point to. Genuine project-wide content lost in the chain: project identity ("Smartout — Employee Readiness System for shift-based businesses in Norway"), source-of-truth list (ORIENTATION → STATE-SUMMARY → decisions/ → reference/ → engines/ → modules/ → architecture/ → cross-cutting/), tech stack version pins (Next.js 16, React 19, Tailwind v4, Supabase Postgres 17), monorepo structure, all 23-module + 54-ADR cross-references, mobile parity rules, telemetry rules, performance rules.

`close-feature.sh` (line 367-368) merges sortie→development with `--no-ff` and the campaign-PR step is the GitHub merge button — neither layer protects `CLAUDE.md` from the campaign-scoped variant. ADR-0213 established that campaign-PRs use merge-commit (not squash), which preserves ancestry but does not address content protection on per-file basis.

The pattern is recurring (3 occurrences, 3 of 3 campaign-PR merges to development that included `CLAUDE.md` changes) and each subsequent campaign merge will reproduce it absent intervention.

## Decision Drivers

- Recover and protect the project-wide `CLAUDE.md` as the canonical Smartout v3 source of truth on `development`
- Preserve campaign-scoped `CLAUDE.md` inside campaign worktrees (it works correctly there — agents stay inside scope)
- Eliminate the recurring clobber on every campaign-PR merge without requiring contributors to remember a manual restore step
- Use a mechanism that survives `git merge-commit` (per ADR-0213) and works without script changes if possible
- Make the protection visible (file in repo) rather than tribal knowledge (CI config, branch-protection-only)

## Considered Options

1. **Option A — `.gitattributes` `merge=ours` driver on root `CLAUDE.md`**
2. **Option B — Pre-merge GitHub Actions gate that fails the campaign-PR if `CLAUDE.md` differs from `development:CLAUDE.md`**
3. **Option C — Sidecar pattern: campaign worktrees use `CLAUDE.campaign.md`, root `CLAUDE.md` is symlinked via local-only override**
4. **Option D — Husky pre-commit hook on `campaign/*` branches blocking `CLAUDE.md` commits**
5. **Option E — Status quo + manual restore each occurrence**

## Decision Outcome

Chosen: **Option A — `.gitattributes` `merge=ours` driver on root `CLAUDE.md`**, combined with **a one-time recovery commit** restoring `CLAUDE.md` to the last-good state (parent of `348142c9`, the pre-#229 "Smartout v3" v1.0.0 file, 247 lines).

Mechanism: register `merge=ours` driver in `.gitattributes` (the file already exists with `merge=union` for the decision log, learning log, and worklog). At merge time, git auto-resolves `CLAUDE.md` conflicts in favour of the destination branch (`development`), so the campaign-scoped variant on the source side is silently dropped. No script changes. No CI changes. No human action at merge time.

The merge driver itself is a built-in alias requiring a one-line registration per clone (`git config merge.ours.driver true`). Documented in this ADR's invariants below; idempotent and re-runnable.

Reject Option B (CI gate): would block legitimate cross-campaign edits to `CLAUDE.md` (a developer fixing a global rule on a campaign branch can no longer ship that fix via the campaign-PR — they would be forced to open a separate `chore/*` PR off `development`). Adds workflow friction without solving auto-clobber. CI checks also cannot retroactively protect against the existing 3 occurrences, and the workflow file itself becomes a campaign-merge-target (recursive risk).

Reject Option C (sidecar): Claude Code's auto-load behaviour reads `CLAUDE.md` at the worktree root by name. Renaming campaign-scoped files to `CLAUDE.campaign.md` breaks the auto-load (agents would no longer pick up campaign scoping). Symlink-via-local-override fragments the source-of-truth and is invisible to git history.

Reject Option D (husky pre-commit): legitimate edits to `CLAUDE.md` happen on campaign branches (the campaign-scoped variant must be authored somewhere). Blocking commits would force authors into a parallel branch dance. Also runs only on local commits — bypassed by `git commit --no-verify`, web UI commits, and direct push.

Reject Option E (status quo): pattern is recurring; 4th occurrence is matter of when, not if. Manual restore loses fidelity each time (3 occurrences already merged; 5 hypothetical campaigns × 3 merges each ⇒ 15 future regressions). Also fails Pontus's "no undocumented decisions" rule from CLAUDE.md.

## Consequences

### Positive

- Project-wide `CLAUDE.md` on `development` recovered to "Smartout v3" v1.0.0 baseline (247 lines).
- Campaign worktrees retain their scoped `CLAUDE.md` — no behaviour change inside campaign work.
- Future campaign-PRs auto-resolve the file in favour of `development`. Zero manual step.
- Pattern documented; if a 4th occurrence is observed, the mechanism failed and that becomes a falsifiable diagnosis (was `.gitattributes` registered? was the merge driver active in the merging clone? was the merge actually run as a merge-commit per ADR-0213, or did someone bypass via squash/rebase-merge?).

### Negative

- Genuine cross-campaign edits to `CLAUDE.md` (rare but possible — e.g., a global rule clarification authored on a campaign branch) will be silently dropped at merge. Mitigation: the contributor must propagate such an edit via a separate PR off `development`. Documented as Invariant 3 below.
- Each clone needs `git config merge.ours.driver true` registered (one-time, idempotent). If a contributor's clone is missing the driver, git falls back to default merge behaviour and the clobber re-occurs from that clone. Mitigation: documented in onboarding (Invariant 4) and in the ADR title commit.
- Per-clone driver registration is invisible to the repo — there is no gitignored or repo-checked indicator that the driver is live in any given clone. Mitigation: `.gitattributes` line is visible; if a clobber recurs, log shows the offending clone via committer email and `git config --show-origin merge.ours.driver` can be checked there.

### Neutral

- Existing `.gitattributes` file already contains `merge=union` directives for `docs/decisions/0000-decision-log.md`, `docs/learnings/0000-learning-log.md`, `docs/WORKLOG.md`, and `docs/worklogs/*`. Adding `merge=ours` for `CLAUDE.md` follows the same pattern; reviewers can verify by reading 5 lines of one file.

## Invariants

1. **Driver registered.** `.gitattributes` contains `CLAUDE.md merge=ours` after this ADR lands. Falsifiable: `grep -E "^CLAUDE\.md\s+merge=ours$" .gitattributes` returns exactly one line.
2. **Recovery commit landed.** `CLAUDE.md` on `development` HEAD matches `git show 348142c9^:CLAUDE.md` line-for-line (the pre-#229 "Smartout v3" baseline, 247 lines). Falsifiable: `diff <(git show development:CLAUDE.md) <(git show 348142c9^:CLAUDE.md)` returns empty.
3. **Cross-campaign global edits route via direct dev-branch PR.** Any edit intended to change project-wide rules in `CLAUDE.md` is committed on `development` (or a `chore/*` branch off `development`), not on a `campaign/*` branch. Falsifiable: a global-rule edit lands via campaign-PR ⇒ `merge=ours` drops it ⇒ the change does not appear on `development` ⇒ the contributor's intent is observably unmet on next session.
4. **Per-clone driver registration documented.** Contributor onboarding (or `~/.claude/CLAUDE.md` Mandatory: Git Workflow section) instructs `git config merge.ours.driver true` once per clone. Falsifiable: a fresh clone running `git config --get merge.ours.driver` returns empty until the contributor runs the registration step.
5. **No campaign-scoped CLAUDE.md on development.** `head -1 CLAUDE.md` on `development` HEAD returns `# CLAUDE.md — Smartout v3` (or successor v2.x heading), never `# CLAUDE.md — campaign/<name>`. Falsifiable: `head -1 CLAUDE.md` returns a `campaign/*` heading ⇒ Invariant violated, drift recurred.
6. **Detection of bypass.** A 4th occurrence of campaign-scoped `CLAUDE.md` on `development` indicates either (a) `.gitattributes` was modified to remove the directive, or (b) the merge ran without the driver registered in the merging clone, or (c) the merge was performed as squash/rebase-merge (which ignores `merge=ours`). Falsifiable: investigate via `git log --first-parent` + `git config --get merge.ours.driver` on the merging clone + GitHub PR merge-method attribute.

## References

- **ADR-0075** — orientation / doc hierarchy
- **ADR-0213** — campaign-PRs use merge-commit (precondition for `merge=ours` to work; squash bypasses merge drivers)
- **`.gitattributes`** — companion configuration; this ADR adds one line
- **Last-good baseline** — `git show 348142c9^:CLAUDE.md` (pre-#229, "Smartout v3" v1.0.0, 247 lines)
- **Damage chain** — PR #229, #233, #239 (each a campaign-merge that clobbered root `CLAUDE.md`)
- **Self-evidence** — `develop:CLAUDE.md` line 6 reads "read `CLAUDE.md` on `development` via `git show development:CLAUDE.md`" (circular)

## Changelog

| Date | Change |
|------|--------|
| 2026-04-27 | Initial ADR. Recovery commit + `.gitattributes` line ship in same PR. |
