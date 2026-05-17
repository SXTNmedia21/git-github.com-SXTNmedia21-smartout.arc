---
title: "HANDOFF — ui-shell-tidslinjen-a11y-polish"
status: in_progress
updated: 2026-05-17
created: 2026-05-17
module: dashboard-dagslinjen
tags: [handoff, a11y, wcag, sub-sortie, council-r1-follow-up]
---

# Handoff — Tidslinjen A11y Polish (Council R1 Follow-up)

> Branch: `feat/ui-shell-ui-shell-tidslinjen-a11y-polish` | Worktree: `/home/sxtnl/dev/smartout.ai-ui-shell-wt-2` | Base: `campaign/ui-shell` @ `a8eef6add`

## Summary

Closes two sortie-introduced WCAG defects on the Dagslinjen Tidslinjen surface that the post-implementation R1 Council (2026-05-17) flagged on the parent Tidslinjen redesign sortie. The parent sortie shipped 3 commits to `campaign/ui-shell` (tip `94888a3f1` at council time) — the design+a11y reviewer surfaced 3 concrete defects, Steward `git blame` confirmed 2 of 3 were introduced by sortie commits (the third predated the sortie and is inherited Nordic Split debt deferred to ADR-0366).

## What was built

| File:line | Change | Source defect |
|---|---|---|
| `apps/web/src/components/day/DayTimelineStrip.tsx:481` | Wrap `animate-pulse` Tailwind utility in `cn(...)` conditional on `!reduceMotion`. The span now uses `cn("...base classes...", !reduceMotion && "animate-pulse")` so users with `prefers-reduced-motion: reduce` see a static now-marker dot. `useReducedMotion` already imported (line 5) and `reduceMotion` already in scope (line 199); `cn` already imported from `@smartout/ui` (line 8). Mirrors the canonical pattern from `DayEventList.tsx:44`. | WCAG 2.3.3 — sortie-introduced in `5a236d7d82` (density-zoom + sidebar nav scroll commit) |
| `apps/web/src/components/day/ClusterMarker.tsx:213-214` | Append `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:rounded-full` to the cluster trigger's className tuple. Existing `focus-visible:outline-none focus-visible:scale-125` preserved. Keyboard-only users now see a visible 2px ring in the `--ring` token color when the cluster icon receives focus, offset 1px from the icon shape. | WCAG 2.4.11 — sortie-introduced in `be0b43a4eb` (cluster popover + phase tinting commit) |

**Diff size:** 2 files, +7 -1.
**Tests:** no new tests. Both fixes consume canonical Nordic Split + Tailwind patterns already in use elsewhere (`useReducedMotion()` gate at `DayEventList.tsx:44`; `focus-visible:ring-*` tokens are theme defaults).
**Telemetry:** no registry edits. No emit-site changes.

## Decisions made

1. **Defer `TimelineTab.tsx:242` OKLCH literal migration.** Steward `git blame` showed the 3× hardcoded `oklch(...)` literals were committed in `d0deaa6a9a` (2026-05-16), pre-dating the Tidslinjen sortie. Pattern is systemic across 6+ files in `apps/web/src/components/day/` (SlotPicker, ApplyTemplateDialog, SavedTimelinesDropdown, SaveTemplateDialog). Migration belongs in a dedicated sortie driven by **ADR-0366 (proposed)** — Nordic Split OKLCH literal ban + ESLint rule `nordic-split/no-oklch-literal`.

2. **Document `getPhaseBoundaries` ontology, do not relocate.** Steward Phase 3 review noted the helper lives in `packages/utils/src/cascade/derive-phase.ts` next to the canonical ADR-0156 `derivePhase` function but operates as presentation-only with a hardcoded `PREP_WIN_MIN = 30` constant. File-relocation would split a sensible phase-helper family. **ADR-0363 (proposed)** mandates a header comment forbidding business-logic binding without ADR amendment to cascade invariant #6.

3. **Sub-sortie scope limited to sortie-introduced regressions.** Trail of P3 polish (Coord-flagged `departmentId`/`sessionId` prop hardening, `eventTypeKind` union tightening, `event.time` `""` analytics drop) and Phase 3 nits (`use-timeline-selection.ts` colocation in `_hooks/`, hardcoded Norwegian i18n debt) all deferred. Council R1 chair recommended single-purpose sub-sortie to keep the scope tight.

4. **ADR slot allocation under concurrent-session pressure.** Original draft claimed 0348 + 0349 + 0350 (renumber). Mid-flight collision detected: campaign tip `a8eef6add` already had 0348 (L-0258 collision detector — concurrent M5 HMS Sortie 1 G4 renumbered from 0347) and 0350 (BotssonHost mount pattern — concurrent BotssonProvider topology-lift council). Per L-0147 outsider-renumber convention, this sortie (later commit) yielded: OKLCH ban claims 0349 (free); `getPhaseBoundaries` ontology claims 0351 (next free after their 0350).

## Decisions registered

- **ADR-0366** (proposed) — Nordic Split: OKLCH literals forbidden in app code. File: `docs/decisions/0366-nordic-split-oklch-literal-ban.md`. Sets the contract that ALL OKLCH values live in `packages/design-tokens/src/tokens.{ts,css}` and `apps/web/src/app/globals.css` `@theme` block, with ESLint enforcement via `nordic-split/no-oklch-literal`. Migration sortie required (not this one).
- **ADR-0363** (proposed) — `getPhaseBoundaries` presentation-layer ontology disambiguation. File: `docs/decisions/0363-get-phase-boundaries-presentation-ontology.md`. Header comment forbids business-logic binding without ADR amendment. Documentation-only fix; can ship as part of any maintenance commit.

