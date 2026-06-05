---
title: Handoff — sxtn plugin / harness tooling session
status: done
updated: 2026-06-04
created: 2026-06-04
module: sxtn-plugin
tags: [handoff, harness, plugin, lint-staged, emit-coverage, commit-gates, page-polish]
---

# Handoff — Plugin / Harness side (2026-06-04)

> Interpretation note: "pluggen 16" read as **the sxtn plugin / harness tooling** — the skills,
> hooks, gates and scripts that drive the campaign (page-polish gate, emit-coverage, lint-staged,
> commitlint, telemetry-map harness). If "16" means something else (a version, a specific issue),
> say so and I'll re-scope.

This session exercised the harness hard (verify a polish run, then fight three commit gates). It
surfaced **four tooling bugs/traps** worth fixing before the next fan-out wave.

---

## 1. What we did (harness-relevant)

- Loaded + ran the `smartout-page-polish` skill as a **verifier**, not a builder — confirmed it can
  be used to disk-audit an existing run record.
- Ran harness gates: `emit-coverage.sh`, telemetry typecheck, `site-map:validate`.
- Drove a commit through the full pre-commit / commit-msg gate stack in the wt-2 worktree.
- Diagnosed a cross-worktree lint-staged stash state without losing data.

---

## 2. Bugs + traps found (the meat)

### 🔴 BUG 1 — `emit-coverage.sh` path is broken after relocation

`docs/campaign/telemetry-map/emit-coverage.sh` computes:

```sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"     # ← wrong
```

The script assumes it lives **2 levels** below repo root (its original home was
`.sxtn-staging/telemetry-map/`). It now lives **3 levels** deep at
`docs/campaign/telemetry-map/`, so `REPO_ROOT` resolves to `…/docs/` and it fails:

```
ERROR: registry.ts not found at /home/sxtnl/dev/smartout.ai-master-refactor/docs/packages/telemetry/src/registry.ts
```

**Impact:** the Layer-2 telemetry gate is broken for **every** domain run from this location, not
just oversikt. It was only caught because the run was disk-verified.

**Fix (one line):** `$SCRIPT_DIR/../..` → `$SCRIPT_DIR/../../..`. Then re-run
`bash docs/campaign/telemetry-map/emit-coverage.sh oversikt apps/web/src/app/dashboard/oversikt-v2`
and confirm exit 0. (Workaround used this session: did the L2 reconciliation by hand — 11 registered
events all have call sites.)

### 🟡 TRAP 2 — lint-staged backup stash is repo-wide, leaks across worktrees

When a husky pre-commit hook fails (vs a lint-staged *task* failing), lint-staged restores the
working tree but can leave its `lint-staged automatic backup` stash **undropped**. Stashes live in
a **single repo-wide reflog**, so a failed commit in worktree B (`refactor/smartout`, wt-2) shows up
as a dangling `stash@{0}` when you `git stash list` in worktree A (`campaign/master-refactor`).

