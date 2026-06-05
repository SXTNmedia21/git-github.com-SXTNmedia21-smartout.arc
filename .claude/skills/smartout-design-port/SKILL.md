---
name: smartout-design-port
description: >
  AUTHORITATIVE recipe for porting ONE SmartOut design domain onto the existing live app —
  copy-not-rewrite, reuse-first, page by page, as a side-by-side `-v2` route. Load before
  converting any design page/domain from the Nordic Split handoff. Encodes the proven 4-file
  pattern extracted from the sandbox reference ports (oversikt-v2, min-dag-v2).
  Triggers (EN): design port, port a page, re-skin route, design handoff, -v2 page, toDesignShape,
  copy-not-rewrite, convert design domain, wire design to backend, faithful port.
  Triggers (NO): porte design, re-skin rute, konverter side, design-implementering, vaktplan-v2,
  oversikt-v2, ansatte-v2, port domene.
  ALWAYS load before creating or editing a `dashboard/<domain>-v2/` route.
---

# SmartOut Design Port

Port ONE design domain onto the existing app. The design is **finished** — you **copy it 1:1** and
wire it to real data. You do **not** redesign. Reference ports (the fasit):
`oversikt-v2/` (complex) + `min-dag-v2/` (simple) in the sandbox.

## The 4-file unit (the only shape)

```
apps/web/src/app/dashboard/<domain>-v2/
  page.tsx                  # async Server Component
  _lib/to-design-shape.ts   # pure adapter, no React/Supabase
  _components/<Name>.tsx     # "use client" — verbatim design JSX
  _components/<domain>.css   # verbatim design CSS
```

`-v2` suffix is mandatory: the new route lives **beside** the production route — reversible, never
overwrites until an explicit promotion decision.

## The copy law (non-negotiable)

Design JSX/CSS/classNames are done. Copy verbatim. **Only these 6 plumbing changes are allowed:**

1. IIFE / `window.SO_PAGES[route]` → `"use client"` + `export default function`
2. `const {useState} = React` → `import { useState } from "react"`
3. `window.Ic` → local `Ic` shim (same `n="name"` prop → `lucide-react`)
4. `window.useToast()` → `sonner` `toast`; `toast(msg,{undo})` → `toast(msg,{action:{label:"Angre",onClick}})`
5. props injected via a typed `Props` interface (not `window.setRoute`)
6. `emit()` added at each mutation / navigation call-site

**Zero markup nodes added or removed.** Output line count ≈ source. ~2× source = a rewrite → reject, redo as copy. Fidelity is disk-checkable: className/selector/JSX-line counts ≈ design source.

## page.tsx (server)

- Resolve context server-side: `resolveDashboardContext()` from `../_data/resolve-page-context` (hidden prereq — verify it exists). Never trust a client-supplied `workspace_id` (ADR-0151).
- All fetches via `Promise.all()` (parallel). `createClient()` from `@smartout/supabase/server`.
- Schema traps: `timesheet.*` and `payroll.*` need `.schema("timesheet")`/`.schema("payroll")` before `.from()`.
- Call `toDesignShape(...)`, pass typed props to the client component. No ambience at route level (ADR-0115).

## to-design-shape.ts (adapter)

- Pure function(s): backend rows → the exact `DesignXxx` shape the JSX reads. No Supabase, no React.
- Declare explicit `DesignXxx` interfaces matching what the JSX reads (not the backend row shapes).
- Every field with no backend source = a `// GAP:` comment with reason + default. Gaps live HERE only — never scattered through the markup.
- **No ghost data:** real source or honest empty state. Never fabricate/`Math.random()`.

## Tokens + telemetry

- **Tokens:** only department hex → `@smartout/design-tokens` `department.*`. All other CSS vars verbatim. NO hex / inline `oklch()` in code (ADR-0366).
- **Telemetry:** every interaction fires a registered event (`packages/telemetry/src/registry.ts`):
  ```ts
  void emit({ event: "<domain>.<action>", workspace_id: nonEmpty(workspaceId,"workspace_id"),
    actor_id: nonEmpty(actorId,"actor_id"), properties:{data:{...}} }).catch(noop);
  ```
  `nonEmpty()` throws on empty (no corrupt telemetry). Nav/view/click = fire-and-forget (`void`+`.catch`).
  **Mutations** must `await emit()` in `onSuccess` (gate proves the row landed in `activity_trail`).
  Page-view emit fires in `useEffect` on mount. Register the event BEFORE wiring.

## Before you start (state the plan)

Name: the domain · the design source file(s) · the existing route + tables/hooks it reuses (check
`reports/backend-reuse-map.json` — 316 entities, columns/FK/RLS) · the classification
(keep/re-skin/rewire/new) · the gate it feeds. **No plan, no edit.**

## DB-wall + backend gaps

- **No DB writes** (migration/seed/schema) without founder approval — only the Database Agent writes schema.
- A missing table/hook is a **finding to surface + honest stub** (e.g. oppgaver `control_list_attempt`), never a license to invent backend.
- Seed-blocked domains (0 rows: `daily_reconciliation`, `haccp_log`, `knowledge_test_attempt`, `workspace_budget`, `payroll.calculation`) are e2e-blocked until F0.4 seed lands — guard with empty-state + an `*_empty_state_shown` event.

## Done (the gate)

A domain closes only when its `control.json` reads `gate==PASS && blockers==[]`: every interactive
element fires a registered event proven to land in `activity_trail` (DB-assert, not UI-200), typecheck
clean, and **G8 = human accept**. Drive via `DRIVE-TO-100.md` (loop until all green). Read evidence
from disk — never a worker's word.

## Known debt to avoid compounding

Shared page primitives (`so-panel`, `brief`, `so-grid-2`, `so-stack`, `dash-statusline`, `sk-eyebrow`)
are currently copy-pasted per page. Extract to a global sheet before fan-out, or every port repeats them.
