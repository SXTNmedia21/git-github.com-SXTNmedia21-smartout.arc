---
topic: stale-branch-refac-vs-refactor
status: active
updated: 2026-06-01T02:20:00Z
created: 2026-06-01T01:14:22Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — stale-branch-refac-vs-refactor

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The canonical working branch for the redesign-wiring campaign is
**`refactor/smartout`** (tip `e1b4b0151`, tracked by `origin/refactor/smartout`).
The earlier-named **`refac/smartout`** (tip `cb5f999ad`) is a **stale leftover** from
a branch rename — it is a **strict subset** of `refactor/smartout`
(`refac..refactor` = only the F0.1 registry commit; `refactor..refac` = empty).
It holds **zero orphaned commits** and is safe to delete once Pontus confirms.
Do NOT do redesign work on `refac/smartout`; always verify
`git branch --show-current` = `refactor/smartout` before staging.

The F0.1 registry (121 design-mutation events, 17786-line
`packages/telemetry/src/registry.ts`) is **on-branch and secured** as its own commit
**`e1b4b0151`**, a proper ancestor of the current tip. The chain is clean and linear:
`cb5f999ad` ← `e1b4b0151` (registry) ← `d3917c48b` (slice-1 `chore(sxtn)`).
`git merge-base --is-ancestor e1b4b0151 HEAD` returns YES. Rescue tag
`rescue/registry-e1b4b0151` exists as redundant belt-and-suspenders.

**Verification discipline (learned the hard way):** do NOT trust ANY value — commit
hash, file count, line count — read back from a laggy/duplicated shell buffer. This
shell lags and echoes stale/garbled output repeatedly this campaign, and it has caused
two distinct misreads:

1. A phantom hash `b0e6f5cf6` (which `git` reported `fatal: unknown revision`) was
   misread from garbled output and briefly fed a false "registry dropped from branch /
   index-fold" narrative into this lesson. Truth, confirmed by reflog
   (`HEAD@{0}: commit … d3917c48b`, `HEAD@{1}: … e1b4b0151`) and `merge-base
--is-ancestor`, is a clean linear chain.
2. The frozen design source was reported as "257 files" while the real staged count
   was **898** (`git diff --cached --name-only | wc -l`). The bundle committed in full
   (`a71509e3f`); only the spoken count was wrong.

Rule: any number or identifier that gates a decision or goes into a lesson/commit MUST
be re-derived from a single authoritative command immediately before use — hash from
`git log -1 --format=%h`/reflog, counts from `… | wc -l`, lineage from `merge-base
--is-ancestor` — and only then written. A wrong lesson is worse than none. When the
shell echoes duplicated/garbled blocks, re-run into a `/tmp` file and `Read` it rather
than trusting inline output.

## Why

Session-start env snapshot reported branch `refac/smartout`; the live repo was on
`refactor/smartout` (reflog `HEAD@{9}: checkout: moving from refac/smartout to
refactor/smartout`). The two near-identical names caused a momentary false alarm
that the registry win was dangling. Verification (`git branch --contains e1b4b0151`,
`git log refac..refactor`) proved refactor is canonical and refac is a contained
subset. Recording this prevents re-investigating the same divergence and prevents
accidental work on the stale branch. See [[commit-early-untracked-is-vulnerable]] and
[[env-snapshot-divergence-worktree]].

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-06-01T01:14:22Z — initial: `refac/smartout` (cb5f999ad) is stale subset of canonical `refactor/smartout` (e1b4b0151); zero orphaned commits, safe to delete after Pontus confirm; F0.1 registry commit verified on-branch (HEAD), not dangling; rescue tag `rescue/registry-e1b4b0151` added.
- 2026-06-01T01:32:00Z — corrected (LATER FOUND WRONG): claimed a soft-reset folded registry into a commit `b0e6f5cf6` via persisted index. This was based on a phantom hash misread from garbled shell output.
- 2026-06-01T01:40:00Z — re-corrected (authoritative): `b0e6f5cf6` never existed (`git: unknown revision`). Real slice-1 commit = `d3917c48b`, parent `e1b4b0151` (registry), parent `cb5f999ad`. Chain is clean/linear; `merge-base --is-ancestor e1b4b0151 HEAD` = YES; slice-1 is pure `.sxtn/` (11 files). No index-fold happened. Added verification-discipline rule: never write a hash read from a laggy/duplicated shell buffer — confirm from reflog/`git log -1` first; a wrong lesson is worse than none.
- 2026-06-01T02:20:00Z — generalized the verify-discipline rule from "hash" to ANY value after a second misread: design source spoken as "257 files" but real staged count was 898 (`… | wc -l`); bundle committed in full (`a71509e3f`), only the count was wrong. Rule now: re-derive any decision-gating number/identifier from one authoritative command immediately before use (hash via `git log -1`, counts via `wc -l`, lineage via `merge-base --is-ancestor`); when shell echoes garbled blocks, write to `/tmp` and `Read` it instead of trusting inline output.
