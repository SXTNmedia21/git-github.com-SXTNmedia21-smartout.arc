---
title: Drawer→API boundary requires end-to-end shape verification
id: LEARNING_0026
status: canonical
layer: learning
created: 2026-04-07
updated: 2026-04-07
module: contracts
tags: [api, zod, ui, code-review]
---

# Learning-0026: Drawer→API boundary requires end-to-end shape verification

## Context

During the employee contract management feature, the first council review approved
the implementation after fixing column names, telemetry, auth headers, etc. A second
council re-review traced the end-to-end send-contract flow and discovered the drawer
and the API route disagreed on BOTH request and response shape — silently:

- Drawer sent `{field_values: {...}}` but Zod schema expected `{overrides: {...}}`
- Zod silently strips unknown keys, so `field_values` was dropped without error
- Drawer destructured `{id, employee_name}` from the response, but the route returned
  `{contract_id, recipient_name, ...}`
- The destructured `id` was `undefined`, causing the next fetch to hit
  `/api/contracts/undefined/send` → 404 → broken send flow

The first review missed this because reviewers verified each side in isolation:
the drawer code "looked right", the route code "looked right", typecheck passed
(local TypeScript types declared `id: string` so the drawer's type annotation lied
about the runtime data).

## Discovery

For any feature that mutates via a drawer/form calling a Next.js route, code review
MUST trace the exact payload field names from:

1. UI component →
2. fetch body →
3. Zod schema (route handler) →
4. DB insert/service call →
5. Response shape →
6. UI component consumer

Grep for every field name on both sides. The fact that TypeScript passes does NOT
prove the runtime shapes match — local type annotations on `await response.json()`
are unchecked claims about the API contract.

Zod's default behavior (`.strict()` is opt-in) silently strips unknown keys. This
means a drawer can send the wrong field name and the API will return 200 having
processed nothing. This is a class of bug that typecheck cannot catch.

## Impact

### For code review

When reviewing any feature with a drawer/form → API route → DB flow, the reviewer
must:

1. Open the component file and the route file side by side
2. Compare every key in the fetch body to every key in the Zod schema
3. Compare every key destructured from the response to every key returned by the
   route handler
4. Grep for the field names across both sides to verify no drift

### For testing

Add an API-level Playwright test (`apps/e2e/tests/contracts-api.spec.ts`) that POSTs
to the route with the exact body shape the UI sends. If anyone changes the schema
field name without updating the UI, this test fails. Pure unit/typecheck cannot
catch this — only an integration test that exercises the actual HTTP boundary can.

### For Zod schemas

Consider using `.strict()` on Zod object schemas for API request bodies. This makes
unknown keys a parse error instead of silent stripping. The trade-off is that
forward-compatible API evolution becomes harder, but for internal-only routes the
strictness is worth it.

## References

- ADRs from feature: docs/decisions/0000-decision-log.md (employee-contract-management)
- Council session: docs/council/COUNCIL-LOG.md 2026-04-06 entry
- Regression test: apps/e2e/tests/contracts-api.spec.ts
- Files involved:
  - apps/web/src/app/api/contracts/route.ts (Zod schema)
  - apps/web/src/app/dashboard/contracts/_components/contract-send-drawer.tsx (fetch body + response handling)

---

> Registered in `docs/learnings/0000-learning-log.md`.