**Diagnostic that disambiguates:** check the stash parent.
```sh
git log --oneline -1 <stash-sha>^1     # parent = the HEAD the backup was based on
```
Here `cdcd0a96d^1 = e41bf87be` (wt-2's tip), proving the stash belonged to wt-2, not us.

**Danger:** `git stash pop` in the wrong worktree dumps B's content onto A's HEAD (wrong base) →
conflicts / silent file loss. This is the L-stash-pop class already in memory.

**Rule:** never pop a `lint-staged automatic backup` from a worktree other than the one that created
it. Verify content is on disk first (`ls` the paths in the stash), then drop — don't pop.

### 🟡 TRAP 3 — page-polish pre-commit gate only fires on first-segment dashboard routes

The gate (`.husky/pre-commit`) regex `^apps/web/src/app/dashboard/[^/]+/` extracts the **first**
segment → demands `.claude/page-polish/dashboard-<segment>.run.yml` with `verified: true`. Staging
any file under `dashboard/people-v2/**` triggered it. Sub-routes are documentation-only (never
enforced). Bypass: `SKIP_PAGE_POLISH=1` (document why in the message body — we did).

### 🟡 TRAP 4 — commitlint rejects `wip` type and digit-bearing scopes

Two consecutive commit-msg failures this session:
- `wip(...)` → rejected. Allowed types: **feat, fix, docs, style, refactor, perf, test, build, ci,
  chore, revert**. ("Track WIP" → use `feat` or `chore`.)
- `feat(people-v2)` → rejected: **scope must be kebab-case** — the regex excludes digits, so the
  `-v2` suffix fails. Use `feat(people)`.

Final accepted: `feat(people): track people-v2 design port (polish deferred)`.

---

## 3. What is completed (harness)

- Confirmed `smartout-page-polish` works as a **disk-verifier** of run records (not just a builder).
- Documented the full pre-commit → commit-msg gate behaviour seen on a real people-v2 commit.
- people-v2 commit landed clean through the gate stack with a documented `SKIP_PAGE_POLISH`.

---

## 4. What should be done (harness backlog)

| Priority | Item | Action |
|----------|------|--------|
| 🔴 P0 | Fix `emit-coverage.sh` REPO_ROOT | `../..` → `../../..`; re-verify oversikt exit 0. Breaks the L2 gate for all domains until fixed. |
| 🟡 P1 | L3 reconciliation in `emit-coverage.sh` | per skill, the script greps call sites only — it does NOT yet reconcile registered ↔ landed-in-`activity_trail` (proposal 0011). Until then manual DB-assert is the binding L3 proof. There is an untracked `scripts/l3-probe-communication.mjs` — looks like an L3-probe being built; align it with the gate. |
| 🟡 P1 | Telemetry `build` step in pre-push | registry interface edits must patch `dist/registry.d.ts` by hand today (a recurring trap). Auto-build dist on pre-push so src is the single source. |
| 🟢 P2 | Drop redundant `stash@{0}` (`cdcd0a96d`) | content verified on disk in wt-2; safe to drop. |
| 🟢 P2 | Document the cross-worktree stash trap | add to a lesson file under `docs/campaign/lessons/` so the next agent doesn't pop in the wrong worktree. |
| 🟢 P2 | Consider allowing `wip` type OR document it | commitlint friction; either add `wip` to type-enum or note "use feat/chore for WIP" in the campaign contract. |

---

## 5. What we learned (harness)

1. **Relocating a script silently breaks relative `REPO_ROOT` math.** Scripts that compute repo root
   by counting `../` levels must be re-checked whenever moved. `emit-coverage.sh` moved from 2→3
   levels deep and the gate went dark with no alarm.
2. **Shared-reflog stashes are a worktree footgun.** lint-staged's backup is global; a dangling
   `automatic backup` stash is not necessarily yours. Parent-SHA check is the disambiguator.
3. **Gates fail loud but late.** The commit fought three gates in sequence (page-polish →
   commitlint type → commitlint scope). Each only surfaced after passing the prior. Knowing the full
   stack up front (polish gate, then type-enum, then kebab-scope) saves the round-trips.
4. **A green skill run can hide a broken harness.** The polish record was honest, but the gate that
   *should* re-prove it (`emit-coverage.sh`) was itself broken. Disk-verification caught what the
   record + the gate both missed.

---

## 6. What we discussed

- "Run a record" reframed as "verify on disk + run runnable gates."
- Which gates can run in WSL2 (typecheck, greps, site-map) vs which need browser/DB (Lighthouse, L3).
- The safe recovery path for the cross-worktree stash (verify-on-disk → drop, never pop).

---

## 7. Pointers

| For | Path |
|-----|------|
| L2 telemetry gate (broken) | `docs/campaign/telemetry-map/emit-coverage.sh` |
| Page-polish skill | `.claude/skills/smartout-page-polish/SKILL.md` |
| Polish gate (pre-commit) | `.husky/pre-commit` (page-polish + design-audit sections) |
| L3 probe (untracked, in progress) | `scripts/l3-probe-communication.mjs` |
| Telemetry registry + dist | `packages/telemetry/src/registry.ts`, `packages/telemetry/dist/registry.d.ts` |
| Campaign lessons (frozen) | `docs/campaign/lessons/` |
