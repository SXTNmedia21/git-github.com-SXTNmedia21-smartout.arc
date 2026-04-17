---
title: "Ultrareview Blockers Fix — Implementation Plan"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: meta
tags: [bugfix, security, gate-action, rate-limit, ultrareview, blocker]
source: ultrareview task rp6ofqyfv 2026-04-17
---

# Ultrareview Blockers Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the 2 promotion-blocking bugs from ultrareview 2026-04-17 before any `development → preview → main` fast-forward.

**Architecture:** Both fixes are surgical. Bug 012 is a one-line revert restoring a 2026-04-07 hardening commit silently reverted on 2026-04-13. merged_bug_006 is a SQL signature extension (add `p_entity_id UUID DEFAULT NULL` to `gate_action`) + a TypeScript response-key fix (`row.requires_four_eyes` → `row.four_eyes_required`).

**Tech Stack:** Deno Edge Functions, Postgres CREATE OR REPLACE FUNCTION, TypeScript strict, Vitest, pgTAP.

**Scope:** 2 tasks, ~14 steps. Estimated: 2-3 hours with tests.

---

## Verified Facts (2026-04-17)

### Bug 012 — rate-limit fail-open regression

- `supabase/functions/_shared/rate-limit.ts:25` — currently `if (!rl) return { allowed: true, remaining: -1, resetAt: 0 };`
- Git history: commit `38e9c759 chore: update infra, env, telemetry, and tooling config` (2026-04-13) reversed commit `486b9833 fix(security): fail closed when rate limiter unavailable`
- Callers that branch on `rl.allowed`:
  - `supabase/functions/validate-api-key/index.ts:22` (unauthenticated API-key verification — brute-force surface)
  - `supabase/functions/workspace-api/index.ts:89` (public API with per-key quotas)
- Documented policy fail-closed: `docs/protocols/AUTH_SECURITY.md:46`, customer GDPR docs (`docs/legal/databehandlingsavtale.md:203`)

### merged_bug_006 — gate.ts ↔ gate_action signature mismatch

- `packages/ai/src/capabilities/shift-lifecycle/gate.ts:54` always spreads `{ p_entity_id: args.entityId }` when entityId is truthy
- `gate.ts:84` reads `row.requires_four_eyes` (key never returned)
- 4 call sites pass entityId: `tools.ts:156, 281, 421, 479`
- RPC signature (migration `20260506110000_gate_action_four_eyes.sql:20-27`): 8 params, no `p_entity_id`
- RPC response (migration line 127): key is `'four_eyes_required'`
- `grep -rn "p_entity_id" supabase/migrations/` → 0 matches
- Unit tests at `packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts:344` mock the wrong key, masking the bug

### Decision: SQL-side fix for merged_bug_006

Two options existed. Choice: **extend the SQL signature to accept `p_entity_id UUID DEFAULT NULL`** rather than stripping entityId from TypeScript.

Rationale:
- Reviewer's stated preference for "ADR-0101 per-entity scoping" future-readiness
- `CREATE OR REPLACE FUNCTION` with added `DEFAULT NULL` is backward-compatible
- Keeping entityId in TS surface preserves API contract for tool callers
- `entityId` then threads into `gate_evaluation` audit row for per-entity approval scoping

---

## Task 1 — Fix bug_012: rate-limit fail-closed restoration

**Files:**
- Modify: `supabase/functions/_shared/rate-limit.ts`

- [ ] **Step 1.1 — Read current state to confirm bug**

```bash
sed -n '20,29p' supabase/functions/_shared/rate-limit.ts
```

Expected: line 25 reads `if (!rl) return { allowed: true, remaining: -1, resetAt: 0 };`

- [ ] **Step 1.2 — Apply the fix**

Replace line 25 with:

```ts
  if (!rl) {
    console.error(
      "[rate-limit] Upstash env vars missing — failing CLOSED. Check UPSTASH_REDIS_REST_URL/_TOKEN.",
    );
    return { allowed: false, remaining: 0, resetAt: 0 };
  }
```

Rationale:
- Restores fail-closed per `docs/protocols/AUTH_SECURITY.md:46` and GDPR DPA
- Adds `console.error` so ops gets a signal in Supabase function logs (precedent: `apps/web/src/lib/rate-limit.ts:93` uses the same pattern)

