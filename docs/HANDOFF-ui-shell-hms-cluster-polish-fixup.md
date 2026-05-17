---
title: "HANDOFF — hms-cluster-polish-fixup"
status: done
updated: 2026-05-17
created: 2026-05-17
module: hms
tags: [handoff, council-followup, r1-fixup, telemetry, a11y, security]
---

# HANDOFF — hms-cluster-polish-fixup

> Sub-sortie of `campaign/ui-shell`. Closes 5 gates from Council R1 verdict on `hms-cluster-polish-read` (APPROVE WITH CHANGES, 2026-05-17).

## Summary

Forward-fix sortie remediating the post-implementation R1 council findings on the M5 Sortie 3 HMS polish. Predecessor sub-sortie already merged at `campaign/ui-shell` tip `430563d27`. This sub-sortie commits `bcc3f6af3` (gate fixes) + `ec729c3b0` (plan/journey) + docs commits below.

**Council reference:** R1 council on hms-cluster-polish-read 2026-05-17 (4 reviewers — system-steward, supervisor, system-agent-coordinator, feature-dev:code-reviewer). Chair Self-Reversal L-0147 6th precedent (a11y axis REVERSED — Code-Reviewer found WCAG 4.1.2 fail Steward marked PARTIAL). 2nd same-day occurrence of design+a11y Phase 3 coverage gap (1st: Tidslinjen R1 2026-05-17 AM) promotes new mandatory rule.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | G1 telemetry wiring pattern: `useRef` + `useEffect` + `nonEmpty(workspace_id, actor_id)` guard | Mirrors `apps/web/src/app/dashboard/contracts/page.tsx:71-88` (canonical sibling). L-0177 fail-fast on empty IDs. |
| 2 | G2 HmsSubNav ARIA: Path A (remove tab roles), not Path B (complete tab pattern) | URL-routed nav is a navigation landmark, not a tab widget. `<nav>` + `aria-current="page"` is canonical for routed sub-navigation. Path B would force `role="tabpanel"` wrappers on all routed page children — unnecessary scope. |
| 3 | G3 sanitization: `react-markdown` + `rehype-sanitize` (not DOMPurify) | Migration column comment says "Markdown supported" — current HTML render was both insecure AND wrong intent. react-markdown was already a dep; only added rehype-sanitize + remark-gfm. Matches L-XSS protocol (sanitize at render, not write). |
| 4 | G3 scope: BOTH LearnFlow.tsx (sortie-new) AND ProcedureDetailTabs.tsx (pre-existing) | Same vector, same component family. Fixing only sortie-new would leave the older site exposed. |
| 5 | G4 site-map training entry with `tools: []` | L-0287 phantom-contract avoidance per predecessor HANDOFF Decision #3 — thin-shell delegating page has no page-level state to register tools against. Site-map entry still REQUIRED (Botsson route registry universal). |
| 6 | G5 run-council Phase 0 carve-out paragraph (not full ADR) | Skill amendment captures the lesson directly in run-council. ADR-0357 codifies the principle separately for ADR-grade visibility. |
| 7 | TODO comments for `workspace_readiness_percent` / `protocol_count` / `active_session_count` data | Real values require hoisting hook (`useGovernanceFiltered`, `useDriftInsights`) from child component to page level — ADR-0115 admin pattern. Out of scope for fixup; flagged for Sortie 4. Telemetry emits with 0 + TODO until then. |

## Learnings

| # | Learning | Slug |
|---|---|---|
| L-NEW-1 | Telemetry contract shipped without emit wiring (registry entries defined, 0 call-sites). Sibling of L-0176 (docstring drift) + L-0177 (silent fallback). Trust-gate addition: grep for matching `emit(` call-sites when reviewing registry PRs. | `learning_telemetry_contract_without_emit_wiring.md` |
| L-NEW-2 | Phase 2.5 fact-check methodology — grep wrong-scope-key (2nd occurrence, 1st: chat-whatsapp 2026-05-16). VERIFIED-missing requires positive absence-evidence (file schema understood + appropriate grep pattern), not negative literal-string absence. | `learning_phase_2_5_grep_wrong_scope_key.md` |
| L-NEW-3 | Phase 3 design+a11y coverage gap — 2nd occurrence in 1 day (1st: Tidslinjen R1 AM, 2nd: HMS R1 PM). Steward+supervisor+coord triplet systematically misses Tailwind class + ARIA + focus-token defects. Mandatory frontend-designer / code-reviewer Phase 3 inclusion now ADR-grade — codified in run-council SKILL.md:105-119. | `learning_phase3_coverage_gap_design_axis.md` (existing — updated with 2nd occurrence) |

