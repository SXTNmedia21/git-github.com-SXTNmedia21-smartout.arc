---
title: "Handoff — campaign/ui-shell R1 council fixup"
status: complete
feature: ui-shell-r1-fixup
parent_campaign: ui-shell
council: campaign-ui-shell-shippability-r1
council_date: 2026-05-17
updated: 2026-05-17
created: 2026-05-17
module: ui-shell
tags: [handoff, council-followup, r1-fixup, migration, telemetry, wcag, i18n]
---

# Handoff — campaign/ui-shell R1 council fixup

> Closes 3 hard blockers + 4 required-before-promote from 2026-05-17 R1 council on `campaign/ui-shell` shippability. Plus Phase 7+8 council closure artifacts.

## Summary

R1 council on campaign/ui-shell shippability (2026-05-17) returned **REJECT — REMEDIATE BEFORE HOP A**. This sortie closed all blockers + required items.

**Branch:** `feat/ui-shell-r1-fixup` (based on `campaign/ui-shell` @ `294a5d84c`)
**Final tip:** `a31dcf629`
**9 commits.** All verification gates green.

Campaign tip moved to `5a116c2bf` during F1 work (concurrent sync-campaign pulled in 40 commits from `origin/development` + payroll-campaign merge — including 5 ADR ID renumbers `0347-0351` → `0359-0363` and 3 learning renumbers `0286/0287/0289` → `0295/0296/0297`). Three-way merge at close-feature absorbs F1 cleanly.

## Decisions

### D1 — Tab ARIA refactor: shadcn Tabs (Path B) over manual ARIA

For `ProcedureDetailTabs.tsx` WCAG 4.1.2 fix, chose shadcn `<Tabs>` primitive (Radix TabsPrimitive) instead of manual `role="tab"` + `aria-selected` + `aria-controls`. Rationale: Radix provides all WCAG-required semantics out of the box, simpler maintenance, consistent with codebase conventions.

HMS R1 HmsSubNav used Path A (nav + Link + aria-current — route-based tabs). ProcedureDetailTabs is stateful within one route, so Path A doesn't fit. Path B is the correct pattern for stateful tabs.

### D2 — Migration retimestamp target window: `2026061711xxxx`

Originally planned `20260617110100`/`110200`. Reality: dev tip moved to `20260619100000` during F1 work. Re-targeted to `20260620100000-100300`. T1 caught one extra migration (`20260515120050_user_view_preference.sql`) also below dev tip — retimestamped together for atomic cleanliness.

### D3 — Selection ring vs focus ring (DayTimelineStrip)

Event marker buttons coupled `ring-ring` to selection state, leaving zero focus indicator when not selected. Decoupled via:
- Selection state → `outline outline-2 outline-ring` (always for highlighted)
- Focus state → `focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2` (always for keyboard focus, unconditional)

Two independent visual indicators. When both fire (highlighted + focused), they coexist visually because `outline` and `ring` are different CSS properties.

### D4 — useRegisterTools empty toolkit shape (T7 type fix)

T3 `help-tools-bridge.tsx` initially passed bare `[]` to `useRegisterTools("help", [])`. TypeScript inferred `never[]`, failing the `ClientToolKit | null` contract. T7 fix: passed canonical empty toolkit `{ definitions: [], implementations: {} }`. Preserves L-0287 thin-shell semantics (no phantom tool registration) while satisfying type contract.

### D5 — ADR-0358 status: proposed (NOT accepted)

Per L-0297 (ADR-to-enforcement-code receipt rule, written this sortie), ADR-0358 (telemetry-registry-requires-emit-wiring) is intentionally `proposed` despite L-NEW-1 hitting 2nd occurrence threshold. Reason: ADR text promises a `scripts/check-telemetry-emit-coverage.ts` enforcement script that is NOT yet shipped. Flipping to `accepted` without the script would be the very anti-pattern L-0297 prohibits. Acceptance gated on enforcement-script PR (follow-up sortie).

### D6 — ADR-0238 status flip: proposed → accepted

ADR-0238 (Botsson surface disambiguation / DomainChatOwnership) flipped to `accepted` 2026-05-17. Rationale: enforcement ADR-0337 shipped 2026-05-16 (`16b000387`). DomainChatOwnership component live in `apps/web/src/app/Botsson/_components/`. Agent-coord Phase 3 R1 trace verified ADR-0238 implementation matches spec end-to-end. Acceptance criteria met.

### D7 — Outsider-renumber convention applied (post-merge resolution)

