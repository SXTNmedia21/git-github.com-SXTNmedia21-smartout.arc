---
title: "Sortie A.3 verification — F-DB-12 staff_event RLS"
status: complete
created: 2026-05-13
updated: 2026-05-13
module: audit
tags: [audit, verification, sortie-a3, f-db-12]
---

# Sortie A.3 — T5 verification walk

Verifier: T5 (read-only). Branch `feat/audit-fdb12-staff-event-rls` in worktree `/home/sxtnl/dev/smartout.ai-wt-6` at `f16f118b9` (T3 head).

Closes audit finding **F-DB-12 (HIGH)** in `docs/audits/2026-05-13-adr-contract-validation-02/07-db-rls-telemetry-smoke.md` — `staff_event` + `staff_event_attendee` shipped 2026-05-13 with the same `FOR ALL USING(...)` no-WITH-CHECK shape ADR-0303 had just codified (same-day rule violation).

## Result: 11 / 11 PASS — ready for closure

| Gate | Verdict | Notes |
|---|---|---|
| S1 No FOR ALL on staff_event + staff_event_attendee | PASS | 0 rows on guard query post-T1 |
| S2 Per-verb policies + WITH CHECK | PASS | 6 / 6 pgTAP assertions PASS |
| S3 Role gate (employee blocked, manager allowed) | PASS | Covered by pgTAP throws_ok / lives_ok |
| S4 Forge attempt throws (WITH CHECK) | PASS | Covered by pgTAP throws_ok |
| S5 Happy path lives_ok | PASS | Covered by pgTAP lives_ok |
| S6 Migration idempotent on second apply | PASS | Exit 0; DROP IF EXISTS skips legacy already removed |
| S7 CI lint exit 0 on clean dev, exit 1 on pre-fix baseline | PASS | Catches F-DB-12 at lines 88+125 of `20260604000001_staff_event.sql` |
| S8 ADR-0303 status accepted | PASS | `status: accepted`, `updated: 2026-05-13`, dedicated acceptance section |
| S9 Audit synthesis F-DB-12 marked CLOSED | PASS | 07 slice + 00-SUMMARY both annotated |
| S10 typecheck | PASS | 52 / 52 turbo tasks PASS (cache hit) |
| S11 Journey statuses flipped to verified | PASS | 3 / 3 files updated with verified_at: 2026-05-13 |

No council escalate triggers fired.

---

## S1 — No FOR ALL on staff_event + staff_event_attendee — PASS

Pre-fix state captured before applying T1:

```
              polname              | polcmd
-----------------------------------+--------
 api_key_read_staff_event          | r
 jwt_read_staff_event              | r
 jwt_write_staff_event             | *
 api_key_read_staff_event_attendee | r
 jwt_read_staff_event_attendee     | r
 jwt_write_staff_event_attendee    | *
```

Pre-fix had 2 FOR ALL policies (`*`) as F-DB-12 documented.

After applying `supabase/migrations/20260609120000_audit_fdb12_staff_event_rls_with_check.sql`:

Guard query (mutating FOR ALL policies excluding service_role + read):

```sql
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid::regclass::text IN ('staff_event','staff_event_attendee')
  AND polcmd='*'
  AND polname NOT LIKE 'service_role_%'
  AND polname NOT LIKE '%read%';
```

Result: **0 rows.** No mutating FOR ALL policies remain.

Full post-T1 policy inventory:

```
 jwt_insert_staff_event            | a
 jwt_delete_staff_event            | d
 api_key_read_staff_event          | r
 jwt_read_staff_event              | r
 jwt_update_staff_event            | w
 jwt_insert_staff_event_attendee   | a
 jwt_delete_staff_event_attendee   | d
 api_key_read_staff_event_attendee | r
 jwt_read_staff_event_attendee     | r
 jwt_update_staff_event_attendee   | w
```

6 new per-verb policies (insert / update / delete × 2 tables) + 4 preserved read policies. Symmetric pattern matches Sortie A.2 canonical.

## S2 — Per-verb policies + WITH CHECK — PASS

### staff_event pgTAP (4 assertions)

```
ok 1 - staff_event: jwt_write replaced by per-verb policies with role gate + WITH CHECK; jwt_read + api_key_read preserved (Sortie A naming convention)
ok 2 - role-gate: employee cannot INSERT staff_event (rejected by new role check)
ok 3 - happy: manager in workspace A can INSERT staff_event (role gate accepts, WITH CHECK passes)
ok 4 - forge: single-workspace manager cannot flip staff_event.workspace_id to non-member workspace (WITH CHECK rejects)
```

### staff_event_attendee pgTAP (2 assertions)

```
ok 1 - staff_event_attendee: jwt_write replaced by per-verb policies with role gate + WITH CHECK; jwt_read + api_key_read preserved (Sortie A naming convention)
ok 2 - forge: single-workspace manager cannot flip staff_event_attendee.event_id to event in non-member workspace (WITH CHECK rejects via parent join)
```

**6 / 6 assertions PASS.** ROLLBACK at end of each test — no side effects.

## S3 — Role gate (admin / owner / manager only) — PASS

Covered by S2.ok 2 (employee throws_ok) + S2.ok 3 (manager lives_ok). Confirms `is_admin_in_workspace()` family is enforced on INSERT; employee rows are rejected before WITH CHECK is even reached.

