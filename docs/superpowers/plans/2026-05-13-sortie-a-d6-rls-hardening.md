---
title: "Sortie A — D6 RLS WITH CHECK Hardening (Implementation Plan)"
slug: sortie-a-d6-rls-hardening
status: ready
revision: v1
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0299
learning_slots_reserved: L-0238
target_branch: feat/sortie-a-d6-rls-hardening
target_worktree: ~/dev/smartout.ai-wt-3
tags: [sortie, plan, defense, rls, schedule_shift, shift_approval]
---

# Sortie A — D6 RLS WITH CHECK Hardening (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.
>
> **READ SPEC §3 FIRST** — `docs/superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md` §3 contains the verified canonical policies, writer enumeration, helper signatures, and the audit verdict on `schedule_shift`. Do NOT re-derive — Phase 1 re-runs the greps as a freshness check, nothing more.

**Goal:** Drop+recreate `shift_approval` JWT policies as split per-verb policies with explicit WITH CHECK (matching `session_task` pattern from Sortie 1). Audit-confirm `schedule_shift` already complies and lock the invariant with pgTAP. No app code, no capability work, no ontology changes.

**Architecture:** Single Postgres migration replaces the `FOR ALL` policy on `shift_approval` with four per-verb policies (read/insert/update/delete). The new UPDATE policy carries identical USING + WITH CHECK predicates, allowing admin/owner/manager OR shift-owner-employee, scoped to the row's `workspace_id`. A comment-only sibling migration documents the `schedule_shift` audit verdict. pgTAP locks both invariants; one Playwright E2E asserts PostgREST rejects a forged JWT request.

**Tech Stack:** Supabase PostgreSQL 17 (RLS), pgTAP, Playwright E2E, pnpm + Turborepo.

---

## Pre-flight

- [ ] **P.1: Verify on main repo development branch**

```bash
pwd
git branch --show-current
git status --short
```

Expected: `/home/sxtnl/dev/smartout.ai`, `development`, clean or only spec/plan staged.

- [ ] **P.2: Verify spec + plan on disk**

```bash
ls -la docs/superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md
ls -la docs/superpowers/plans/2026-05-13-sortie-a-d6-rls-hardening.md
```

Both must exist.

- [ ] **P.3: Stash any dirty tree**

```bash
git stash push -u -m "pre-sortie-a 2026-05-13" || true
git status --short
```