When `git fetch --unshallow` revealed 5 ADR ID collisions between ui-shell `0347-0351` and payroll-via-dev `0347-0351`, applied run-council SKILL.md Phase 8 Step 0 outsider-renumber convention: payroll merged to development FIRST (88a0c2a94) → keeps original numbers. ui-shell renumbered to `0359-0363`. 24 cross-references swept (HANDOFFs, plans, journeys, code comments, BOTSSON-SYSTEM-MAP, SKILL.md). Same pattern surfaced 3 learning ID collisions (0286/0287/0289) — also outsider-renumbered to 0295/0296/0297.

## Learnings

Written + registered in `docs/learnings/0000-learning-log.md`:

- **L-0295** — 7th L-0147 precedent: component-level ARIA defect class repeats (ProcedureDetailTabs == HMS R1 HmsSubNav). Pattern: run-council SKILL.md visual-surface MANDATORY rule (lines 105-119) catches at Phase 5 review-time, NOT Phase 3 plan-time. Possible amendment: dispatch frontend-designer/code-reviewer at Phase 3, not just Phase 5.
- **L-0296** — Chair self-reversal 4-pattern in single council. Steward Phase 3 systematically missed (a) telemetry-contract pipeline, (b) cross-campaign merge ancestry, (c) component-level ARIA, (d) ADR-to-enforcement-rule wiring. Three chair-protocol amendments queued for `~/.claude/skills/run-council/SKILL.md` Phase 3 hard rules.
- **L-0297** — ADR-to-enforcement-code receipt rule: ADR-0361 (formerly 0349, OKLCH literal ban) accepted with ESLint-rule promise. Implementation never landed. Toothless ADR — same class as L-0176 docstring drift. Hard rule: ADR cannot be marked `accepted` until enforcement-code receipt verified.

Plus latent learning (not yet promoted, observed this sortie):

- **L-adr-id-squatting 6th occurrence** — parallel campaigns squat next-free ADR slots. `git log --all --name-only | grep -E 'docs/decisions/[0-9]{4}-'` reservation check is 30s; reactive renumber + cross-ref sweep is 30-60 min. ADR collision detector (ADR-0360, formerly 0348) needs cross-branch mode.
- **L-NEW-D shallow-clone trap** — fresh worktrees on this dev box can be shallow clones. `git fetch --unshallow` first OR sync-campaign script needs `--unshallow` flag for first-merge after long divergence.

## Trust Gate (per-tool)

| Tool / event | Pre-F1 | Post-F1 |
|---|---|---|
| `shift_marketplace.override` | CONDITIONAL FAIL (migration apply broken) | PASS |
| `shift_swap.override` | CONDITIONAL FAIL (same migration) | PASS |
| `deviation_viewed` event | FAIL (phantom — 0 emit-sites) | PASS (emit wired in DeviationDetailDrawer.tsx:58 with L-0177 fail-fast) |
| `handbook_chapter_opened` event | FAIL (phantom — 0 emit-sites) | PASS (emit wired in ChapterReader.tsx:62) |
| HMS view events × 4 | PASS | PASS (unchanged) |
| shift_swap.{request,respond,cancel} | PASS WITH NOTE (SS-4 transitional) | PASS WITH NOTE (unchanged; SS-5 cleanup deferred) |
| channel_admin.* × 6 | PASS WITH NOTE (skeletons) | PASS WITH NOTE (unchanged) |
| timeline_template.* | PASS | PASS |
| `useRegisterTools("help", [])` | FAIL (TS2345) | PASS (D4 type fix) |

## Commits (9 + 1 sync-campaign on campaign)

| SHA | Subject |
|---|---|
| `ba10f3e57` | fix(migrations): B1 — 4 timestamp collisions + remove IF NOT EXISTS |
| `2d35cc6d5` | feat(help): J3 — Tier 1 polish baseline (error.tsx + _tools) |
| `c912d1a20` | feat(telemetry): B2 — wire phantom emit for deviation-viewed + handbook-chapter-opened |
| `ff2c9a6ea` | fix(hms): J5 — migrate ProcedureDetailTabs hardcoded Norwegian to i18n keys |
| `9cd0984db` | docs(adr): ADR-0358 telemetry-registry-requires-emit-wiring + flip ADR-0238 accepted |
| `ebb44c646` | docs(council): COUNCIL-LOG R1 entry + DASHBOARD refresh |
| `0835fb6ff` | fix(hms): J4 — WCAG 4.1.2 ProcedureDetailTabs + WCAG 2.4.11 DayTimelineStrip × 2 |
| `1f6917c75` | fix(help): T7 — useRegisterTools type annotation |
| `a31dcf629` | docs(ui-shell): mark r1-fixup journey verified |

