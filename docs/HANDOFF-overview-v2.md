---
title: "Handoff — overview-v2 (WebDayControl replaces OversiktView)"
feature: overview-v2
branch: feat/overview-v2
closed: 2026-04-20
module: dashboard
status: done
updated: 2026-04-20
created: 2026-04-19
tags: [handoff, day-control, overview, nordic-split]
---

# Handoff — overview-v2

## Summary

Replaced `apps/web/src/components/dashboard/OversiktView.tsx` (1070 LOC mock executive summary) with `WebDayControl` — a session-centric 7-tab admin panel driven by `department_session`. 10 canonical widgets extracted to `packages/ui/src/day-control/` ready for mobile reuse. All council conditions from 4 gates + post-impl R1 + debt ticket review satisfied. All 8 tracked debt items from the post-impl council landed in the same branch.

## What Was Done

### Feature series (WebDayControl ships)
- [x] PR 1 — Nordic Split dark-mode tokens for dept/status/priority (`ac0c6be8`, `93612d44`)
- [x] PR 2 — Scaffold WebDayControl shell + 10 widgets + 7 tab stubs + Overview tab live (`ef56b144`, `002ce328`)
- [x] PR 3 — 6 tabs live + 3 Server Actions (signoff, task toggle, broadcast) + engine_memory pin (`40b1ebd7`, `bd086820`)
- [x] PR 4 — Motion springs + dark-mode gradient fix + ambient orb + delete OversiktView + feature-flag removal (`40d8734d`)
- [x] Post-impl R1 — RLS service-role fix, event-name alignment (session_task.completed), entity refs on emit, derivePhase + recon wiring, resolveDeptKey fallback (`07f73cfc`)

### Debt ticket series (council 2026-04-19)
- [x] T6 — HANDOFF min_role correction + docs audit (zero remaining stale claims) (`630ccbaf`)
- [x] T7 — RosterTab deptKey hardcode replaced with resolveDeptKey shared helper (`1d3d53d5`)
- [x] T8 — Delete pin-day-control-context client wrapper (direct Server Action call) (`1d3d53d5`)
- [x] T5 — Converge SessionSignoffDrawer → signoffSessionAction (`e59e59ae`)
- [x] T3 — Wire hasMinimumRole callers through gate_action() + seed engine_authority_config (`9d8b1c23`)
- [x] T4a — Extract day-control widgets to packages/ui/src/day-control/ (`881cb254`)
- [x] T4b — ADR-0158 packages/ui dual-platform strategy (`7117ab93`)
- [x] T1 — Migrate 10 capability engine_event bypass sites to emit() registry across 3 sub-PRs: communication (`84f3f416`), operations-intelligence (`be3511ac`), operations (`9fa0195d`)
- [x] T2 — DROPPED (grep confirmed zero orphans after event-name rename)

## Decisions Made

| Decision | Reason | Impact |
|----------|--------|--------|
| ADR-0156: WebDayControl replaces OversiktView as canonical D6 admin surface | Executive summary paradigm was wrong for a shift-based business; D6 session model is canonical | New admin surface anchored on `department_session`. Widget staging rule enables mobile extraction. |
| ADR-0157: Server Actions scope — amendment to ADR-0114 | Steward-Supervisor semantic conflict on ADR-0114 scope required explicit grandfather rule | New mutations → Server Actions. Existing TanStack mutations grandfathered until scheduled migration. |
| ADR-0158: packages/ui dual-platform strategy | T4a extracted widgets; mobile consumption needs a strategy decision before implementation | `.web.tsx` + `.native.tsx` platform extensions + shared TS logic primitives. Rejects NativeWind + full-split. |
| L-0064: Phase enum UI-vs-DB drift | UI needed 6 phases; DB enum has 5 (`locked` missing) | Named `derivePhase(session, recon)` helper; widgets consume `UiPhase` only; never persist derived state. |
| L-0065: Fact-check must grep columns across ALL migrations, not just CREATE TABLE | Phase 2.5 missed `engine_authority_config.min_role` because it only grepped the CREATE TABLE migration | Three-pass verify rule: CREATE TABLE + grep column across all migrations + check database.types.ts. |
| Keep `komm` channel for broadcasts, not new table | Council decided broadcast type encoded in `channel_message.system_data.broadcast_type` JSONB | Zero new tables. Audit trail via komm + system_data provenance (incl. `session_id`). |
| Widgets at `apps/web` Phase 1 → `packages/ui` Phase 2 | Designer's staging accepted with portability discipline | ESLint rule enforces no `next/*`, no Supabase in widget files. Phase 2 extracted 2026-04-19 (T4a). |
| Drop T2 (grep sweep for old event name) | Fact-check confirmed zero orphans after registry rename | Saved ~30 min of pointless work. |
| T3 rewrite — schema exists, only caller migration needed | Council caught the L-0065 case — `min_role` column was added 3 weeks earlier | Prevented spurious schema-migration work. Ticket became code-only refactor. |

## Learnings

