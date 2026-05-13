---
title: "Sortie A D6 RLS WITH CHECK hardening — shift_approval forgeable-workspace gap closure"
id: ADR_0299
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0299: Sortie A D6 RLS WITH CHECK hardening — shift_approval forgeable-workspace gap closure

## Context and Problem Statement

Sortie 1 (`feat/mobile-session-task-defense`) closed the `session_task` forgeable-actor gap but explicitly deferred `schedule_shift` and `shift_approval` to Sortie A (§R6). The `shift_approval` table carried a `FOR ALL` policy that applied a single USING predicate without a matching WITH CHECK. This means any authenticated workspace member with a valid JWT could INSERT or UPDATE rows with a forged `workspace_id` in the request body — the DB accepted the body value unchecked, as long as USING passed on the queried row. The Mobile Oppgaver Council (2026-05-12) classified this as a ≥30-policy class hole in the defense-in-depth posture for D6 mutation surfaces.

## Decision Drivers

- ADR-0151: actor identity must be derived server-side; client-supplied actor fields must be rejected or verified
- ADR-0298: RLS UPDATE policies require WITH CHECK + actor predicate on all D6 tables
- Sortie 1 §R6 deferred gap: `shift_approval` FOR ALL → per-verb split was explicitly out of scope for Sortie 1
- R1 materialized during Sortie A: `approve_shift` agent tool uses `ctx.supabaseAdmin` (service_role), not anon/JWT path — pgTAP suite must use PostgREST JWT simulation to exercise RLS policies, not the tool path

## Considered Options

1. **Add WITH CHECK to existing FOR ALL** — minimal change; still one policy for all verbs
2. **Split FOR ALL into per-verb policies with symmetric USING + WITH CHECK** — clean separation; allows manager-tier and employee-tier predicates on UPDATE without conflating SELECT/INSERT/DELETE
3. **Comment-only audit on both tables; defer RLS split to Sortie A.2** — no runtime change; documentation only

## Decision Outcome

Chosen option: **"Option 2 — per-verb split with symmetric USING + WITH CHECK"**, because the WITH CHECK predicate on UPDATE is the critical gap and per-verb split enables distinct role-predicate branches (manager vs employee) without overloading a single policy. Option 1 would work but leaves INSERT/DELETE merged with UPDATE semantics. Option 3 defers the actual defense gap.

## Rules & Consequences

- **Good, because** the UPDATE policy now carries `USING (workspace_id = auth.jwt()->>'workspace_id') WITH CHECK (workspace_id = auth.jwt()->>'workspace_id')`, preventing cross-workspace body forgery on any JWT-path writer
- **Good, because** manager-tier USING branch (`role IN ('manager', 'admin', 'owner')`) and employee self-confirm branch (`employee_profile_id = auth.uid()`) are now discrete — future changes to one branch do not affect the other
- **Good, because** all 3 current writers (confirmHoursAction, engine-dispatch, approve_shift agent tool) use service_role and are unaffected — zero behavior change for live paths
- **Bad, because** `schedule_shift` changes in this sortie are audit-comment-only; full `ALTER POLICY` mechanism for schedule_shift is deferred (Sortie A.2 or future ADR)
- **Agent Impact:** Any future author adding a JWT-path writer for `shift_approval` (anon key or caller JWT) MUST verify the new writer satisfies the USING + WITH CHECK predicates before shipping. Service_role writers bypass RLS — switching `approve_shift` from `ctx.supabaseAdmin` to `ctx.supabaseClient` REQUIRES explicit predicate review (L-0238 in HANDOFF-sortie-a-d6-rls-hardening.md)

---

> Registered in `docs/decisions/0000-decision-log.md`. Relates to ADR-0151 (forgery defense), ADR-0298 (task ontology + D6 RLS requirement), ADR-0134 (telemetry contract — workspace_id non-null).
