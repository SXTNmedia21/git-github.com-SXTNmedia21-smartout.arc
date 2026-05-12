---
title: "Runbook — Bubble Production Cutover Rollback Procedures"
status: draft
updated: 2026-05-08
created: 2026-05-08
module: bubble-migration
tags: [cutover, rollback, runbook, bubble-migration, pitr, auth-bridge]
---

# Runbook — Bubble Production Cutover Rollback Procedures

> **Scope:** Three discrete rollback scenarios for the Bubble → Smartout v3 production data cutover.
> This runbook is operational reference, not a substitute for the full cutover plan.
> All scenarios assume the production Supabase project `yljaglomadbhyqpcigff`.
> Secrets are accessed via 1Password (`op://`) — never inline values.

---

## Prerequisites — Always Check Before Any Rollback

Before executing any scenario, confirm the following:

```bash
# 1. Confirm which Supabase project you are targeting
supabase projects list

# 2. Confirm you are NOT logged into Local by mistake
echo $SUPABASE_PROJECT_REF
# Expected: yljaglomadbhyqpcigff  (PROD)
# If empty or local: STOP — set the env var before continuing

# 3. Confirm active git branch is NOT main / preview
git branch --show-current
# Expected: development or a feat/* branch
# NEVER run rollback scripts from a state that could trigger preview → main promotion

# 4. Load prod service-role key via 1Password
export SUPABASE_SERVICE_ROLE_KEY=$(op read "op://smartout_ai_prod/supabase/service-role-key")
export SUPABASE_PROJECT_REF=yljaglomadbhyqpcigff
export SUPABASE_DB_URL=$(op read "op://smartout_ai_prod/supabase/db-url")
```

---

## Scenario R1 — Cloud Dry-Run Failure Mid-Apply (Track E Gate Fail)

### When to Invoke

- You are applying the migration bundle to an **ephemeral Supabase branch database** (Track E dry-run, not the production project).
- The apply fails at any point — constraint violation, FK error, enum mismatch, or a TypeScript gate check failure.
- There is **zero production impact** because this is an ephemeral branch.
- Invoke immediately on any non-zero exit from `psql` or the migration apply script.

### Trigger Conditions

- `psql` exits non-zero during dry-run apply.
- Any SQL error surfaced in the apply log (look for `ERROR:` lines).
- A post-apply row-count check returns 0 where > 0 is expected.
- `pnpm turbo typecheck` fails after apply (TS errors surfaced by schema change).

### Pre-Rollback Checks

```bash
# 1. Confirm this is an ephemeral branch, NOT the parent project
supabase branches list --project-ref yljaglomadbhyqpcigff
# Record the branch ID from the output, e.g. "abc123"

# 2. Confirm no DNS change has been made (no production impact possible)
# Track E dry-run by definition precedes DNS cutover — verify with team lead

# 3. Save the apply log for post-mortem
# The log should already be captured in your terminal session
```

### Step-by-Step Recovery

**Step 1 — Delete the ephemeral branch.**

```bash
BRANCH_ID="<branch-id-from-above>"

supabase branches delete "$BRANCH_ID" \
  --project-ref yljaglomadbhyqpcigff
# Confirm the deletion prompt with 'y'
```

**Step 2 — Verify deletion.**

```bash
supabase branches list --project-ref yljaglomadbhyqpcigff
# Expected: branch ID is no longer listed
```

**Step 3 — Capture failure details before re-attempting.**

```bash
# Save the apply log with timestamp for post-mortem
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
# Copy terminal output to: docs/missions/bubble-migration/apply-failure-${TIMESTAMP}.log
# (do NOT commit bundled.sql files — they are .gitignored generated artifacts per ADR-0267)
```

**Step 4 — Diagnose the root failure.**

Cross-reference against the known schema bug list in `HANDOFF-bubble-migration.md §BM-05`. Most failures at this stage are one of the 8 documented schema bugs (invalid enums, NULL coalescing, missing columns). If the failure is a new pattern, open a research log entry via `/research-log` before re-running.

**Step 5 — Re-create a fresh branch and re-run.**

```bash
# Create a new ephemeral branch
supabase branches create \
  --project-ref yljaglomadbhyqpcigff \
  --name "bubble-cutover-dryrun-$(date +%Y%m%d)"
```

