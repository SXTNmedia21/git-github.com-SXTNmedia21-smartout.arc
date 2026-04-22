---
title: Plan — contract-hub-redesign
feature: contract-hub-redesign
spec: docs/superpowers/specs/2026-04-22-contract-hub-redesign.md
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: contracts
tags: [plan, contracts, hub, templates, drift]
---

# Plan — contract-hub-redesign

> Branch: `feat/contract-hub-redesign` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-2` | Module: contracts

**Spec:** [Contract Hub Redesign — Council Verdict 2026-04-22](../superpowers/specs/2026-04-22-contract-hub-redesign.md)

## Journeys (the contract)

All 8 journeys inherited from `development` base (commit `98087b78`). Paths use the existing contract-prefix convention, not `<feature>-<slug>` (these predate this plan).

Primary (new):
- [JOURNEY-contract-hub-redesign](../journeys/JOURNEY-contract-hub-redesign.md) — tabs-in-hub navigation, role-gated tabs, ambient Botsson chip, reverse flow
- [JOURNEY-workspace-template-fork](../journeys/JOURNEY-workspace-template-fork.md) — K1a → K1b fork, edit, publish, deprecate, re-activate
- [JOURNEY-cascade-drift-observability](../journeys/JOURNEY-cascade-drift-observability.md) — passive lineage badge + amber drift chip + deprecated banner
- [JOURNEY-platform-k1a-curation](../journeys/JOURNEY-platform-k1a-curation.md) — Pontus curates K1a catalog, sees cross-workspace distribution
- [JOURNEY-contract-bulk-send](../journeys/JOURNEY-contract-bulk-send.md) — `Maler` tab `Send til ansatte…` secondary flow

Amended (existing):
- [JOURNEY-contract-composition-engine](../journeys/JOURNEY-contract-composition-engine.md) — wizard → drawer
- [JOURNEY-contract-preview-editor](../journeys/JOURNEY-contract-preview-editor.md) — preview inside drawer
- [JOURNEY-contract-system-phase2-3](../journeys/JOURNEY-contract-system-phase2-3.md) — bindings in hub tab

## Goal

Deliver the world's cleanest contract-management surface for shift-based businesses: one hub, three tabs, employee-first composition by default, cascade-aware template authoring with K1a→K1b drift observability, under Nordic Split.

## Phase-by-phase tasks

### Phase 0 — Pre-flight (docs + gates)

- [ ] ADR-0178 written + registered (docs-tutor running on development)
- [ ] ADR-0179 written + registered
- [ ] ADR-0180 written + registered (proposed status)
- [ ] L-0098, L-0099, L-0100 written + registered
- [ ] **G1** — Fix `is_admin_in_workspace(uuid, uuid)` signature inversion
  - [ ] Migration `supabase/migrations/20260422130000_fix_is_admin_in_workspace_signature.sql`
  - [ ] pgTAP asserting exactly one function signature
  - [ ] Types regenerated
- [ ] **G2** — Register 10 events in `packages/telemetry/src/registry.ts`
  - [ ] 5 template lifecycle events (forked, clause_updated, published, deprecated, deleted)
  - [ ] 3 hub events (hub_viewed, tab_switched, botsson_chip_invoked)
  - [ ] 2 drift events (drift_viewed, drift_dismissed)
  - [ ] 4 destinations each (activity_trail + engine_event + posthog + logger)
  - [ ] Unit test per event

### Phase 1 — Schema + Capability Foundation

- [ ] **G5** — Schema migration `20260422140000_contract_template_lineage_columns.sql`
  - [ ] 5 new columns (source_template_id FK, source_template_version, forked_at, published_at, deprecated_at)
  - [ ] CHECK constraint `(source_template_id IS NULL OR forked_at IS NOT NULL)`
  - [ ] FK `source_template_id → contract_template(template_id) ON DELETE SET NULL`
- [ ] **G3** — Trigger migration `20260422140100_contract_template_is_system_immutability.sql`
  - [ ] BEFORE UPDATE trigger raising `EXCEPTION 'is_system is immutable'`
- [ ] RLS policies `20260422140200_contract_template_rls_policies.sql`
  - [ ] workspace_admin FOR ALL on `is_system=false`
  - [ ] platform_admin FOR ALL on `is_system=true`
  - [ ] JWT + API-key policies both
- [ ] pgTAP tests (fork lineage, is_system rejected, RLS isolation)
- [ ] Types regenerated
- [ ] **G4** — Capability tools in `packages/ai/src/tools/contract/`
  - [ ] `fork-template.ts`
  - [ ] `publish-workspace-template.ts`
  - [ ] `deprecate-workspace-template.ts`
  - [ ] All three: explicit `gate_action`, `default_allow=false`, `allowedChannels=["chat"]`, C4 authority seeded in `engine_authority_config`, NOT in mobile `suggestTools`
- [ ] `/api/contract-templates/copy/route.ts` populates lineage columns atomically

### Council Gate 1 — Trust Gate post-Phase-1

- [ ] `/run-council` with code-tracer mandate on mutation paths
- [ ] Verify G1-G5 pass
- [ ] APPROVE before Phase 2

### Phase 2 — Hub UI redesign

- [ ] `apps/web/src/app/dashboard/contracts/page.tsx` — tabs `Kontrakter | Maler | Bindinger`
- [ ] `apps/web/src/app/dashboard/contracts/_components/KontrakterTab.tsx`
- [ ] `apps/web/src/app/dashboard/contracts/_components/MalerTab.tsx`
- [ ] `apps/web/src/app/dashboard/contracts/_components/BindingerTab.tsx`
- [ ] `apps/web/src/app/dashboard/contracts/templates/[id]/page.tsx` — workbench deep-link
- [ ] Settings: remove `contract-templates` tab from `settings-tabs.tsx`
- [ ] DELETE `apps/web/src/app/dashboard/contracts/new/page.tsx` (or redirect)
- [ ] `apps/web/src/app/dashboard/contracts/_components/BotssonAmbientChip.tsx`
- [ ] Remove `openBotssonForContract` button (lines 72-83 + 100-103 of `page.tsx`)
- [ ] Enrich `primeContext` on hub + `[id]`
- [ ] Nordic Split: ambient orb, typography-led rows, no `zinc-*` / `gray-*`
- [ ] Reverse flow from `/dashboard/employees/[id]`

### Phase 3 — CompositionDrawer + perf + bulk-send

- [ ] `apps/web/src/components/contracts/CompositionDrawer.tsx` — drawer replaces full-page wizard
- [ ] `apps/web/src/components/contracts/SelectEmployeeStep.tsx` — virtualized via TanStack Virtual
- [ ] `AnimatedWizardShell` — spring tuning for drawer context
- [ ] Inline Botsson chat panel inside drawer (chat-only)
- [ ] Bulk-send: `Maler` tab `Send til ansatte…` → multi-select → `POST /api/employment-contracts/bulk`
- [ ] New API route: `apps/web/src/app/api/employment-contracts/bulk/route.ts`
- [ ] Progress polling (1s interval)
- [ ] Performance gate: drawer open-to-interactive p95 <250ms in `apps/e2e/tests/performance-gates.spec.ts`

### Phase 4 — Drift observability passive

- [ ] Cascade badge (`Basert på K1a: X vY`) in workbench header
- [ ] Amber drift chip (hue 50) when `source_template_version < current K1a version`
- [ ] Drift diff drawer (read-only, no accept/reject — Phase 5 defer)
- [ ] Deprecated-template banner in `CompositionDrawer` step 3
- [ ] Drift detection on-read (no cron, lazy JOIN)

### Council Gate 2 — Integration post-Phase-3

- [ ] `/run-council` after Phase 3
- [ ] Code-tracer on all mutation paths
- [ ] Dual-perspective-verification for admin + employee flows
- [ ] APPROVE before E2E

### E2E tests per journey

- [ ] `apps/e2e/tests/contracts/hub-redesign.spec.ts`
- [ ] `apps/e2e/tests/contracts/workspace-template-fork.spec.ts`
- [ ] `apps/e2e/tests/contracts/cascade-drift-observability.spec.ts`
- [ ] `apps/e2e/tests/contracts/platform-k1a-curation.spec.ts`
- [ ] `apps/e2e/tests/contracts/contract-bulk-send.spec.ts`
- [ ] `apps/e2e/tests/contracts/composition-engine.spec.ts` (updated)
- [ ] `apps/e2e/tests/contracts/preview-editor.spec.ts` (updated)
- [ ] `apps/e2e/tests/contracts/system-phase2-3.spec.ts` (updated)
- [ ] Seeded contract-service + templates fixtures
- [ ] All green before Gate 3

### Council Gate 3 — Ship readiness + bug iteration

- [ ] All journeys `status: verified`
- [ ] `pnpm turbo typecheck` 0 errors
- [ ] All E2E green
- [ ] Post-merge-verify skill
- [ ] HANDOFF at `docs/HANDOFF-contract-hub-redesign.md`
- [ ] Council APPROVE → merge to `development`

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] `pnpm turbo typecheck` passes (0 errors across all packages)
- [ ] Decision log + learning log updated (ADR 0178/0179/0180, L 0098/0099/0100)
- [ ] `run-council` SKILL.md updated with 14-day prior-verdict verification rule
- [ ] 8 E2E tests pass
- [ ] All 5 council gates (G1–G5) pass verification
- [ ] 3 council reviews complete with APPROVE verdicts
- [ ] HANDOFF document written
- [ ] Performance gate: drawer p95 open-to-interactive <250ms

## Owner assignments (sub-agent dispatch)

| Phase | Agent type | Model |
|---|---|---|
| Phase 0 docs | `docs-tutor` | default |
| Phase 0 G1 (RLS fix) | `general-purpose` + smartout-database-guide | sonnet |
| Phase 0 G2 (telemetry) | `general-purpose` | sonnet |
| Phase 1 schema | `general-purpose` + smartout-database-guide + smartout-cascade-developer | sonnet |
| Phase 1 capability | `system-agent-coordinator` or `walkai-bridge-builder` | opus |
| Phase 2 UI | `frontend-designer` + smartout-nordic-split | opus |
| Phase 3 drawer | `frontend-designer` + framer-motion-animator | opus |
| Phase 4 drift | `frontend-designer` | sonnet |
| E2E | `protocol-writer` or `general-purpose` | sonnet |
| Gates 1-3 | `/run-council` | n/a |
