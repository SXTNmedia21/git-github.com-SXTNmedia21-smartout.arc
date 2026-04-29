---
title: "Role Enum Assumption Trap — payroll_admin doesn't exist"
id: LEARNING_0180
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [role, enum, council, chair-self-reversal, contract-module]
---

# Learning-0170: Role Enum Assumption Trap

## Context

Council 2026-04-29 chair (Steward) Phase 3 review of Contract Module Phase 0a flagged "PII columns adding without payroll-admin RLS = breach risk on day one" (Severity-2 finding 1.11). Phase 5 chair self-reversal: Harness + Coord code-trace showed `payroll_admin` role does NOT exist in codebase — `engine_authority_config.min_role` enum is `employee | manager | admin | owner`. Existing seed `20260515170500_*` covers ALL contract tools under one row at `min_role='admin'`. ARCH §9 PII boundary collapses to plain `admin` — the role text was aspirational, not implemented.

This is the third documented chair self-reversal precedent (Year Wheel Redesign 2026-04-20, /dashboard/help 2026-04-28, this).

## Discovery

When a council briefing or ADR cites a role/enum value by name, verify the value exists in:
1. `engine_authority_config.min_role` enum in current `database.types.ts`
2. RLS helper functions (`is_admin_in_workspace`, `get_workspace_ids_for_user`, etc.)
3. Any role-checking code path

Aspirational role names ("payroll_admin", "auditor", "framework_steward") frequently appear in architecture docs without backing enum entries. Assumption trap: chair takes role name at face value, downstream reviewers code-trace and prove it doesn't exist.

Pattern signature:
- ARCH §security/access/governance section names a role
- No `ALTER TYPE ... ADD VALUE` migration for that role exists
- RLS helpers don't reference the role
- Existing capability seeds collapse to lowest-common-denominator (`admin`)

## Impact

**Phase 2.5 fact-check for ADRs citing role names MUST grep:**
```bash
grep -E "<role-name>" packages/supabase/src/database.types.ts supabase/migrations/*.sql packages/supabase/src/rls/*.ts
```
Zero matches = role aspirational, ADR must either add `ALTER TYPE` migration OR replace with capability split (preferred per ADR-0234).

**Chair Self-Reversal Protocol applies (3rd documented precedent):** when reviewer code-trace falsifies chair's role-name claim, chair MUST mark Phase 3 finding as REVERSED, not REFINED.

**ADR template addendum (proposed):** when ADR introduces access-control concern, MUST cite either (a) existing role enum value verbatim, or (b) capability split per ADR-0234, or (c) ALTER TYPE migration to add new role.

## References

- ADR-0234 (capability split — alternative to role enum extension)
- ADR-0192 (authority seed bootstrap)
- Year Wheel Redesign Council 2026-04-20 (precedent 1)
- /dashboard/help Council 2026-04-28 (precedent 2)
- Council 2026-04-29 Contract Module Phase 0a (precedent 3)
- L-0147 (chair self-reversal pattern) — promoted to SKILL.md after this third occurrence

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
