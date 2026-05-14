---
title: "HANDOFF — mobile-phase-3f-home-absorption (3f.1)"
feature: mobile-phase-3f-home-absorption
branch: feat/mobile-phase-3f-home-absorption
closed: 2026-05-14
module: mobile
tags: [handoff, mobile, phase-3f, council-g2, sortie-split, l-0147-precedent]
sortie-of: ADR-0268 Phase 3f
follow-up-sorties: [3f.2, 3f.3, 3f.4]
---

# HANDOFF — mobile-phase-3f-home-absorption (3f.1)

## Summary

Drove ADR-0268 §"Tab removal sequence" Phase 3f forward by **shipping the smallest safe wedge (3f.1)** — full inbound-importer audit + delete of `(home)/shift-hub.tsx` + 4-sortie roadmap handoff. Council G2 verdict 2026-05-14 (5 reviewers) **split the original single-sortie plan into 4 sub-sorties** (3f.1/3f.2/3f.3/3f.4) due to 11× LOC budget overrun. Order inversion required: **retarget 25 inbound importer sites BEFORE any `(home)` file moves or is deleted** in follow-up sorties.

This sortie does NOT absorb any business logic. It produces:
1. Authoritative retarget map for 3f.2/3f.3/3f.4 (`docs/audits/2026-05-14-phase-3f-inbound-importer-map.md`)
2. Single safe deletion (`(home)/shift-hub.tsx` — verified 0 inbound `router.push`)
3. ADR-0268 amendment 2026-05-14 with Council G2 verdict + 4-sortie roadmap
4. L-0147 8th codified precedent (Chair Self-Reversal on A1 "0 cross-folder importers" claim)
5. L-0250 + L-0251 captured

## Journeys Delivered

| Journey | Status | E2E test |
|---------|--------|----------|
| inbound-importer-audit-shipped | verified | deferred (audit doc) |
| shift-hub-shell-deleted | verified | deferred (typecheck-only verification) |
| roadmap-handed-off | verified | n/a (documentation deliverable) |

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| Split Phase 3f into 4 sub-sorties (3f.1/3f.2/3f.3/3f.4) | 19 files × ~8995 LOC = 11× over 800 LOC budget; single-sortie ship = merge-conflict risk + regression surface | Each sub-sortie has bounded scope; 3f.1 ships smallest safe wedge (audit + 1 delete); 3f.2/3f.3/3f.4 spawn after 3f.1 closure |
| Order inversion: retarget BEFORE absorb/delete | 25 external sites target `(home)/*` via 7 importer classes (push deeplinks, nav tables, phase-views, capability tools, prioritize-actions, cross-tab routes, page-context literals). Naive delete-first = 404 storm | 3f.2 first action = retarget 14 deeplinks; 3f.3 = retarget 6; 3f.4 = retarget 4 + folder delete |
| Compliance fixes bundled with absorption | `temp-deviation.tsx:162` direct `supabase.update()` violates ADR-0287; `edit-profile.tsx` violates ADR-0134+0287; absorbing as-is moves the violation | 3f.2 owns temp-deviation gateAction wrap + edit-profile Server Action wrap |
| `(home)/shift-hub.tsx` DELETE in 3f.1 (only) | Council G2 verified 0 inbound `router.push` to this specific file; component-folder views consumed externally via `ShiftClockView` survive | Smallest safe wedge ships pattern + clears one file before bigger absorptions |
| `apps/mobile/src/components/home/` RETAIN in 3f.1 | `ShiftClockView.tsx:36,254` consumes `AfterShiftView` from this folder; intra-folder consumers number 5+; rename now would block 3f.2/3f.3/3f.4 with phantom imports | Component folder retained; rename deferred to 3f.4 final cleanup |
| ADR-0268 amendment (not new ADR) | Council G2 verdict refines execution of existing ADR-0268 mandate; no new architectural decision | ADR-0268 frontmatter `amended` block extended with Council G2 reference |
| L-0250 captured as canonical immediately | Council G2 5-reviewer convergence; clear rule with 7-class taxonomy | New rule for future councils on route-group absorption |
| L-0251 captured as canonical immediately | Council G2 verified component-folder distinction; clear rule with rename-deferral protocol | New rule for future route-restructuring sorties |

All decisions registered in `docs/decisions/0000-decision-log.md` (ADR-0268 row updated).

## Learnings

| Learning | Context |
|----------|---------|
| L-0250 — Route-group absorption requires inbound-importer audit, not just route-tree audit | A1 grep returned "0 cross-folder importers" via standard `import` pattern. Council G2 Phase 5 chair self-reversal found 25+ external sites via 7 importer-class taxonomy (push deeplink registry, nav tables, phase-views, capability tool route tables, prioritize-actions, cross-tab `router.push`, page-context literals). All STRING LITERALS, not imports. |
| L-0251 — Component-folder location aligns with route-folder during route moves | `apps/mobile/src/components/home/` ≠ `apps/mobile/app/(app)/(home)/`. Distinct folders; component folder survives route deletion. But naming drift = semantic debt; future readers chase obsolete reference. |
| L-0147 8th codified precedent | Chair Self-Reversal Protocol stable across 8 consecutive councils. Year Wheel 2026-04-20 (1st) through Phase 3f G2 2026-05-14 (8th). Pattern is stable; SKILL.md §1.5 holds. Two precedents in one day (G1 + G2) confirms generalization-vs-code-trace asymmetry. |

## Known Issues / Debt

