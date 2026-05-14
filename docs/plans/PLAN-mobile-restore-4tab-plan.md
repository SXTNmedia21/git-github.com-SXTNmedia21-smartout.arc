---
title: "PLAN — Mobile Restore 4-Tab Plan (revert drift)"
status: draft
created: 2026-05-14
updated: 2026-05-14
module: mobile
tags: [sortie, mobile, navigation, revert, drift-fix]
---

# PLAN — Mobile Restore 4-Tab Plan

## Scope

Mobile dev currently runs 6 tabs (Hjem stub + Vakter + Min tid + digest + komm + Meg). Master-plan from 2026-03-24 (per memory `project_mobile_4tab_drift_2026_05_03`) and Pontus's mental model both specify 4 tabs + AI FAB:

```
Hjem (anchor) | Vakter | [FAB Botsson] | Chat | Meg
```

Plus the FAB acts as reset/launch surface. Delete digest + komm. Restore Hjem as anchor (not stub-redirect). Optionally rename "Meg" → "Min tid" per memory note.

## Deliverables (in order)

1. **ADR-0315** — Mobile 4-tab restore (revert-to-plan). Cites 2026-03-24 master-plan + memory project entry. Documents which tabs delete and why, what restores. No new architecture; purely revert drift.
2. **Branch + tab-router edits** — `apps/mobile/src/app/(home)/_layout.tsx` (or wherever tab navigator lives). Delete digest + komm tab files entirely. Restore `(home)/index.tsx` as Home content (currently redirect-stub to shift-hub.tsx).
3. **FAB component verification** — confirm Botsson FAB renders on every tab and acts as reset. If broken/missing, restore per master-plan §FAB.
4. **Audit deleted code for cross-dependencies** — digest + komm tabs may be imported by helpdesk or daily-ops campaigns. Run `grep -r "digest\|komm" apps/mobile/src/` before deleting. If imports exist outside the deleted files, route them to new locations.
5. **JOURNEY** — employee opens app, sees 4 tabs + FAB; navigates each tab; FAB launches Botsson; back-press behavior.
6. **HANDOFF** at close.

## Skills (must be loaded)

- `smartout-database-guide` — only if DB queries change (unlikely)
- React Native + Expo patterns

## Plan reference

Per memory: 2026-03-24 master-plan §Architecture: "4 tabs + AI FAB". Drift across 3 iterations (`8b30e4226`, `955785917`, `5a1b6d1d8`) patched symptoms (rename, restructure) without restoring plan.

## Out of scope

- New mobile features
- Changing Hjem anchor semantics beyond restoring it as a real screen (not redirect)
- Touching helpdesk or daily-ops mobile surfaces unless they cross-import deleted tabs

## Risks

- Deleted tabs may be referenced by helpdesk-mobile or daily-ops-mobile campaigns. Pre-delete grep mandatory.
- Hjem currently redirects to shift-hub — restoring it as own screen requires moving shift-hub content elsewhere or splitting.
- Expo Router config sensitive — verify tab routes match `_layout.tsx` array order or breakage on bottom-tab assignment.

## Council escalation trigger

If pre-delete grep surfaces cross-campaign imports requiring coordinated changes (mobile-campaign + helpdesk + daily-ops), escalate before deleting.

## Worktree

`~/dev/smartout.ai-wt-12` on branch `feat/mobile-restore-4tab-plan` based on `development`.