- [ ] **P.4: Commit spec + plan to development** (local commit; push deferred — Pontus's voice-agent + polish-skill commits unpushed)

```bash
git add docs/superpowers/specs/2026-05-13-sortie-a-d6-rls-hardening-design.md \
        docs/superpowers/plans/2026-05-13-sortie-a-d6-rls-hardening.md
git commit -m "docs(sortie-a): D6 RLS WITH CHECK hardening spec + plan"
```

- [ ] **P.5: Create Sortie A worktree** (orchestrator runs this; agent verifies after)

```bash
~/.claude/scripts/new-feature.sh sortie-a-d6-rls-hardening 3 cascade
```

Worktree at `~/dev/smartout.ai-wt-3` on branch `feat/sortie-a-d6-rls-hardening`.

---

## Phase 1 — Pre-flight grep + canonical-reality re-lock

**Goal:** Re-run the spec §3 investigation greps to confirm canonical reality has not drifted since 2026-05-13. ANY drift escalates per spec §9.

### Task 1.1 — Re-grep policy state

```bash
grep -n "shift_approval" supabase/migrations/20260304200200_deviation_shift_approval.sql | head -20
grep -rn "DROP POLICY.*shift_approval\|CREATE POLICY.*shift_approval" supabase/migrations/
grep -rn "DROP POLICY.*schedule_shift\|CREATE POLICY.*schedule_shift" supabase/migrations/ | grep -v lock
```

**Acceptance:**
- `shift_approval`: exactly 4 policies (jwt_read, jwt_manage, service_role, api_key_read). `jwt_manage` is `FOR ALL USING(...)` with NO `WITH CHECK`.
- `schedule_shift`: exactly 4 jwt + 4 api_key + 1 overlay (`jwt_employee_confirm_own_shift`) policies. Both UPDATE policies carry WITH CHECK.

If counts or shapes differ from spec §3.1/§3.2: STOP, escalate per spec §9.

### Task 1.2 — Re-enumerate writers

```bash
grep -rn "from(['\"]shift_approval['\"])\s*\.\(update\|upsert\|insert\)" apps/web/src apps/mobile/src packages/ai/src services/ supabase/functions
grep -rn "from(['\"]schedule_shift['\"])\s*\.\(update\|upsert\|insert\)" apps/web/src apps/mobile/src packages/ai/src services/ supabase/functions
```

**Acceptance:** writer set is a subset of spec §3.4 + §3.5. Any new JWT-path writer triggers council escalation per spec §9.

### Task 1.3 — Verify helper signatures unchanged

```bash
grep -A 5 "CREATE OR REPLACE FUNCTION public.is_admin_in_workspace\|CREATE OR REPLACE FUNCTION public.get_workspace_ids_for_user" supabase/migrations/00004_rls_policies.sql
```

**Acceptance:** signatures match spec §3.3.

---

## Phase 2 — Migrations

### Task 2.1 — Write `shift_approval` RLS migration

Create `supabase/migrations/20260605120000_shift_approval_rls_with_check.sql` per spec §4.1. Drop `jwt_manage_shift_approval`. Create 3 new policies: jwt_insert (admin/owner/manager), jwt_update (admin/owner/manager OR shift-owner-employee with symmetric USING+WITH CHECK), jwt_delete (admin/owner).

### Task 2.2 — Write `schedule_shift` audit migration

Create `supabase/migrations/20260605121000_schedule_shift_rls_invariant_assert.sql` — comment-only DDL recording audit verdict on both existing policies per spec §4.2.

### Task 2.3 — Single commit + apply locally

```bash
git add supabase/migrations/20260605120000_shift_approval_rls_with_check.sql \
        supabase/migrations/20260605121000_schedule_shift_rls_invariant_assert.sql
git commit -m "fix(rls): WITH CHECK on shift_approval UPDATE (Sortie A defense)"
npx supabase migration up
```

**Acceptance:** migration applies clean; `\d+ shift_approval` shows 5 policies (jwt_read, jwt_insert, jwt_update, jwt_delete, service_role, api_key_read).

---

## Phase 3 — pgTAP tests

### Task 3.1 — `shift_approval` pgTAP

Create `supabase/tests/sortie-a-shift-approval-rls.spec.sql` covering spec §6 cases P1-P3 + N1-N4 (3 positive + 4 negative). Use Sortie 1 pgTAP fixture pattern: set `request.jwt.claims` via `set_config`, attempt UPDATE, assert `lives_ok` / `throws_ok`.

### Task 3.2 — `schedule_shift` pgTAP

Create `supabase/tests/sortie-a-schedule-shift-rls.spec.sql` covering spec §6 P1-P2 + N1-N4 (2 positive + 4 negative).

### Task 3.3 — Single commit + verify

```bash
git add supabase/tests/sortie-a-shift-approval-rls.spec.sql \
        supabase/tests/sortie-a-schedule-shift-rls.spec.sql
git commit -m "test(rls): pgTAP for shift_approval + schedule_shift UPDATE invariants"
npx supabase test db
```

**Acceptance:** all 13 assertions PASS.

---

## Phase 4 — E2E forgery rejection

### Task 4.1 — Playwright spec

Create `apps/e2e/tests/sortie-a-d6-forgery-rejection.spec.ts`:
- Skip-gate on `!process.env.LOCAL_SUPABASE`
- Seed two workspaces (use existing `apps/e2e/helpers/seed.ts`)
- Mint a JWT for `workspace_A` employee
- Direct PostgREST `PATCH /rest/v1/shift_approval?approval_id=eq.<workspace_B_row>` with that JWT
- Assert response is 4xx or `204` with `Content-Range: */0`
- Repeat for `schedule_shift`

```bash
git add apps/e2e/tests/sortie-a-d6-forgery-rejection.spec.ts
git commit -m "test(e2e): D6 forgery-rejection via direct PostgREST"
```

**Acceptance:** `pnpm --filter @smartout/e2e test sortie-a-d6-forgery` passes locally with `LOCAL_SUPABASE=1`.

---

## Phase 5 — Closure deliverables

### Task 5.1 — HANDOFF

Write `docs/HANDOFF-sortie-a-d6-rls-hardening.md` with sections: Summary, Decisions (ADR-0299), Learnings (L-0238 if discovered), Known issues, Next steps. Cross-reference Sortie 1 HANDOFF for §R6 closure narrative.

### Task 5.2 — JOURNEY

Write `docs/journeys/JOURNEY-sortie-a-d6-rls-hardening.md` capturing journeys for:
1. **Forger (negative)** — attacker with leaked employee JWT attempts cross-workspace shift_approval UPDATE → rejected at RLS
2. **Admin (happy)** — manager approves a pending shift_approval via approve_shift agent tool → passes WITH CHECK
3. **Employee (happy)** — employee self-confirms own shift → passes employee branch
4. **Engine (happy)** — engine-dispatch queue_shift_approval INSERT via service_role → bypasses RLS, unaffected

### Task 5.3 — ADR-0299 register

Append ADR-0299 entry to `docs/decisions/0000-decision-log.md` titled "Sortie A D6 RLS WITH CHECK hardening — shift_approval forgeable-workspace gap closure" with status: accepted, date: 2026-05-13. Optionally create `docs/decisions/0299-sortie-a-d6-rls-with-check.md` (full ADR).

### Task 5.4 — Plan update + closure commit

Update plan stub `docs/plans/PLAN-sortie-a-d6-rls-hardening.md` from draft → done. Single conventional commit.

```bash
git add docs/HANDOFF-sortie-a-d6-rls-hardening.md \
        docs/journeys/JOURNEY-sortie-a-d6-rls-hardening.md \
        docs/decisions/0299-sortie-a-d6-rls-with-check.md \
        docs/decisions/0000-decision-log.md \
        docs/plans/PLAN-sortie-a-d6-rls-hardening.md
git commit -m "docs(sortie-a): HANDOFF + JOURNEY + ADR-0299 closure"
```

### Task 5.5 — Typecheck

```bash
pnpm turbo typecheck
```

Must be green (no app code changed; smoke check that migrations didn't introduce drift).

### Task 5.6 — Ready-for-closure signal

Tell Pontus: "Sortie A ready for closure. Run `close-feature.sh 3` to merge `feat/sortie-a-d6-rls-hardening` → development."

---

## Acceptance summary

- [ ] Phase 1: canonical reality re-verified, no drift
- [ ] Phase 2: 2 migrations land in single commit
- [ ] Phase 3: 2 pgTAP files, all assertions PASS
- [ ] Phase 4: 1 E2E forgery-rejection spec PASSES locally
- [ ] Phase 5: HANDOFF + JOURNEY + ADR-0299 + decision-log entry committed
- [ ] `pnpm turbo typecheck` green
- [ ] Pontus runs `close-feature.sh 3`
