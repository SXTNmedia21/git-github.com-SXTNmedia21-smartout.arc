---
title: "HANDOFF — hms-cluster-polish-r2-fixup"
status: done
updated: 2026-05-17
created: 2026-05-17
module: hms
tags: [handoff, council-followup, r2-fixup, wcag, a11y]
---

# HANDOFF — hms-cluster-polish-r2-fixup

> R2 council follow-up. Closes 3 BLOCKERs + 1 maintenance from R2 verdict (2026-05-17 PM2 APPROVE WITH CHANGES). Predecessor: hms-cluster-polish-fixup (campaign tip `ac17ca61e`).

## Summary

Forward-fix sub-sortie on `campaign/ui-shell`. Two commits: `28521f8b0` (plan/journey seed) + `98d7ce100` (gate fixes). Net diff: 4 files +4 / -4 lines (excluding lockfile).

## Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | B1 fix: 130-char rewrite preserving role-conditional info | Validator threshold 140; old purpose 165 chars. Trimmed without losing admin/employee branching semantics. |
| 2 | B3 + B4 replace `transition-all` with `transition-colors` (Nordic Split §10.4) | Pre-commit Nordic Split audit flagged `transition-all` in touched lines. Buttons only transition colors (active state), not size/transform — `transition-colors` is the correct token. Closes drift in same hop. |
| 3 | B2 RETRACTED post-Phase-5: validator works correctly | Orchestrator captured full output + exit code (`echo "exit=$?"`). Validator exits 1 with ✗ printed. Phase 5 chair adopted Agent-coord's head-truncated-output misread. Sibling trap class to L-NEW-2. Captured as L-NEW-C. |
| 4 | ADR-0357 v2 addendum (page-header inheritance) appended to existing file (not new ADR slot) | Addendum is amendment to existing rule, not new rule. Single-file edit preserves cross-reference integrity. |
| 5 | Use HMS scope for commit messages (`docs(hms)` / `fix(hms)`) | commitlint scope-case rejected `hms-r2-fixup` (mixed alpha-digit segments). `hms` is canonical module scope, matches predecessor sortie commits. |

## Learnings

| # | Learning | Slug |
|---|---|---|
| L-NEW-C | Head-truncated stdout misread leads to false negative-claim. 3rd occurrence of output-shaping-misread family (sibling L-NEW-2 Phase 2.5 wrong-scope-key, L-diff-hunk-misled-review). **3-occurrence threshold met — promote to run-council SKILL.md.** Hard rule: always capture exit code explicitly + full output for failure detection, NEVER `head -N` on validators/scripts. | `learning_head_truncated_output_false_negative.md` |

## ADRs

- **ADR-0357 v2 addendum (proposed)** — Page-Header Inheritance Carve-Out. Appended to `docs/decisions/0357-page-polish-documented-intentional-skips.md`. Allows NEVER-skippable (b) "page header + description" to be satisfied via inheritance pattern when: (1) page-file is thin-shell, (2) parent layout provides section-level labeling, (3) child component branches own primary headings. Precedent: HMS training page.

## Known issues / debt

1. **NEW-3 hardcoded Tailwind palette** in 4 HMS files (TaskCard, SessionSignoffDrawer, OversiktDashboard, OversiktEmployee) — 18+ classes. Pre-existing; deferred to Sortie 4 palette-migration sweep.
2. **F-2 animate-spin scope = 297 across 180+ files** (was claimed 6 in R1 HANDOFF; updated 6 → 297 as B5). Sortie 4 scope is dashboard-wide convention shift + ESLint rule, NOT HMS-local.
3. **NC-1 ProcedureDetailTabs `<Tabs>` consistency refactor** — pre-existing custom `<button>` pattern instead of shadcn `<Tabs>`. Sortie 4 consistency pass.
4. **NIT i18n hardcoded label** `ProcedureDetailTabs.tsx:153` `"Opplaeringsinnhold:"` (also typo — should be "Opplæringsinnhold"). Sortie 4.

## Next steps

- **Phase 7+8 council artifacts** ship in next commit on this branch (this HANDOFF + ADR-0357 v2 addendum + L-NEW-C + COUNCIL-LOG R2 entry).
- **close-feature.sh** runs gates + merge to campaign/ui-shell.
- **L-NEW-C promotion** to run-council SKILL.md Common Mistakes table after merge.
- **Sortie 4** picks up: animate-spin dashboard-wide sweep, palette migration, ProcedureDetailTabs Tabs refactor, i18n label.

## Verification trace

- `pnpm --filter web typecheck` → 0 errors (after rebuilding stale package dists: telemetry + types + utils + payroll-* + journey-ir + contracts + ai)
- `npx tsx apps/web/scripts/validate-site-map.ts` → exit 0, `✓ site-map.json valid — 53 route entries`
- `grep -n 'focus-visible:' apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx` → line 106 contains all 4 ring tokens
- `grep -n 'focus-visible:' apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx` → line 79 contains all 4 ring tokens
- Nordic Split pre-commit audit → 0 drift (transition-all replaced with transition-colors)
- jq verified routes[17].purpose length = 130 (was 165)

## Files changed

```
apps/web/.botsson/site-map.json                                      | +1 -1 (B1)
apps/web/src/app/dashboard/hms/_components/LearnFlow.tsx             | +1 -1 (B4)
apps/web/src/app/dashboard/hms/_components/ProcedureDetailTabs.tsx   | +1 -1 (B3)
docs/HANDOFF-ui-shell-hms-cluster-polish-fixup.md                    | +1 -1 (B5)
docs/plans/PLAN-hms-cluster-polish-r2-fixup.md                       | (new)
docs/journeys/JOURNEY-ui-shell-hms-cluster-polish-r2-fixup.md        | (new)
docs/HANDOFF-ui-shell-hms-cluster-polish-r2-fixup.md                 | (this file)
docs/decisions/0357-page-polish-documented-intentional-skips.md      | v2 addendum appended
docs/council/COUNCIL-LOG.md                                          | R2 entry appended
```

## Council artifact references

- R2 Phase 5 synthesis + L-0147 REFINED Self-Reversal + B2 retraction: `docs/council/COUNCIL-LOG.md` `## 2026-05-17 PM2 — HMS Cluster Polish R2 verification` entry.
- ADR-0357 v2 addendum: `docs/decisions/0357-page-polish-documented-intentional-skips.md` (V2 Addendum section).
- L-NEW-C: `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/learning_head_truncated_output_false_negative.md`.
- Run-council Phase 0 carve-out (still active): `~/.claude/skills/run-council/SKILL.md:121-135`.
