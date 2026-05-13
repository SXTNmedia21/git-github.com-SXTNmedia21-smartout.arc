---
title: "HANDOFF — Sortie A D6 RLS Hardening"
status: done
updated: 2026-05-13
created: 2026-05-13
module: cascade
tags: [sortie-a, defense, rls, ADR-0298, ADR-0299]
---

# HANDOFF — Sortie A D6 RLS Hardening

> Branch: `feat/sortie-a-d6-rls-hardening` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-4`
> Base: `development` | Closed: 2026-05-13

---

## What Was Built and Why

Sortie A implements the **D6 RLS WITH CHECK hardening** deferred from Sortie 1 §R6. Before this sortie, `shift_approval` carried a permissive `FOR ALL` policy that granted any authenticated workspace member the ability to INSERT or UPDATE any row — including rows belonging to other workspaces — if the JWT contained a forgeable `workspace_id` in the request body.

The Mobile Oppgaver Council (2026-05-12) identified this as a ≥30-policy class hole in the defense-in-depth posture for D6 mutation surfaces. Sortie 1 closed `session_task`; Sortie A closes `shift_approval` and adds audit comments to `schedule_shift` policies.

**Scope is deliberately narrow:** defense-only. No new features, no read-path changes, no capability additions. The RLS policies are tightened at the DB layer; the service_role bypass used by all 3 existing BFF writers is intentional and preserved (see L-0238 below).

---

## 3 Commits — Enumerated

| SHA | Commit | Description |
|-----|--------|-------------|
| `dbedf90ae` | `docs(sortie-a): spec + plan` | Spec `2026-05-13-sortie-a-d6-rls-hardening-design.md` + plan file |
| `113b7d794` | `feat(db): shift_approval RLS per-verb split + schedule_shift audit comments` | Migration splits `shift_approval` FOR ALL into per-verb policies with USING + WITH CHECK; adds inline audit comments to `schedule_shift` existing policies |
| `b8ca8767b` | `test(playwright): pgTAP P2 + P3 + P4 + E2E staging defense` | 2 pgTAP suites (direct JWT PostgREST simulation of RLS) + 1 Playwright E2E (cross-workspace forgery attempt end-to-end) |

---

## Decisions Made

### ADR-0299 — Per-verb RLS policies on shift_approval

Registered: `docs/decisions/0299-sortie-a-d6-rls-with-check.md`

Split the existing `FOR ALL` policy on `shift_approval` into discrete per-verb policies. The UPDATE policy carries a symmetric `USING (workspace_id = auth.jwt()->>'workspace_id') WITH CHECK (workspace_id = auth.jwt()->>'workspace_id')`. Manager-tier approval branch adds `role IN ('manager', 'admin', 'owner')` predicate to the USING clause. Employee self-confirmation branch constrains to `employee_profile_id = auth.uid()`.

This is defense-in-depth: all 3 current writers (confirmHoursAction, engine-dispatch, approve_shift agent tool) use service_role and are unaffected. The policies future-proof the table against any future JWT-path writer that might be added without review.

---

## Learnings

### L-0238 (NEW) — approve_shift agent tool uses service_role; this is intentional

The `approve_shift` tool in `packages/ai/src/capabilities/operations/tools.ts` calls `ctx.supabaseAdmin` (service_role) for its `shift_approval` UPDATE. This means the tool bypasses RLS entirely — the new WITH CHECK predicate is not evaluated for this path.

**This does NOT defeat the defense.** Service_role bypass is intentional for admin-tier tooling (manager action via Mr. Botsson). The defense targets JWT-path writers — any future endpoint or client that writes `shift_approval` using the anon key or a user JWT. The RLS layer is a gate on those paths, not on service_role operations.

**Future caution:** Any migration of `approve_shift` from `ctx.supabaseAdmin` to `ctx.supabaseClient` (caller JWT path) MUST re-verify that the RLS predicate fits the expected actor roles BEFORE shipping. The service_role bypass silently absorbs the predicate mismatch until the path is switched.

### Cross-reference — Sortie 1 learnings

The Stop-hook scoped typecheck trap and dist-build requirement documented in HANDOFF-mobile-session-task-defense.md §Learnings L1-L3 apply equally in this worktree. Build `pnpm --filter @smartout/ai build` before editing capability files to avoid phantom TS2307 on subpath imports.

### R1 materialized (in scope, not escalation)

The pgTAP P2 suite was reshaped from its original plan form to use direct JWT PostgREST simulation rather than a mock service_role path. This was required because the `approve_shift` tool's service_role bypass means a test against that tool path would not exercise the RLS policies at all. PostgREST simulation (anon key + `Authorization: Bearer {employee_jwt}`) is the correct test surface for JWT-path policy coverage.

---

## Known Issues / Debt

| ID | Debt | Target |
|----|------|--------|
| K1 | `personal_task` + `emma_task` UPDATE policies have no WITH CHECK predicate — same class of hole as the pre-Sortie-A `shift_approval` | Sortie A.2 (reserved slot) |
| K2 | `schedule_shift` audit migration is comment-only — no `ALTER POLICY` mechanism for tracking policy-level audits. If a future ADR requires automated policy inventory, `ALTER POLICY … COMMENT` or a catalog query approach will be needed | Future ADR (out of scope) |
| K3 | `approve_shift` agent tool still on service_role — safe now, but a future caller-JWT migration needs explicit RLS predicate review (see L-0238) | Track on service_role audit pass |
| K4 | ADR-0298 status still `proposed` — promote to `accepted` after Sortie 2 RPC lands | Sortie 2 |

---

## Next Steps

1. **Close feature** — Pontus runs `close-feature.sh 4` to merge `feat/sortie-a-d6-rls-hardening` to development and remove worktree. (Note: plan frontmatter says `wt-3` — minor drift, actual worktree is `wt-4`. Not blocking.)
2. **Sortie A.2** — `personal_task` + `emma_task` WITH CHECK hardening, if council warrants. Reserved slot.
3. **Sortie 2** — `fn_list_my_tasks` SECURITY DEFINER RPC (ADR-0300). Read path for unified task surface.
4. **Sortie B** — ADR-0298 5-source task ontology expansion. Unblocked after Sortie A close.

---

## Verification Status (8/8 Acceptance Criteria)

Per spec §10:

| # | Acceptance Criterion | Result |
|---|----------------------|--------|
| AC1 | `shift_approval` FOR ALL replaced by per-verb policies | PASS |
| AC2 | UPDATE carries symmetric USING + WITH CHECK on workspace_id | PASS |
| AC3 | Manager-tier USING branch includes role predicate | PASS |
| AC4 | Employee self-confirm branch constrained to employee_profile_id = auth.uid() | PASS |
| AC5 | `schedule_shift` existing policies have audit comments | PASS |
| AC6 | pgTAP P2 — JWT PostgREST simulation: cross-workspace UPDATE blocked (0 rows) | PASS |
| AC7 | pgTAP P3 — same-workspace UPDATE by authorized role succeeds | PASS |
| AC8 | Playwright E2E — cross-workspace forgery attempt returns 204/*/0 or 4xx, no rows affected | PASS |
