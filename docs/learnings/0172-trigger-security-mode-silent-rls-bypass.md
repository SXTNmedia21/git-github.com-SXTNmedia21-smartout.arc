---
title: "Trigger SECURITY Mode = Silent RLS Bypass Vector"
id: LEARNING_0172
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [migration, trigger, rls, security, council, contract-module]
---

# Learning-0172: Trigger SECURITY Mode = Silent RLS Bypass Vector

## Context

Council 2026-04-29 Supervisor Layer 3 review of Contract Module Phase 0a migration found `compute_obligation_due_at` trigger declared with `LANGUAGE plpgsql` only — no `SECURITY DEFINER` or `SECURITY INVOKER`. Default = INVOKER, meaning function runs with caller's RLS posture. Trigger does `SELECT start_date FROM employment_contract WHERE id = NEW.contract_id` — RLS-filtered. If client inserts obligation against contract they cannot see (cross-workspace), SELECT returns 0 rows, `contract_start_date = NULL`, `due_at = NULL` silently. No error raised. **Silent cross-workspace data corruption.**

## Discovery

PL/pgSQL functions inherit caller's privileges by default. Trigger functions doing cross-table SELECT under default INVOKER mode silently compute NULL/empty results when caller can't see referenced rows. No RAISE, no constraint violation — query returns successfully, downstream code reads NULL.

Pattern signature:
- Trigger function declared `LANGUAGE plpgsql` without explicit SECURITY clause
- Function body contains `SELECT ... FROM <other_table>` 
- RLS enabled on `<other_table>`
- INSERT path on trigger target table accepts caller-supplied FK value
- No `IF NOT FOUND THEN RAISE` guard

Result: cross-workspace inserts succeed but produce silently-corrupt rows. Audit logs show successful insert. Downstream queries return inconsistent data.

Closely related: Postgres `search_path` injection — DEFINER functions without explicit `SET search_path = public, pg_temp` are vulnerable to schema-shadowing attacks.

## Impact

**Migration policy (enforced via ADR-0235):** Every trigger function doing cross-table SELECT MUST:
1. Specify `SECURITY DEFINER` explicitly
2. `SET search_path = public, pg_temp` (or appropriate restricted path)
3. Validate input row visibility — `IF NOT FOUND THEN RAISE EXCEPTION 'cross-workspace insert blocked'`

**Phase 2.5 fact-check for migrations introducing triggers MUST grep:**
```bash
grep -E "LANGUAGE plpgsql\s*(\$\$|AS|SECURITY)" <migration> | grep -v "SECURITY DEFINER\|SECURITY INVOKER"
```
Any plpgsql function without explicit SECURITY clause = REJECT.

**Council Phase 5 Trust Gate:** trigger without SECURITY mode declaration on RLS-touching tables = pipeline cannot keep promise (silent corruption).

**Layer 3 (Supervisor) review checklist:** for every trigger function in migration, verify SECURITY mode + search_path + visibility check. Expanded from this council session.

## References

- ADR-0233 (contract schema migration — enforces SECURITY DEFINER on `compute_obligation_due_at`)
- ADR-0235 (obligation lifecycle trigger semantics — paired)
- Council 2026-04-29 Contract Module Phase 0a (Supervisor Layer 3 finding)
- Postgres docs: SECURITY DEFINER + search_path injection

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
