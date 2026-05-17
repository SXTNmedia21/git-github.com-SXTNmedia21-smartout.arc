---
title: "Plan — campaign/ui-shell R1 council fixup"
status: in_progress
feature: ui-shell-r1-fixup
parent_campaign: ui-shell
council: campaign-ui-shell-shippability-r1
council_date: 2026-05-17
updated: 2026-05-17
created: 2026-05-17
module: ui-shell
tags: [plan, council-followup, r1-fixup, migration, telemetry, wcag, i18n]
---

# Plan — campaign/ui-shell R1 council fixup

> Closes 3 hard blockers + 4 required-before-promote findings from the 2026-05-17 R1 council on campaign/ui-shell shippability.
>
> Council verdict: **REJECT — REMEDIATE BEFORE HOP A.** This sortie unblocks HOP A.

## Council context

| Field | Value |
|---|---|
| Council date | 2026-05-17 |
| Campaign tip reviewed | `9d4857649` |
| Council ID | campaign-ui-shell-shippability-r1 |
| Verdict | REJECT — REMEDIATE BEFORE HOP A |
| Chair | System Steward |
| 4 Chair self-reversals | Phantom contract, tri-campaign scope drift, WCAG 4.1.2 mixed-ARIA, ADR-0349 ESLint absence |
| L-0147 precedent count | 7th (component-level ARIA on ProcedureDetailTabs identical to HMS R1 HmsSubNav) |
| L-NEW-1 occurrence | 2nd (deviation_viewed + handbook_chapter_opened registered, 0 emit-sites) — ADR-grade threshold met |

## Hard blockers (3)

### B1 — Migration timestamp collisions × 2 + forbidden `CREATE TABLE IF NOT EXISTS`

**Root cause:** Two campaign-new migrations share timestamps with already-on-development migrations. `schema_migrations.version` is PK → second-applied fails with `schema_migrations_pkey` violation. Pontus' own commit `c7228d056` documents this exact failure mode.

Affected:
- `supabase/migrations/20260616120000_shift_lifecycle_pipeline_v2.sql` collides with `20260616120000_seed_channel_admin_authority.sql` (on dev)
- `supabase/migrations/20260617100000_seed_pipeline_override_authority.sql` collides with `20260617100000_payroll_period_locked_notifier_process.sql` (on dev)

Plus: `20260616120000_shift_lifecycle_pipeline_v2.sql` contains `CREATE TABLE IF NOT EXISTS public.engine_authority_pipeline` — explicitly forbidden by `.github/scripts/migration-lint.sh` Check 2/3 (lines 78-87). HOP A CI will block.

**Fix:**
1. Retimestamp `_shift_lifecycle_pipeline_v2.sql` → `20260617110100` (past `20260617110000_policy_create_manual_capability_seed.sql`)
2. Retimestamp `_seed_pipeline_override_authority.sql` → `20260617110200`
3. Remove `IF NOT EXISTS` from the `CREATE TABLE public.engine_authority_pipeline` statement (after retimestamp it is the canonical creator). Update any in-file comments that referenced the old timestamp.
4. Grep `grep -r '20260616120000_shift_lifecycle\|20260617100000_seed_pipeline_override' .` to verify no stale cross-references in code/docs.

### B2 — Phantom telemetry contract × 2 (L-NEW-1 2nd occurrence)

**Root cause:** Two telemetry events registered in `packages/telemetry/src/registry.ts` (lines 1284 + 1511) by sortie 4 (commit `55dc524be`) without `emit()` call-sites — identical defect class to HMS R1 phantom contract (which the R1 fixup closed).

Affected:
- `deviation_viewed` event → should emit from `DeviationDetailDrawer.tsx` open/mount
- `handbook_chapter_opened` event → should emit from `ChapterReader.tsx` chapter selection

**Fix:**
1. Add `useRef` + `useEffect` emit pattern in `DeviationDetailDrawer.tsx` mirroring HMS R1 fixup template (`hms-page-client.tsx:40`).
2. Same pattern in `ChapterReader.tsx` on chapter selection.
3. Both must use `useProfileContext()` with L-0177 fail-fast on empty `workspace_id` + `actor_id`.
4. Verify with `grep -rE "emit\\([\\\"']deviation\\.viewed|emit\\([\\\"']handbook\\." apps/web/src/` returns ≥2 matches.

## Required-before-promote (4)

### J3 — `/help` Tier 1 surface polish baseline

`apps/web/src/app/dashboard/help/` lacks both `error.tsx` AND `_tools/` directory. Tier 1 surface in `apps/web/.botsson/site-map.json` cannot ship without `error.tsx` (ADR-0357 NEVER-skippable).

**Fix:** Add minimal `error.tsx` mirroring `apps/web/src/app/dashboard/billing/error.tsx` + `_tools/` skeleton folder with placeholder bridge.

### J4 — WCAG a11y fixes (component-level ARIA + focus-visible × 2)

Sortie 4 introduced WCAG 4.1.2 (Name, Role, Value) mixed-ARIA pattern in `ProcedureDetailTabs.tsx:98-117` — identical to HmsSubNav defect closed by HMS R1. **7th L-0147 precedent.**

