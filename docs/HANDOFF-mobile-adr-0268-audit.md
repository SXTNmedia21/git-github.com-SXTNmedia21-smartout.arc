---
title: "HANDOFF — mobile-adr-0268-audit"
feature: mobile-adr-0268-audit
status: done
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [handoff, mobile, adr-0268, audit, drift-fix]
---

# HANDOFF — mobile-adr-0268-audit

## Summary

Drove **ADR-0268 "TabBar Canonical Layout"** from `proposed` (2026-05-04) to `accepted` (2026-05-14). All 5 accept-checklist items verified. ADR text amended to correct 3 cross-reference errors caught by Council 2026-05-14 (4 reviewers). Dead `(home)/index.tsx` redirect-stub deleted + 3 deeplinks retargeted.

This sortie was originally `feat/mobile-restore-4tab-plan` — pivoted to ADR-0268 audit after audit 2026-05-13 (A2 system-steward, opus) discovered the canonical reference (2026-03-24 mobile-ui-master-plan) had been superseded by ADR-0268 nine days prior. Memory entry `project_mobile_4tab_drift_2026_05_03.md` was 1 day stale. Pivot documented in L-0249 + new memory entry `mobile-4tab-drift-2026-05-03-superseded` + new feedback `verify-adrs-before-acting-on-drift-memory`.

## Decisions

### ADR-0268 accepted + amended (this sortie)

- **Status flip:** `proposed` → `accepted` 2026-05-14 (commit `2bccacb1e`).
- **Cross-reference corrections** (3 places — lines 37, 66, 126):
  - Was: "absorbed elsewhere per memory and ADR-0163 helpdesk hub work"
  - Now: "list logic absorbed into Chat tab Skranke segment per ADR-0161 (helpdesk ontology = engine_state) + ADR-0162 (capability placement). `(komm)` route retained as deep-link target + ticket-detail screen."
- **Checklist item 4 wording rewritten** to explicitly record `(komm)` retention decision: route group kept; only tab-bar entry removed. Push deeplink `komm_message` + Chat tab queue-tap both resolve to `/(app)/(komm)/[channelId]` (single source of truth for ticket detail).
- **Cross-references section** updated: ADR-0161 + ADR-0162 separated; ADR-0163 reframed as orthogonal PII fence (not absorption path).

### Council verdict 2026-05-14 (GO WITH CHANGES)

4 reviewers (steward chair, supervisor, agent-coord code-tracer, harness). Semantic conflict resolved: agent-coord "item 4 SATISFIED via fallback" vs harness "NOT SATISFIED until decision recorded" — DIFFERENT layers (code reality vs ADR text), resolved by text fix.

Trust Gate: N/A — ADR-0268 governs mobile tab navigation only; no mutations, no capabilities, no Edge Functions, no `emit()` calls.

### No new ADR created

Amendment to ADR-0268 sufficient. No architectural decision changed — only documentation accuracy improved.

## Learnings

### L-0249 — ADR cross-reference content-drift

**5th cross-reference incident overall** (4 prior renumber-side per `reference_adr_renumber_pattern.md`); **1st content-side instance** (correct number cited, wrong topic from same Council cluster). Rule captured: cite ADRs by `**ADR-N** — <title fragment>`, never bare number. Spot-check every cross-reference at write-time + review-time. Promote to skill enforcement on 3rd content-side occurrence.

### Sortie pivot lesson — memory staleness window is 24h

Recommendation to Pontus 2026-05-13 was built on memory entry that became stale 1 day after creation (ADR-0268 accepted by Pontus + design handoff 2026-05-04, memory dated 2026-05-03). Cost: 1 sortie setup + 2 documentation commits before pivot. New feedback memory `verify-adrs-before-acting-on-drift-memory.md` mandates ADR grep before acting on any drift-claiming memory.

### Worktree pnpm symlink trap (recurrence)

T5 build agent hit `learning_worktree_missing_pnpm_symlinks.md` immediately. Followed by `learning_stale_telemetry_dist_blocks_typecheck.md` after install. Fresh worktree typecheck requires 3 ordered commands (`pnpm install` → `pnpm --filter @smartout/telemetry build` → `pnpm --filter @smartout/utils build`). Pre-build of dist packages should be added to `new-feature.sh` script.

## What was built / changed

