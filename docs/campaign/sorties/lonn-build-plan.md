---
title: Lønn (payroll) — Build Worklist / Sortie Plan
status: in_progress
created: 2026-06-05
updated: 2026-06-05
module: design-handoff
tags: [sortie, lonn, payroll, worklist, build, bygg, W3]
---

# Lønn (payroll) — Build Worklist

> **Architect deliverable (S5/sortie).** This is the list the **orchestrator** executes —
> it dispatches the builder + verifier; it does NOT hand-build. The architect (this doc) and
> the orchestrator (dispatch/verify) and the builder (port) are **separate lanes** — do not merge them.
> Wave W3 of `PLANLEGG-plan.md`. Class: re-skin + employee self-view. Backend gate: GREEN.

## Current state (verified on disk, 2026-06-05)

A first builder pass ran and was **stopped mid-flight** (it was colliding with the orchestrator as a
second writer in the same worktree — see Guardrail G3). What it left, **uncommitted**, web-typecheck **green**:

| Route | Files present | Complete? |
|-------|---------------|-----------|
| `apps/web/src/app/dashboard/payroll-v2/` | `page.tsx`, `loading.tsx`, `lonn.css`, `_lib/to-design-shape.ts`, `_components/PayrollV2View.tsx` | structurally complete — needs wiring audit + gate |
| `apps/web/src/app/dashboard/my-lonn-v2/` | `_lib/to-design-shape.ts`, `_components/MinLonnView.tsx` | **INCOMPLETE — missing `page.tsx` + `loading.tsx`** (route does not render yet) |

**FIRST ORCHESTRATOR ACTION: commit this green state** (rule 10 — untracked work is the single point of
loss) before any further build, OR consciously discard and rebuild from this worklist. Do not leave it dangling.

## Buildable slices (ordered)

1. **payroll-v2 wiring audit** — port is in place; confirm against `docs/campaign/telemetry-map/lonn/control.json`:
   - 13 mutations → their existing reused hook (do NOT rebuild data layer; hooks live in
     `payroll/_hooks`, `payroll/[periodId]/_hooks`, `settings/_hooks/use-supplement-rules.ts`).
   - Each of the 13 events emits exactly once, from the correct layer (see Guardrail G2).
   - The 21+ noop elements (control.json `noop_candidates`) emit nothing.
   - 3 known hook gaps stay honest-disabled with a TODO (P1/P2 future sorties):
     `useDeviationReject`, `useTimebankWithdrawalRequest`, `useSupplementRuleTestRun`.
2. **my-lonn-v2 finish** — add `page.tsx` (route entry, server component fetching via the reused
   `my-salary` hooks) + `loading.tsx` (mirror `my-salary/loading.tsx`). Wire the read-only employee view.
3. **Adapter correctness** — both `to-design-shape.ts` adapters: real-or-empty, no fabricated rows.
   Every payroll.* column referenced MUST exist in `database.types.ts` (Guardrail G1).
4. **Commit** per route (payroll-v2, then my-lonn-v2) via `commit-steward`. Never `--no-verify`.

## Gate battery (verifier — the "full testing")

Run in order; evidence on disk, not a worker's word:

| Gate | Command / proof | State |
|------|-----------------|-------|
| Typecheck | `TURBO_CONCURRENCY=1 pnpm --filter web typecheck` → exit 0 | ✅ green now |
| Lint (no-hex/no-oklch, ADR-0366) | repo lint on the two route dirs | pending |
| Polish-gate | `smartout-page-polish` checklist | pending |
| Emit-coverage | `bash docs/campaign/telemetry-map/emit-coverage.sh lonn apps/web/src/app/dashboard/payroll-v2` → GREEN | pending (P0 path bug already fixed `aece76f11`) |
| E2E | Playwright specs for payroll-v2 + my-lonn-v2 | pending |
| **L3 proof** | a mutation (e.g. lock period / acknowledge deviation) lands a row in `activity_trail` | pending — needs local Supabase on `:54321` |
| **G8** | per-domain human accept (Pontus) | pending |

## Backend / data

- **F0.4 seed NOT needed.** Demo Restaurant `supabase/seed/demo-restaurant/30-payroll.sql` seeds a
  closed `payroll.period` + `calculation` rows for employee Anna (RLS-verified in `99-verify.sql` B2).
  min-lønn renders real data after `supabase db reset`. No DB-wall approval required for this sortie.
- L3 prerequisite: confirm the smartout DB container owns `:54321` (not sxtn-ops-local) before any L3 run.

## Guardrails (hard lessons from the first pass — enforce as pre-flight)

- **G1 — verify every column.** The first builder repeatedly invented columns (`deviation.description`→`message`,
  `calculation_line.hours_worked`→`hours`, `timebank_entry.notes`→`description`). This is recurring lesson
  L-0348. Before any adapter field access on a payroll.* row: `grep -A30 '<table>: {' packages/supabase/src/database.types.ts`.
- **G2 — no duplicate emit.** Never emit a client event that is already emitted server-side (BFF route) or by a
  hook you call. `payroll.manual_supplement_added` is emitted by `add-manual-supplement/route.ts`;
  `payroll.supplement_rule_fired` is calc-engine / activity_trail-only (registry.ts:10724), never from a UI toggle;
  the toggle event is emitted by `useUpdateSupplementRule()`. One correct emit, never a thinner duplicate.
- **G3 — ONE writer per worktree.** The first pass failed because a background builder AND the orchestrator
  both wrote the same 2600-line file — edits clobbered each other and the shared Stop-hook typecheck thrashed.
  Either run the builder in an isolated `feat/lonn-v2` worktree, OR have the orchestrator stay hands-off while
  the builder owns the files. Never both in one worktree at once (CLAUDE.md rule 9).

## Findings (architect — for follow-up)

- **emit-coverage.sh false-negative on hook-emit domains.** The gate greps only the page/route dir for
  `emit(...)` call-sites. Lønn emits ALL 13 events from reused hooks + BFF routes by design (G2), so the
  page dir has zero emits → gate reports FAIL though wiring is correct (verified on disk). Fix: the gate
  must also scan the hook + BFF dirs a domain reuses (or read the hook list from control.json). Until fixed,
  treat emit-coverage as advisory for hook-emit domains; the on-disk hook/BFF emit is the real proof.
- **Stale untracked copy in master-refactor.** payroll-v2 + my-lonn-v2 remain untracked in the master-refactor
  working dir (the green state was carried into feat/lonn-v2 instead, after a real pre-commit lint bounce on
  campaign). Harmless, superseded when feat/lonn-v2 merges back. Clean up on merge.

## Handoff

Orchestrator: commit the green state, then dispatch builder for slices 1–4 (single writer), then verifier for
the gate battery. Architect (this lane) does not build. Pontus holds G8.
