---
title: "Vitest fluent-mock chains pass without validating .eq() / .select() column arguments"
id: L_0230
status: accepted
layer: learning
created: 2026-05-09
updated: 2026-05-09
sibling_to:
  - L_0176
relates_to:
  - ADR_0151
  - L_0177
council_session: 2026-05-09 Payroll Phase 5 Closure Review
---

# L-0230 — Fluent-mock chains skip column validation

## What we discovered

Phase 5 PII reveal tools (`view_personal_number`, `view_bank_account`) shipped with `.eq("id", params.profile_id)` against the `profile` table — but `profile` table PK is `profile_id`, not `id`. The bug would return `not_found` for **every production call**.

13 vitest assertions (8 view-pii + 5 update-payroll-profile) all passed. Council code-trace caught it. Tests didn't.

Same session also caught `tax_municipality_code` written + read by capability tools but column doesn't exist anywhere in `database.types.ts` or migrations. Same root cause: tests verify behavior shape, not query shape.

## Why tests missed it

Existing mock pattern (Phase 5 view-pii.test.ts before fix):

```typescript
const fromSpy = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { personal_number: "12345..." }, error: null }),
      }),
    }),
  }),
});
```

The mock returns canned data regardless of which columns `.eq()` was called with. `.eq("id", ...)` and `.eq("profile_id", ...)` produce the same test output because the mock doesn't care.

## Why this is the same class as L-0176

L-0176 says "docstrings drift from bodies — verify body, not docstring." This learning extends it: **tests can drift from queries** the same way. A test that mocks `from()` returning canned data tests that the tool reads SOMETHING — not that the tool reads the RIGHT thing.

Both are "claim vs reality" failures:
- L-0176: docstring claims X, body does Y
- L-0230: tests claim X works, queries actually read Y

## How to apply

When mocking Supabase fluent chains in vitest:

1. **Use vi.fn() spies on each step**, not blind `mockResolvedValue`
2. **Assert column arguments after tool execution:**
   ```typescript
   expect(mockFrom).toHaveBeenCalledWith("profile");      // table name
   expect(mockEq).toHaveBeenNthCalledWith(1, "profile_id", TARGET_ID);  // column name
   expect(mockEq).toHaveBeenNthCalledWith(2, "workspace_id", WS_ID);    // workspace check
   ```
3. **Assert SELECT column list** if the test cares about returned shape:
   ```typescript
   expect(mockSelect).toHaveBeenCalledWith("personal_number, workspace_id");
   ```
4. **Red-green verify** — temporarily revert the column name, confirm test fails, restore, confirm test passes. If the test doesn't fail on revert, the assertion isn't doing its job.

## Pre-merge checklist (when reviewing capability tools)

- [ ] Every `.from(...)` argument grepped against `database.types.ts` table names
- [ ] Every `.eq(...)` first-arg grepped against the table's Row type column list
- [ ] Every `.select(...)` column list verified against schema
- [ ] Tests assert column args, not just response shape
- [ ] Red-green cycle proves the assertion catches the bug

## Related

- **L-0176** (docstring-body drift) — sibling pattern; both ship apparent-correctness
- **ADR-0151** (cross-workspace forgery) — workspace_id constraint shape was correct; the OTHER `.eq("id", ...)` was wrong
- **L-0177** (fail-fast on row-not-found) — bug surfaced as "not_found" because the WHERE clause matched zero rows, not because no rows existed
- Council session 2026-05-09 — REJECT verdict on Phase 5 closure based on Agent-coordinator code-trace catching this bug
