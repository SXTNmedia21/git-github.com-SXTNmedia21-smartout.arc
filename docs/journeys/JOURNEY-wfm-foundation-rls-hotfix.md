---
title: "Journeys — wfm-foundation-rls-hotfix"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [journey, hotfix, rls, adr-0313, defense-in-depth]
---

# Journeys — wfm-foundation-rls-hotfix

> Pure DDL refactor sortie — no user-facing journey, only defense-in-depth posture change. Single data-flow journey describing the policy invariants now enforced.

## Journey 1: Service-role mutation goes through per-verb gate

**Actor:** BFF route or Edge Function with service_role key (e.g. future C1 `pos-sync` function INSERTs into `pos_sale_event`; future C2 `shift-offer-notify` function INSERTs into `schedule_shift_offer`)
**Precondition:** caller authenticated as `service_role` (typical for server-side mutations).

**Steps (post-hotfix):**

1. Caller issues `INSERT` against `pos_account` (or `schedule_shift_offer`).
2. RLS engine evaluates `service_role_insert_pos_account` policy: `FOR INSERT TO service_role WITH CHECK (auth.role() = 'service_role')`.
3. Predicate satisfied → INSERT proceeds.
4. Same path for UPDATE: `service_role_update_pos_account` evaluates USING (existing rows visible) AND WITH CHECK (proposed rows allowed); both = `auth.role() = 'service_role'`.
5. Same path for DELETE: `service_role_delete_pos_account` evaluates USING only (DELETE is non-creating).

**Pre-hotfix (NOW REJECTED PATTERN):** single `service_role_write_pos_account FOR ALL` policy with USING + WITH CHECK both `auth.role() = 'service_role'`. Functionally equivalent for service_role caller (which bypasses RLS anyway), but ADR-0313 requires the per-verb structure for sister-sweep discipline + future-proofing if a JWT-path writer is ever added.

**Postcondition:** All foundation tables now match ADR-0313 canonical D6 RLS pattern. ADR-0303 sister-sweep query returns zero gaps for foundation surface.

**Error paths:**

- Caller without service_role (e.g. JWT user) attempting INSERT → no INSERT policy matches their role → RLS rejects (no rows affected). Same as pre-hotfix.
- Migration apply fails → DROP POLICY IF EXISTS guards prevent destruction; re-run safe.

**Hot-fix deliverable for this journey:** `supabase/migrations/20260611120200_wfm_foundation_rls_hotfix.sql` — splits 2 tables × 1 FOR ALL policy → 6 per-verb policies (3 per table). `pos_sale_event` skipped (already INSERT-only compliant).