Concurrent on campaign during F1:
| `5a116c2bf` | chore(ui-shell): sync development into campaign — renumber + union-merge |

## Verification (T7 gate — 12/12 PASS)

1. ✅ web typecheck — 0 `error TS` lines, direct `tsc --noEmit` exit 0
2. ✅ turbo typecheck — 51/52 tasks green; only web SIGTERM 143 (machine timeout, not failure)
3. ✅ migration-lint — exit 0 (Check 1+2+3 all pass)
4. ✅ validate-site-map — exit 0, 53 routes, 76 useRegisterTools sites
5. ✅ `deviation viewed` emit — DeviationDetailDrawer.tsx:58
6. ✅ `handbook chapter_opened` emit — ChapterReader.tsx:62
7. ✅ shadcn Tabs import — ProcedureDetailTabs.tsx:4
8. ✅ Manual ARIA tabs absent — `role="tab` count = 0
9. ✅ focus-visible ring count on DayTimelineStrip — 5 (≥2 required)
10. ✅ ADR statuses — 0358 proposed (intentional per L-0297), 0238 accepted
11. ✅ Learnings 0295-0297 registered in 0000-learning-log.md
12. ✅ Journey status flipped draft → verified

## Known issues / debt

Carried forward (deferred to post-HOP-A follow-up sorties):

- **ADR-0361 ESLint rule implementation** in `packages/eslint-config/next.mjs` (OKLCH literal ban) — toothless ADR, no new violations this campaign but enforcement infrastructure missing. L-0297 mandates landing before ADR-0361 can flip to `accepted`.
- **ADR-0358 enforcement script** — `scripts/check-telemetry-emit-coverage.ts` promised in ADR body, not yet shipped.
- **7 surviving `transition-all`** on HMS components (DepartmentReadiness, TaskCard, OversiktEmployee, MaintenanceProcedureForm) — Nordic Split §10.4 violation.
- **Palette literals** `green-500`, `red-500`, `rose-*` → semantic tokens (`text-success`, `text-destructive`).
- **`LearnFlow.tsx:68-91`** stage buttons need `aria-current` or full tablist pattern (Code-reviewer IMPORTANT).
- **BOTSSON-SYSTEM-MAP §L4 capability count** — map says 30, registry has 35.
- **Parity-scanner gap** for `mutateWithGate({capability:})` shape — Agent-coord LOW.
- **3 hardcoded `duration: 1.2`** in `DayTimelineStrip.tsx:613` + `DayEventList.tsx:126` — half-tokenized, should use `motionTokens`.

## Next steps

1. **F1 close-feature merges to `campaign/ui-shell`** (this handoff). Campaign tip will move from `5a116c2bf` → merge commit at ~`<new-sha>`.
2. **Sync-campaign once more before HOP A** — `origin/development` is currently 3 commits ahead of campaign post-sync.
3. **Tri-campaign scope acceptance** — separate gate. Pontus must explicitly accept that HOP A promotion includes:
   - `campaign/world-best-wfm` (ADR-0340 authority-pipeline V2) — merged via PR #395
   - `campaign/mobile` (22 mobile chat files) — merged via PR #393
   - `campaign/payroll` (Phase 7d-followup + Phase 7e + Phase 7f) — merged via PR #394 + concurrent sync
   - Plus this ui-shell scope.
4. **HOP A** — `op run --env-file=.env.template -- ./infra/scripts/promote-preview.sh` from `~/dev/smartout.ai` on `development`.

## References

- Council artifacts: `docs/council/COUNCIL-LOG.md` § `2026-05-17 PM3 — campaign/ui-shell Shippability R1`
- ADRs proposed/accepted/flipped this sortie: 0238 (accepted), 0358 (proposed)
- ADRs renumbered post-sync: ui-shell 0347→0359, 0348→0360, 0349→0361, 0350→0362, 0351→0363
- Learning logs: L-0295, L-0296, L-0297
- Plan: `docs/plans/PLAN-ui-shell-r1-fixup.md`
- Journey: `docs/journeys/JOURNEY-ui-shell-r1-fixup.md` (status: verified)
- Sibling councils same-day: Tidslinjen R1 AM, HMS R1 PM, HMS R2 PM2
- Memory references: L-0042 (migration retimestamp), L-0066 (default-allow), L-0147 (chair self-reversal, 7th precedent this sortie), L-0176 (docstring drift), L-0177 (fail-fast empty IDs), L-0287 (phantom-contract avoidance), L-NEW-1 (telemetry-contract-without-emit, ADR-grade promoted), L-NEW-C (head-truncated stdout misread)
