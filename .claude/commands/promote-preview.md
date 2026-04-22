# Promote Preview

Fast-forward `preview` to the current `development`, after verifying that
GitHub Actions on development is fully green. Gated by husky pre-push
(lint + typecheck + FF-ancestry check).

Only Pontus runs this. Claude should invoke it only on explicit request.

## Arguments

None.

## Steps

### Step 1: Confirm the User Wants This

Before running anything, confirm with the user. Promotion is not reversible
in the cheap sense — it triggers a preview deploy on Vercel and a preview
database migration on Supabase (ADR-0071).

Ask:
> "Confirm promote development → preview? This will trigger preview deploy + Supabase Branch DB migration."

Proceed only on explicit yes.

### Step 2: Run the Script

```bash
~/.claude/scripts/promote-preview.sh
```

The script verifies four gates in order, and aborts on the first failure:

1. Local `development` is in sync with `origin/development` (fast-forwards if behind; aborts on divergence).
2. All GitHub Actions runs on the current `development` SHA are `completed` with `conclusion: success`.
3. Every linked Vercel project (under `apps/*/.vercel/project.json`) has a `READY` deployment for the exact `development` SHA. Any other state — `BUILDING`, `QUEUED`, `CANCELED`, `ERROR` — blocks.
4. `preview` is an ancestor of `development` (fast-forward is possible).

If all gates pass, the script:
- Checks out `preview`
- Fast-forwards to `development`
- Pushes `preview` (husky pre-push re-runs lint + typecheck)
- Returns the main repo to `development`
- Writes a `promote-preview` event to activity-log

### Step 3: Report

Report the commit delivered and what the user should do next. The script
prints a summary; relay it unchanged.

## Important Rules

- NEVER run promote-preview without explicit user confirmation
- NEVER bypass the CI or Vercel gate (`--force`, `-n`, etc.) — if either is red, fix it first
- NEVER push to `main` — this script does not and must not
- If any gate fails, stop and surface the reason; do not try to "unstick" it
- The script requires `gh`, `gh auth login`, `jq`, and `VERCEL_TOKEN` in env — surface any missing requirement
- Run via 1Password so the Vercel token is injected at runtime: `op run --env-file=.env.template -- ~/.claude/scripts/promote-preview.sh`
