---
title: Fasit Review — sandbox state + proven port pattern
status: done
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [fasit, review, port-pattern, state-truth, sandbox]
---

# Fasit Review — what the sandbox already proves

> Source: `code-explorer` deep-read of the sandbox `/home/sxtnl/plugins/smartout-sxtn-sandbox/`
> (the prior campaign's real output, branch `development`). **Code-wins: this corrects the
> reuse-map's optimistic "all 12 = re-skin" — it is wrong for most domains.**

## Where the real campaign state lives
The sandbox — NOT master-refactor — holds the executed work: 2 ported pages, the machine
reuse-map, the per-domain coverage system, the ingest-scaffolded domain spine. master-refactor
holds the rules/orientation docs. **These two must be reconciled (open coordination question).**

## The proven port pattern (the template every domain copies)
**4-file unit, `-v2` suffix (side-by-side, reversible):**
```
apps/web/src/app/dashboard/<domain>-v2/
  page.tsx                  # async Server Component: resolveDashboardContext() → Promise.all fetches → toDesignShape() → typed props
  _lib/to-design-shape.ts   # pure adapter: backend rows → DesignXxx shape; every gap a // GAP: comment + default
  _components/<Name>.tsx     # "use client" — VERBATIM design JSX + 6 allowed plumbing changes + emit() call-sites
  _components/<domain>.css   # VERBATIM design CSS, no token renames
```
**6 allowed plumbing changes (nothing else):** IIFE/`window.SO_PAGES`→`"use client"`+export · `const{useState}=React`→import · `window.Ic`→lucide shim (same `n=` prop) · `window.useToast`→sonner `toast`(+`{action:{label:"Angre"}}`) · props via typed interface · `emit()` at each mutation/nav.
**Token handling:** only department hex → `@smartout/design-tokens` `department.*`; all other CSS vars verbatim (design built on same token system).
**Telemetry:** `void emit({event, workspace_id: nonEmpty(...), actor_id: nonEmpty(...), ...}).catch(noop)`; page-view in `useEffect`; `nonEmpty()` throws on empty (no corrupt telemetry).
**Hidden prereq:** every `-v2` page imports `resolveDashboardContext` from `_data/resolve-page-context` — must exist first.
**Reference files:** sandbox `oversikt-v2/` (complex, ~315L page) + `min-dag-v2/` (simple, ~70L page).

## What's done
| State | Domains |
|---|---|
| **GREEN (ported, gate pass)** | `oversikt-v2` (11/11 events) · `min-dag-v2` (15/15 events) |
| **Telemetry-mapped (analysis + control.json, gate FAIL w/ blocker catalog)** | vaktplan · ansatte · avstemming · hms · kommunikasjon · lonn · planlegging · rapporter |
| **Stub only (PLAN.md)** | handbook · oppgaver |

## Correction: most domains are NOT a clean re-skin
Only oversikt/min-dag were shallow (≤15 mutations, mostly read). The rest carry real backend/gating work:
- **vaktplan:** 153 elements, 91 mutations, 18 ungated shift writes → C4-gating before prod.
- **ansatte:** 164 elements, 24 mutations with no hook; bulk actions have no API route.
- **kommunikasjon:** Skranke helpdesk tab is mock-only; no backend table; comment thread is design fiction.
- **hms / avstemming / lonn:** F0.4 seed blocker (0 rows in daily_reconciliation, haccp_log, knowledge_test_attempt, workspace_budget, payroll.calculation) → e2e blocked + visual unverifiable until seed.
⇒ The reuse-map's "re-skin" label holds only for the shallow domains; the rest are **rewire + backend-gap (gap-track)**.

## Coverage system (already built in sandbox)
`.sxtn-staging/telemetry-map/`: per-domain `PLAN.md` + `TELEMETRY-MAP.md` + `control.json`; `AGGREGATE-control.json`; `DRIVE-TO-100.md` (the gate loop: drive until every domain `gate==PASS && blockers==[]`); `emit-coverage.sh` · `completion-rate.sh` · `reconcile.sh`; HTML dashboards; `activity/feed.jsonl`. Self-verifying.
`reports/backend-reuse-map.json`: 316 entities, full columns/FK/RLS, tagged REUSE — the "does this table exist + columns" lookup adapters check before writing.

## Divergences to resolve
1. **Campaign home:** sandbox (real work) vs master-refactor (rules docs) — reconcile.
2. **NO/EN taxonomy:** telemetry-map uses NO names; docs/domains spine uses EN — no mapping doc in sandbox. **My `F7-domain-naming-proposal.md` fills exactly this gap.**
3. **Shared CSS primitives** (`so-panel`, `brief`, …) copy-pasted per page — extract to global sheet before fan-out or debt compounds.
4. **F0.4 seed** is a cross-domain blocker (DB-wall gated — founder approval).
