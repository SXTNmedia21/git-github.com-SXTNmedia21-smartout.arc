---
title: "TabBar Canonical Layout — 5-Tab Per Design Handoff"
id: ADR-0268
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
---

# ADR-0268: TabBar Canonical Layout

## Context

Three competing tab-layouts exist in the mobile codebase as of 2026-05-04:

| State | Source | Tabs | Count |
|---|---|---|---|
| **Current dev** | `apps/mobile/app/(app)/_layout.tsx` (campaign/mobile HEAD) | Hjem, Digest, Vakter, Min kø, Chat, Min side | 6 |
| **wt-1 plan** | `feat/mobile-mobile-restore-4tab-plan` (per memory entry "Mobile 4-tab plan drift 2026-05-03"; references 2026-03-24 master-plan) | Hjem, Vakter, [FAB], Chat, Meg | 4 + FAB |
| **wt-7 plan (locked)** | `feat/mobile-restore-4tab-plan` | (same 4-tab restore) | 4 + FAB |
| **wt-3 design handoff** | `docs/design/design_handoff_calendar/source/primitives.jsx` (Pontus delivered 2026-05-04) | Kalender, Vakter, ⊕ FAB, Chat, Min Tid | 5 + FAB |

Phase 0 discovery (§2) confirms the current 6-tab state and notes that "Min Tid" is **NEW** in the handoff — not present in either backend or current mobile code.

Memory entry "Mobile 4-tab plan drift" notes Pontus' mental model: "Home er ikke side, Home = anker, FAB = reset" — which matches the 4-tab master-plan. The 2026-05-04 design handoff supersedes that — Pontus has consciously delivered a 5-tab design after that mental model was articulated.

Wt-1 (`feat/mobile-mobile-restore-4tab-plan`) and wt-3 (`feat/mobile-calendar-redesign`) both plan to write `apps/mobile/app/(app)/_layout.tsx`. Direct file conflict if both land.

## Decision Drivers

- Pontus' most recent design action (2026-05-04 handoff) supersedes earlier mental models.
- Calendar tab is **structurally required** by the calendar-redesign plan — without a Kalender tab, the new calendar route group has no entry point.
- "Min Tid" is a placeholder in the handoff — Phase 0 §2 noted it requires verification ("Confirm with steward: does 'Min Tid' exist in backend or is it placeholder?"). Steward verdict: Min Tid is a NEW tab, content TBD, can ship as stub initially.
- ADR-0133 — mobile is execution surface. Tabs should map to execute verbs (Kalender = D6 read, Vakter = D6 read+execute, FAB = AddSheet entry, Chat = communication, Min Tid = personal time/balance).
- Removing Hjem (current home redirect-stub) is consistent with Pontus' "Home = anker, not side" framing — Kalender becomes the daily anchor.
- Removing Digest is consistent with reducing tab count + avoiding redundant overview surfaces.
- (komm) tab — currently routed via `LifeBuoy` icon, used as a helpdesk surface — is being absorbed elsewhere per memory and ADR-0163 helpdesk hub work; safe to remove from tabs.

## Considered Options

1. **Adopt 5-tab handoff (Kalender, Vakter, FAB, Chat, Min Tid).** Chosen. Matches latest design action.
2. **Adopt 4-tab restore (Hjem, Vakter, FAB, Chat, Meg).** Rejected — predates the 2026-05-04 design handoff; "Hjem" framing was Pontus' earlier mental model.
3. **Hybrid: 4-tab with Kalender replacing Hjem (Kalender, Vakter, FAB, Chat, Meg).** Considered. Defers "Min Tid" entirely. Rejected for V1 — handoff explicitly delivers 5 tabs; "Min Tid" is in scope as stub. May fall back to this if Min Tid stub is too painful.
4. **Keep 6-tab status quo.** Rejected — tab-bar is overcrowded; current Hjem is a redirect-stub; Digest and Min kø are unused per memory.

## Decision Outcome

**Chosen: Option 1 — 5-tab layout per 2026-05-04 design handoff.**

### Canonical 5-tab order

| Position | Label | Icon (Lucide-RN) | Route | Notes |
|---|---|---|---|---|
| 1 | Kalender | `Calendar` | `(calendar)` | NEW route group (Phase 3c). WeekScreen default. |
| 2 | Vakter | `Users` | `(shifts)` | EXISTING route, vaktliste redesigned (Phase 3d). |
| 3 (center) | ⊕ FAB | `Plus` (orange) + Smartout flame mark | trigger AddSheet | Not a tab; opens AddSheet. |
| 4 | Chat | `MessageCircle` | `(chat)` | EXISTING route. |
| 5 | Min Tid | `Clock3` | `(me)` (renamed from "Min side") | EXISTING route, label change. Content TBD; ship as-is for V1. |

### Tab removal sequence

