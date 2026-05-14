---
title: "Conventional-commit type `sync` invalid — emit `chore(<scope>): sync ...`"
id: LEARNING_0262
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
tags: [git, commitlint, conventional-commits, close-feature, sync-campaign, script]
---

# Learning-0262: Conventional-commit type `sync` invalid — emit `chore(<scope>): sync ...`

## Context

`close-feature.sh` and `sync-campaign.sh` emitted merge commits with message:

```
sync(${CAMPAIGN_NAME}): development into campaign
```

commitlint (`@commitlint/config-conventional`) rejects `sync` — it is not in the `type-enum` allowlist (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`). The commit-msg hook fires on every merge commit, blocking the closure.

At least 6 commits in git log confirm the broken pattern was emitted historically — all failed commitlint but were allowed through because the merge path bypassed the hook (merge commits on local branch before push). The pre-push hook then caught the malformed message on push, surfacing the error only at the end of the close-feature pipeline.

## Discovery

The canonical form for operational sync operations is `chore(<scope>): <verb> ...`. Pontus had already hand-typed `chore(campaign): sync development into campaign` at least 5 times as a manual fix — the script never adopted the correction until this Council.

The correct message is:
```
chore(${CAMPAIGN_NAME}): sync development into campaign
```

## Impact

Fixed in all 4 script sites (2026-05-14):
- `~/.claude/scripts/close-feature.sh` line 339
- `~/.claude/scripts/sync-campaign.sh` line 76
- `.claude/scripts/close-feature.sh` line 319 (project-local)
- `.claude/scripts/sync-campaign.sh` line 69 (project-local)

Any future script emitting a merge commit must use a type from the commitlint allowlist. `sync` is not a valid type. Use `chore` for operational/maintenance operations, `feat` for feature merges, `fix` for hotfix merges.

## References

- `@commitlint/config-conventional` type-enum
- close-feature.sh + sync-campaign.sh (4 sites, corrected 2026-05-14)
- Council 2026-05-14 — close-feature pipeline traps, Change A verdict
- L-0263 (project-local script copies drift from global)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
