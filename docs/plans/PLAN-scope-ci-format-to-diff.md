---
title: "PLAN — Scope CI Format Check to PR diff"
status: proposed
created: 2026-05-03
updated: 2026-05-03
module: cross-cutting / ci
tags: [plan, ci, format, prettier, monorepo, blast-radius]
related:
  - docs/decisions/0265-enforced-deployment-pipeline.md
  - docs/HANDOFF-deploy-conductor-session-2026-05-03.md
  - .github/workflows/ci.yml
---

# PLAN — Scope CI Format Check to PR diff

## Problem statement

`.github/workflows/ci.yml` Format Check job runs `pnpm format:check`, which
expands to `prettier --check "**/*.{ts,tsx,md,json,css}"` over the whole
monorepo. ~1003 pre-existing prettier-dirty files (tech-debt accumulated
from multiple agents/campaigns) cause the job to fail on **every PR** —
even PRs that touch zero formattable files.

This violates the operator's stated principle: *"Vi skal bare kjøre på de
partier som er påvirket eller endret."* It also blocks all 17 in-flight
worktrees + 4 campaigns from achieving green CI until either:

(a) every dirty file is swept clean (1003-file blast — explicitly rejected),
(b) Format Check is scoped to PR diff (this plan), or
(c) Format Check is removed from required checks (regression — rejected).

A previous attempt ran `pnpm prettier --write` whole-repo (1002 files
modified) and was reverted by operator with `git checkout -- .`.

## Industry-standard pattern

Scoped formatter checks are the default in production monorepos:

- **Turborepo** ships `turbo run format --filter=[origin/main]` as the
  documented pattern for diff-scoped tasks; the `--filter=[<ref>]` syntax
  selects only packages with changes vs the ref.
  Source: turborepo docs › Filtering › "Filtering by changed packages".
- **pnpm** ships `pnpm --filter "...[origin/main]" format:check` for the
  same pattern at the workspace layer.
  Source: pnpm docs › `--filter` › "since" syntax.
- **Vercel** template `next.js/examples/with-turborepo` uses
  `turbo run lint --filter=[HEAD^1]` in CI for incremental checks.
- **Supabase monorepo** (`supabase/supabase`) scopes prettier in CI to
  `git diff --name-only origin/master...HEAD | xargs prettier --check`
  rather than running across all `apps/`/`packages/`.
- **Smartout precedent**: `.github/workflows/ci.yml` `edge-functions` job
  *already* uses `git diff --name-only "$BASE"..HEAD -- 'supabase/functions/**'`
  to detect changed functions (lines 215–227). The pattern is in-house.

The principle is identical across all four: **the formatter is a hygiene
gate on what you changed, not an audit of the whole tree**. Whole-repo
audits live in nightly cron or one-shot sweep PRs, never in PR-blocking CI.

## Three scoping strategies — compared

### Strategy A: changed-files-only via `git diff`

```yaml
- name: Determine base ref
  id: base
  run: |
    if [ "${{ github.event_name }}" = "pull_request" ]; then
      echo "ref=${{ github.event.pull_request.base.sha }}" >> "$GITHUB_OUTPUT"
    else
      # push event — diff against previous commit
      echo "ref=HEAD~1" >> "$GITHUB_OUTPUT"
    fi
- name: Format check (changed files)
  run: |
    FILES=$(git diff --name-only --diff-filter=ACMR \
      "${{ steps.base.outputs.ref }}"...HEAD \
      -- '*.ts' '*.tsx' '*.md' '*.json' '*.css' || true)
    if [ -z "$FILES" ]; then
      echo "No formattable files changed — skipping prettier."
      exit 0
    fi
    echo "$FILES" | xargs -r pnpm exec prettier --check
```