Both registered in `docs/decisions/0000-decision-log.md` at the top of the table (newest-first).

## Learnings logged

1. **`learning_phase3_coverage_gap_design_axis`** (NEW) — Phase 3 multi-agent council triplet (steward + supervisor + system-agent-coordinator) systematically misses token-level design-system violations and a11y semantics (Tailwind OKLCH literals, `animate-*` reduced-motion gating, `focus-visible:outline-none` without compensating ring tokens). Mandate frontend-designer / feature-dev:code-reviewer as 4th Phase 3 reviewer when topic touches `apps/web/src/components/**`. Sibling of L-0147 (single-axis insufficient) — different axis (design vs code-trace), same root.

2. **`learning_builder_agent_report_fabrication_2026_05_17`** (EXTENDED) — R1 postscript appended documenting Path A closure validation (4/4 APPROVE on shipped commits) AND the design+a11y coverage gap that drives the new learning above.

Both indexed in `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/MEMORY.md`.

## Council log entry

Appended to `docs/council/COUNCIL-LOG.md` as `2026-05-17 — Tidslinjen Redesign (Post-Implementation R1)`. Verdict: APPROVE — with mandatory P2 follow-up sub-sortie. Chair self-reversal protocol: REFINED, not REVERSED (L-0147 2-reviewer threshold not met; 1 reviewer with new evidence vs 3 holding APPROVE).

## Known issues / debt

- **`TimelineTab.tsx:242` OKLCH literals** — 3× inline `oklch(...)` in Tailwind class strings. Pre-existing, inherited debt. Resolution: ADR-0366 migration sortie.
- **OKLCH literal sprawl across `components/day/`** — SlotPicker, ApplyTemplateDialog, SavedTimelinesDropdown, SaveTemplateDialog all carry inline literals. Resolution: same ADR-0366 sortie.
- **`getPhaseBoundaries` header comment** — ADR-0363 calls for the comment; not applied in this sub-sortie because the comment-edit blast radius is on `packages/utils/src/cascade/derive-phase.ts` which is outside the Tidslinjen visual-surface scope. Ship the comment in any maintenance commit.
- **Dark-mode phase tint vars are identical to light-mode.** Comment in `globals.css` says "dark tuning deferred to follow-up". Existing tech debt; not regression.
- **Hardcoded Norwegian in `components/day/`** — bypasses i18n. Pre-existing pattern across the folder. Track separately.
- **Phase 3 design+a11y coverage gap fixed via the new learning + ADR candidates above.** Adds a binding rule for future councils, not an immediate code change.

## Next steps

1. Run `~/.claude/scripts/close-feature.sh 2` (from main repo at `~/dev/smartout.ai-ui-shell`) to merge `feat/ui-shell-ui-shell-tidslinjen-a11y-polish` → `campaign/ui-shell`. Journey Guardian gate verifies the JOURNEY file. Sync of `origin/development` into the campaign happens automatically at tail of closure.
2. After closure: schedule the ADR-0366 migration sortie (sortie name: `ui-shell-nordic-split-oklch-migration` or similar). Acceptance: zero `oklch(` matches in `grep -r 'oklch(' apps/ | grep -v test | grep -v stories`. Add the lint rule first, then migrate consumers.
3. Apply the ADR-0363 header comment to `packages/utils/src/cascade/derive-phase.ts` in any maintenance commit (does not require its own sortie).
4. Update `run-council` skill Phase 1 INTAKE topic-class selector to mandate frontend-designer / code-reviewer when topic touches `apps/web/src/components/**`. Captured as next-step in `learning_phase3_coverage_gap_design_axis.md`.

## Acceptance verification

- [x] `apps/web/src/components/day/DayTimelineStrip.tsx:481` — `animate-pulse` wrapped in `cn(...)` conditional on `!reduceMotion`. Verified via `grep` post-edit.
- [x] `apps/web/src/components/day/ClusterMarker.tsx:213-214` — `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` appended. Verified via `grep` post-edit.
- [x] Only 2 files modified (`git diff --stat` shows +7 -1).
- [x] No telemetry registry changes.
- [x] No new files in `apps/web/src/components/day/`.
- [x] ADR-0366 + ADR-0363 written + registered.
- [x] 2 learnings logged + indexed in MEMORY.md.
- [x] Council log entry appended.
- [x] JOURNEY + PLAN files written.

## References

- Parent sortie commits: `ed3854d33` + `5a236d7d82` + `be0b43a4eb` on `campaign/ui-shell`.
- Parent sortie payload-cleanup commit: `94888a3f1` (payroll seed removal — out of scope here, but pushed in same window).
- Council R1 entry: `docs/council/COUNCIL-LOG.md` (2026-05-17 — Tidslinjen Redesign R1).
- ADR-0366: `docs/decisions/0366-nordic-split-oklch-literal-ban.md`.
- ADR-0363: `docs/decisions/0363-get-phase-boundaries-presentation-ontology.md`.
- Learnings: `~/.claude/projects/-home-sxtnl-dev-smartout-ai/memory/learning_phase3_coverage_gap_design_axis.md` + `learning_builder_agent_report_fabrication_2026_05_17.md` (R1 postscript).
- Canonical `useReducedMotion()` pattern: `apps/web/src/components/day/DayEventList.tsx:44`.
- Nordic Split `--warn-soft` tokens: `packages/design-tokens/src/tokens.css:66-67` (light) + `:201-202` (dark).