### Verification Steps (Post-Recovery)

- `supabase branches list` shows the old failed branch is gone.
- No errors in the project dashboard under "Database" for `yljaglomadbhyqpcigff`.
- Parent project `yljaglomadbhyqpcigff` database is untouched (any `psql` query against the parent returns the pre-cutover row counts).

### If This Step Fails — Escalation

- Branch deletion fails: Open Supabase dashboard → Project `yljaglomadbhyqpcigff` → Branches → manually delete via UI.
- Dashboard deletion also fails: Contact Supabase support with branch ID. This is a platform issue, not a data issue.

### Time Estimate

**5–10 minutes.** Deletion is near-instant. Diagnosis and re-emit may take 30–60 minutes depending on the root cause.

---

## Scenario R2 — Production Cutover Failure Mid-Apply (Track F Gate Fail, BEFORE DNS / Before Auth-Bridge Phase B)

### When to Invoke

- You are applying the migration bundle to the **production project** `yljaglomadbhyqpcigff`.
- The apply fails after `BEGIN;` but before `COMMIT;` (or after a partial `COMMIT;` on a non-transactional step).
- **DNS has NOT been switched** and **auth-bridge Phase B has NOT sent any recovery emails**.
- Invoke immediately on any apply error that cannot be forward-fixed within the maintenance window.

### Trigger Conditions

- Non-zero exit from `psql` on any Track F apply step.
- A mandatory gate check (row count, FK integrity, provenance shape check) returns failure.
- Apply takes longer than the agreed maintenance window and must be aborted.
- An operator observes corrupt state (duplicate rows, broken workspace references) in the production database.

### Pre-Rollback Checks

**Check 1 — Confirm PITR window covers the cutover slot.**

```bash
# Supabase PITR retention is typically 7 days on Pro plan.
# Open: https://supabase.com/dashboard/project/yljaglomadbhyqpcigff/settings/addons
# Confirm "Point in Time Recovery" is enabled and the retention window is shown.

# To verify the earliest available restore point via CLI:
supabase --project-ref yljaglomadbhyqpcigff db remote commit
# The dashboard "Backups" tab shows the precise available restore window.
# Expected: restore window start < your cutover slot start time (UTC)
```

If the PITR window does NOT cover the cutover slot start:

> TODO — needs council input: What is the fallback if PITR window is shorter than expected (e.g. plan was downgraded since last check)? Supabase support ticket + manual row-delete script are the two options; council needs to decide the SLA for this edge case.

**Check 2 — Record the exact cutover slot start timestamp (UTC).**

Before starting any apply, record this value in your terminal session:

```bash
CUTOVER_SLOT_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Cutover slot start: $CUTOVER_SLOT_START"
# Save this to your session notes — you will need it for the PITR restore target
```

**Check 3 — Confirm auth-bridge Phase B has NOT run.**

```bash
# Query production to check for any migrated auth.users entries
# (auth-bridge Phase B creates auth.users with user_metadata.migrated_from_bubble=true)
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*)
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START';
"
# Expected: 0
# If count > 0: STOP — this is Scenario R3, not R2. Follow R3 procedure.
```

### Step-by-Step Recovery

**Step 1 — Abort any in-flight transaction immediately.**

If `psql` is still connected:

```bash
# In the psql session, issue:
ROLLBACK;
\q
```

If the session has already been terminated or timed out, Postgres will have auto-rolled back open transactions. Verify:

```bash
psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction';"
# Expected: 0
```

**Step 2 — Freeze Bubble (prevent new writes during restore window).**

Per your pre-cutover maintenance window agreement, Bubble should already be in read-only / maintenance mode. Verify:

- Open Bubble editor → `Settings → General → Maintenance Mode` (or equivalent).
- Confirm no new writes are flowing to Bubble's production data.

Do NOT unfreeze Bubble until the PITR restore is confirmed clean.

**Step 3 — Initiate PITR restore via Supabase dashboard.**

```
URL: https://supabase.com/dashboard/project/yljaglomadbhyqpcigff/database/backups/pitr
```