| Removed | Strategy |
|---|---|
| Hjem (`(home)`) | Current `(home)/index.tsx` is a redirect-stub to `shift-hub.tsx`. Delete the route group; redirect logic absorbed by Kalender as default tab. Logic in `shift-hub.tsx` (the original Home) merges into Kalender DayView OR becomes a Vakter sub-screen. Phase 3f will decide concrete merge. |
| Digest (`digest`) | Delete route + tab entry. No replacement. |
| Min kø (`(komm)`) | Delete tab entry. Helpdesk thread logic absorbed into Chat per ADR-0163 (kanaler-som-helpdesk). Verify thread continuity before delete. |

### "Min Tid" V1 scope

For Phase 3f ship: "Min Tid" reuses existing `(me)` route — relabel only. No new content. Future sortie defines actual time-tracking surface. Acceptable per L-0044 — do NOT ship empty placeholder ports of web `/dashboard/me`.

If "Min Tid" is too thin for V1, fallback to Option 3 (drop Min Tid, ship 4 + FAB with Kalender / Vakter / Chat / Meg). Decision deferred to Phase 3f review.

### wt-1 / wt-7 coordination

| Branch | Status | Action |
|---|---|---|
| `feat/mobile-mobile-restore-4tab-plan` (wt-1) | Active, HEAD `234c795ae` | **Cancel or rebase to 5-tab.** Coordinator informs wt-1 owner. If wt-1 has additional work beyond `_layout.tsx` (e.g., bug-fixes), cherry-pick those, abandon the 4-tab `_layout.tsx` change. |
| `feat/mobile-restore-4tab-plan` (wt-7, locked) | Locked | No active work. Branch will be deleted after this ADR is `accepted`. |

**Merge order:** ADR-0268 must be `accepted` BEFORE Phase 3f (wt-3 TabBar redesign) ships. wt-1 must be resolved (cancelled or rebased) BEFORE wt-3 lands its `_layout.tsx` change.

## Rules

### R1. Tabs map to ADR-0133 verb classes

- Author/Compose/Plan tabs are FORBIDDEN on mobile (per ADR-0133 R2).
- Calendar/Vakter = read + execute (D6).
- FAB = AddSheet entry (deviation/note witness verbs in scope; shift authoring out of scope per plan).
- Chat = communication.
- Min Tid = personal D6 view (own clock-in/-out, breaks).

### R2. Tab count is policy, not preference

5 tabs is the canonical V1 count. Future tab additions require an ADR amendment to ADR-0268, not silent expansion. The 6-tab drift documented in memory ("Mobile 4-tab plan drift 2026-05-03") demonstrates how silent additions accumulate.

### R3. FAB is not a tab

The center ⊕ button is an AddSheet trigger, not a navigable route. It does NOT participate in active-tab styling.

### R4. Active-state styling per handoff

Orange icon + label + 4 px orange dot below — already matches current (Phase 0 §2 confirmed).

### R5. Tab labels are i18n keys

No hardcoded Norwegian. `Kalender`, `Vakter`, `Chat`, `Min Tid` flow through `packages/i18n/`. Phase 3f writes the keys.

## Consequences

### Positive

- Resolves wt-1 vs wt-3 conflict — single canonical layout.
- Provides Calendar tab entry point required by Phase 3c-3e.
- Reduces tab-bar from 6 → 5 — improves thumb reach + visual clarity (Phase 0 §2).
- Honors Pontus' 2026-05-04 design action.

### Negative / Debt

- wt-1 work is wholly or partially cancelled — coordinator must inform wt-1 owner.
- "Min Tid" V1 ships as a thin relabel of `(me)`. Future sortie required to make it meaningful (otherwise reverts to L-0044 graveyard pattern).
- Hjem-merge logic (current `(home)/shift-hub.tsx` content) needs absorbed into Kalender or Vakter — Phase 3f detail.
- (komm) helpdesk threads must continue working post-removal — verify ADR-0163 hub absorption is functional before Phase 3f merges.

## Cross-references

- **ADR-0133** — web composes, mobile executes (verb classification of tabs)
- **ADR-0163** — kanaler-som-helpdesk (komm tab absorption path)
- **L-0044** — mobile-parity-graveyards (don't ship empty ports — applies to "Min Tid")
- **2026-05-04 design handoff** — `docs/design/design_handoff_calendar/source/primitives.jsx` (TabBar block)
- **Memory entry** — "Mobile 4-tab plan drift (2026-05-03)" (prior tab-count history)
- **Phase 0 discovery §2** — current 6-tab state + handoff mapping
- **PLAN-calendar-redesign.md** §Phase 3f — TabBar redesign

## Status

`proposed` — accepts on Phase 3f implementation merge. wt-1 owner coordination required BEFORE accept.

### Accept checklist

1. wt-1 (`feat/mobile-mobile-restore-4tab-plan`) cancelled OR rebased to 5-tab.
2. wt-7 locked branch deleted.
3. Phase 3f delivers `apps/mobile/app/(app)/_layout.tsx` with 5-tab order per R1-R4.
4. (komm) helpdesk thread continuity verified after tab removal.
5. i18n keys registered for `Kalender`, `Vakter`, `Min Tid` labels.