## ADRs

- **ADR-0357 (proposed)** — Page-Polish 8-Phase Rule: Documented Intentional Skips. Codifies G5 carve-out at ADR-grade. Allows tool-bridge skip on thin-shell delegating pages with HANDOFF cascade rationale; NEVER allows site-map / page header / telemetry view-emit skip.

## Known issues / debt

1. **Telemetry view-event data fields are placeholders.** 3 of 4 events emit with `0` for their data field (workspace_readiness_percent, protocol_count, active_session_count). TODO comments + tracker in plan. Requires hoisting hooks to page level — Sortie 4 scope per ADR-0115 admin pattern blocker.
2. **Pre-existing palette debt in `apps/web/src/app/dashboard/hms/_components/{DeviationKanban,DeviationDetailDrawer,ProcedureDetailTabs}.tsx`** — hardcoded `bg-red-500`, `bg-yellow-500`, `bg-blue-500`. Flagged by predecessor HANDOFF; not scope here.
3. **`animate-spin` on Loader2 — actual count 297 occurrences across 180+ files (dashboard-wide), NOT 6 HMS-local as originally claimed.** Count updated post-R2 council 2026-05-17 PM2 (R1 said 6, R2 reviewer said 20, R2 chair grep verified 297 in 180+ files). WCAG 2.3.3 AAA (not AA). Sortie 4 scope reframed: dashboard-wide `useReducedMotion()` convention shift + ESLint rule, NOT HMS-local fix.
4. **Cardinality concern on `activity_trail` from view events** — predecessor HANDOFF Known Issue #4. Deferred (broader question, applies to all read-side events that route to activity_trail).

## Next steps

- **Phase 7+8 council artifacts** ship in next commit on this branch (COUNCIL-LOG entry + ADR-0357 + 3 learning index updates in MEMORY.md).
- **close-feature.sh** runs gates + merge to campaign/ui-shell.
- **Sortie 4** picks up: (a) palette debt cleanup in HMS components, (b) animate-spin rm-gate sweep, (c) hoist data-derivation hooks to page level for real telemetry payload values.

## Verification trace

- `pnpm --filter web typecheck` → 0 errors.
- `grep -rn 'hms\.umbrella\.viewed\|hms\.drift\.viewed\|hms\.documents\.opened\|hms\.training\.viewed' apps/web/src/app/dashboard/hms/` → 4 emit() call-sites (was 0).
- `grep -n 'role="tab\|role="tablist' apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx` → 0 hits (was 2).
- `grep -n 'dangerouslySetInnerHTML' apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx ProcedureDetailTabs.tsx` → 0 hits (was 2).
- `jq '[.routes[] | select(.path | startswith("/dashboard/hms"))] | length' apps/web/.botsson/site-map.json` → 6 (was 5).
- `grep -n 'Phase 0 carve-out' ~/.claude/skills/run-council/SKILL.md` → 1 match (added).

## Files changed

```
apps/web/.botsson/site-map.json                                      | +18
apps/web/package.json                                                | +8 -2
apps/web/src/app/dashboard/hms/_components/HmsSubNav.tsx             | +4 -2
apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx             | +10 -1
apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx   | +10 -1
apps/web/src/app/dashboard/hms/_components/hms-page-client.tsx       | +33 -2
apps/web/src/app/dashboard/hms/documents/page.tsx                    | +27 -1
apps/web/src/app/dashboard/hms/drift/page.tsx                        | +31 -1
apps/web/src/app/dashboard/hms/training/page.tsx                     | +30 -1
pnpm-lock.yaml                                                       | +62 -37
docs/plans/PLAN-hms-cluster-polish-fixup.md                          | +95 (new)
docs/journeys/JOURNEY-ui-shell-hms-cluster-polish-fixup.md           | +50 (new)
docs/HANDOFF-ui-shell-hms-cluster-polish-fixup.md                    | +this file
docs/council/COUNCIL-LOG.md                                          | +R1 entry
docs/decisions/0357-page-polish-documented-intentional-skips.md      | +new ADR
docs/decisions/0000-decision-log.md                                  | +1 row
```

## Council artifact references

- Phase 5 synthesis verdict + L-0147 self-reversal: COUNCIL-LOG.md `## 2026-05-17 — HMS Cluster Polish Read (Post-Implementation R1)` entry.
- Visual-surface mandatory rule (referenced): `~/.claude/skills/run-council/SKILL.md:105-119`.
- Page-polish mandatory rule + Phase 0 carve-out (this sortie): `~/.claude/skills/run-council/SKILL.md:121-133`.