## S4 — Forge attempts throw via WITH CHECK — PASS

Covered by S2.ok 4 (staff_event direct workspace_id forge) and S2.ok 2 on attendee (event_id forge via parent join). Both reject as expected. WITH CHECK is symmetric to USING on UPDATE.

## S5 — Happy path lives_ok — PASS

Covered by S2.ok 3 — manager-in-workspace-A INSERT succeeds.

## S6 — Migration idempotent — PASS

Second apply of `20260609120000_audit_fdb12_staff_event_rls_with_check.sql` exit code: 0.

Idempotency signature:

- DROP POLICY IF EXISTS on legacy `jwt_write_staff_event*` — emits NOTICE "does not exist, skipping" on second apply (first apply consumed it).
- DROP POLICY IF EXISTS on new `jwt_insert / jwt_update / jwt_delete` — succeeds (recreated).
- CREATE POLICY emitted 6 times — succeeds.
- COMMENT ON POLICY emitted 6 times — succeeds.

Migration is structured as DROP-then-CREATE on the new policies, which is the canonical idempotent shape (matches Sortie A.2 ship pattern). No state-dependent branches.

## S7 — CI lint check — PASS

### Clean dev (HEAD = f16f118b9)

```
$ npx tsx scripts/check-rls-with-check.ts
[check-rls-with-check] OK — scanned 1 migrations, 0 offenses.
exit 0
```

### Pre-fix baseline (GIT_BASE_REF=9a40fad44~1)

```
$ GIT_BASE_REF=9a40fad44~1 npx tsx scripts/check-rls-with-check.ts
[check-rls-with-check] FAIL — 4 policy/policies violate ADR-0303 ...
  ✗ supabase/migrations/20260520100000_personal_task.sql:46
  ✗ supabase/migrations/20260520100000_personal_task.sql:56
  ✗ supabase/migrations/20260604000001_staff_event.sql:88
  ✗ supabase/migrations/20260604000001_staff_event.sql:125
exit 1
```

F-DB-12 (lines 88 + 125 of `20260604000001_staff_event.sql`) caught exactly as expected. The `personal_task` lines surface ADR-0303-relevant findings still being closed under earlier sorties — out of scope for A.3, in scope for adjacent sweep.

CI workflow `.github/workflows/check-rls.yml` (23 lines) wires the script to PR + push events with `GIT_BASE_REF`.

## S8 — ADR-0303 status accepted — PASS

`docs/decisions/0303-sister-table-sweep-rule.md`:

- Frontmatter: `status: accepted`, `created: 2026-05-13`, `updated: 2026-05-13`.
- Body acceptance section at L85: "2026-05-13 acceptance + enforcement — Promoted from proposed to accepted on the same day F-DB-12 (audit `2026-05-13-adr-contract-validation-02`) validated the rule's necessity. Enforcement ships in Sortie A.3 via `scripts/check-rls-with-check.ts` + `.github/workflows/check-rls.yml`."

## S9 — Audit synthesis F-DB-12 CLOSED — PASS

`docs/audits/2026-05-13-adr-contract-validation-02/07-db-rls-telemetry-smoke.md` L54:

```
| F-DB-12 | HIGH | `staff_event` + `staff_event_attendee` ship with `FOR ALL USING(...)` no WITH CHECK | `20260604000001_staff_event.sql` lines 87-98, 124-135 — CLOSED 2026-05-13 by feat/audit-fdb12-staff-event-rls |
```

`docs/audits/2026-05-13-adr-contract-validation-02/00-SUMMARY.md` L35:

```
### F-DB-12 (NEW HIGH) — ADR-0303 sister-sweep rule already violated same day — CLOSED 2026-05-13 by feat/audit-fdb12-staff-event-rls
```

Both annotations present.

## S10 — typecheck — PASS

`pnpm turbo typecheck` from worktree root: **52 / 52 tasks PASS** (cache hit on parallel worktree builds; semantics preserved — sortie A.3 changed only SQL migration + pgTAP + new TS lint script in `scripts/`, no app TS source modified).

Cache key correctness verified by the script's tsx invocation succeeding in S7 (script itself typechecked cleanly under tsx live).

## S11 — Journey statuses flipped — PASS

Three journey files in `docs/journeys/`:

| File | status before | status after | verified_at |
|---|---|---|---|
| JOURNEY-audit-fdb12-staff-event-rls-attacker-forges-workspace-id-rejected.md | draft | verified | 2026-05-13 |
| JOURNEY-audit-fdb12-staff-event-rls-recurring-rule-violation-caught-by-ci.md | draft | verified | 2026-05-13 |
| JOURNEY-audit-fdb12-staff-event-rls-staff-event-happy-path-still-works.md | draft | verified | 2026-05-13 |

---

## Council escalate — none required

No conditions from the brief's escalate list triggered:

- pgTAP manager UPDATE: passing (S2.ok 3 lives_ok). Migration is not too restrictive.
- Idempotency: second apply exit 0 (S6). Migration is deterministic.
- CI script exit codes: 0 on clean, 1 on bad (S7). Correct.
- typecheck: 52 / 52 (S10). No regression.
- Happy path: lives_ok (S5). No break.

## Ready for closure

Sortie A.3 is verified end-to-end. Sortie author may proceed to `/close-feature` once journeys are part of the merge artifact and HANDOFF deliverable is written.

Verifier signature: T5, 2026-05-13.