### Code changes (commit `3d756361d`)
- `apps/mobile/app/(app)/(home)/index.tsx` — DELETED (dead redirect-stub to `shift-hub`)
- `packages/notifications/src/deep-links.ts` — 3 deeplinks retargeted:
  - `task_assigned` → `(calendar)` (today's day view anchor)
  - `join_request` → `(calendar)`
  - `contract_declined` → `(me)` (Min Tid)
- KEPT on hidden `(home)` subpaths per ADR-0268 Phase 3f deferral:
  - `deviation_reported` → `(home)/deviation`
  - `reconciliation_pending_signoff` → `(home)/clockout`

### Documentation changes (commit `2bccacb1e`)
- `docs/decisions/0268-tabbar-canonical-layout.md` — amended (frontmatter + 3 body sections + checklist final-state)
- `docs/decisions/0000-decision-log.md` — row updated to `accepted`
- `docs/learnings/0249-adr-cross-reference-content-drift.md` — new
- `docs/learnings/0000-learning-log.md` — L-0249 row added
- `docs/council/COUNCIL-LOG.md` — 2026-05-14 session row added

### Specs + plans (commits `88439c7bc`, `dba7392b9`)
- `docs/superpowers/specs/2026-05-13-mobile-restore-4tab-plan.md` — moved to `archive/...-SUPERSEDED.md`
- `docs/superpowers/specs/2026-05-14-mobile-adr-0268-audit.md` — new
- `docs/plans/PLAN-mobile-adr-0268-audit.md` — new (replaces deleted `PLAN-mobile-restore-4tab-plan.md`)
- 3 journey files renamed + rewritten + flipped to `status: verified`

### Memory updates (outside repo, `~/.claude/projects/`)
- `mobile-4tab-drift-2026-05-03-superseded` — replaces prior 4-tab drift entry with supersession note
- `verify-adrs-before-acting-on-drift-memory` — new feedback rule
- `council_meta.md` — Phase 9 self-improvement entries (3 new observations) + session row

## Known issues / debt

### (queue) dead route (flagged by agent-coord code-tracer)
`apps/mobile/app/(app)/(queue)/[ticketId].tsx` still imports `useTicket` but `(queue)` tab is hidden (`href: null`). Imports look like dead code. **Schedule cleanup sortie** before any future `(komm)/` folder deletion attempt.

### (home) subpath deeplinks pending Phase 3f
`deep-links.ts:50` `deviation_reported` → `/(app)/(home)/deviation`
`deep-links.ts:64-65` `reconciliation_pending_signoff` → `/(app)/(home)/clockout`

These remain on hidden `(home)` subpaths until Phase 3f absorbs `shift-hub.tsx` + `clockout.tsx` business logic into Kalender/Vakter. Pattern is legitimized by Council 2026-05-14 ("hidden-route-as-detail-surface"). NOT a defect — explicit deferral.

### `(komm)` folder deletion is FORBIDDEN
ADR-0268 amended checklist item 4 + cross-references + tab-removal-sequence table all explicitly record that `(komm)` route group is **retained as detail surface**. Any future sortie attempting `(komm)/` deletion must:
1. Update `packages/notifications/src/deep-links.ts:53` first.
2. Update `apps/mobile/app/(app)/(chat)/index.tsx:553-554` first.
3. Verify Chat tab "Skranke" segment has standalone detail surface.

### V2 i18n migration (out of scope)
`apps/mobile/src/constants/strings.ts` header notes V2 = migrate to `packages/i18n/`. T6 audit confirmed all 4 canonical labels live locally for V1. V2 migration is a separate sortie.

## Next steps

1. **Run `/close-feature`** to merge `feat/mobile-adr-0268-audit` → `development`.
2. **Future sortie candidate**: V2 i18n migration of mobile strings to `packages/i18n/`.
3. **Future sortie candidate**: `(queue)` dead route cleanup + `useTicket` import audit.
4. **Phase 3f sortie** (separate, mobile campaign): absorb `shift-hub.tsx` + `clockout.tsx` business logic into Kalender/Vakter, then retarget remaining `(home)` subpath deeplinks.
5. **L-0249 watch**: monitor for 2nd + 3rd content-side cross-reference drift occurrence. Promote to SKILL.md on 3rd.

## Commits on `feat/mobile-adr-0268-audit`

| SHA | Message |
|-----|---------|
| `b4906ae92` | docs(mobile): add spec stub for mobile-restore-4tab-plan (PRE-PIVOT — spec later archived on development) |
| `3eec6b349` | docs(mobile): declare plan + 3 journeys for mobile-restore-4tab-plan (PRE-PIVOT — superseded by `dba7392b9`) |
| `dba7392b9` | docs(mobile): pivot plan + journeys to ADR-0268 audit; drop 4-tab restore |
| `3d756361d` | feat(mobile): remove dead (home) redirect-stub + retarget 3 deeplinks |
| `2bccacb1e` | docs(adr-0268): accept + correct cross-references; capture L-0249 |
| (next) | docs(mobile): flip 3 journey status to verified + HANDOFF (this commit) |

## Branch state at handoff

- Branch: `feat/mobile-adr-0268-audit` (renamed from `feat/mobile-restore-4tab-plan` 2026-05-14)
- Worktree: `/home/sxtnl/dev/smartout.ai-wt-4`
- Base: `development`
- Typecheck (post `pnpm install` + telemetry/utils build): `@smartout/mobile` 0 errors; `@smartout/notifications` 0 errors
- Council verdict: APPROVE WITH CHANGES (changes applied)
- Pontus approval: 2026-05-14 "approve, proceed with all four"
