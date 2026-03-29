# LiveKit Webhook Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the LiveKit webhook and its associated database migrations to Supabase Cloud to enable operative walkie-talkie presence and logging.

**Architecture:** Push local `channel_voice` migrations to the production/staging database, inject required LiveKit API secrets into the Supabase Cloud environment, and deploy the edge function so it is publicly accessible by LiveKit.

**Tech Stack:** Supabase CLI, PostgreSQL, Deno (Edge Functions), 1Password CLI

---

### Task 1: Push Database Migrations

**Files:**

- Reference: `supabase/migrations/20260422301000_channel_voice.sql`

- [ ] **Step 1: Check migration status**

```bash
npx supabase db push --dry-run
```

Expected: Shows pending migrations including `20260422301000_channel_voice.sql` (and potentially earlier channel migrations if not yet pushed).

- [ ] **Step 2: Push migrations to Cloud**

```bash
npx supabase db push
```

Expected: Success message indicating migrations were applied successfully to the remote database.

### Task 2: Configure Supabase Cloud Secrets

**Files:**

- Reference: `.env.template`

- [ ] **Step 1: Extract secrets from 1Password and set in Supabase Cloud**

```bash
op run --env-file=.env.template -- bash -c 'npx supabase secrets set LIVEKIT_API_KEY=$LIVEKIT_API_KEY LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET'
```

Expected: Success message confirming secrets are set in the Supabase project.

### Task 3: Deploy the Edge Function

**Files:**

- Reference: `supabase/functions/livekit-webhook/index.ts`
- Reference: `supabase/config.toml`

- [ ] **Step 1: Deploy the function**

```bash
npx supabase functions deploy livekit-webhook
```

Expected: Success message with the deployed function URL (e.g., `https://<project-ref>.supabase.co/functions/v1/livekit-webhook`). The `--no-verify-jwt` is configured in `config.toml` so it is applied automatically.

### Task 4: Verify and Document Webhook Endpoint

- [ ] **Step 1: Output the final Webhook URL**
      Ask the user to log in to their LiveKit Cloud Dashboard and add the newly deployed webhook URL:

```text
https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/functions/v1/livekit-webhook
```

- [ ] **Step 2: Verify in Dashboard**
      Ask the user to confirm that `participant_joined`, `participant_left`, and `room_finished` events are correctly firing in the LiveKit Dashboard without errors.