Plus: `DayTimelineStrip.tsx:534` time-slot add buttons have zero focus indicator (WCAG 2.4.11). `DayTimelineStrip.tsx:618` event markers lose focus when not highlighted.

**Fix:**
1. `ProcedureDetailTabs.tsx` — option A: add full `role="tablist"` + `role="tab"` + `role="tabpanel"` with `aria-selected` + `aria-controls`. Option B (preferred per HmsSubNav precedent): refactor to shadcn `<Tabs>` primitive.
2. `DayTimelineStrip.tsx:534` — add `focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset`.
3. `DayTimelineStrip.tsx:618` — decouple selection ring from focus ring; use `focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2`.

### J5 — i18n migration for `ProcedureDetailTabs.tsx`

9 hardcoded Norwegian strings — CLAUDE.md explicit ban. Includes typo `"Pakrevd"` (missing `å`).

**Fix:**
1. Move tab labels ("Oversikt", "Steg", "Quiz", "Bekreftelse") + error messages + placeholders to `apps/web/messages/{nb,en}/dashboard.json` under `hms.procedureDetailTabs` namespace.
2. Replace literals with `t()` calls.
3. Fix `"Pakrevd"` → `"Påkrevd"` in the i18n nb file.

## Council Phase 7+8 artifacts (in this sortie)

Phase 7+8 council closure folded into this sortie's HANDOFF:
- ADR for L-NEW-1 promotion ("Telemetry registry entries require emit() call-sites — toothless event ban", 2nd occurrence threshold)
- COUNCIL-LOG.md entry for 2026-05-17 R1 ui-shell shippability council
- Learning logs: 7th L-0147 precedent observation, 4 chair self-reversal patterns, ADR-to-enforcement-code receipt rule
- DASHBOARD.md refresh (45 → 242 ahead, tip → `9d4857649`)
- ADR-0238 status flip (proposed → accepted)

## Deferred (post-HOP-A follow-up sortie)

Out of scope for F1:
- ADR-0349 ESLint rule implementation in `packages/eslint-config/next.mjs` (OKLCH literal ban) — toothless ADR but no new violations this campaign
- 7 surviving `transition-all` on HMS components (DepartmentReadiness, TaskCard, OversiktEmployee, MaintenanceProcedureForm)
- Palette literals (`green-500`, `red-500`, `rose-*`) → semantic tokens
- `LearnFlow.tsx:68-91` stage buttons need `aria-current` (Code-reviewer IMPORTANT)
- BOTSSON-SYSTEM-MAP §L4 capability count refresh (30 → 35)
- Parity-scanner gap for `mutateWithGate({capability:})` shape

## Tri-campaign scope acceptance (gate before HOP A)

**SEPARATE from F1.** Before promoting campaign/ui-shell to development, Pontus must explicitly accept that the tip includes:
- `campaign/world-best-wfm` (ADR-0340 authority-pipeline V2) — merged via PR #395
- `campaign/mobile` (22 mobile chat files) — merged via PR #393

Council recommends Option A: accept + document in HOP A commit message + activity-log entry. Option B (bisect out) is high cost / low value.

## Estimated effort

| Item | Estimate |
|---|---|
| B1 migrations + IF NOT EXISTS | 10 min |
| B2 phantom telemetry (2 files) | 15 min |
| J3 /help polish | 15 min |
| J4 WCAG fixes (3 spots) | 25 min |
| J5 i18n migration | 20 min |
| Council Phase 7+8 artifacts | 30 min |
| Typecheck + verify | 15 min |
| HANDOFF + closure | 15 min |
| **Total** | **~2h** |

## Verification

Before close-feature:
1. `pnpm turbo typecheck` — 0 errors
2. `npx tsx apps/web/scripts/validate-site-map.ts; echo "exit=$?"` — exit 0 (L-NEW-C: capture full output + exit code, never head -N)
3. Local `supabase db reset` — applies all migrations clean, no pkey violation
4. `.github/scripts/migration-lint.sh` — passes Check 2/3 (no `CREATE TABLE IF NOT EXISTS`)
5. Grep `emit\\(['\\\"]deviation\\.viewed\\|emit\\(['\\\"]handbook\\.` — ≥2 matches in apps/web/src/
6. Manual: visit `/dashboard/help` with simulated error → error.tsx renders correctly
7. Manual: keyboard-only nav through `ProcedureDetailTabs` → focus ring visible, screen reader announces "tab 1 of 4 selected"

## References

- Council artifacts (Phase 4-5): in-session transcript 2026-05-17
- ADR-0357 (page-polish documented intentional skips) + v2 addendum (page-header inheritance)
- L-0042 (migration retimestamp pattern, precedent commits `c7228d056`, `eb4d72fbc`)
- L-NEW-1 (telemetry-contract-without-emit-wiring) — promoted to ADR-grade after 2nd occurrence
- L-NEW-C (head-truncated stdout misread) — promoted to run-council SKILL.md after 3rd occurrence
- L-0147 (Chair Self-Reversal Protocol) — 7th precedent
- L-0177 (fail-fast on empty workspace_id/actor_id)
- ADR-0204 (gatedMutation contract)
- ADR-0238 (Botsson surface disambiguation / DomainChatOwnership) — flip to accepted as part of this sortie
- ADR-0287 (atomic single-exec mutation contract)
