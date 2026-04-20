# Start Feature

Set up a new feature worktree with spec reference, plan, and declared
user journeys. Works from the main repo (creates a sortie in wt-N) and
from inside a campaign worktree (creates a sub-sortie in
<campaign>-wt-N).

Updated 2026-04-20: journey-first flow. Every feature declares 1–5 user
journeys at start. Close-feature verifies them against `status: verified`.

## Arguments

$ARGUMENTS — Feature name (required). Example: `/start-feature dashboard-filters`

## Steps

### Step 1: Validate Input

The feature name comes from `$ARGUMENTS`. If empty, ask:
> "What's the feature name? (kebab-case, e.g. `dashboard-filters`)"

### Step 2: Detect Context (sortie vs sub-sortie)

```bash
git rev-parse --show-toplevel        # where the user ran this from
git branch --show-current            # campaign/<name> means sub-sortie
git rev-parse --git-common-dir       # main repo path
```

If current branch matches `campaign/<CAMPAIGN>`, this is a sub-sortie.
Worktrees created by `new-feature.sh` will be named
`~/dev/<REPO>-<CAMPAIGN>-wt-N` and the branch will be
`feat/<CAMPAIGN>-<FEATURE_NAME>`.

Otherwise this is a classic sortie: `~/dev/<REPO>-wt-N`, branch `feat/<FEATURE_NAME>`.

### Step 3: Find Free Worktree Number

```bash
git worktree list
```

Sortie context: scan `~/dev/<REPO>-wt-*` and pick the lowest free N in
the range documented in DASHBOARD.md (typically 1–15, plus 20).

Sub-sortie context: scan `~/dev/<REPO>-<CAMPAIGN>-wt-*` and pick the
lowest free N in the same range.

If no slot is free in the relevant pool, tell the user:
> "All worktrees for this pool are in use. Close one with `/close-feature`."

### Step 4: Ask for Spec (required)

Use AskUserQuestion:
- Header: "Spec"
- Question: "Which spec does this feature implement?"

Offer options:
- For each existing file in `<MAIN_REPO>/docs/superpowers/specs/*.md`, show as an option with its title from frontmatter.
- "Create new spec" — you will ask the user for a one-sentence summary, then write a stub.

If the user picks an existing spec, note its path for the plan file.
If the user picks "Create new spec":
1. Ask: "One-sentence summary of what this spec covers?"
2. Write stub at `<MAIN_REPO>/docs/superpowers/specs/<YYYY-MM-DD>-<FEATURE_NAME>.md` with frontmatter (title, status: draft, created, updated, module) and H1 heading. The user fills in details later.

### Step 5: Ask for Module

Use AskUserQuestion:
- Header: "Module"
- Question: "Which module does this feature belong to?"
- Options from `<MAIN_REPO>/docs/modules/` (e.g. "Dashboard — MODULE_01", "Onboarding — MODULE_02", "Schedule — MODULE_10", "Botsson — MODULE_BOTSSON", etc.).

Include "Other" as a natural option.

### Step 6: Ask for Journeys (required, 1–5)

This is the contract. A feature without declared journeys cannot proceed.

First ask:
> "How many user journeys will this feature deliver? (1–5 typical, 3 is common)"

Then for each journey, ask in sequence:
> "Journey {i}: short slug (kebab-case) + one-line description."

Example input: `admin-inviterer-ansatt — Admin sender invitasjon på e-post`

Reject journeys with: slugs not kebab-case, missing description, duplicates.

Collect into a list. Do not write files yet.

### Step 7: Run the Script

```bash
~/.claude/scripts/new-feature.sh {FEATURE_NAME} {WT_NUMBER} {MODULE_NAME}
```

The script is context-aware: if you invoke it from inside a campaign
worktree, it creates a sub-sortie automatically. If from the main repo,
it creates a classic sortie. Read the script's output to confirm the
worktree path and branch name before continuing.

Wait for the worktree to exist.

### Step 8: Write Plan + Journey Stubs (inside the worktree)

Resolve `WT_DIR` from the script's output (the line `Ready! <WT_DIR> -> <BRANCH>`).

**Plan file.** Overwrite `<WT_DIR>/docs/plans/PLAN-<FEATURE_NAME>.md`
with the full template:

```markdown
---
title: "Plan — {FEATURE_NAME}"
feature: {FEATURE_NAME}
spec: {relative path to spec from worktree root}
status: draft
updated: {today}
created: {today}
module: {MODULE_NAME}
tags: [plan]
---

# Plan — {FEATURE_NAME}

> Branch: `{BRANCH}` | Worktree: `{WT_DIR}` | Module: {MODULE_NAME}

**Spec:** [{spec title}]({relative path})

## Journeys (the contract)

{for each declared journey:}
- [JOURNEY-{FEATURE_NAME}-{slug}](../journeys/JOURNEY-{FEATURE_NAME}-{slug}.md) — {description}

## Goal

<!-- What does this feature accomplish? One sentence. -->

## Tasks

- [ ] Task 1

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for any architectural choices
- [ ] At least one E2E test exists per journey (recommended)
```

**Journey stubs.** For each declared journey, write
`<WT_DIR>/docs/journeys/JOURNEY-<FEATURE_NAME>-<slug>.md`:

```markdown
---
title: "Journey — {description heading}"
feature: {FEATURE_NAME}
journey: {slug}
status: draft
verified_at: null
e2e_test: null
created: {today}
updated: {today}
module: {MODULE_NAME}
tags: [journey]
---

# Journey: {readable title}

**Role:** <!-- admin | manager | employee | (other) -->

**Precondition:** <!-- what must be true before this flow starts -->

## Happy Path

1. User does X → System does Y → User sees Z

**Postcondition:** <!-- what is true after this flow completes -->

## Error Paths

- **Scenario:** <!-- what goes wrong --> → <!-- how the system handles -->

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter)
- [ ] Manually tested end-to-end

**Mark `status: verified` in frontmatter when all three boxes are checked.**
```

### Step 9: Commit the plan + journeys on the feature branch

```bash
cd <WT_DIR>
git add docs/plans/PLAN-<FEATURE_NAME>.md docs/journeys/JOURNEY-<FEATURE_NAME>-*.md
git commit -m "docs({FEATURE_NAME}): declare plan + journeys

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

This locks the contract into git history on the feature branch.

### Step 10: Update DASHBOARD.md

Resolve `MAIN_REPO` as `git -C <WT_DIR> rev-parse --path-format=absolute --git-common-dir | xargs dirname`.

Edit `<MAIN_REPO>/docs/DASHBOARD.md`:

- Add a row to "Active Worktrees" (sortie) or "Active Sub-Sorties" (sub-sortie). Create the Sub-Sorties section if missing.
- Remove the worktree number from the relevant "Free Slots" line (sortie pool or campaign sub pool).
- Add one row per declared journey to "Pending Journeys" with status `draft`.

Update the `updated:` date in frontmatter.

**Do NOT** add rows to any "Session History" or "Recent Closures" section — those were cut per ADR-0075.

### Step 11: Tell the User

```
Feature `{FEATURE_NAME}` ready!

  Context:   {sortie | sub-sortie of campaign:{CAMPAIGN}}
  Branch:    {BRANCH}
  Worktree:  {WT_DIR}
  Base:      {BASE_BRANCH}
  Module:    {MODULE_NAME}

Declared journeys:
  - JOURNEY-{FEATURE_NAME}-<slug-1>.md  (status: draft)
  - JOURNEY-{FEATURE_NAME}-<slug-2>.md  (status: draft)
  - ...

Start working:
  tmux new -s <session-name> -c {WT_DIR}

Next:
  1. Open each JOURNEY-*.md and fill in steps + verification
  2. Write code that satisfies each journey
  3. Flip status: draft → verified when all verification boxes are checked
  4. /close-feature when all journeys are verified

When pausing: /end-session
```

## Important Rules

- NEVER create a feature without declaring at least one journey
- NEVER skip the spec step — "Create new spec" with a stub is valid, but the link must exist
- NEVER switch HEAD in the main repo during setup — the script uses `git branch <new> <base>` without checkout
- NEVER add the sub-sortie to the sortie "Free Slots" pool — it belongs to the campaign's pool
- NEVER use the legacy `JOURNEY-<feature>.md` single-file format for new features — one file per journey with `feature:` and `status:` frontmatter
- ALWAYS commit the plan + journeys on the feature branch before handing back to the user
- Feature and journey slugs must be kebab-case (lowercase, hyphens only)