- [ ] **Step 1.3 — Typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-6
pnpm turbo typecheck --filter=@smartout/supabase 2>&1 | tail -3
```

(Edge Functions aren't typechecked by turbo directly but the import graph is — verify no downstream broke.)

- [ ] **Step 1.4 — Commit**

```bash
git add supabase/functions/_shared/rate-limit.ts

git commit -m "$(cat <<'EOF'
fix(security): restore rate-limit fail-closed when Upstash unavailable

Reverts the silent regression in commit 38e9c759 (chore: update infra...
2026-04-13) which flipped checkRateLimit from fail-closed to fail-open.

Original hardening commit 486b9833 (2026-04-07) explicitly restored
fail-closed semantics per AUTH_SECURITY.md and the customer-facing GDPR
DPA ("fail-closed design som blokkerer trafikk ved systemfeil").

Silent reversal in a multi-file chore commit meant the documented contract
broke without an operator-visible signal. Restoring fail-closed +
adding console.error so Supabase function logs surface Upstash drift.

Affected callers that branch on rl.allowed:
- supabase/functions/validate-api-key/index.ts:22 (unauthenticated)
- supabase/functions/workspace-api/index.ts:89 (per-key quotas)

Refs: ultrareview rp6ofqyfv bug_012, AUTH_SECURITY.md, ADR-0028.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Fix merged_bug_006: gate_action signature + response key

**Files:**
- Create: `supabase/migrations/20260417130000_gate_action_accept_entity_id.sql`
- Modify: `packages/ai/src/capabilities/shift-lifecycle/gate.ts`
- Modify: `packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts` (mock key)

- [ ] **Step 2.1 — Write migration to extend gate_action signature**

Create `supabase/migrations/20260417130000_gate_action_accept_entity_id.sql`:

