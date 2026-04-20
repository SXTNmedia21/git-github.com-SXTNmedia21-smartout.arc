# Start Campaign

Create a long-lived campaign worktree for an ongoing development stream
(e.g. Botsson Arena, Schedule redesign). Campaigns are persistent — they
do not live in the sortie pool and are not closed via `/close-feature`.

Features inside a campaign are declared as sub-sorties via path-aware
`/start-feature` run from inside the campaign worktree.

## Arguments

$ARGUMENTS — Campaign name (required). Example: `/start-campaign botsson-arena`

Campaign name must be lowercase kebab-case and cannot start with `wt-`
(reserved for the sortie pool).

## Steps

### Step 1: Validate Input

Feature name comes from `$ARGUMENTS`. If empty, ask:
> "What's the campaign name? (kebab-case, e.g. `botsson-arena`)"

Reject: starts with `wt-`, contains uppercase, spaces, or other non-kebab chars.

### Step 2: Confirm we are in the main repo

Campaigns must be started from the main repo checkout, not a worktree.

```bash
git rev-parse --git-common-dir
```

If the common-dir resolves to a worktree's `.git/worktrees/*`, refuse and
tell the user to `cd` to the main repo.

### Step 3: Ask for Module (optional)

Use AskUserQuestion:
- Header: "Module"
- Question: "Which module drives this campaign?"
- Options based on `docs/modules/`:
  - "Dashboard" — MODULE_01
  - "Onboarding" — MODULE_02
  - "Schedule" — MODULE_10
  - "Botsson" — MODULE_BOTSSON
  - "Agent SDK" — MODULE_AGENT_SDK
  - "Landing" — apps/landing

Include "Other" as a natural option.

### Step 4: Run the Script

```bash
~/.claude/scripts/new-campaign.sh {CAMPAIGN_NAME} {MODULE_NAME}
```

The script:
- Creates branch `campaign/{CAMPAIGN_NAME}` from `development`
- Creates worktree at `~/dev/{REPO_NAME}-{CAMPAIGN_NAME}/`
- Copies `.env.template` + `.env.local`
- Writes `docs/plans/CAMPAIGN-{CAMPAIGN_NAME}.md` (roadmap template, not feature plan)
- Inherits `docs/decisions/0000-decision-log.md` from development
- Writes a `campaign-start` event to activity-log

### Step 5: Update DASHBOARD.md (campaigns section)

Resolve `MAIN_REPO` as `git -C <campaign-worktree> rev-parse --path-format=absolute --git-common-dir | xargs dirname`.

Edit `$MAIN_REPO/docs/DASHBOARD.md`:

Add the campaign to the "Active Campaigns" section (create the section if
it does not yet exist — `/status` rebuilds it on next run anyway):

```markdown
## Active Campaigns

| Name | Branch | Module | Started | Last Sync | Ahead | Behind |
|---|---|---|---|---|---|---|
| {CAMPAIGN_NAME} | `campaign/{CAMPAIGN_NAME}` | {MODULE_NAME} | {today} | never | 0 | 0 |
```

Update the `updated:` date in frontmatter.

**Do NOT** put the campaign in "Active Worktrees" or "Free Slots" — those
are for sorties only.

### Step 6: Tell the User

```
Campaign `{CAMPAIGN_NAME}` ready!

  Branch:    campaign/{CAMPAIGN_NAME}
  Worktree:  ~/dev/{REPO_NAME}-{CAMPAIGN_NAME}
  Module:    {MODULE_NAME}

Start working:
  tmux new -s {REPO_NAME}-{CAMPAIGN_NAME} -n "camp:{CAMPAIGN_NAME}" -c ~/dev/{REPO_NAME}-{CAMPAIGN_NAME}

Files created:
  docs/plans/CAMPAIGN-{CAMPAIGN_NAME}.md

From within this worktree:
  /start-feature <name>  → creates sub-sortie (branch feat/{CAMPAIGN_NAME}-<name>)
  /sync-campaign         → merge latest development into campaign
  /close-feature         → BLOCKED at campaign root

Next: fill the campaign plan with vision, scope, milestones.
```

## Important Rules

- NEVER start a campaign from inside another worktree — only from main repo
- NEVER add the campaign to "Free Slots" — it is not part of the sortie pool
- NEVER run `/close-feature` from the campaign root — it is blocked by design
- ALWAYS run the script — never set up manually
- Campaign names must be lowercase kebab-case, cannot start with `wt-`
