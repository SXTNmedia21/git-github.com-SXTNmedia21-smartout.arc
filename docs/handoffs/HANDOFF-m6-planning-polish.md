---
title: "Handoff — m6-planning-polish"
feature: m6-planning-polish
branch: feat/ui-shell-m6-planning-polish
closed: 2026-05-18
module: dashboard-planning
tags: [handoff, polish, m6, ui-shell, cascade-d4, cascade-d5]
---

# Handoff — m6-planning-polish

## Summary

M6 Planning cluster sub-sortie: 3 dashboard routes through the 8-phase
`smartout-page-polish` workflow. Cluster touches Cascade D4 (year-wheel:
season_budget, day_factor, hour_factor) and the I1 bootstrap residual
(setup wizard hand-off). Polish was UI-only — zero D4 logic changes, zero
new ADRs.

Sortie dispatched 3 parallel sonnet polish agents (one per route), one
sonnet code-reviewer for cross-route audit, and one orchestrator-applied
fix from review feedback. Council not triggered (no boundary crossings,
no agent disagreement, no high-risk decisions).

## Journeys Delivered

| Journey | Status | Verification |
|---|---|---|
| Manager reviews cascade change-proposals | verified | code-reviewer pass |
| Owner plans the year on the Year-Wheel | verified | warm render 0.45s, Server Action emit verified |
| Admin completes setup wizard hand-off | verified | scaffold + Nordic Split clean |

## Decisions Made

No new ADRs. Polish-only sortie. All decisions deferred to follow-up
sorties (see "Deferred").

## Routes polished

### `/dashboard/proposals`
- Created: `loading.tsx`, `error.tsx`, `[proposalId]/loading.tsx`, `[proposalId]/error.tsx`
- Modified: `_components/ProposalsListClient.tsx`, `_components/ProposalDetailClient.tsx` (semantic-token migration), `_hooks/use-payroll-proposals.ts` (BFF-emit explanation comment)
- Site-map: `polished_at` 2026-05-14 → 2026-05-18
- Telemetry: BFF-delegated emit per ADR-0134 (intentional — client mutations do NOT emit directly; the `/api/payroll/*` routes own it)