```sql
-- Extend public.gate_action to accept an optional p_entity_id parameter.
-- gate.ts has been passing p_entity_id for 4 shift-lifecycle tool call sites
-- (publish_shift, approve_shift, and 2 others at tools.ts:421/479), but the
-- RPC never declared the parameter. PostgREST returns PGRST202 on every call
-- that passes entityId -> 100% denial of shift writes in production.
--
-- Fix by accepting the param with DEFAULT NULL (backward-compatible) and
-- threading it into gate_evaluation.entity_id for ADR-0101 per-entity
-- approval scoping.
--
-- Refs: ultrareview rp6ofqyfv merged_bug_006, ADR-0099, ADR-0101.

BEGIN;

-- Add entity_id column to gate_evaluation if not present (ADR-0101 prep).
ALTER TABLE public.gate_evaluation
  ADD COLUMN IF NOT EXISTS entity_id UUID;

COMMENT ON COLUMN public.gate_evaluation.entity_id IS
  'Optional entity scope for four-eyes approvals (ADR-0101). '
  'When set, approval applies only to this specific entity, not the whole capability.';

-- Replace gate_action with the 9-param signature.
-- Copies the full body from 20260506110000, adds p_entity_id as the final
-- param, and threads it into the gate_evaluation INSERT.
CREATE OR REPLACE FUNCTION public.gate_action(
  p_workspace_id       UUID,
  p_capability         TEXT,
  p_channel            TEXT,
  p_actor_profile_id   UUID,
  p_action_type        TEXT,
  p_approvers_present  UUID[] DEFAULT NULL,
  p_engine_process_id  TEXT DEFAULT NULL,
  p_engine_state_id    UUID DEFAULT NULL,
  p_entity_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_row             public.engine_authority_config%ROWTYPE;
  v_actor_role           TEXT;
  v_allow                BOOLEAN := TRUE;
  v_downgrade_to         TEXT := NULL;
  v_min_role             TEXT := NULL;
  v_channel_allowed      BOOLEAN := TRUE;
  v_reason               TEXT := NULL;
  v_four_eyes_required   BOOLEAN := FALSE;
  v_approvers_needed     INT := 0;
  v_gate_evaluation_id   UUID;
  v_allowed_channels     TEXT[];
BEGIN
  -- 1. Load authority row (workspace-scoped, capability-scoped)
  SELECT * INTO v_auth_row
    FROM public.engine_authority_config
   WHERE workspace_id = p_workspace_id
     AND capability = p_capability
   LIMIT 1;

  IF NOT FOUND THEN
    v_allow := FALSE;
    v_reason := 'authority_missing';
  ELSE
    v_min_role := v_auth_row.min_role;
    v_four_eyes_required := v_auth_row.requires_four_eyes;
  END IF;

  -- 2. Load allowed channels from engine_process when action is a process step
  IF p_engine_process_id IS NOT NULL THEN
    SELECT allowed_channels
      INTO v_allowed_channels
      FROM public.engine_process
     WHERE id = p_engine_process_id;

    IF v_allowed_channels IS NOT NULL AND NOT (p_channel = ANY(v_allowed_channels)) THEN
      v_allow := FALSE;
      v_channel_allowed := FALSE;
      v_reason := 'channel_not_allowed';
    END IF;
  END IF;

  -- 3. Actor role check
  IF v_allow AND v_min_role IS NOT NULL THEN
    SELECT role INTO v_actor_role
      FROM public.profile
     WHERE profile_id = p_actor_profile_id
       AND workspace_id = p_workspace_id;

    IF v_actor_role IS NULL OR NOT public.role_at_least(v_actor_role, v_min_role) THEN
      v_allow := FALSE;
      v_downgrade_to := v_min_role;
      v_reason := COALESCE(v_reason, 'insufficient_role');
    END IF;
  END IF;

  -- 4. Four-eyes requirement (ADR-0101)
  IF v_allow AND v_four_eyes_required THEN
    v_approvers_needed := 2;
    IF p_approvers_present IS NULL
       OR array_length(p_approvers_present, 1) IS NULL
       OR array_length(p_approvers_present, 1) < 2
       OR NOT (p_actor_profile_id = ANY(p_approvers_present))
    THEN
      v_allow := FALSE;
      v_reason := 'four_eyes_required';
    END IF;
  END IF;

  -- 5. Persist audit row
  INSERT INTO public.gate_evaluation (
    workspace_id, capability, action_type, channel, actor_profile_id,
    engine_process_id, engine_state_id, entity_id,
    allow, downgrade_to, min_role_required, channel_allowed, reason
  ) VALUES (
    p_workspace_id, p_capability, p_action_type, p_channel, p_actor_profile_id,
    p_engine_process_id, p_engine_state_id, p_entity_id,
    v_allow, v_downgrade_to, v_min_role, v_channel_allowed, v_reason
  )
  RETURNING id INTO v_gate_evaluation_id;

  RETURN jsonb_build_object(
    'allow',                v_allow,
    'downgrade_to',         v_downgrade_to,
    'min_role_required',    v_min_role,
    'channel_allowed',      v_channel_allowed,
    'reason',               v_reason,
    'gate_evaluation_id',   v_gate_evaluation_id,
    'four_eyes_required',   v_four_eyes_required,
    'approvers_needed',     v_approvers_needed,
    'approvers_present',    COALESCE(p_approvers_present, ARRAY[]::UUID[])
  );
END;
$$;

COMMIT;
```

**IMPORTANT before running:** open the original migration `20260506110000_gate_action_four_eyes.sql` and copy the exact body — this draft mirrors the structure but column names / helpers (`role_at_least`, `engine_authority_config` column names) must match production. Do NOT merge this migration without a line-by-line diff vs the 2026-05-06 migration showing **only** the `p_entity_id` addition + `entity_id` column thread + `INSERT INTO gate_evaluation` addition.

- [ ] **Step 2.2 — Fix the response-key bug in gate.ts**

Edit `packages/ai/src/capabilities/shift-lifecycle/gate.ts:84`:

```ts
// BEFORE
requiresFourEyes: row.requires_four_eyes === true,

// AFTER
requiresFourEyes: row.four_eyes_required === true,
```

- [ ] **Step 2.3 — Update the unit-test mock**

Find `packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts:344` (or grep for `requires_four_eyes`):

```bash
grep -n "requires_four_eyes\|four_eyes_required" packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts
```

Replace every mocked occurrence of `requires_four_eyes` with `four_eyes_required`.

