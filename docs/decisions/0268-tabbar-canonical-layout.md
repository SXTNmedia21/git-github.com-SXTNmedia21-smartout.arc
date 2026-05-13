---
title: "TabBar Canonical Layout — 5-Tab Per Design Handoff"
id: ADR-0268
status: accepted
layer: decision
created: 2026-05-04
updated: 2026-05-14
accepted: 2026-05-14
amended:
  - date: 2026-05-14
    reason: "Council verdict 2026-05-14 — corrected cross-references (ADR-0163 → ADR-0161/0162) and clarified that (komm) route group is retained as deep-link/detail surface, not deleted. Code state verified per audit + 4-reviewer Council."
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
- (komm) tab — currently routed via `LifeBuoy` icon, used as a helpdesk surface — list logic is being absorbed into the Chat tab as a "Skranke" segment per ADR-0161 (helpdesk ontology = `engine_state`) + ADR-0162 (helpdesk capability placement). The `(komm)` route group is **retained as the deep-link target + ticket-detail screen**; only the tab-bar entry is removed.

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
| Min kø (`(komm)`) | Tab entry removed; route group **retained** as deep-link target + ticket-detail screen. List logic surfaced inside Chat tab as "Skranke" / "Chatkanaler" segments per ADR-0161 (helpdesk ontology) + ADR-0162 (capability placement). Verified 2026-05-14: `packages/notifications/src/deep-links.ts:53` still resolves; `apps/mobile/app/(app)/(chat)/index.tsx:57,476,553-554` consume `QueueRow` and navigate to `(komm)/[channelId]`. `(komm)/[channelId].tsx` reads from `engine_state` per ADR-0161. |

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
- **ADR-0161** — Helpdesk ontology: ticket = `engine_state` Alt D (`(komm)` route retained as ticket-detail surface; Chat tab "Skranke" segment is the new list surface)
- **ADR-0162** — Helpdesk capability placement (new isolated capability; not an extension of communication)
- **ADR-0163** — ADR-0078 amendment: PII `allowedChannels` mandatory (orthogonal — channel-restriction for capabilities, not UX layout. Helpdesk thread PII fence enforced at Layer 2 via `packages/ai/src/capabilities/helpdesk_query/index.ts:29`)
- **L-0044** — mobile-parity-graveyards (don't ship empty ports — applies to "Min Tid")
- **2026-05-04 design handoff** — `docs/design/design_handoff_calendar/source/primitives.jsx` (TabBar block)
- **Memory entry** — "Mobile 4-tab plan drift (2026-05-03)" — SUPERSEDED by this ADR; see `project_mobile_4tab_drift_2026_05_03.md` for the supersession note
- **Phase 0 discovery §2** — current 6-tab state + handoff mapping
- **PLAN-calendar-redesign.md** §Phase 3f — TabBar redesign
- **Council 2026-05-14** — accept verdict (GO WITH CHANGES): cross-reference corrections + (komm) retention clarification. 4 reviewers (steward, supervisor, agent-coordinator code-tracer, botsson-harness-builder).

## Status

**`accepted` 2026-05-14** — all five checklist items verified by Council 2026-05-14 (4 reviewers).

### Accept checklist — final state

1. **DONE** — wt-1 (`feat/mobile-mobile-restore-4tab-plan`) deleted; wt-1 now carries `feat/sma-328-aml-14-15-trekk-consent` (unrelated). Verified by haiku Explore audit 2026-05-13.
2. **DONE** — wt-7 locked branch `feat/mobile-restore-4tab-plan` renamed to `feat/mobile-adr-0268-audit` 2026-05-14 (rename achieves the same isolation as deletion; this sortie owns the rename).
3. **DONE** — `apps/mobile/app/(app)/_layout.tsx` lines 93-109 register 5-tab order per R1-R4; file header lines 1-13 cite this ADR as canonical source.
4. **DONE** — `(komm)` route group retained as deep-link target + ticket-detail screen; list logic absorbed into Chat tab "Skranke" segment. Push deeplink `komm_message` resolves to `(komm)/[channelId]` per `packages/notifications/src/deep-links.ts:53`. Chat tab routes queue taps to same target per `apps/mobile/app/(app)/(chat)/index.tsx:553-554`. Ticket detail reads from `engine_state` per ADR-0161 via `apps/mobile/src/hooks/queries/use-ticket.ts:35-106`. ADR-0163 PII Layer 2 fence verified at `packages/ai/src/capabilities/helpdesk_query/index.ts:29`.
5. **DONE** — i18n keys `tabs.kalender`, `tabs.vakter`, `tabs.chat`, `tabs.minTid` registered in `apps/mobile/src/constants/strings.ts` with canonical labels (Kalender / Vakter / Chat / Min Tid). Verified by sonnet audit 2026-05-14.