1. Select the restore target timestamp: **use `$CUTOVER_SLOT_START` minus 5 minutes** as the restore point (before any apply writes landed).
2. Confirm the restore target is within the available PITR window (Step 0 above).
3. Click "Restore" and confirm the destructive action prompt.
4. Expected: Supabase shows a restore-in-progress indicator. This typically takes **5–30 minutes** depending on database size.

> Note: PITR restore replaces the entire database state at the project level. There is no partial restore by schema or table. All changes since the restore timestamp — including any migrations applied during the cutover attempt — will be reverted.

**Step 4 — Monitor restore progress.**

```bash
# Poll the project status via Supabase API
# (Replace SUPABASE_ACCESS_TOKEN with op:// reference below)
ACCESS_TOKEN=$(op read "op://smartout_ai_prod/supabase/access-token")

while true; do
  STATUS=$(curl -s \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/yljaglomadbhyqpcigff" \
    | jq -r '.status')
  echo "$(date -u): project status = $STATUS"
  [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
  sleep 30
done
# Expected terminal state: ACTIVE_HEALTHY
```

**Step 5 — Verify all 3 migration workspaces are absent post-restore.**

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT id, slug, name
  FROM public.workspace
  WHERE slug IN ('strom-mat-bar', 'bardshaug-vegkro', 'yogurt-heaven');
"
# Expected: 0 rows returned
# If any rows are returned: the restore did not reach the correct timestamp.
# Re-examine the restore target — try 10 minutes earlier.
```

**Step 6 — Verify no half-applied state in adjacent tables.**

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM public.profile
  WHERE workspace_id IN (
    'd79d9930-df55-5a20-9db3-bdacc24ecb3c',  -- Strøm
    '4be48bb8-9a44-5d97-a71c-d06950ae86ef',  -- Bårdshaug
    'e361cdc7-3a81-51f8-a60c-07afe52e8c8d'   -- Yogurt Heaven
  );
"
# Expected: 0

psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM public.schedule_shift
  WHERE workspace_id IN (
    'd79d9930-df55-5a20-9db3-bdacc24ecb3c',
    '4be48bb8-9a44-5d97-a71c-d06950ae86ef',
    'e361cdc7-3a81-51f8-a60c-07afe52e8c8d'
  );
"
# Expected: 0

psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true';
"
# Expected: 0
```

**Step 7 — Confirm FK replica mode is not stuck.**

```bash
psql "$SUPABASE_DB_URL" -c "SHOW session_replication_role;"
# Expected: origin  (the default)
# If: replica — run: SET session_replication_role = origin;
# (A stuck replica-mode session after a ROLLBACK is possible if the connection
# was not cleanly terminated. Per L-6 in HANDOFF-bubble-migration.md.)
```

**Step 8 — Unfreeze Bubble.**

Only after Steps 5–7 are all clean:

- Open Bubble editor → disable Maintenance Mode.
- Verify Bubble is serving normal user traffic.
- Log the restoration event to activity-log:

```bash
~/.claude/scripts/log-activity.sh "session" "claude" \
  "R2 rollback complete: PITR restore to pre-cutover on yljaglomadbhyqpcigff. All 3 workspace slugs absent. Bubble unfrozen."
```

### Communication Template — R2 (Users Not Yet Notified)

Because auth-bridge Phase B did not run, no users received any migration communication.
The communication is an internal maintenance notice only:

---

**Subject:** Smartout — Scheduled maintenance completed (no user action needed)

We performed a scheduled system maintenance window today. The maintenance has been completed and all systems are running normally. No action is required from you.

If you experienced any disruption during [WINDOW_START]–[WINDOW_END] UTC, please contact support@smartout.no.

---

### If This Step Fails — Escalation

| Step | Failure | Escalation |
|------|---------|-----------|
| Step 3 — PITR restore | Dashboard restore fails to start | Contact Supabase support immediately with project ref `yljaglomadbhyqpcigff` and target timestamp. Do not attempt a second restore until support responds. |
| Step 3 — PITR restore | Restore completes but project remains unhealthy | Supabase support escalation. Do not touch the project. |
| Step 5 — workspace check | Workspaces still present after restore | Wrong restore timestamp — use an earlier one. Check the Supabase dashboard "Backups" log for the actual restore point applied. |
| Step 7 — replica mode stuck | `SET session_replication_role = origin` fails | Restart the Postgres connection; if issue persists, contact Supabase support. |

