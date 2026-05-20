---
title: "Plan — contracts-polish"
status: draft
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [plan, ui-shell, contracts, polish, campaign-ui-shell]
---

# Plan — contracts-polish

> Branch: `feat/ui-shell-contracts-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-16

## Goal

Drive the full `/dashboard/contracts/*` cluster (5 routes + 4 existing Botsson tool bridges) through the `smartout-page-polish` 8-phase workflow. Closes S12 step 5 (`/dashboard/contracts` orphan) and brings the entire contracts surface to production polish parity with website-polish + pos-accounts-polish.

## Scope

**In scope (5 routes):**
- `/dashboard/contracts` — admin overview list
- `/dashboard/contracts/[id]` — contract detail view
- `/dashboard/contracts/[id]/revise` — amendment flow
- `/dashboard/contracts/awaiting-my-signature` — pending signature queue
- `/dashboard/contracts/new` — create-contract wizard

**Existing infrastructure to polish (4 bridges):**
- `contracts-tools-bridge.tsx` + `use-contracts-tools.ts`
- `contract-detail-tools-bridge.tsx` + `use-contract-detail-tools.ts`
- `contract-revise-tools-bridge.tsx` + `use-contract-revise-tools.ts`
- `awaiting-signature-tools-bridge.tsx` + `use-awaiting-signature-tools.ts`

**Out of scope:**
- New capabilities, new ADRs — module is mature (12+ prior HANDOFFs covering intake-gate, compose, dispatch, compliance-cluster)
- Mobile contract surfaces (ADR-0133 — separate concern, employee-contract-mobile already shipped)
- Backend logic, RLS, capability tools (only polish: descriptions, loading states, telemetry, harness wiring)
- Schema changes (defer to follow-up sortie if discovered)

## Recon (pre-work)

- DB schema: `employment_contract`, `contract_amendment`, `contract_recipient`, `employee_payroll_profile` (verified via smartout-database-guide skill at sortie start)
- Mature module: prior sorties already established server actions, gates (ADR-0204), capability tools
- Each route has its own `_tools/` directory — minimal scaffolding work, mostly polish on existing structures

## Phases (per smartout-page-polish skill)

### Phase 1 — Speed-test baseline (per route)
- [ ] Run dev server on localhost:3060, measure first-paint for each route
- [ ] Document baseline numbers per route in PLAN

### Phase 2 — Bottleneck fix
- [ ] Identify slowest route, fix worst offender (parallel data fetch, suspense boundary, server-component conversion)
- [ ] Defer non-blocking improvements to followups

### Phase 3 — Re-test
- [ ] Verify speed regression-free post fix

### Phase 4 — UI/UX pass (Nordic Split, per route)
- [ ] Headers (Instrument Serif, page instructions slot)
- [ ] Loading states (`loading.tsx` per route)
- [ ] Empty states (no contracts / no pending / no amendments)
- [ ] Error boundaries (`error.tsx` per route)
- [ ] Nordic Split tokens: `bg-background`, `text-foreground`, `border-border`, no zinc hardcodes

### Phase 5 — Telemetry registration
- [ ] Grep mutations in each route, ensure `emit()` called on success (5 routes)
- [ ] Verify registry includes events emitted (no orphan event names)

### Phase 6 — Page instructions
- [ ] Each route gets a `<PageInstructions>` block (or equivalent) — explains what manager/admin/employee does here
- [ ] Norwegian copy aligned with existing contract module tone

### Phase 7 — Harness tool descriptions
- [ ] Polish 4 existing tool bridges — tool descriptions read complete, declarative, agent-discoverable
- [ ] Verify Tool Compliance Self-Check per smartout-agent-dev skill (no docstring-vs-body drift, no direct DB writes outside gatedMutation per ADR-0204)
- [ ] Optional: register page-tool kit on each route via `useRegisterTools` (if not already wired)

### Phase 8 — Site-map.json registration
- [ ] Verify all 5 contracts routes registered with kit metadata + indirect-via-variable pattern
- [ ] `pnpm --filter web site-map:validate` exit 0

## Tasks (cross-cutting)

- [ ] **T0** — Read 4 existing tool bridges, identify gaps + drift before polish
- [ ] **T1** — Speed baseline + bottleneck fix (Phase 1-3)
- [ ] **T2** — UI/UX pass on all 5 routes (Phase 4) — dispatch to frontend-designer / sonnet build agent in parallel per route
- [ ] **T3** — Telemetry sweep (Phase 5) — verify all mutations emit
- [ ] **T4** — Page instructions (Phase 6) — 5 routes
- [ ] **T5** — Harness tool descriptions (Phase 7) — 4 bridges + ADR-0204 verify
- [ ] **T6** — Site-map registration (Phase 8)
- [ ] **T7** — Code review (sonnet code-reviewer)
- [ ] **T8** — HANDOFF + journey closure
- [ ] **T9** — close-feature.sh from inside worktree

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] 5 routes have `loading.tsx` + `error.tsx`
- [ ] 5 journeys verified (frontmatter `status: verified` + `feature: contracts-polish`)
- [ ] 4 tool bridges pass Tool Compliance Self-Check
- [ ] All mutations emit telemetry
- [ ] HANDOFF written

## Risks

- **Scope blowout** — 5 routes is bigger than any prior ui-shell sub-sortie (website-polish was 3 routes). Mitigation: parallel dispatch per route in T2.
- **Pre-existing debt drift** — 12+ prior contract HANDOFFs may have left subtle inconsistencies between routes. Mitigation: T0 recon, document gaps but only fix what blocks polish acceptance.
- **Tool docstring-vs-body drift (L-0176)** — verify body satisfies ADR-0204 before declaring tool polished.
- **ADR-0173 frozen-4 boundary** — if contracts tools try to write to other-namespace tables, halt and draft ADR (per ADR-0240 precedent).

## Next

T0 recon first (read 4 bridges in parallel, identify drift). Then T1 speed baseline. Defer T2 fan-out until recon is solid.
