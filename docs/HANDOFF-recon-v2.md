---
title: "Handoff — daily-operation recon-v2"
status: ready-for-review
updated: 2026-04-20
created: 2026-04-20
module: reconciliation
tags: [handoff, recon, avstemming, admin, milestone-1]
---

# HANDOFF — daily-operation recon-v2 (Milestone 1)

> Branch: `feat/daily-operation-recon-v2` · Sub-sortie of `campaign/daily-operation`
> Parent milestone: CAMPAIGN-daily-operation.md §Milestone 1

## Summary

Recomposed `apps/web/src/app/dashboard/reconciliation/` til designbundelens layout (Avstemming.html + detail.jsx) med full 1fr + 380px sticky-approve-panel + preflight-gate + 6 detail-tabs + admin-override + CSV-eksport + revisjonslogg. Alle 5 journeys (J1–J5) implementert i kode.

## What was built

### New files
- `_lib/status-mapping.ts` — reconciliation_status → UiPhase mapping + label helper.
- `_lib/csv-export.ts` — Norwegian-locale CSV generator (space thousand separator, comma decimal, DD.MM.YYYY).
- `_hooks/useReconciliationAuditTrail.ts` — query `activity_trail` filtered by `entity_type='reconciliation'` for Revisjonslogg tab.
- `_actions/override-reconciliation-action.ts` — Server Action for Invariant #9 admin-override. Gate via `gate_action` RPC with capability `reconciliation.override`. Reason ≥20 chars Zod-validated. Writes `[OVERRIDE] {reason}` prefix in `approval_notes`, then emits `reconciliation admin_action` + activity_trail logs override nature via `action_verb` + `data`.
- `_components/PreflightGate.tsx` — blocker-list with `border-l-4 border-destructive` accent; click-to-jump via onJump; auto-collapse + green "Klar for godkjenning" banner when `blockers=0`; spring motion (stiffness 35, damping 24, mass 2.3) with `useReducedMotion` fallback.
- `_components/AdminOverrideDialog.tsx` — AlertDialog-based modal with Zod reason validation, live char counter, aria-describedby hint.
- `_components/DayDetail.tsx` — replaces DayApproval. 1fr + 380px grid. 6 tabs with motion transitions (spring 38/22/2.2). Sticky approve-panel does NOT animate on tab-switch (prevents layout thrash). Back-button to list view. PhaseBadge in header.
- `_components/tabs/OversiktTab.tsx` — session summary + 4 KpiTiles (Omsetning/Arbeidstid/Lønn/Labor %) + compliance row (Vakter venter / Åpne avvik / Avvik totalt).
- `_components/tabs/OppgaverTab.tsx` — queries `session_task` joined via `session_hook`, renders checklist with progress bar.
- `_components/tabs/RevisjonsloggTab.tsx` — read-only chronological audit list with override highlighting.

