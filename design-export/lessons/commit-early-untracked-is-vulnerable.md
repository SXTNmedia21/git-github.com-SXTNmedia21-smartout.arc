---
topic: commit-early-untracked-is-vulnerable
status: active
updated: 2026-06-01T00:29:54Z
created: 2026-05-31T23:55:00Z
supersedes:
metadata:
  type: feedback
---

# Decision lesson — commit-early-untracked-is-vulnerable

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

**Uncommitted work is the single point of data loss in a multi-instance / heartbeat-loop
setup. Commit early, commit often — untracked = vulnerable, committed = protected.**

The failure mode (observed twice in one session, 2026-05-31): a worktree runs with a
heartbeat loop / cleanup hook (or a second agent instance) that periodically does
`git clean -fd` / `git reset --hard` to "tidy" the tree. Git only protects **committed**
files. Everything new and uncommitted — ported pages, vendored design source, docs, an
edited registry.ts (+1626 lines, 121 events) — is treated as garbage and wiped without warning.
Reflog fingerprint: repeated `reset: moving to HEAD`.

Rules that follow:

1. **After any non-trivial unit of work lands on disk, commit it** (to a feature/refactor
   branch — never main/preview). A WIP commit is cheap; re-doing wiped work is not.
2. **Never leave a session's deliverable untracked across a turn boundary** when a
   heartbeat/clean loop is active in the same worktree. The turn gap is exactly when the loop fires.
3. **Husky `lint-staged` auto-stash (`stash@{0}`) is the accidental safety net, not the plan.**
   It saved this session twice — by luck, not design. Do not rely on it. Recovery anchors
   (`stash@{0}`, dangling commits via `git fsck`/`reflog`) exist, but the real fix is: don't
   let work be untracked in the first place.
4. **Before any `git clean`/`reset --hand` in a shared worktree, STOP** — inventory untracked
   files first (`git status --short`), confirm none is unsaved deliverable, and prefer
   committing over cleaning. A clean that wipes a peer instance's work is the multi-instance
   cross-contamination hazard (relates to verifying physical worktree before parallel dispatch).
5. **Two instances in one worktree = collision risk** (this session: ui-builder + worklist +
   .sxtn config clobbered, then clean wiped untracked). Either give each instance its own
   worktree, or serialize writes + commit between hand-offs.
6. **Snapshot is the net; commit is the fix — they are NOT the same.** A heartbeat
   auto-snapshot (`git stash create` + `tag autosnap/<ts>` every N beats, zero working-tree
   mutation) is insurance: a ref that survives `reset --hard`. But a brand-new untracked file
   created between two beats is in the gap and uncovered. A **commit** survives BOTH
   `reset --hard` AND `clean -fd` and needs no net at all. Build the snapshot trigger for the
   class-of-problem, but still commit per unit for the real durability. Belt AND braces.
7. **Ownership:** the auto-snapshot heartbeat trigger is the **harness-builder's** lane
   (loop/heartbeat/triggers/walls), not the foreman's. Foreman commits its own deliverables;
   harness-builder arms the standing net. Do not cross these (see [[discovery-output-and-foreman-role]] pt 3).

## Why

Pontus, 2026-05-31, after the second loss: "hur kan det bara försvinna? Vad är det som händer?"
— things kept vanishing because the coordinating session left every deliverable untracked while
a heartbeat loop and a second harness instance shared the worktree; a `git clean`/`reset` (reflog:
`reset: moving to HEAD` ×3) treated all of it as junk. Recovery worked both times only because
husky's pre-commit stash happened to capture it. The durable fix is not better recovery — it is
committing work so it physically cannot be cleaned. "Rie en etta" (nail down the foundation) =
commit the foundation so it stops disappearing. Relates to [[do-the-thing-not-machinery-about-it]]
(losing real work to machinery churn) and [[discovery-output-and-foreman-role]] (two-instance
ownership boundaries).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T23:55:00Z — initial: uncommitted work is the single point of data loss under a heartbeat/clean loop or two instances sharing a worktree; commit early to a feature branch; husky auto-stash is luck not a plan; never `git clean`/`reset --hard` a shared worktree without inventorying untracked deliverables first. Observed twice 2026-05-31 (people-v2 + design source + registry.ts all wiped, recovered from stash@{0}/dangling 1c7b1282c).
- 2026-06-01T00:40:00Z — caveat to "commit early": husky pre-commit can BLOCK the very commit meant to secure recovered work. This repo's hook has 11 gates (secret-scan, ADR-dupe, branch-guard, page-polish, nordic-token-drift, `pnpm check:identity-on-profile` ADR-0396). A mass WIP commit of recovered files can trip a gate unrelated to the recovery → exit 1, tree stays dirty, work still at-risk. Fix: diagnose the SPECIFIC failing gate and resolve its real cause; NEVER `--no-verify` (CLAUDE.md hard rule). The auto-snapshot net is what protects the work WHILE you debug the gate — that's exactly why the net exists alongside commit. (Mis-read warning: don't assume the failure is a typo in the hook; read the actual failing step.)
- 2026-06-01T00:10:00Z — added pts 6+7: snapshot (heartbeat `git stash create`+`tag autosnap/<ts>`) is the NET — survives reset but leaves a between-beats gap for new untracked files; COMMIT is the FIX — survives reset+clean, no gap. Build both (belt+braces). Auto-snapshot trigger = harness-builder's lane, not foreman's. Pontus took a 4th anchor this session: 92M bundle + tags in ~/sxtn-safety-<ts>/ (F0.1 now safe in stash@{0} + dangling 1c7b1282c + bundle + tag).
- 2026-06-01T00:29:54Z — confirmed recurrence (3rd this campaign): the read-first playbook `docs/IMPLEMENTATION-HARNESS.md` ITSELF is gone — exists nowhere on disk, zero git history, only the two `[[implementation-harness-doc]]` lessons still point at it. Classic untracked-wipe casualty: the one doc whose job is "resume not restart" was never committed, so a reset/clean ate it and the next session restarts blind. Sharpest proof of the rule: even the meta-doc about not-losing-work was lost to not-committing-work. Fix = reconstruct from the 11 linked atomic lessons + current verified state, then commit IMMEDIATELY to refactor/smartout (do not leave the rebuilt doc untracked across a turn).