### Owned by 3f.2 (8 files + 14 deeplink retargets, ~4475 LOC)

- ABSORB → `(shifts)`: clockout, deviation, haccp, punch-clock, safety-round, team, team/[id], temp-deviation
- **FIX BEFORE ABSORB:** `temp-deviation.tsx:162` direct `supabase.from("deviation").update()` — wrap in capability tool with `gate_action` per ADR-0287
- **FIX BEFORE ABSORB:** `edit-profile.tsx:115` direct `supabase.from("profile").update()` + L90 storage upload — add `getProfileContext()` + `emit('profile.updated')` + Server Action wrap (ADR-0134 + ADR-0287)
- **VERIFY BEFORE ABSORB:** punch-clock + clockout — body re-trace required (Council G2 Trust Gate UNVERIFIED on these two; A2 head-grep returned empty, full trace needed)
- **ADR-0267 fence:** team.tsx + team/[id].tsx — verify RLS policy on `profile` + `user_identity` queries enforces workspace isolation (email + phone PII surfaced)
- **L-0177 fail-fast:** Each absorbed mutation must use `getProfileContext()` (no body-supplied IDs per ADR-0151)
- Retarget 14 deeplinks per audit doc §"3f.2"

### Owned by 3f.3 (6 files + 6 deeplink retargets, ~3450 LOC)

- ABSORB → `(me)`: course-detail, edit-profile (after 3f.2 compliance fix), flow-player, settings, spokesperson-approval, training
- **L-0177 fail-fast:** `spokesperson-approval.tsx:47` — add explicit `if (row.workspace_id !== profile.workspace_id) throw L-0177-error` post-fetch
- **ADR-0133 R5 amendment OR defer:** `availability.tsx` D2 authoring (RRULE weekly templates via `AvailabilityScreen`) — decide between (a) ADR-0133 R5 amendment permitting self-D2 authoring on mobile OR (b) defer to web. Council G2 flagged.
- Retarget 6 deeplinks per audit doc §"3f.3"

### Owned by 3f.4 (1 file + 4 deeplink retargets + folder delete, ~600 LOC)

- ABSORB operations → `(calendar)` (verify against existing weekly strip per Frontend Q4 — may merge with existing surface, not parallel absorb)
- DELETE `(home)/_layout.tsx` + `(home)/hms.tsx` (3-button navigation hub → FAB AddSheet entries per Frontend Q6)
- DELETE `(home)/` route group entirely
- Remove `<Tabs.Screen name="(home)" href:null />` from `apps/mobile/app/(app)/_layout.tsx`
- Retarget 4 deeplinks per audit doc §"3f.4"
- Update `apps/mobile/src/hooks/queries/use-botsson-chat.ts:367` pageContext literal `"(app)/(home)"`
- **L-0251 follow-up:** Rename `apps/mobile/src/components/home/` to canonical location (likely `components/shift/` since AfterShiftView ↔ shift-clock dependency dominates)

### Not in any Phase 3f sortie

- **`(queue)/[ticketId].tsx` dead route** — flagged by prior sortie HANDOFF (mobile-adr-0268-audit 2026-05-14); separate cleanup sortie still pending
- **L-0176 docstring-vs-body re-verify** — `deviation.tsx:94` + `haccp.tsx:124` claim ADR-0134 compliance in comments. 3f.2 must verify body matches docstring before absorb

## Next Steps

1. **3f.2 sortie (next):** Pre-flight = body re-trace of punch-clock + clockout for ADR-0134/0287/0151 compliance. Then atomically: retarget 14 deeplinks + fix temp-deviation + fix edit-profile + ABSORB 8 files → `(shifts)`. Council G4 pre-merge review before close.
2. **3f.3 sortie:** Retarget 6 deeplinks + spokesperson L-0177 fail-fast + ADR-0133 R5 amendment decision + ABSORB 6 files → `(me)`. Council G3-mini on R5 amendment (load-bearing ADR change).
3. **3f.4 sortie (final):** Retarget 4 deeplinks + operations vs calendar duplicate-merge verification + FAB-AddSheet replacement for hms.tsx + folder delete + `_layout.tsx` cleanup + component-folder rename. Council G4 final pre-merge.
4. **L-0250 watch:** Monitor for 2nd content-side route-group importer audit miss. Promote to SKILL.md `run-council` Phase 2 hard rule on 3rd occurrence.
5. **L-0251 watch:** Monitor for 2nd component-folder/route-folder naming drift incident.

## Commits on `feat/mobile-phase-3f-home-absorption`

| SHA | Message |
|-----|---------|
| (varies) | docs(mobile): declare plan + 3 journeys for phase-3f-home-absorption |
| (varies) | docs(mobile): overwrite phase-3f plan stub with full plan + tasks |
| (this commit) | docs(mobile): 3f.1 ships — audit doc + shift-hub.tsx delete + Council G2 verdict + L-0250 + L-0251 + roadmap handoff |

## Branch state at handoff

- Branch: `feat/mobile-phase-3f-home-absorption`
- Worktree: `/home/sxtnl/dev/smartout.ai-wt-4`
- Base: `development`
- 3 journeys: all `status: verified`
- ADR-0268 amended with Council G2 verdict
- L-0250 + L-0251 in learning log; L-0147 8th precedent in council_meta
- Council G2 verdict: GO WITH CHANGES (5 reviewers, NOT DEGRADED)
- Pontus approval: 2026-05-14 "approve" + "invoke Council G2" + "approve" sequence