### Modified files
- `_components/DayList.tsx` — full rewrite: PhaseBadge status pills (Inv #1 CI-gate 1 fix — removed hardcoded `text-amber-500` + `text-emerald-500`), filter chips (status + department), header counters (Venter/Klar/Låst), CSV export button.
- `_components/reconciliation-page-client.tsx` — switched from `w-80 + flex-1` side-by-side to full-width list-OR-detail mode (Avstemming.html pattern).

### Deleted files
- `_components/DayApproval.tsx` — superseded by `DayDetail.tsx`. Grep-verified no other consumers.

## Decisions made

- **D1. Override discriminator via `approval_notes` prefix, not registry event.** `ReconciliationAdminAction` registry shape only accepts `{ reconciliation_id, action: "approved" | "rejected" }` — no room for `override` flag. Decision: use `approval_notes` `[OVERRIDE] {reason}` prefix + `activity_trail.data` for override+reason. Revisjonslogg reads this. Follow-up: extend registry with `ReconciliationOverridden` event if override analytics need stronger typing.

- **D2. Layout: full-page list OR detail, not side-by-side.** Avstemming.html bundle uses full-screen mode-switch (list then detail). Previous 2-panel layout hid the 1fr+380px content-lane richness. Back-button returns to list.

- **D3. Status-pill canonicalization.** Reconciliation uses its own enum (open/submitted/awaiting_approval/approved/locked/unreconciled), DIFFERENT from cascade UiPhase. `_lib/status-mapping.ts` translates. PhaseBadge now reused → visual consistency with WebDayControl.

- **D4. department_session_id access pattern.** `daily_reconciliation` does NOT have a direct `department_session_id` column. OppgaverTab reads session via nested join from useReconciliationDetail's select expansion. Follow-up: expand useReconciliationDetail `.select` to include `department_session:...(department_session_id)` for cleaner access.

- **D5. Dedupe `deviation reported` — VERIFIED NOT A BUG.** The 3 emit-sites (`packages/ai/.../operations/tools.ts`, `apps/web/hms/.../use-create-deviation.ts`, `apps/mobile/.../use-report-deviation.ts`) are DISJOINT entry points (agent / web-user / mobile-user). Each user-context fires once. `activity_trail` does not receive duplicates per single user action. No code change needed.

- **D6. `--dept-service` vs `--dept-floor`.** Fact-check v1 flagged `--dept-service` missing — v2 correction: `--dept-floor` (hue 180) already serves sal/service/floor via `dept-key.ts:16` mapping. No new token needed. Only `--hero-warm-deep` added (Prereq Commit 0, landed `9ebef7a6`).

## Learnings

- **L1. Registry strictness catches silent schema drift.** Attempted to pass `override: true` in `properties.data` — TS rejected because `ReconciliationAdminAction` shape explicitly lists allowed keys. This is the Trust Gate pattern doing its job: registry = contract, not suggestion.

- **L2. activity_trail column naming is `id` (BIGSERIAL), not `activity_id` or `activity_trail_id`.** Verified in `supabase/migrations/00005_activity_trail.sql:4`. The `data` column is JSONB (not `payload`). Revision log queries must match these exact names.

- **L3. EntityType enum source of truth is `packages/telemetry/src/registry.ts:51`**, not `supabase/migrations/`. Enum contains `"reconciliation"` (not `"daily_reconciliation"`). Activity_trail entity_type column is `TEXT` not enum — but telemetry layer enforces via EntityType discriminated union at emit-site.

- **L4. Invariant #1 close-review grep `placeholder` over-matches.** HTML `<input placeholder="">` attributes are legitimate, not stubs. Suggested refinement: grep for `placeholder=["'](?:TODO|TBD|xxx|coming soon|not implemented)["']` to catch actual stub placeholders, or grep on JSX text content only. For now, reviewer must manually verify placeholder attribute context.

- **L5. Workspace packages require `pnpm install` per worktree.** New sub-sortie worktree starts with node_modules missing. `pnpm install --prefer-offline` + `pnpm turbo typecheck` is the standard bootstrap.

## Known issues / debt

- **Follow-up FU-1:** Extend `useReconciliationDetail` `.select` to include `department_session:department_session_id(department_session_id, opened_at, closed_at)` — currently accessed via type-cast `(detail as any).department_session`. Clean up once the query select is extended.
- **Follow-up FU-2:** Consider adding `ReconciliationOverridden` event to registry if override analytics become a product need.
- **Follow-up FU-3:** E2E tests under `apps/e2e/daily-operation-recon-v2/` per Invariant #6 (required for M2+M3, recommended for M1).
- **Follow-up FU-4:** `activity_trail` lookup currently limited to 100 entries — add pagination if recon history grows past this in production.
- **Follow-up FU-5:** Compliance tile "Vakter venter" + "Åpne avvik" in OversiktTab — hook-based filter derives from already-loaded `shift_approval` + `deviation` arrays. Verify performance if detail query returns many rows per session.

## Acceptance against campaign invariants

- ✅ Inv #1 CI-gate 1: `rg '(text|bg|border)-(zinc|gray|slate|neutral|stone)-|#[0-9a-fA-F]{3,8}'` → 0 treff i nye/endrede filer (fikset ett `#1234` eksempel i placeholder).
- ✅ Inv #1 CI-gate 2: alle `var(--*)` CSS-vars finnes i `tokens.css` både `:root` og `.dark` (via eksisterende tokens + Prereq Commit 0's `--hero-warm-deep`).
- ✅ Inv #1 CI-gate 3: alle `<motion.*>` har eksplisitt `transition` prop.
- ✅ Inv #1 grep-gate: ingen `TODO|FIXME|mock` stubs i rendret UI (se L4 om `placeholder`-attributt-nyansen).
- ✅ Inv #2: single source of truth — override skriver KUN `daily_reconciliation`-kolonner + `activity_trail` via emit. Ingen dual-write.
- ✅ Inv #3: emit via registry (`"reconciliation admin_action"`, `"reconciliation locked"`). Ingen direkte `engine_event.insert()`.
- ✅ Inv #4: ADR-0133 — web-only surface, ingen mobile-authoring-drift.
- ✅ Inv #5: ADR-0134 — Server Action `resolveCurrentProfile()` re-derives workspace + profile per ADR-0151; ingen `?? ""`-fallbacks.
- ✅ Inv #6: typecheck 0-feil (via `pnpm turbo typecheck --filter=web` → FULL TURBO cached). Journey-fil skrevet. Handoff-fil (denne). E2E follow-up.
- ✅ Inv #9: admin-override skriver `[OVERRIDE] {reason}`-prefix i `approval_notes` + emit event. `gate_action` verifiserer admin-rolle + confirm-level.
- ✅ Inv #11: split-shift semantikk — M3 vil håndtere; ikke aktuelt i M1 recon-v2 (recon er workspace-nivå, ikke shift-nivå).
- ⚠️ Inv #12: Riksavtalen-tariff i KPI — OversiktTab viser Lønn-linje basert på `total_labor_cost` fra daily_reconciliation som allerede skal inneholde tariff-tillegg fra engine-dispatch. Merket "post-reconciliation" source. Verifisér at backend-beregningen inkluderer kveldstillegg/helgetillegg; hvis ikke, legg til "Estimat — eksl. tillegg"-disclaimer.

## Next steps

1. Ship this sub-sortie via `close-feature.sh` → merges to `campaign/daily-operation`.
2. Open next sub-sortie: Milestone 2 (recon-wizard-mobile) — requires ADR-NEXT-02 first per campaign doc.
3. Address follow-ups FU-1–FU-5 in cleanup sortie eller inline i Milestone 3 (handover-migration).