### Time Estimate

- Step 1 (abort transaction): < 1 minute
- Step 2 (freeze Bubble): 5 minutes
- Step 3–4 (PITR restore + wait): 10–40 minutes
- Step 5–7 (verification): 10 minutes
- Step 8 (unfreeze + log): 5 minutes

**Total: 30–60 minutes.** PITR restore duration dominates.

---

## Scenario R3 — Production Cutover Partial-Success Failure (Auth-Bridge Phase B Partial, Then Apply Failed)

### When to Invoke

This is the hardest and most consequential scenario. Invoke when ALL of the following are true:

1. Auth-bridge Phase B ran (or partially ran) and **sent recovery emails** to some or all migrated users.
2. The migration SQL apply subsequently failed — either mid-bundle or at a gate check.
3. The production database is in a **partial state**: some auth.users rows exist for migrated users, but the corresponding `user_identity` / `profile` / workspace rows may be absent or incomplete.

This scenario requires coordinating:
- Revocation of pending recovery tokens (so users cannot follow the emails to a broken account).
- Deletion of partially-created auth.users rows.
- Reverting workspace/profile data via PITR.
- Restoring Bubble as the authoritative system.
- Direct communication to affected users acknowledging the email they received.

### Trigger Conditions

- `psql` exits non-zero during Track F apply AND the auth-bridge Phase B script exited 0 (or partial 0) before the failure.
- Post-apply gate check: `SELECT count(*) FROM auth.users WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'` returns > 0.
- An operator or user reports receiving a "Set your password on Smartout" email during a failed migration window.

### Pre-Rollback Checks

**Check 1 — Determine the exact blast radius.**

```bash
export CUTOVER_SLOT_START="<the timestamp you recorded at cutover start>"

# Count migrated auth.users created during this window
psql "$SUPABASE_DB_URL" -c "
  SELECT
    id,
    email,
    raw_user_meta_data->>'original_workspace_slug' AS workspace_slug,
    raw_user_meta_data->>'migrated_from_bubble' AS migrated_flag,
    created_at
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START'
  ORDER BY created_at ASC;
" > /tmp/r3-affected-users.txt 2>&1

cat /tmp/r3-affected-users.txt
wc -l /tmp/r3-affected-users.txt
# Save the count and workspace_slug breakdown — you need this for the communication template.
```

**Check 2 — Determine token issuance state.**

Recovery emails contain one-time password-reset tokens. Check whether any have already been consumed (i.e., a user followed the link and set a password):

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT
    u.id,
    u.email,
    u.last_sign_in_at,
    u.updated_at,
    u.raw_user_meta_data->>'migrated_from_bubble' AS migrated_flag
  FROM auth.users u
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START'
    AND last_sign_in_at IS NOT NULL
  ORDER BY last_sign_in_at ASC;
"
# If any users have last_sign_in_at populated: they followed the recovery link.
# These users need extra care in communication — they tried to onboard and hit a broken state.
# Record the count for the communication template (variable: USERS_WHO_SIGNED_IN).
```

**Check 3 — Freeze Bubble IMMEDIATELY (if not already frozen).**

Users must stay on Bubble while rollback proceeds. Do this before any token revocation step:

- Open Bubble editor → enable Maintenance Mode.
- Confirm no new writes can flow.

**Check 4 — Confirm the PITR window.**

Same as R2 Step 0. Confirm `$CUTOVER_SLOT_START` minus 5 minutes is within the PITR window before proceeding.

### Step-by-Step Recovery

**Step 1 — Revoke all pending recovery tokens for migrated users.**

Supabase Auth Admin API allows generating a new one-time token, which invalidates the previous one. Iterating through the affected user list and calling `generateLink` with `type=recovery` on each user forces the old token to expire.

```bash
# Requires SUPABASE_SERVICE_ROLE_KEY loaded (see Prerequisites)
export SUPABASE_SERVICE_ROLE_KEY=$(op read "op://smartout_ai_prod/supabase/service-role-key")

