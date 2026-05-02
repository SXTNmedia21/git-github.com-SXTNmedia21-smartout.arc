---
title: "Defense-in-depth ownership re-check on owner-scoped admin pages"
id: ADR_0257
status: accepted
layer: decision
created: 2026-05-02
updated: 2026-05-02
module: billing
tags: [apps-admin, security, ownership, rls, gdpr]
---

# ADR-0257: Defense-in-depth ownership re-check on owner-scoped admin pages

## Context and Problem Statement

`apps/admin` is a single-tenant accountant surface where a mis-written RLS policy or a schema migration that drops a policy clause would silently expose another accountant's data. The billing schema queries currently use `as any` casts (pending type-regen that includes the billing schema), which bypass TypeScript's type-level safety guarantees. The forgeable-ID class of bugs (L-0177) establishes that relying on a single enforcement layer — RLS — is insufficient when that layer can regress through normal maintenance operations such as migration edits, policy rewrites, or schema refactors.

## Decision Drivers

- A cross-accountant data leak in a single-tenant admin surface is catastrophic for trust and constitutes a GDPR Art. 32 breach.
- `as any` casts on billing-schema queries make ownership constraints invisible to the TypeScript compiler.
- RLS is correct but fragile: policy regressions are silent at runtime — they produce wrong data, not exceptions.
- ADR-0151 mandates server-side ID derivation; this ADR extends the same principle to ownership verification at the page level.
- The code-level check adds ~2–3 lines per detail page — an acceptable cost for the protection provided.

## Considered Options

1. **Defense-in-depth: explicit ownership check in page/route code after RLS-scoped query**
2. **Trust RLS alone** — no additional check
3. **Move ownership check to middleware** — shared layer across all routes

## Decision Outcome

Chosen option: **"Defense-in-depth: explicit ownership check in page/route code after RLS-scoped query"**, because it is a deterministic kill-switch that survives RLS regressions and makes ownership intent visible at every call site.

**Implementation contract:**

Every owner-scoped detail page and API route in `apps/admin` MUST perform an explicit ownership check AFTER the RLS-scoped query:

```ts
// Page (Server Component)
const { data: entity } = await userClient
  .from('settlement_run')
  .select('*')
  .eq('id', runId)
  .maybeSingle();

if (!entity) notFound();                          // RLS denied or row missing
if (entity.initiated_by !== userId) notFound();   // Defense-in-depth
```

```ts
// API Route Handler
const { data: entity } = await userClient
  .from('settlement_run')
  .select('*')
  .eq('id', runId)
  .maybeSingle();

if (!entity) return NextResponse.json({ error: 'not_found' }, { status: 404 });
if (entity.initiated_by !== userId)
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
```

Rules:
- The ownership column varies per entity (`initiated_by`, `owner_id`, `accountant_id`, etc.) — use the correct column for the table in question.
- Pages return `notFound()` on mismatch (renders 404, leaks no information about existence).
- API routes return 403 on mismatch (explicit forbidden, distinct from 404).
- The RLS-scoped query uses the **user-scoped Supabase client** (JWT auth). The ownership check operates on the returned row — no second DB round-trip.
- Do NOT skip this check even when a migration comment says "RLS covers this" — comments drift; code does not.

**Why middleware is not the answer:** ownership columns differ per entity type. A middleware that could generalise this check would need entity-type routing logic that duplicates the page's own query — more complexity, not less.

## Rules & Consequences

- **Good, because** an RLS misconfiguration becomes a code-detected 404/403 instead of a silent data leak.
- **Good, because** ownership intent is explicit and grep-able at each call site — no hidden policy file to audit.
- **Good, because** satisfies the forgeable-ID principle (L-0177) at the presentation layer.
- **Bad, because** 2–3 lines of boilerplate per detail page/route. Acceptable given the protection value.
- **Bad, because** if `as any` casts are removed (types regen includes billing schema), TypeScript will not automatically enforce the check — it must still be written explicitly.
- **Agent Impact:** any engineer adding a detail page or API route in `apps/admin` that fetches an owner-scoped entity MUST include the explicit ownership check. Code review should block merges that omit it.

---

## References

- L-0177 — forgeable-ID class
- ADR-0151 — server-side ID derivation (no body-supplied IDs)
- ADR-0004 — Unified Telemetry (audit trail context)
- M7c implementation: `apps/admin/src/app/(admin)/avstemming/[run_id]/page.tsx` (~line 70), `apps/admin/src/app/api/avstemming/[run_id]/artifact/[type]/route.ts` (~line 69)

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
