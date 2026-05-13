---
title: "Audit Smoke Re-run — 2026-05-13 post-wave-1"
status: complete
created: 2026-05-13
updated: 2026-05-13
mode: smoke
run_id: 2026-05-13-adr-contract-validation-02
baseline: 2026-05-13-adr-contract-validation
slices_run: 3
purpose: verify wave-1 closures (F-DB-09, F-OB-10-01, F-CL-11, F-EF-03) + zero new CRITICAL/HIGH
tags: [audit, smoke, post-wave-1]
---

# Audit Smoke — 2026-05-13 post-wave-1

## Verdict

**PARTIAL PASS** — all 4 wave-1 closures verified stuck; **1 NEW HIGH discovered**: F-DB-12 (`staff_event` migration violates ADR-0303 sister-sweep rule).

## Score

| Closure | Severity | Slice | Verdict |
|---|---|---|---|
| F-DB-09 (3 D6 sister tables WITH CHECK) | CRITICAL | 07 | PASS |
| F-DB-10 (personal_task WITH CHECK) | HIGH | 07 | PASS |
| F-OB-10-01 (17 legacy onboarding files) | CRITICAL | 01 + collateral | PASS |
| F-CL-11 (legal voice channel cut) | CRITICAL | 01 | PASS |
| F-EF-03 (5 intelligence EFs auth) | HIGH/ops | 03 | PASS (5/5) |
| **F-EF-04 (bonus — useOnboardingState.ts deletion)** | HIGH | 03 collateral | **PASS** — closed by Sortie B |

**5 wave-1 closures verified + 1 bonus closure (F-EF-04 by Sortie B collateral).**

## New findings (smoke scope)

### F-DB-12 (NEW HIGH) — ADR-0303 sister-sweep rule already violated same day — CLOSED 2026-05-13 by feat/audit-fdb12-staff-event-rls

`supabase/migrations/20260604000001_staff_event.sql` (shipped 2026-05-13 via ADR-0285 staff_event work):
- `jwt_write_staff_event` — `FOR ALL USING(...)` no WITH CHECK on workspace-scoped table
- `jwt_write_staff_event_attendee` — same shape

This is the EXACT pattern Sortie A.2 closed across 4 sister D6 tables (`department_session`, `session_hook`, `deviation`, `personal_task`) AND that ADR-0303 (proposed today) codifies as forbidden.

**Severity: HIGH** — same gap class as F-DB-09 was (CRITICAL there because 3 D6 sister tables; HIGH here because 2 less-trafficked tables but identical attack surface).

**Recommendation:** Sortie A.3 — apply same per-verb WITH CHECK pattern to `staff_event` + `staff_event_attendee`. Mechanical, sub-day, mirror of A.2.

**Meta:** This validates the ADR-0303 sister-sweep rule — the pattern would have caught this PRE-merge if the rule were CI-enforced. ADR-0303 should escalate from `proposed` to `accepted` + ship lint check.

## Slice-by-slice findings

| Slice | New CRITICAL | New HIGH | Note |
|---|---|---|---|
| 01 capability-tools | 0 | 0 | F-CL-11 verified at `legal/index.ts:62`. Task capability (ADR-0298) ship is clean — 18 writes all gate-fenced via `gateTaskAction`. |
| 03 edge-functions | 0 | 0 | F-EF-03 verified 5/5. F-EF-04 closed by Sortie B (useOnboardingState deleted). F-EF-02a still open (out of wave-1 scope). |
| 07 db-rls-telemetry | 0 | **1 (F-DB-12)** | F-DB-09 + F-DB-10 verified per migration `20260608120000`. ADR-0303 rule already breached same day on `staff_event`. |

## Delta vs 2026-05-13 baseline

| Bucket | Pre-wave-1 | Post-wave-1 |
|---|---|---|
| CRITICAL open | 3 | 0 |
| HIGH open (smoke scope) | ~5 in smoke surface | ~3 in smoke surface (+ 1 new F-DB-12) |
| Closed this wave | 0 | 5 (F-DB-09, F-DB-10, F-OB-10-01, F-CL-11, F-EF-03) + 1 collateral (F-EF-04) |
| Regressed (rule violation same-day) | n/a | 1 (F-DB-12 violates ADR-0303 proposed today) |

## Promotion-safety verdict

Original blockers (3 CRITICAL + F-EF-03 money vector): **ALL CLOSED**.

New blocker emerged in smoke scope: **F-DB-12 (HIGH)** — not CRITICAL but actively trending wrong direction on a rule we just shipped.

**Recommendation:** Sortie A.3 to close F-DB-12 before campaign promotion. Sub-day mechanical fix mirroring A.2 pattern.

## Skipped per smoke scope

- 11 of 14 slices not re-run (full audit is too heavy for verification cycle)
- Synthesis skipped (smoke mode default)
- 40 HIGH baseline findings outside the 3 smoke slices not re-verified — assumed unchanged

## Additional closures (post-smoke)

### SE-02-01 (CLOSED) — botsson/chat BFF trusted body-supplied profileId

**Sortie:** `feat/audit-adr0151-derivation`

`apps/web/src/app/api/botsson/chat/route.ts` injected `body.primeContext.profileId` into the LLM context prefix without server-verification. ADR-0151 spirit violation — a forged profileId could pollute LLM audit context.

**Fix:** Route now server-verifies `body.primeContext.profileId` via `admin.from("profile").select().eq("profile_id", ...).eq("workspace_id", ...)`. Only the workspace-confirmed profile_id is interpolated. Forged IDs silently drop the context line.

**Vitest:** `apps/web/src/app/api/botsson/chat/__tests__/route.test.ts` — 5 tests, all pass. Forge test explicitly verifies forged ID not present in forwarded message.

### F-MO-06 (CLOSED) — submit_own_pii RPC used body-supplied workspace_id in audit trail

**Sortie:** `feat/audit-adr0151-derivation`

`submit_own_pii` RPC passed `p_workspace_id` (body-supplied) directly into `activity_trail.workspace_id`. While the PII write was safe (profile lookup used `auth.uid()`), audit attribution could be forged to a different workspace.

**Fix:** Migration `20260514000010_secure_submit_own_pii.sql` — RPC now derives `v_workspace_id` from the profile row resolved via `auth.uid()`, validates it matches `p_workspace_id`, raises exception on mismatch. `activity_trail` INSERT uses `v_workspace_id` (server-derived) only.

Mobile caller `apps/mobile/app/(app)/(me)/contract/complete-data.tsx` updated with ADR-0151 comment documenting the server-validation contract.

## References

- 2026-05-13 full audit: `docs/audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md`
- Wave-1 closures:
  - F-DB-09 + F-DB-10: A.2 merge `20a573288`
  - F-OB-10-01 + F-OB-10-04: Sortie B merge `2c3e4b1eb`
  - F-CL-11: direct dev `47bffe635` + synthesis `21183e9aa`
  - F-EF-03: Sortie C merge `bfa977e92`
- ADR-0303 (proposed): `docs/decisions/0303-sister-table-sweep-rule.md`
- New finding F-DB-12 details: `01-capability-tools-smoke.md`, `03-edge-functions-smoke.md`, `07-db-rls-telemetry-smoke.md` (this run folder)
- SE-02-01 + F-MO-06 sortie: `feat/audit-adr0151-derivation` — commit SHA added at close-feature time