# Extract affected user IDs and emails from the pre-rollback check output
psql "$SUPABASE_DB_URL" -c "
  SELECT id, email
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START'
  ORDER BY created_at ASC;
" --csv --tuples-only > /tmp/r3-users-to-revoke.csv

# Revoke tokens by overwriting them via the Admin API
# (generateLink type=recovery generates a NEW token, making the emailed token stale)
while IFS=',' read -r user_id email; do
  echo "Revoking token for $email ($user_id)..."
  curl -s -X POST \
    "https://api.supabase.com/v1/projects/yljaglomadbhyqpcigff/auth/v1/admin/generate_link" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"type\": \"recovery\", \"email\": \"$email\"}" \
    | jq -r '.action_link // "ERROR"'
  # Discard the generated link — we only want the side effect of invalidating the old one.
  sleep 0.2  # Rate-limit: ~5 req/sec
done < /tmp/r3-users-to-revoke.csv

echo "Token revocation complete."
```

> **Why this works:** Supabase Auth stores the recovery token hash. Generating a new token overwrites the stored hash, making the previously emailed link non-functional. The new generated link is deliberately discarded.

If the Admin API `generate_link` endpoint returns errors for any user:

```bash
# Alternative: invalidate tokens by updating email_confirm directly
# This prevents password reset flow from completing for unconfirmed emails
psql "$SUPABASE_DB_URL" -c "
  UPDATE auth.users
  SET recovery_token = NULL,
      recovery_sent_at = NULL
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START';
"
# Verify
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*)
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START'
    AND recovery_token IS NOT NULL;
"
# Expected: 0
```

> TODO — needs council input: Direct `recovery_token` NULL-update requires confirming the exact column name on the Supabase Auth schema for project version in use. The `auth.users` column may be named `recovery_token` or stored differently depending on GoTrue version. Verify against `information_schema.columns WHERE table_schema='auth' AND table_name='users'` before running this fallback.

**Step 2 — Delete auth.users rows created during the cutover window.**

Only run after token revocation is confirmed (Step 1 complete, 0 active recovery tokens).

```bash
# Dry-run first — confirm the delete scope
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*)
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START';
"
# Record this count. It must match the count from Check 1.

# Delete — scoped to provenance.bubble._migrated_at >= slot-start
# NOTE: auth.users is managed by GoTrue. Direct delete via psql on auth schema
# requires service_role access and is supported on Supabase.
psql "$SUPABASE_DB_URL" -c "
  DELETE FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START';
"

# Verify deletion
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*)
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START';
"
# Expected: 0
```

> **Note on `provenance.bubble._migrated_at`:** The `_migrated_at` field is stored in the JSONB provenance column on public-schema rows (ADR-0268), not on `auth.users`. The `auth.users` deletion scope uses `created_at >= CUTOVER_SLOT_START` instead — this is equivalent because auth.users rows are created by auth-bridge Phase B exclusively during the cutover window. If any production auth.users were created by legitimate Smartout signup during the window, they will have `raw_user_meta_data->>'migrated_from_bubble'` as NULL and will NOT be deleted.

**Step 3 — PITR restore for public-schema data.**

This step reverts all workspace, profile, schedule_shift, user_identity, and other public-schema rows that were applied before the failure. Follow the same steps as R2 Steps 3–7.

```bash
# Confirm restore target: CUTOVER_SLOT_START minus 5 minutes
echo "Restore target: $CUTOVER_SLOT_START (use -5 minutes in the dashboard)"

# Dashboard URL:
# https://supabase.com/dashboard/project/yljaglomadbhyqpcigff/database/backups/pitr

# After restore completes, run the same verification queries as R2 Step 5-7:

psql "$SUPABASE_DB_URL" -c "
  SELECT id, slug FROM public.workspace
  WHERE slug IN ('strom-mat-bar', 'bardshaug-vegkro', 'yogurt-heaven');
"
# Expected: 0 rows

psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM public.user_identity
  WHERE created_at >= '$CUTOVER_SLOT_START';
"
# Expected: 0 (no new user_identity rows since cutover)