**Pros**: granular (file-level), zero false-positives, matches operator's
principle exactly, mirrors existing `edge-functions` job pattern.
**Cons**: requires `fetch-depth: 0` on checkout; `xargs` arg-list limits
on huge diffs (mitigated with `xargs -r` and prettier's tolerance).
**Honors `.prettierignore`**: yes — prettier filters internally.

### Strategy B: package-scoped via Turborepo filter

```yaml
- run: pnpm turbo run format:check --filter='[origin/${{ github.base_ref || 'development' }}]'
```

Requires adding `format:check` script to every package's `package.json`
plus a `format:check` task to `turbo.json`. Selects whole packages even
if only one file changed in them — runs prettier across **all** files in
those packages, including the 1003 dirty ones inside touched packages.

**Pros**: native turbo, package-graph aware, caches.
**Cons**: still false-positives on dirty files inside touched packages;
requires package-by-package script wiring (currently format lives only
at root); doesn't honor the operator's "only what changed" — it's "what
package changed".
**Verdict**: too coarse. The 1003 dirty files are spread across packages
the active worktrees *are* touching.

### Strategy C: hybrid (A for CI, B for nightly audit)

CI Format Check uses Strategy A. A separate `format-audit-nightly.yml`
cron workflow runs `pnpm format:check` whole-repo every night at 03:00
UTC, posts a Slack ping with dirty-file count, never blocks anything.

**Pros**: PR signal stays clean + visibility into latent debt remains.
**Cons**: extra workflow to maintain; until format-debt is addressed the
Slack ping is noise.

## Recommended strategy: **A (now)** + **C (later, optional)**

Reasons:
1. Mirrors the existing `edge-functions` job in the same `ci.yml` —
   convention already established in-house.
2. Granular enough to honor "kjøre kun på de partier som er påvirket".
3. Zero coupling to package-level script wiring (no `package.json`
   churn across 30+ packages).
4. Strategy C can land in a follow-up sortie once the operator decides
   the format-debt policy (sweep vs owners-touch-it-fix-it).

## Exact YAML diff for `.github/workflows/ci.yml`

Replace lines 49–60 (current `format` job) with:

```yaml
  format:
    name: Format Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for git diff against base
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Determine base ref
        id: base
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            echo "ref=${{ github.event.pull_request.base.sha }}" >> "$GITHUB_OUTPUT"
          else
            # push event — diff against previous commit
            echo "ref=HEAD~1" >> "$GITHUB_OUTPUT"
          fi
      - name: Format check (changed files only)
        run: |
          set -euo pipefail
          FILES=$(git diff --name-only --diff-filter=ACMR \
            "${{ steps.base.outputs.ref }}"...HEAD \
            -- '*.ts' '*.tsx' '*.md' '*.json' '*.css' || true)
          if [ -z "$FILES" ]; then
            echo "No formattable files changed — skipping prettier."
            exit 0
          fi
          echo "Checking $(echo "$FILES" | wc -l) files:"
          echo "$FILES"
          echo "$FILES" | xargs pnpm exec prettier --check
```

Notes on the diff:
- `fetch-depth: 0` is **required** — default depth=1 makes `git diff`
  against base impossible. Adds ~5–10s to checkout, no other cost.
- `--diff-filter=ACMR` excludes deletions (D) and untracked (?). Prettier
  has nothing to check on a deleted file.
- `git diff A...B` (three-dot) uses the merge-base, which is correct for
  PR-style "what did this branch add". The `edge-functions` job uses
  two-dot (`A..B`) — both acceptable for PR base resolution; we pick
  three-dot to match human intuition of "what's in my branch that isn't
  in main yet" and ignore unrelated commits on main since fork.
- `xargs pnpm exec prettier --check` (no `-r` flag because empty-check
  guard above) — keeps stable behavior across GNU and BSD xargs.
- `set -euo pipefail` on the script step — defensive default.
- Pathspecs `'*.ts' '*.tsx' …` mirror the existing `format:check` glob
  exactly so semantics don't drift.
- `.prettierignore` is honored automatically by `prettier --check`.

## Risk analysis

| Risk | Severity | Mitigation |
|---|---|---|
| **False-negative** — un-touched dirty files stay dirty | Medium | Accepted by design; addressed via separate format-debt decision (see below). Strategy C nightly cron makes the debt visible without blocking. |
| **Stale fetch on shallow checkout** | Low | `fetch-depth: 0` prevents this. |
| **Base-ref wrong on push events** | Medium | `HEAD~1` for push works for `development`/`main`/`preview` because every push is either a merge commit (whose `HEAD~1` = previous tip on the branch) or a direct push. Edge case: first commit on a new branch — handled by `\|\| true` plus empty-check fallback. |
| **xargs arg-list overflow on huge PRs** | Low | xargs auto-splits. Prettier handles multiple invocations idempotently. |
| **Non-bash shell on runner** | None | `runs-on: ubuntu-latest` always uses bash. |
| **Required-checks contract breakage (ADR-0265, 11→14 checks after F2)** | High | Job name `Format Check` is **unchanged** — required-checks contract is keyed on job name, not its internals. No ADR-0265 update needed. |
| **Interaction with `feat/*` rebases** | Low | Three-dot diff against PR base SHA is rebase-stable as long as the PR was rebased before push. |

**False-positive elimination**: complete. PRs that don't touch
`.{ts,tsx,md,json,css}` files now skip prettier entirely (exit 0).

## Adoption sequence

1. **Land plan-doc** (this file). Operator reviews, decides on the
   format-debt question (next section). No CI change.
2. **Operator decision** on format-debt → unlocks step 3.
3. **Sortie `chore/scope-ci-format-to-diff`** opens worktree, edits
   `.github/workflows/ci.yml` per diff above. Adds journey doc covering:
   motivation (this plan), exact change, test plan, rollback.
4. **Test plan in sortie PR**:
   - PR description must include a test matrix:
     - PR touching only `.py` files → Format Check skips, exit 0.
     - PR touching one already-clean `.ts` file → Format Check passes.
     - PR touching one deliberately-dirtied `.ts` file → Format Check
       fails on that file only, log shows the file path.
     - PR touching a file inside `.prettierignore` (e.g., `docs/foo.md`)
       → Format Check skips that file.
   - Verify in CI logs that "Checking N files:" output is sane.
5. **Merge to development**, observe 24h across active campaigns.
6. **Decision-log entry** appended to
   `docs/decisions/0000-decision-log.md` referencing this plan +
   ADR-0265.
7. **Optional**: open follow-up sortie for Strategy C nightly audit
   workflow once format-debt policy is set.

## Operator decisions surfaced

These cannot be answered by an agent — operator must decide:

1. **Format-debt policy** — pick one:
   - (i) **Owners-touch-it-fix-it**. Latent debt remains. As contributors
     touch dirty files (lint-staged on commit + prettier on changed-file
     CI) the debt naturally dissolves over months. Lowest disruption.
     Drawback: nightly format audits would stay red until done.
   - (ii) **One-shot `chore/format-sweep` sortie**. Single PR runs
     `pnpm format` whole-repo, ~1003 files modified, zero semantic change.
     Coordinate with all active worktrees: pause merges for ~2h, sweep
     lands on `development`, all worktrees rebase. Pro: clean slate.
     Con: 17 worktrees rebasing 1003 files of formatting churn.
   - (iii) **Hybrid**: sweep only `apps/web` and `packages/ai`
     (high-traffic areas), leave `apps/landing` + `services/*` to (i).
   - **Recommendation**: (i) until at least one campaign hits its merge
     window with green Format Check using the new scoping; revisit then.
2. **Strategy C nightly audit** — yes/no/later? If yes, opens a separate
   tiny workflow file; if no, format-debt is invisible until it's
   touched.
3. **Sortie timing** — execute `chore/scope-ci-format-to-diff` (a) now
   on `development` directly, or (b) wait until preview-recovery
   completes (operator F2 + F3 + preview reset)? CI fix is independent
   of preview state but adds a moving piece during a delicate window.

## Out of scope

- Edits to `pnpm format` / `pnpm format:check` script (still useful for
  local ad-hoc whole-repo runs by humans who know what they're doing).
- Adding `format:check` to `turbo.json` (Strategy B was rejected).
- Modifying `.prettierignore` or `.prettierrc`.
- Touching the 1003 pre-existing dirty files (separate decision).
- Pre-commit `lint-staged` config (already correctly file-scoped at
  `.lintstagedrc.json`).
- ADR-0265 itself (no contract change — required-checks count and job
  name unchanged).

## Done = …

- This plan-doc reviewed by operator + decision recorded in §"Operator
  decisions surfaced".
- Format-debt policy chosen.
- Follow-up sortie opened (or explicitly deferred).