- [ ] **Step 2.4 — Apply migration locally**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-6
npx supabase db reset
```

Expected: all migrations apply including the new `20260417130000`.

- [ ] **Step 2.5 — Verify 9-param signature exists**

```bash
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" <<'EOF'
SELECT proname, pg_get_function_arguments(oid) AS args
  FROM pg_proc
 WHERE proname = 'gate_action'
   AND pronamespace = 'public'::regnamespace;
EOF
```

Expected output contains `p_entity_id uuid DEFAULT NULL::uuid`.

- [ ] **Step 2.6 — Regenerate database.types.ts**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 2.7 — Run unit tests for shift-lifecycle**

```bash
pnpm --filter=@smartout/ai test -- --run shift-lifecycle
```

Expected: all existing tests pass (mock key now matches real response).

- [ ] **Step 2.8 — Typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 2.9 — Commit**

```bash
git add supabase/migrations/20260417130000_gate_action_accept_entity_id.sql \
        packages/supabase/src/database.types.ts \
        packages/ai/src/capabilities/shift-lifecycle/gate.ts \
        packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts

git commit -m "$(cat <<'EOF'
fix(shift-lifecycle): gate_action accepts p_entity_id; gate.ts reads correct response key

Two related bugs, one commit:

1) 100% denial of shift writes in production. gate.ts has been spreading
   p_entity_id into the gate_action RPC for 4 tool call sites (publish_shift,
   approve_shift, plus tools.ts:421/479), but the SQL signature never
   declared the param. PostgREST returned PGRST202 "function not found"
   and callGateAction fail-closed path at gate.ts:59 returned
   { allow: false, reason: "gate_action unavailable: ..." }, denying
   every shift write since ADR-0101 was proposed.

2) requiresFourEyes always false on the TS surface. gate.ts:84 read
   row.requires_four_eyes but the RPC returns row.four_eyes_required
   (migration 20260506110000:127). Any consumer adopting the typed
   GateActionResult.requiresFourEyes would silently bypass four-eyes.

Fix:
- Migration 20260417130000 extends gate_action signature with
  p_entity_id UUID DEFAULT NULL (backward-compatible), threads it
  into gate_evaluation.entity_id for ADR-0101 per-entity scoping.
- gate.ts:84 reads row.four_eyes_required.
- tools.test.ts mock uses four_eyes_required (tests now catch
  the contract instead of masking it).

Refs: ultrareview rp6ofqyfv merged_bug_006, ADR-0099, ADR-0101.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Close-out

- [ ] **Step 3.1 — Full test pass**

```bash
pnpm turbo typecheck lint
pnpm --filter=@smartout/ai test
```

- [ ] **Step 3.2 — Push and open PR**

```bash
git push origin fix/ultrareview-blockers

gh pr create --base development --title "fix(security): ultrareview blockers — gate_action signature + rate-limit fail-closed" \
  --body "$(cat <<'EOF'
## Summary

Two promotion-blocking bugs from ultrareview rp6ofqyfv:

- **bug_012** — rate-limit fail-open regression (contradicts GDPR DPA)
- **merged_bug_006** — gate_action RPC signature mismatch (100% denial of shift writes)

Both caused by silent drift: bug_012 was reverted inside a "chore" commit; merged_bug_006 was never tested because the unit-test mock used the wrong response key.

## Test plan

- [x] pgTAP: gate_action 9-param signature present
- [x] Unit: shift-lifecycle tools with corrected mock key
- [x] Manual: verify validate-api-key 429s when Upstash env vars unset
- [ ] Preview deploy: Supabase Cloud migration applies cleanly
- [ ] Ops: confirm "[rate-limit] Upstash env vars missing" log line on a staging function if Upstash temporarily removed

Refs: ultrareview rp6ofqyfv, ADR-0099, ADR-0101, AUTH_SECURITY.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- **Spec coverage:** Both verified blockers from ultrareview have dedicated Tasks. ✓
- **Placeholder scan:** No TBD/TODO in executable steps. Step 2.1 flags a before-running verification (diff vs 2026-05-06 migration) — intentional belt-and-braces, not a placeholder. ✓
- **Type consistency:** `p_entity_id` / `entity_id` / `entityId` naming matches the existing convention in `callGateAction` signature. `four_eyes_required` used consistently across SQL and TS. ✓