psql "$SUPABASE_DB_URL" -c "SHOW session_replication_role;"
# Expected: origin
```

> **IMPORTANT:** After PITR restore, the auth.users deletions from Step 2 will be undone — the restore replaces the entire database including the auth schema. You must re-run the auth.users delete (Step 2) AFTER the PITR restore completes.

**Step 4 — Re-run auth.users delete AFTER PITR restore.**

```bash
# Re-confirm token revocation state was also reverted by PITR
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*)
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true'
    AND created_at >= '$CUTOVER_SLOT_START';
"
# If count > 0: PITR restore preserved the auth-bridge inserts (expected).
# Re-run token revocation (Step 1) and then re-run the delete (Step 2).

# Verify final state
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*)
  FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true';
"
# Expected: 0
```

**Step 5 — Unfreeze Bubble.**

Only after Steps 3–4 are verified clean:

- Open Bubble editor → disable Maintenance Mode.
- Verify Bubble is serving normal user traffic before sending any communications.

**Step 6 — Log the incident.**

```bash
~/.claude/scripts/log-activity.sh "session" "claude" \
  "R3 rollback complete: auth-bridge Phase B partial send (N users). Tokens revoked. auth.users deleted. PITR restore to pre-cutover on yljaglomadbhyqpcigff. Bubble unfrozen."
```

Replace `N` with the count from Check 1.

### Communication Template — R3 (Users Who Received Recovery Emails)

This email must be sent to every user who received a recovery email during the failed cutover.
**Do not send until Bubble is confirmed live and stable.**

Per the email policy in CLAUDE.md: draft in `.md` first, Pontus approves, then create a Gmail draft via service account. Never send directly.

---

**Subject:** Importante: Smartout migration — link in previous email is no longer valid

Hei [first_name],

You recently received an email asking you to set your password for Smartout. We need to let you know that the email contained a link that is now inactive — please do not use it.

We were in the process of migrating your account to our new platform, but encountered a technical problem that required us to pause the migration. Your data is safe, and Bubble continues to be your active work system.

**What this means for you:**
- The link in the previous email is no longer valid and will not work.
- Your Bubble account is unchanged and fully operational.
- We will contact you again when the migration is rescheduled, with a new, valid link.

We apologize for the inconvenience and confusion. If you have any questions, please contact support@smartout.no.

Med vennlig hilsen,
Smartout-teamet

---

**Additional note for users who signed in (variable: USERS_WHO_SIGNED_IN > 0):**

If a user followed the link and attempted to sign in or set a password, they should receive the above email PLUS the following paragraph:

> It appears you may have attempted to complete the setup process. Your new account on the Smartout platform has been removed as part of the rollback, and your Bubble account remains your active account. No data was lost. We will reach out directly before the next migration attempt.

---

### Verification Steps (Post-Recovery)

Full rollback is complete when ALL of the following are true:

```bash
# 1. No migrated workspaces in public schema
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM public.workspace
  WHERE slug IN ('strom-mat-bar', 'bardshaug-vegkro', 'yogurt-heaven');
"
# Expected: 0

# 2. No migrated auth.users
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM auth.users
  WHERE raw_user_meta_data->>'migrated_from_bubble' = 'true';
"
# Expected: 0

# 3. No migrated user_identity rows
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM public.user_identity
  WHERE created_at >= '$CUTOVER_SLOT_START';
"
# Expected: 0

# 4. No migrated profiles
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM public.profile
  WHERE workspace_id IN (
    'd79d9930-df55-5a20-9db3-bdacc24ecb3c',
    '4be48bb8-9a44-5d97-a71c-d06950ae86ef',
    'e361cdc7-3a81-51f8-a60c-07afe52e8c8d'
  );
"
# Expected: 0

# 5. replica mode not stuck
psql "$SUPABASE_DB_URL" -c "SHOW session_replication_role;"
# Expected: origin