| Learning | Context |
|----------|---------|
| L-0064 Phase enum drift (accepted) | Any cascade surface rendering richer UI state than DB enum supports needs named derivation helper. Applies beyond day-control. |
| L-0065 Fact-check grep discipline (accepted) | Single-migration greps miss ALTER additions. Three-pass verify rule now enforced in council Phase 2.5. |
| Post-impl review catches what per-file review misses | Gate 4 cleared the feature for merge; post-impl R1 then caught 6 blockers (event-name mismatch, RLS bypass, missing entity refs, uncatched hardcode). Per-file review ≠ payload trace. Aligns with prior councils (L-0023, L-0036, L-0051). |
| Council Phase 2.5 can propagate stale assumptions | Initial post-impl R1 fact-check claimed `min_role` didn't exist; the follow-up debt-ticket council caught it via different reviewer angles. Three-reviewer synthesis surfaces inconsistencies between briefing and code. |
| Capability tool bypasses engine_event registry are contagious | 10 sites across 8 capability files all followed the same direct-insert pattern. Once one was fixed, the pattern was visible everywhere. Telemetry registry should be the only write path. |

## Known Issues / Debt

### None blocking merge

All 8 debt items identified by the council landed in this branch. Follow-up items tracked below are not blocking.

### Minor follow-ups (optional)

1. **`hasMinimumRole` inline check** — Server Actions currently run BOTH `hasMinimumRole` (inline) AND `gate_action()` (RPC) as belt-and-braces. Once the `20260515110000_seed_day_control_authority.sql` migration is verified in all production workspaces, `hasMinimumRole` can be removed. Not blocking; safety-preserving redundancy.
2. **`channel_message sent` vs `channel.message.sent`** — T1/PR1 reuses the existing dotted event name `channel.message.sent`. Naming pattern differs from the council's Agent Coord taxonomy suggestion (which would have been `channel_message sent` → `channel_message.sent`). Deliberate: avoids registering a duplicate type. Both forms work; doc it if the convention tightens.
3. **Mobile widget adoption** — ADR-0158 established the dual-platform strategy. First `.native.tsx` sibling for any widget remains to be written when mobile needs a D6 execution surface that reuses the web shape.
4. **Duplicate-emit audit for T1 events** — ADR-0156 Trust Gate condition noted that `channel.message.sent` + `day_brief.compiled` + `preclose_summary.compiled` should be grep-verified for multiple writers before shipping. T1/PR1 assumed same-name emit = unified audit (not duplicate row). If production activity_trail shows 2× rows for the same click, reconcile by making UI writers the sole source and capability tools no-op or conversely.
5. **ADR-0156 §Trust Gate 2 — removing inline `hasMinimumRole`** — gated on production verification of the authority seeds in migration `20260515110000`. Follow-up PR once confirmed.

## Next Steps

1. **Merge to development** — run `close-feature.sh 1` from main repo.
2. **ADR-0158 PoC** — when mobile picks up the first D6 execution widget, prototype `PhaseBadge.native.tsx` as the first platform-extension validation.
3. **Duplicate-emit audit (item #4)** — after a production sample of activity_trail rows, verify no duplicate rows from T1 sites.
4. **Remove inline `hasMinimumRole`** (item #5) — once authority seeds are confirmed in prod.

## Commit roll-up (chronological)

```
1dc7d323 docs(council): web-day-control spec + ADRs + learning
217aa118 docs(spec): web-day-control self-review fixes
ac0c6be8 feat(design-tokens): dark-mode variants for dept/status/priority
93612d44 fix(design-tokens): Gate 1 tweaks — dept-kitchen chroma + warm-neutral
ef56b144 feat(dashboard): scaffold WebDayControl + overview tab live (ADR-0156)
002ce328 fix(day-control): Gate 2 fixes — ARIA + motion + ESLint hardening
40b1ebd7 feat(dashboard): WebDayControl PR 3 — 6 tabs live + 3 Server Actions
bd086820 fix(day-control): Gate 3 fixes — error toasts + broadcast sessionId + emit unify
40d8734d feat(dashboard): WebDayControl PR 4 — polish + delete OversiktView
07f73cfc fix(day-control): post-impl R1 blockers — event name + RLS + entity ref + recon + dept key
630ccbaf docs(council): debt-ticket review session + L-0065 + HANDOFF correction
3afc2bd1 docs(followups): WebDayControl debt tickets for Linear paste
1d3d53d5 chore(day-control): T7 + T8 cleanup — roster deptKey + wrapper delete
e59e59ae refactor(hms): T5 — migrate SessionSignoffDrawer to signoffSessionAction
9d8b1c23 refactor(engine): T3 — wire hasMinimumRole callers through gate_action()
881cb254 refactor(ui): T4a — extract day-control widgets to packages/ui/src/day-control
7117ab93 docs(adr): T4b — ADR-0158 packages/ui dual-platform consumption strategy
84f3f416 refactor(ai): T1/PR1 — communication capability engine_event bypass migration
be3511ac refactor(ai): T1/PR2 — operations-intelligence engine_event bypass migration
9fa0195d refactor(ai): T1/PR3 — operations deviation.reported engine_event bypass
```

## Verification (evidence)

- [x] `pnpm turbo typecheck` — 33/33 packages pass, FULL TURBO
- [x] Decision log updated (ADRs 0156, 0157 accepted; 0158 proposed)
- [x] Learning log updated (L-0064, L-0065)
- [x] Council log — 3 entries: initial spec, post-impl R1, debt ticket review
- [x] User journeys — `docs/journeys/JOURNEY-overview-v2.md` (160 lines, 8 journeys)
- [x] Feature flag `NEXT_PUBLIC_DAY_CONTROL_V2` removed, only tombstone comment remains
- [x] `OversiktView.tsx` deleted
- [x] Zero `engine_event.insert` bypass sites across capabilities (grep verified)
- [x] All 8 debt tickets landed in branch (commits above)
- [x] 3 council gates + post-impl R1 + debt ticket review cleared
