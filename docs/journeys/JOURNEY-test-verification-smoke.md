---
title: "Journey — smoke verification of sub-sortie flow"
feature: test-verification
journey: smoke
status: verified
verified_at: 2026-04-20
e2e_test: null
created: 2026-04-20
updated: 2026-04-20
module: MODULE_BOTSSON
tags: [journey, test]
---

# Journey: smoke verification of sub-sortie flow

**Role:** developer (Pontus)

**Precondition:** campaign/botsson-arena exists as a worktree; new-feature.sh was invoked from inside it.

## Happy Path

1. Developer runs `/start-feature test-verification` from campaign worktree → System detects campaign context via `git branch --show-current` matching `campaign/*` → Developer sees sub-sortie worktree created at `smartout.ai-botsson-arena-wt-1` with branch `feat/botsson-arena-test-verification`.
2. Developer writes this journey file and marks `status: verified` → System will accept it at close-feature gate.
3. Developer runs `/close-feature` → System merges feat to campaign, syncs development into campaign, removes sub-worktree.

**Postcondition:** sub-worktree gone; campaign/botsson-arena contains the feat merge commit plus development sync commit.

## Error Paths

- **No journey declared:** close-feature Journey Guardian blocks with exit 1.
- **Journey still draft:** close-feature blocks with "must be verified" error.
- **Campaign worktree dirty during close:** close-feature blocks with "commit or stash" error.

## Verification

- [x] Implementation matches the steps above (observed live, 2026-04-20)
- [ ] E2E test exists (this IS the E2E test — no separate Playwright spec needed)
- [x] Manually tested end-to-end by Pontus on 2026-04-20
