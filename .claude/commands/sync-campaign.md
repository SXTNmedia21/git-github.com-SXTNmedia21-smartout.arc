# Sync Campaign

Merge the latest `development` into the current campaign branch. Use this
when a campaign worktree has fallen behind development and no sub-sortie
is being closed right now (close-feature auto-syncs as part of closure).

## Arguments

None. Operates on the current campaign worktree.

## Steps

### Step 1: Verify Context

```bash
git rev-parse --show-toplevel
git branch --show-current
```

- The branch must match `campaign/*`.
- The worktree must be clean (no uncommitted changes).

If either check fails, stop and tell the user why. Do not try to guess.

### Step 2: Run the Script

```bash
~/.claude/scripts/sync-campaign.sh
```

The script:
- Fetches `origin`
- Pulls `campaign/<name>` (fast-forward only)
- Merges `origin/development` into the campaign branch
- Pushes the campaign
- Appends a row to the Sync Log in `docs/plans/CAMPAIGN-<name>.md`
- Writes a `campaign-sync` event to activity-log

If a merge conflict appears, the script stops and tells the user how to
finish manually. Do not try to resolve conflicts automatically.

### Step 3: Tell the User

If the script exited cleanly, report the number of commits merged and
mention that the Sync Log was updated. If it exited with a conflict,
pass the script's resolution instructions through unchanged.

## Important Rules

- NEVER run `/sync-campaign` outside a campaign worktree
- NEVER auto-resolve merge conflicts — hand control to the user
- Sync direction is always `development → campaign`, never the reverse