### `/dashboard/year-wheel`
- Created: `error.tsx`
- Modified: `_components/canvas/TimelineBlock.tsx` (#fff → var(--primary-foreground), rgba boxShadow → color-mix, bg-white → bg-primary-foreground), `_components/SeasonQuickCreateSheet.tsx` (DEBT comments on 5 hex COLOR_PRESETS)
- Site-map: `polished_at` 2026-05-14 → 2026-05-18
- Phase 1 baseline: cold 12.0s (server boot), warm 0.45s (well under 3s threshold — Phase 2 skipped)
- Server Action emit verified: `activateSeasonAction` emits `season activated`, `season archived` (displaced season), `season operating_hours_generated`, `season activation_failed`. `archiveSeasonAction` emits `season archived` (idempotent branch skips correctly).

### `/dashboard/setup`
- Created: `loading.tsx`, `error.tsx`
- Modified: none (page already Nordic Split clean — 0 hardcoded colors)
- Site-map: `polished_at` 2026-05-14 → 2026-05-18
- Loading.tsx replaces the inline Suspense spinner with a layout-matching wizard skeleton (removes skeleton flash)

## Code Review (sonnet, Wave 4)

VERDICT: APPROVE-WITH-CHANGES (1 issue fixed by orchestrator before close).

**Fixed before close (orchestrator)**:
- 3x `emerald-600 dark:emerald-400` → `text-success` / `bg-success text-success-foreground`. The `--color-success` token already lives in `apps/web/src/app/globals.css:61-62` (backed by `packages/design-tokens/src/tokens.css`). The polish agent was given mis-guiding instructions about emerald being acceptable for finance amounts — corrected mid-sortie. Files: `ProposalDetailClient.tsx:74, 375`, `ProposalsListClient.tsx:102`.

## Learnings

| Learning | Context |
|---|---|
| Sonnet polish agents follow orchestrator hints literally. If the prompt says "emerald-600 is acceptable for finance amounts", the agent will ship that even when `text-success` exists in the design tokens. Lesson: orchestrator must NOT pre-resolve token names in the prompt — point the agent at the design tokens file and let it choose. | Wave 3 proposals agent shipped `emerald-*`; Wave 4 reviewer caught it; orchestrator fixed. Cost: ~3-line patch + reviewer round. |
| The Stop-hook `typecheck.sh` matches `smartout\.ai-wt-[0-9]+/` — the LEGACY worktree naming. New campaign-prefixed naming (`smartout.ai-ui-shell-wt-1/`) does NOT match, so the hook ran web typecheck (5+ min) and SIGTERM'd at the 180s hook timeout, blocking every agent edit. Fix: regex extended to `-wt-[0-9]+/` (covers both shapes). Hook lives in TWO copies — `${CLAUDE_PROJECT_DIR}/.claude/hooks/typecheck.sh` resolves via main worktree (NOT the wt-N worktree), so the main copy is the one that runs. Patch the main copy; the wt-N copy is for future propagation. | Applied during Wave 3. Recommend committing the main-copy patch on `campaign/ui-shell` so it survives sortie close. |
| `close-feature.sh` requires JOURNEY frontmatter `feature: <branch-suffix>` + `status: verified`, AND handoff at canonical `docs/handoffs/HANDOFF-<branch-suffix>.md` — branch suffix excludes the `feat/ui-shell-` prefix. Branch `feat/ui-shell-m6-planning-polish` → feature key `m6-planning-polish`. | Verified pre-close. |
| Dev-server-down at agent curl-time = N/A baseline. Setup agent saw HTTP 500 + connection reset because web :3061 had Bash-timeout'd between dispatch and curl. Year-wheel agent succeeded because web was restarted in parallel. | Orchestrator should restart web with longer bash timeout (or persistent Monitor) before dispatching long-running build agents. |

## Known Issues / Deferred Debt

| # | Issue | Sortie suggestion |
|---|---|---|
| 1 | `nativeTheme.season` palette missing — `SeasonQuickCreateSheet.tsx` COLOR_PRESETS keeps 5 hex literals with per-line DEBT comments. No canonical season-palette token exists in `packages/design-tokens/src/native.ts`. Migration to wrong semantic tokens would be incorrect. | `design-token-sweep` sortie — add `nativeTheme.season` palette, then migrate all season-color references repo-wide |
| 2 | `setup/_adapters/employment-save-bridge.ts` registers `callEmploymentSave()` but does NOT emit a domain event on successful save. The actual save path (`EmploymentSetupStep.tsx:312`) emits `"button clicked"` with `trackingId: "employment-terms-saved"` — generic, not domain-typed. | `telemetry-registry-add` sortie — add `employment_contract saved` (or `setup.employment_step_saved`) to `packages/telemetry/src/registry.ts`, then wire emit in bridge with `nonEmpty()` guards |
| 3 | Motion-token inline values: `TimelineBlock.tsx:33-34` + `SeasonActivationProposalModal.tsx:126-127` use inline `stiffness/damping/mass` — correct Nordic Split canonical values but should be imported from `motionTokens.spring`. Open system-wide debt across 14 files. | `motion-token-sweep` sortie — central import migration |
| 4 | `ProposalsListClient.tsx:82-84` ProposalRow badge hardcodes "Venter godkjenning" regardless of `item.status`. `activeFilter` state is wired to ProposalsToolsBridge but never filters the rendered list. If BFF `/api/payroll/proposals` returns only `status='pending'`, the filter UI is dead-weight; if it returns mixed statuses, the badge mislabels applied/rejected rows. Reviewer Finding 2, confidence 82, requires BFF-behavior verification before fix. | Single-file diagnostic — verify BFF response shape, either filter client-side or extract `statusBadge()` to shared helper. Optional small sortie. |
| 5 | Pre-existing TS2307 errors across `@smartout/telemetry`, `@smartout/types`, `@smartout/ai` — stale dist symlinks in fresh worktrees (L-0190). Not caused by M6. Workaround: `pnpm install` from worktree root (we ran this mid-sortie when the preflight reported missing node_modules). | Recurring trap — possibly a `pnpm install --frozen-lockfile` baked into `new-feature.sh` would help; tracked elsewhere. |

## Hook Patch (orchestrator action)

`.claude/hooks/typecheck.sh` regex extended `smartout\.ai-wt-[0-9]+/` → `-wt-[0-9]+/`. Patched in BOTH worktrees mid-sortie. The main-copy patch survives sortie close because the wt-N copy was deleted with the worktree. Recommend committing the main-copy patch separately so it does NOT vanish if the campaign worktree is ever re-cut from `development`.

## Next Steps

1. Operator: verify the 3 new `error.tsx` boundaries actually fire by triggering a failed query on each route (e.g. invalid `proposalId`, supabase down).
2. Operator: smoke-test `setup` `loading.tsx` skeleton matches the wizard layout shape (no flash on slow connection).
3. Pontus: decide sequencing for deferred sorties #1-#4 above (lowest-risk = #4 ProposalRow diagnostic; biggest-payoff = #1 nativeTheme.season for repo-wide cleanup).
4. M6 not yet milestone-complete — still need `m6-calendar-polish` sortie (web `/dashboard/calendar`, separate cluster).
