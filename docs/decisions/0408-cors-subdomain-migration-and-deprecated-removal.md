---
title: "CORS Subdomain Migration — Permanently Kill Recurring Bug"
id: ADR-0408
status: accepted
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0408: CORS Subdomain Migration — Permanently Kill Recurring Bug

## Context and Problem Statement

Smartout is multi-tenant. Each workspace is served from `{slug}.smartout.ai` (a subdomain of
`smartout.ai`). All Edge Functions that accept browser fetch requests must echo the requesting
origin in `Access-Control-Allow-Origin`; browsers treat `https://smartout.ai` and
`https://acme.smartout.ai` as different origins and block mismatched responses.

The codebase had a deprecated static constant `corsHeaders` in `_shared/cors.ts` that hardcoded
`"Access-Control-Allow-Origin": "https://smartout.ai"` — the apex domain only. This triggered the
following prod CORS error on 2026-05-23:

```
Access to fetch at 'https://yljaglomadbhyqpcigff.supabase.co/functions/v1/activate-workspace'
from origin 'https://smartout.smartout.ai' has been blocked by CORS policy:
The 'Access-Control-Allow-Origin' header has a value 'https://smartout.ai' that is not equal
to the supplied origin.
```

This was the **fourth** time a CORS fix was attempted without permanently removing the deprecated
export. Each prior partial fix left `corsHeaders` alive:

- **ADR-0171 (2026-03)** — introduced suffix-match `getCorsHeaders(req)` as the correct
  replacement, but kept the deprecated export for backward compatibility.
- **Partial fix #2** — several functions migrated at that time; others missed.
- **Partial fix #3** — another round of migrations, still incomplete.
- **Partial fix #4 (hotfix before this ADR)** — migrated more functions but left the export.

Each partial fix reset the "time-to-next-occurrence" clock without closing the structural hole.

## Decision Drivers

- Every workspace-subdomain request was blocked by CORS if routed to a non-migrated EF.
- The deprecated `corsHeaders` export continued to exist as a landmine for new EFs.
- No CI enforcement existed — a new contributor copying an old EF would reintroduce the bug.
- The fix itself (`getCorsHeaders(req)`) already existed and was correct since ADR-0171.

## Considered Options

1. **Migrate all 32 EFs + delete deprecated export + add CI gate** (chosen)
2. **Migrate all 32 EFs, keep deprecated export** — leaves the landmine; next partial-copy resets
   the clock again.
3. **Wildcard ACAO (`*`)** — rejected: breaks credentials mode (`Authorization` header requires
   explicit origin echo; Supabase JS sends `Authorization: Bearer …`).

## Decision Outcome

Chosen option: **Option 1** — complete migration + deletion + enforcement.

### Migration scope

All 32 Edge Function files that imported `corsHeaders` from `_shared/cors.ts` were migrated to
`getCorsHeaders(req)`. For the `workspace-api` gateway (which routes through a typed
`RouteHandler` where handlers do not have direct `req` access), the gateway computes
`const cors = getCorsHeaders(req)` once and threads it as a third parameter to all handlers.
`RouteHandler` type was updated accordingly:

```ts
type RouteHandler = (
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
  cors: Record<string, string>,
) => Promise<Response>;
```

Two files (`ops-monitor/index.ts` and `journey-stuck-detector/index.ts`) define their own local
`corsHeaders = { "Access-Control-Allow-Origin": "*" }` with wildcard — they are NOT imported
from `_shared/cors.ts` and use wildcard (not a hardcoded https URL), so they are out of scope
for this migration and pass the CI gate as-is.

### Deprecated export removal

`export const corsHeaders` was removed from `supabase/functions/_shared/cors.ts`. The file now
exports only `isAllowedOrigin` and `getCorsHeaders`.

### CI enforcement gate

`scripts/check-cors-pattern.mjs` was added. It scans all `.ts` files under
`supabase/functions/` (skipping `_shared/cors.ts` itself and `*.test.ts` / `*.spec.ts`) and
fails (exit 1) if any file:

1. Imports a symbol named `corsHeaders` from `_shared/cors.ts` (deprecated import pattern).
2. Contains a hardcoded `Access-Control-Allow-Origin: https://...` value (any explicit HTTPS URL
   that is not a wildcard and not a dynamic echo).

The gate is wired into:

- `package.json` as `"check:cors": "node scripts/check-cors-pattern.mjs"`
- `.husky/pre-push` (after `lint:tool-collisions`, before `check-otp-coherence.mjs`)
- `.github/workflows/ci.yml` (step in `format` job)

## Rules & Consequences

- **Good:** New EFs that copy an old file and forget to update CORS will be caught at push time.
  Regression is now structurally impossible — the gate runs before any PR can be opened.
- **Good:** The correct pattern is simple: `import { getCorsHeaders } from "../_shared/cors.ts";`
  + `const cors = getCorsHeaders(req);` at the top of the handler.
- **Good:** Wildcard ACAO (`*`) is still caught by the gate (Pattern 2), so contributors cannot
  work around the fix with a new hardcoded constant.
- **Bad:** The `workspace-api` handler pattern (threading `cors` as a third param) is slightly
  more verbose than standalone EFs — but it is explicit and type-safe.
- **Agent Impact:** Any new EF MUST use `getCorsHeaders(req)` from `_shared/cors.ts`. The CI gate
  will block push if it detects either deprecated import or hardcoded ACAO URL.

## Historical Predecessor

ADR-0171 (2026-03) introduced `getCorsHeaders(req)` with the suffix-match approach. This ADR
closes the loop ADR-0171 opened by deleting the deprecated export it kept for compatibility.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in
> `CLAUDE.md`.
