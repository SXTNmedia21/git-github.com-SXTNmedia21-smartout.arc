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

### Step 2: Run the Enforced Wrapper (ADR-0265)

```bash
op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh
```

The repo-canonical wrapper at `infra/scripts/promote-preview.sh` runs three
stages. Stage 1 calls `~/.claude/scripts/promote-preview.sh` (the
foundational 4-gate FF executor); stages 2–3 are Smartout-specific
post-promote enforcement.

**Stage 1 — foundational gates (4):**

1. Local `development` is in sync with `origin/development` (fast-forwards if behind; aborts on divergence).
2. All GitHub Actions runs on the current `development` SHA are `completed` with `conclusion: success`.
3. Every linked Vercel project (under `apps/*/.vercel/project.json`) has a `READY` deployment for the exact `development` SHA. Any other state — `BUILDING`, `QUEUED`, `CANCELED`, `ERROR` — blocks.
4. `preview` is an ancestor of `development` (fast-forward is possible).

If all four pass, FF + push happens. Husky pre-push re-runs lint + typecheck.

**Stage 2 — smoke probe:**

5. `infra/scripts/smoke-probe.sh preview` must come back green
   (Vercel web, Vercel landing, Supabase REST, Edge Functions reachable).
   Smoke red = exits 1, no tag created.

**Stage 3 — last-known-good tag:**

6. The promoted SHA is tagged `lkg-preview-<sha>` and the tag is pushed.
   This is the rollback target referenced in the preview→main PR template.

The wrapper writes `promote-preview` events to activity-log at each stage.

### Step 3: Report

Report the commit delivered, smoke result, and `lkg-preview-<sha>` tag. The
wrapper prints a final summary; relay it unchanged.

## Important Rules

- NEVER run promote-preview without explicit user confirmation
- NEVER bypass the CI, Vercel, or smoke gate (`--force`, `-n`, etc.) — if any is red, fix it first
- NEVER push to `main` — this script does not and must not
- If any gate fails, stop and surface the reason; do not try to "unstick" it
- ALWAYS run the repo wrapper (`./infra/scripts/promote-preview.sh`), not the global script directly — the wrapper enforces post-promote stages 2–3
- The wrapper requires `gh`, `gh auth login`, `jq`, `VERCEL_TOKEN`, and the smoke-probe surfaces. Surface any missing requirement
- Run via 1Password so the Vercel token is injected at runtime: `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh`
