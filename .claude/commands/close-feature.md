# Close Feature

Verify all declared journeys, complete remaining deliverables, then hand
off to `close-feature.sh` which merges the branch and cleans up the
worktree.

Updated 2026-04-20: Journey Guardian gate. Every journey declared at
`/start-feature` must have `status: verified` in frontmatter before the
script will merge. Claude does NOT invent journeys at closure — the
contract was set at start, the closure verifies.

## Arguments

$ARGUMENTS — Optional worktree number. Usually omitted; the script uses
the worktree you are CWD in.

## Step 0: Detect Context

```bash
pwd
git branch --show-current
git worktree list
```

Determine:
- **BRANCH**: current branch (must be `feat/*`, not `campaign/*`)
- **CAMPAIGN**: if the worktree path matches `<repo>-<X>-wt-N` and a
  `<repo>-<X>` campaign worktree exists, this is a sub-sortie of
  campaign `<X>`. The branch will be `feat/<X>-<rest>`.
- **FEATURE_NAME**: for sortie, `BRANCH` without `feat/`. For sub-sortie,
  `BRANCH` with the `feat/<CAMPAIGN>-` prefix stripped.
- **WT_NUMBER**: from the path (e.g. `.../smartout.ai-wt-2` → `2`).

If on `campaign/*`, STOP and tell the user:
> "Campaigns are long-lived and not closed via `/close-feature`. Sync with `/sync-campaign` instead."

If on anything other than `feat/*`, STOP.

## Step 1: Verify Declared Journeys

This is the Journey Guardian check. The contract was set at
`/start-feature`; closure verifies it.

```bash
JOURNEY_FILES=$(grep -l "^feature: ${FEATURE_NAME}$" docs/journeys/JOURNEY-*.md 2>/dev/null || true)
```

Expected outcome:
- At least one journey file exists for this feature.
- Every file has `status: verified` in its frontmatter.

If `JOURNEY_FILES` is empty AND no legacy `JOURNEY-<FEATURE_NAME>.md` exists:
> STOP and tell the user: "No journeys declared for this feature. Either the feature was not started via the new `/start-feature` flow, or the journey files are missing. Restart via `/start-feature` or create journeys manually with frontmatter `feature: {FEATURE_NAME}` and `status: draft`."

If some journeys have `status: draft` or another non-verified state:
1. List each unverified journey file and its current status.
2. Open each one and verify against the code that was written.
3. For each journey, confirm with the user:
   - Implementation matches the steps documented
   - E2E test exists (or is explicitly accepted as debt)
   - Manual verification done
4. Only when all three boxes are honestly checked: flip `status:` to `verified` and fill `verified_at:` with today's date.
5. Commit the status flip: `docs({FEATURE_NAME}): verify journey <slug>`.

**Do NOT** mass-flip statuses without actually verifying each journey.
**Do NOT** invent journey content at closure — the contract was declared at start.

## Step 2: Audit Other Deliverables

### 2a. Decision log
- Check `docs/decisions/0000-decision-log.md` exists
- Review git log: `git log <BASE_BRANCH>..HEAD --oneline` (BASE_BRANCH = development for sortie, campaign/<X> for sub-sortie)
- Any architectural choices that need an ADR?

### 2b. YAML frontmatter (branch-scoped)
- Scan docs changed in this branch: `git diff <BASE_BRANCH>..HEAD --name-only -- 'docs/' | grep '\.md$'`
- Add missing frontmatter to changed files only — never touch docs from other branches.

### 2c. Typecheck
- Run `pnpm turbo typecheck`
- If it fails, fix the type errors. Do not skip.

## Step 3: Fix Everything Missing

Work through missing items from Step 2. For each:
1. Fix it
2. Commit with conventional commit format: `docs({FEATURE_NAME}): ...` or `fix({FEATURE_NAME}): ...`
3. Move to the next item

## Step 4: Write Handoff

Create `docs/HANDOFF-{FEATURE_NAME}.md` in the worktree. Handoff merges
with the branch and serves as the single artifact that explains what
was done.

```markdown
---
title: "Handoff — {FEATURE_NAME}"
feature: {FEATURE_NAME}
branch: {BRANCH}
closed: {today}
module: {MODULE_NAME}
---

# Handoff — {FEATURE_NAME}

## Summary
{2–3 sentences: what was built, why, current state}

## Journeys Delivered
| Journey | Status | E2E test |
|---------|--------|----------|
| <slug-1> | verified | <path or "none"> |
| <slug-2> | verified | <path or "none"> |

## Decisions Made
| Decision | Reason | Impact |
|----------|--------|--------|
| {what} | {why} | {what it affects} |

Register each decision in `docs/decisions/0000-decision-log.md`.

## Learnings
| Learning | Context |
|----------|---------|
| {discovery} | {why it matters for future work} |

## Known Issues / Debt
- {rough edges}

## Next Steps
- {what should happen after this merges}
```

Fill the handoff from:
- The verified journey files (status table)
- Git log: `git log <BASE_BRANCH>..HEAD --oneline`
- Your session knowledge

Commit: `docs({FEATURE_NAME}): handoff for ${BASE_BRANCH}`.

## Step 5: Update DASHBOARD.md

Resolve `MAIN_REPO` from the worktree's git-common-dir. Edit
`<MAIN_REPO>/docs/DASHBOARD.md`:

1. Remove the row for this worktree from "Active Worktrees" (sortie) or "Active Sub-Sorties" (sub-sortie).
2. Add the worktree number back to the relevant "Free Slots" line.
3. Remove this feature's journeys from "Pending Journeys" — they are done.
4. Update `updated:` in frontmatter.

**Do NOT** write to "Recent Closures" or "Session History" — those are gone (ADR-0075).

## Step 6: Run the Closure Script

```bash
~/.claude/scripts/close-feature.sh
```

(No `<wt-number>` needed when you are in the worktree you want to close.)

The script will:
- Re-run all gates: decision log, Journey Guardian, frontmatter, typecheck
- Commit any uncommitted changes with a closure commit
- Merge the branch:
  - Sortie: `feat/<name>` → `development` → push development
  - Sub-sortie: `feat/<camp>-<name>` → `campaign/<camp>` → sync `development` → `campaign/<camp>` → push campaign
- Remove the worktree and delete the branch
- Write a `feature-closed` or `sub-sortie-closed` event to activity-log

## Step 7: Final Verification

After the script exits cleanly, confirm:

```
✅ Journeys verified — {N} journeys with status: verified
✅ Decision log — exists, reviewed
✅ YAML frontmatter — all branch-changed docs have it
✅ Typecheck — passes
✅ Handoff — docs/HANDOFF-{FEATURE_NAME}.md written
✅ Merge — {BRANCH} → {BASE_BRANCH} complete
✅ Worktree + branch cleaned up
```

If any step failed, surface it — do not pretend everything is fine.

## Important Rules

- NEVER verify a journey without actually checking the implementation. Flipping `draft → verified` is a claim, not a formality.
- NEVER invent new journeys at closure — the contract was set at `/start-feature`
- NEVER skip Journey Guardian — it is the reason features ship correctly
- NEVER merge to development yourself — the script does that
- NEVER run close-feature on a `campaign/*` branch — campaigns do not close
- If typecheck fails, fix it. Never `--no-verify`.
- All commits use conventional format
