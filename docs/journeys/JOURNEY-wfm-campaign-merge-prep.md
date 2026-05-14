---
title: Journey — WFM Campaign Merge Prep
status: verified
updated: 2026-05-14
created: 2026-05-14
feature: wfm-campaign-merge-prep
module: governance
tags: [journey, governance, campaign, learning-renumber, l-0209]
---

# Journey — WFM Campaign Merge Prep

Sub-sortie: `feat/world-best-wfm-wfm-campaign-merge-prep`
Campaign: `campaign/world-best-wfm`
Closes: PHASE 4 verifier P0-1 (L-0252..L-0255 ID collision with development)

## Journey: Steward Resolves Learning ID Collision

**Precondition:** PHASE 4 verifier (system-steward opus) reports campaign + development both authored learning IDs L-0252..L-0255 same-day with different content (7th L-0209 occurrence).

1. Steward identifies collision via `git log --all` learning-number scan → System detects 4 colliding IDs → Reports each campaign-side title vs dev-side title for unambiguous mapping
2. Steward picks renumber target STRICTLY above dev tip L-0263 (= L-0264..L-0267) → System updates 4 log rows + frontmatter + cross-refs in 9 files → Steward verifies no broken references
3. Steward commits via `chore(<scope>):` form (post-council script v8) → Husky pre-commit + commitlint pass → Branch ready for close-feature

**Postcondition:** Campaign tip references L-0264..L-0267 only. Development L-0252..L-0263 retained. Eventual `campaign → development` PR merges additively without ID collision.

**Error paths:**
- Sed-replace bulk-rename trap (per L-0209 hard rule) → use surgical Edit per file, NOT global sed
- Missing physical learning files (G3 entries are log-only) → skip `git mv`, edit log rows only
- Pre-commit hook ENOENT on prettier (fresh worktree) → run `pnpm install` from worktree root, retry

## Verification

- Commit `705fcb241` on `feat/world-best-wfm-wfm-campaign-merge-prep` lands all 4 renumbers + 9-file cross-ref updates
- `grep -rn "L-025[2-5]" docs/` returns 0 hits on campaign tip post-fix (only L-0252..L-0255 references that survive are if any are intentional dev-side ones — verify at merge)
- `docs/learnings/0000-learning-log.md` row pattern: 4 rows now read `| 264 |`, `| 265 |`, `| 266 |`, `| 267 |` matching campaign content