# 6. Bubble returning 200 for unauthenticated homepage
curl -s -o /dev/null -w "%{http_code}" https://<your-bubble-app-url>
# Expected: 200 or 301 (redirect to login)
```

### If This Step Fails — Escalation

| Step | Failure | Escalation |
|------|---------|-----------|
| Step 1 — token revocation | Admin API returns 403 / 401 | Verify `SUPABASE_SERVICE_ROLE_KEY` is correct. Confirm the key has not been rotated. Try the direct `recovery_token = NULL` fallback. |
| Step 1 — token revocation | Admin API returns 422 for specific email | The email may not exist in auth.users (auth-bridge may have failed for that user specifically). Skip — that user never received a valid token. |
| Step 2 — auth.users delete | Delete fails with FK constraint | `public.user_identity` has a FK to `auth.users(id)`. Delete `user_identity` rows first, then retry auth.users delete. (PITR will clean up public-schema rows — Step 3 — but you may need to manually delete user_identity before Step 2 if PITR has not run yet.) |
| Step 3 — PITR restore | Restore fails | Follow R2 escalation table. Supabase support. |
| Step 4 — re-delete after PITR | count > 0 after delete | Check for locked sessions holding the rows. `SELECT pid FROM pg_stat_activity WHERE state != 'idle'` — terminate blocking PIDs with `pg_terminate_backend(pid)`, retry delete. |
| Step 5 — Bubble unfreeze | Bubble does not serve traffic | Bubble platform support. Do NOT send user communications until Bubble is verified live. |

### Time Estimate

- Step 1 (token revocation): 5–20 minutes (proportional to user count × API rate limit)
- Step 2 (auth.users delete): 5 minutes
- Step 3–4 (PITR restore + re-delete): 20–50 minutes
- Step 5 (Bubble unfreeze + verify): 5 minutes
- Step 6 (logging): 5 minutes
- Communication drafting and approval: 30–60 minutes (separate async)

**Total operational: 40–90 minutes.** Communication loop is additional and async.

---

## Appendix A — Workspace UUID Reference

| Workspace | Slug | UUID (from rehearsal fixture) |
|-----------|------|-------------------------------|
| Strøm Mat & Bar | `strom-mat-bar` | `d79d9930-df55-5a20-9db3-bdacc24ecb3c` |
| Bårdshaug Vegkro | `bardshaug-vegkro` | `4be48bb8-9a44-5d97-a71c-d06950ae86ef` |
| Yogurt Heaven | `yogurt-heaven` | `e361cdc7-3a81-51f8-a60c-07afe52e8c8d` |

> Note: These UUIDs are from the Local rehearsal fixture. Production cutover will use the same deterministic `uuidv5` formula but the actual UUIDs assigned in production must be confirmed from the emit output before the cutover window. Update this table with production-confirmed UUIDs before cutover.

---

## Appendix B — Key ADR References

| ADR | Relevance to Rollback |
|-----|----------------------|
| ADR-0006 | Auth-bridge orchestration — Phase B recovery email procedure |
| ADR-0267 | PII plaintext scoped to Local only — confirms prod encryption gate |
| ADR-0268 | Provenance JSONB shape — `_migrated_at` field used for R3 scoping |
| ADR-0265 | Deployment pipeline — no unilateral pipeline actions outside sanctioned scripts |
| ADR-0077 | pgsodium encryption requirement — must be satisfied before production cutover |

---

## Appendix C — Unresolved TODOs (Needs Council Input)

The following items were parked as requiring council input before this runbook is promoted from `draft` to `in_progress`:

1. **R2 / PITR fallback if retention window is too short** — What is the SLA decision if the PITR window does not cover the cutover slot? Options: Supabase support ticket + manual row-delete script vs. accepting data loss on a non-critical column set. Council needs to define the decision tree.

2. **R3 / auth.users `recovery_token` column name** — Verify the exact column name on the Supabase GoTrue schema (`recovery_token` vs. `recovery_sent_at` + token hash). Confirm against `information_schema.columns WHERE table_schema='auth' AND table_name='users'` on a staging instance before the first production cutover attempt.

3. **R3 / token revocation rate limit** — Supabase Auth Admin API has undocumented rate limits. For 121 profiles across 3 workspaces, the 0.2s sleep (5 req/sec) should be safe. Council should confirm the correct rate limit for the production Supabase plan tier before the cutover window.

4. **R3 / user_identity FK ordering on delete** — The Step 2 / Step 4 note mentions that `user_identity` FK to `auth.users` may block the delete. Confirm whether the production schema has `ON DELETE CASCADE` on this FK or requires manual ordering. Check: `SELECT confdeltype FROM pg_constraint WHERE conname = 'user_identity_user_id_fkey'` on production.
