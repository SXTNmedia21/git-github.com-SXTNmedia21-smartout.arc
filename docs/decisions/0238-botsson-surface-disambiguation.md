---
title: "Botsson Surface Disambiguation on Pages with Embedded Chat"
id: ADR_0238
status: accepted
accepted_date: 2026-05-17
layer: decision
created: 2026-04-29
updated: 2026-05-17
---

# ADR-0238: Botsson Surface Disambiguation on Pages with Embedded Chat

> **Status flipped proposed → accepted 2026-05-17.** Reason: enforcement shipped via ADR-0337 (`DomainChatOwnership` component mandate) + implementation verified by ui-shell R1 council Agent-coord trace (2026-05-16 commit `16b000387` — `DomainChatOwnership` component live in `apps/web/src/app/Botsson/_components/`, wired in `dashboard/komm/chat` + `dashboard/komm/thread/[id]` + `dashboard/shift-clock`). Enforcement requirement met per L-0277 (ADR-declared-pattern-component-never-built closed). Sub-sortie feat/ui-shell-r1-fixup, verified by system-agent-coordinator Phase 3.

## Context and Problem Statement

Council R1 (2026-04-29) Phase 3 frontend designer flagged HIGH-severity UX defect on `/platform-admin/journeys/wizard/[sessionId]`: the page now hosts TWO chat surfaces simultaneously — the in-page wizard textbox (Card-bubble thread + sidebar draft preview, posts to `/api/botsson/chat` with `mission=journey_authoring`) AND the BotssonShell Orb (bottom-right fixed, mounted via `BotssonProvider` in platform-admin/layout.tsx, opens a separate chat surface for general godmode interactions).

Both surfaces look like "talk to AI." Neither labels which is which. A user typing a journey-authoring message into the Orb expecting it to advance the wizard hits a different code path — the Orb posts to its own session, Botsson responds with a general answer, the wizard session receives nothing, the wizard phase does not advance. Silent failure. No error, no redirect, no signal.

Same risk applies to any future page that mounts a domain-specific chat surface alongside the global Orb.

## Decision Drivers

- Silent-failure UX is shipping-blocker class (Frontend P0)
- Disambiguation must be **visible** to first-time users — affordances cannot rely on tooltips or post-hoc training
- Two acceptable solution shapes: suppress one surface, or differentiate both surfaces with visible labels + distinct interaction patterns
- Pattern needs to generalize — wizard is the first page-with-embedded-chat, more will follow (helpdesk-preview, communications/compose templates, future authoring flows)

## Considered Options

1. **Suppress Orb when domain chat is mounted** — when a page declares it owns its own chat surface, BotssonShell renders in a passive "watching this page" state (icon-only, not chat-enterable) or is hidden entirely. Page declares ownership via context flag from BotssonProvider.
2. **Visually distinguish + label** — both surfaces stay interactive. Wizard textbox carries explicit "Journey Wizard" label and distinct surface tokens. Orb carries "Botsson / General" label when expanded. Differentiation through copy + tokens.
3. **Single-surface mode** — the page does not mount its own chat at all; the wizard is driven entirely through the Orb with mission-routing handled via prime context. Eliminates dual-surface by eliminating the in-page textbox.
4. **Status quo** — no change, accept silent failure UX. Rejected.

## Decision Outcome

Chosen option: **"Option 1 — Suppress Orb when domain chat is mounted"**, because:
- First-time user never sees two competing surfaces
- No copy-engineering or token-engineering required — UX is structural
- Generalizes cleanly: any future page that owns its chat declares ownership, Orb suppresses
- Orb stays available on every other platform-admin route (governance, billing, contracts, users etc.) where there is no domain chat

Implementation pattern:
- `BotssonProvider` exposes a `useDomainChatOwnership()` hook + `<DomainChatOwnership>` component
- Pages mount `<DomainChatOwnership reason="journey-wizard" />` in their tree
- `BotssonShell` reads the flag and renders in passive mode (icon-only, "Botsson is watching this page" tooltip) when ownership is claimed
- Optional: passive Orb still allows voice activation via long-press for emergency exits (not required Phase 1)

Phase 1 scope: wizard page only. Helpdesk-preview + communications/compose follow in subsequent ADRs once their chat patterns stabilize.

## Rules & Consequences

- **Good, because** silent-failure UX class eliminated for current + future pages
- **Good, because** no per-page copy work — disambiguation is a single declaration
- **Good, because** Orb stays present (visual continuity) without being interactive on owned pages — user always knows Botsson exists
- **Bad, because** introduces a new context flag that must be honored everywhere BotssonShell renders
- **Bad, because** users on owned pages cannot ask Orb general questions while authoring — must navigate away. Acceptable trade — alternatives create silent misroute.
- **Agent Impact:** any page with a domain chat MUST declare ownership. Failure to declare = dual-surface confusion ships. Add to page-checklist + skill `smartout-page-polish`.

## References

- ADR-0078 — channel restriction + chat-only surfaces
- Frontend designer Phase 3 review (council 2026-04-29)
- L-0178 — dual chat surface UX disambiguation (this council)

---

> After writing: register in `docs/decisions/0000-decision-log.md`. Promote to `accepted` when implementation lands. Phase 1 ships before journey-wizard is announced as production-ready for non-Pontus godmode users.
