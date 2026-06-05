---
title: "Handoff — policies-handbook-polish-write"
status: ready-to-merge
feature: policies-handbook-polish-write
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [handoff, ui-shell, polish, hms, policies, handbook, council-verified, campaign-ui-shell, M5-final]
---

# Handoff — policies-handbook-polish-write

M5 Sortie 4 of 4 — FINAL. HMS cluster complete.

## Read FIRST

- `docs/plans/PLAN-policies-handbook-polish-write.md`
- `docs/journeys/JOURNEY-ui-shell-policies-handbook-polish-write.md` (verified)
- `docs/council/COUNCIL-LOG.md` row "2026-05-17 — M5 HMS cluster scoping"
- `docs/plans/CAMPAIGN-ui-shell.md` M5 entry (mark COMPLETE after this merges)
- Sortie 1+2+3 HANDOFFs for full M5 context

## What Was Built

### Routes — 6 boundary files

| File | Status |
|---|---|
| `/dashboard/hms/deviations/error.tsx` | NEW |
| `/dashboard/hms/deviations/loading.tsx` | NEW |
| `/dashboard/hms/procedure/[id]/error.tsx` | NEW |
| `/dashboard/hms/procedure/[id]/loading.tsx` | NEW |
| `/dashboard/policies/error.tsx` | NEW (loading.tsx pre-existed) |
| `/dashboard/handbook/error.tsx` | NEW (loading.tsx pre-existed) |

All 4 `error.tsx` files: Norwegian "Prøv igjen", outline button variant (Sortie 3 G4 LOW deferred — absorbed here preemptively), semantic destructive accent on icon/border.

### Component Token Sweep — 11 components, ~38 hardcoded → semantic

| Component | Hits fixed | Notes |
|---|---|---|
| `DeviationKanban.tsx` | 8 | severity bg/text + count badge |
| `DeviationDetailDrawer.tsx` | 5 | SEVERITY_COLORS map + resolved block |
| `DeviationForm.tsx` | 4 | icon container + 3× required asterisk |
| `DeviationListView.tsx` | 4 | severity badges |
| `ProcedureDetailTabs.tsx` | 2 | training content box |
| `ProcedureExperience.tsx` | 0 | clean |
| `PoliciesPageClient.tsx` | 0 | clean |
| `PolicyCreateDialog.tsx` | 0 | clean, uses CSS vars |
| `PolicyTypeBadge.tsx` | 4 | emerald/blue/amber/violet → success/info/warning/primary |
| `ChapterReader.tsx` | 6 | orange-* → brand-orange CSS var; dark/light conditional collapsed |
| `handbook-page-client.tsx` | 1 | text-orange-500 → text-brand-orange |

**DeviationKanban motion audit:** No `AnimatePresence` or `motion.*` found. Council Phase 3 condition 4 satisfied by absence — no guard added. Plain `<button>` cards with CSS `transition-colors` only.

### Telemetry — 2 new events

Both follow SPACE-separator convention. Registered in `packages/telemetry/src/registry.ts`.

| Event | Interface | Destinations | Category |
|---|---|---|---|
| `"deviation viewed"` | `DeviationViewed` | posthog + logger + activity_trail | operations |
| `"handbook chapter_opened"` | `HandbookChapterOpened` | posthog + logger + activity_trail | training |

## Council Conditions — 7/7 PASS

| # | Condition | Status |
|---|---|---|
| 1 | 4 error.tsx + 2 loading.tsx in one commit | PASS |
| 2 | No hardcoded color tokens | PASS (0 hits across 11 components) |
| 3 | SkeletonEntrance at route boundary only | PASS |
| 4 | DeviationKanban motion budget guard | PASS (no AnimatePresence present) |
| 5 | Bridge tool descriptions unchanged | PASS (no _tools edits) |
| 6 | Norwegian retry button outline variant | PASS (4/4 "Prøv igjen" + outline) |
| 7 | Telemetry SPACE-separator | PASS (2 new events) |

## Decisions

- **Outline button variant adopted** for retry buttons — was G4 LOW deferred from Sortie 3; absorbed this sortie to align all M5 error boundaries.
- **SPACE-separator telemetry naming** for new HMS-cluster events aligns with codebase convention. Sortie 3's dot-separator events (`hms.umbrella.viewed`, etc.) remain unchanged — no ADR yet mandating one convention.
- **ChapterReader brand-orange consolidation:** collapsed dark/light conditional into single `brand-orange` CSS variable class. Small simplification, not a polish goal but came out cleanly.

## Learnings

1. **Builder absorbed Sortie 3 G4 deferred LOWs preemptively** (outline variant, telemetry space-separator). Pattern: document prior sortie G4 deferred fixes in the next sortie's plan — builder picks them up without explicit prompt, saves a G4 round trip.
2. **DeviationKanban motion guard turned out unnecessary** — component never had AnimatePresence. Council Phase 3 flagged it speculatively. Confirmed by code-trace this sortie. Pattern: speculative motion concerns get downgraded to "audit" not "guard" after trace.
3. **PolicyTypeBadge color encoding:** policy types map to semantic tokens (handbook=primary, training=info, procedure=warning, custom=success). Ordering is counterintuitive — training is "info-y", not "success". Document when building future badge variants.

## Known Issues / Debt

