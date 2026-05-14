---
title: "Mobile 4-Tab Plan Supersession — feat/mobile-restore-4tab-plan Resolution"
id: ADR-0318
status: accepted
layer: decision
created: 2026-05-14
updated: 2026-05-14
accepted: 2026-05-14
module: mobile
tags: [mobile, tab-navigation, navigation, adr-0268, supersession]
---

# ADR-0318: Mobile 4-Tab Plan Supersession

## Context

Branch `feat/mobile-restore-4tab-plan` (wt-7, later wt-15) was created to execute the
2026-03-24 master-plan restoring 4 tabs + FAB:

```
Hjem (anchor) | Vakter | [FAB Botsson] | Chat | Meg
```

Per memory entry `project_mobile_4tab_drift_2026_05_03`: mobile had drifted to 6 tabs
(Hjem stub + Vakter + (komm) + digest + Min tid + Meg). Three prior iterations
(`8b30e4226`, `955785917`, `5a1b6d1d8`) patched symptoms without restoring the plan.

## What Actually Happened Before This Sortie Ran

ADR-0268 (TabBar Canonical Layout) was drafted 2026-05-04 and accepted 2026-05-14 by
4-reviewer Council. It superseded the 4-tab master-plan with a **5-tab layout** based
on Pontus' 2026-05-04 design handoff:

| Position | Label | Route |
|---|---|---|
| 1 | Kalender | `(calendar)` |
| 2 | Vakter | `(shifts)` |
| 3 (center) | ⊕ FAB | AddSheet trigger |
| 4 | Chat | `(chat)` |
| 5 | Min Tid | `(me)` |

By the time `feat/mobile-restore-4tab-plan` was dispatched (wt-15), the development branch
already embodied ADR-0268 — the branch had **zero unique commits** vs `development`.

The 6-tab drift was eliminated; the intent of the 4-tab restore plan was satisfied
(reduce overcount, establish calendar as anchor, FAB as reset). The original "Hjem"
framing was deliberately replaced by "Kalender" per ADR-0268 §Decision Drivers.

## Code Verification (2026-05-14)

Verified at sortie start:

- `apps/mobile/app/(app)/_layout.tsx` lines 93–109 — 5-tab layout registered; `digest`,
  `(komm)`, `(home)`, `(queue)`, `journey` all `href: null` or in `hiddenTabs` set
- `apps/mobile/src/components/navigation/TabBar.tsx` lines 26–37 — `TAB_ICONS` + `TAB_LABELS`
  contain exactly 4 navigable routes; `hiddenTabs` set enforces runtime exclusion of legacy folders
- `apps/mobile/src/components/navigation/AIFab.tsx` — FAB component live; renders on every
  tab via `renderTabBar` callback in `_layout.tsx`; tap → Kalender (daily anchor per ADR-0268)
- `apps/mobile/app/(app)/digest.tsx` — file exists but tab is hidden; no cross-imports outside
  own hook (`use-digest-feed.ts`). Safe to delete.
- `apps/mobile/src/hooks/queries/use-digest-feed.ts` — only consumer is `digest.tsx`. Orphaned.
- `(komm)` route group — RETAINED per ADR-0268 §"Tab removal sequence". Used as deep-link
  target + ticket-detail screen from Chat tab "Skranke" segment.

## Decision

Accept that ADR-0268 has already resolved the 4-tab restore intent. This sortie's work
is:

1. **Delete `apps/mobile/app/(app)/digest.tsx`** — tab hidden, file orphaned, 0 cross-imports.
2. **Delete `apps/mobile/src/hooks/queries/use-digest-feed.ts`** — sole consumer is `digest.tsx`.
3. **No other changes** — `(komm)` folder retained per ADR-0268; `(home)` folder deletion is
   Phase 3f.4 scope (25 inbound importer retargets required first per L-0250).
4. Write closure documentation (journey + handoff) confirming supersession.

## Options Considered

1. **Execute original 4-tab plan (delete digest, delete komm tab, restore Hjem as anchor).**
   Rejected — directly conflicts with ADR-0268 (accepted). Kalender supersedes Hjem as anchor.
   (komm) route group MUST be retained as deep-link surface.

2. **Delete all legacy folders (home, digest, komm) in this sortie.**
   Rejected — `(home)` folder has 25 inbound importer sites requiring retarget before delete
   (L-0250). `(komm)` is intentionally retained per ADR-0268. Premature deletion = 404 storm.

3. **Treat this sortie as a documentation-only closure with no file deletions.**
   Considered. Rejected in favor of option 4 — `digest.tsx` + `use-digest-feed.ts` are truly
   orphaned and clutter the route tree. Safe to delete now.

4. **Delete only the truly orphaned files (digest.tsx + use-digest-feed.ts) + write docs.**
   Chosen. Minimally invasive. Confirms the resolution trajectory established by ADR-0268.

## Consequences

### Positive

- Removes `digest.tsx` and `use-digest-feed.ts` — orphaned code; no consumers outside each other
- Closes the `feat/mobile-restore-4tab-plan` sortie cleanly with accurate documentation
- Confirms ADR-0268 as the single canonical source for tab-bar layout decisions
- `(home)`, `(komm)`, `(queue)` folder cleanup deferred to correct sorties (3f.2/3f.3/3f.4) with proper retarget-first ordering per L-0250

### Negative / Debt

- `(home)` folder is still present with 19 sub-screens; cleanup pending 3f.2/3f.3/3f.4
- `(komm)` folder is retained but its tab entry is permanently removed; future contributors
  may not understand why the folder exists without ADR-0268 + ADR-0161
- `(queue)` dead route flagged in prior HANDOFF — still pending dedicated cleanup sortie

## Cross-references

- **ADR-0268** — TabBar Canonical Layout (supersedes original 4-tab master-plan). Accepted 2026-05-14.
- **ADR-0161** — Helpdesk ontology: `(komm)` route retained as ticket-detail surface
- **ADR-0133** — Mobile execution-surface boundary (Kalender/Vakter = D6 read+execute)
- **L-0250** — Route-group absorption requires inbound-importer audit before any folder delete
- **L-0251** — Component-folder aligns with route-folder during route moves
- **HANDOFF-mobile-phase-3f-home-absorption.md** — Phase 3f.1 ships; 3f.2/3f.3/3f.4 roadmap
- **Memory entry** — `project_mobile_4tab_drift_2026_05_03.md` — SUPERSEDED by ADR-0268
- **2026-03-24 master-plan** — original 4-tab restore intent (superseded by ADR-0268)

## Status

`accepted` 2026-05-14 — author decision; no council required (no new architectural change;
purely documents supersession by ADR-0268 + authorizes orphaned file deletions).