- **Drift/loading.tsx layout mismatch** (Sortie 3 deferred LOW) — outline button landed; skeleton-tuning remains for follow-up if Pontus prioritizes.
- **Telemetry naming convention** — dot vs SPACE has no ADR. Two conventions now coexist in the codebase. ADR needed before next telemetry sortie.
- **8 cross-domain L-0258 collisions** still in ratchet allowlist (`scripts/known-tool-name-collisions.json`) — follow-up sortie required to shrink to 0.
- **L-0287 capability gap deferred** — no hms/policies/handbook/deviations capability in `packages/ai/src/capabilities/`. Bridge tool descriptions are L1-only. Build capability sortie when Botsson harness phase requires.
- **DeviationDetailDrawer focus trap** — not audited. If Radix UI Dialog/Sheet default focus trap holds, fine. Else: separate a11y sortie.

## Files Changed

```
apps/web/src/app/dashboard/hms/deviations/error.tsx                       NEW
apps/web/src/app/dashboard/hms/deviations/loading.tsx                     NEW
apps/web/src/app/dashboard/hms/procedure/[id]/error.tsx                   NEW
apps/web/src/app/dashboard/hms/procedure/[id]/loading.tsx                 NEW
apps/web/src/app/dashboard/policies/error.tsx                             NEW
apps/web/src/app/dashboard/handbook/error.tsx                             NEW
apps/web/src/app/dashboard/hms/_components/DeviationKanban.tsx            token sweep
apps/web/src/app/dashboard/hms/_components/DeviationDetailDrawer.tsx      token sweep
apps/web/src/app/dashboard/hms/_components/DeviationForm.tsx              token sweep
apps/web/src/app/dashboard/hms/_components/DeviationListView.tsx          token sweep
apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx        token sweep
apps/web/src/app/dashboard/policies/_components/PolicyTypeBadge.tsx       token sweep
apps/web/src/app/dashboard/handbook/_components/ChapterReader.tsx         token sweep
apps/web/src/app/dashboard/handbook/_components/handbook-page-client.tsx  token sweep
packages/telemetry/src/registry.ts                                        2 new events
docs/plans/PLAN-policies-handbook-polish-write.md                         plan
docs/journeys/JOURNEY-ui-shell-policies-handbook-polish-write.md          journey
docs/HANDOFF-ui-shell-policies-handbook-polish-write.md                   this file
```

Commits: `b0c2cb37f` (plan+journey), `55dc524be` (polish + boundary files + token sweep + telemetry).

## M5 Milestone Status

M5 = HMS cluster (8 routes) — **COMPLETE** after this merge. 4/4 sorties shipped:

| Sortie | Name | Commit |
|---|---|---|
| 10 | `pre-m5-mutation-closure` | `9ef0fbb60` |
| 11 | `hms-collision-fix` | `379036989` |
| 12 | `hms-cluster-polish-read` | `430563d27` |
| 13 | `policies-handbook-polish-write` | pending merge SHA |

Campaign-ui-shell milestones remaining: M6 (Planning, 3 routes), M7 (Komm+AI+MinTid, 4 routes), M9 (milestone PR — Pontus's call).

## Next Steps

1. Run `close-feature.sh` from inside `/home/sxtnl/wsl/smartout.ai-ui-shell-wt-1`
2. Sub-sortie merges to `campaign/ui-shell` via merge-commit (ADR-0213)
3. Worktree removed by close-feature
4. Update `docs/plans/CAMPAIGN-ui-shell.md`: mark M5 COMPLETE + add Sortie 13 row
5. Pontus decides: dispatch Sortie 14 (M6 first sortie) OR cut M9 milestone PR now OR pause

## Verification Commands

```bash
# Typecheck
pnpm --filter web typecheck
# → 0 errors

# Site map
pnpm --filter web site-map:validate
# → exit 0

# Tool collision ratchet
pnpm lint:tool-collisions
# → exit 0, allowlist 8 unchanged

# 6 boundary files exist
ls \
  apps/web/src/app/dashboard/hms/deviations/error.tsx \
  apps/web/src/app/dashboard/hms/deviations/loading.tsx \
  "apps/web/src/app/dashboard/hms/procedure/[id]/error.tsx" \
  "apps/web/src/app/dashboard/hms/procedure/[id]/loading.tsx" \
  apps/web/src/app/dashboard/policies/error.tsx \
  apps/web/src/app/dashboard/handbook/error.tsx | wc -l
# → 6

# 0 hardcoded color tokens
grep -nE 'bg-(green|amber|red|yellow|orange|blue|purple|emerald|rose|indigo|cyan|teal|sky|lime|pink|fuchsia|violet)-[0-9]|text-(green|amber|red|yellow|orange|blue|purple|emerald|rose|indigo|cyan|teal|sky|lime|pink|fuchsia|violet)-[0-9]' \
  apps/web/src/app/dashboard/hms/_components/{Deviation,Procedure}*.tsx \
  apps/web/src/app/dashboard/policies/_components/*.tsx \
  apps/web/src/app/dashboard/handbook/_components/*.tsx | wc -l
# → 0

# Norwegian retry button in all 4 error.tsx
grep -c "Prøv igjen" \
  apps/web/src/app/dashboard/hms/deviations/error.tsx \
  "apps/web/src/app/dashboard/hms/procedure/[id]/error.tsx" \
  apps/web/src/app/dashboard/policies/error.tsx \
  apps/web/src/app/dashboard/handbook/error.tsx
# → all 1

# No AnimatePresence in kanban
grep -c "AnimatePresence" apps/web/src/app/dashboard/hms/_components/DeviationKanban.tsx
# → 0

# 2 new telemetry events registered (≥4 hits: interface + EVENT_ROUTING per event)
grep '"deviation viewed"\|"handbook chapter_opened"' packages/telemetry/src/registry.ts | wc -l
# → ≥4
```
