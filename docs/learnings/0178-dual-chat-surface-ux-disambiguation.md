---
title: "Dual Chat Surfaces on Same Page Require Explicit Disambiguation or Suppression"
id: LEARNING_0178
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [ux, frontend, botsson, silent-failure, adr-0238]
---

# Learning-0178: Dual Chat Surfaces on Same Page Require Explicit Disambiguation or Suppression

## Context

Council R1 (2026-04-29) frontend designer Phase 3 review of `/platform-admin/journeys/wizard/[sessionId]` flagged HIGH-severity UX defect. The page hosts TWO chat surfaces simultaneously after this campaign's commits landed:

1. In-page wizard textbox — Card-bubble thread + sidebar draft preview, posts to `/api/botsson/chat` with `mission=journey_authoring`. Advances wizard phase.
2. BotssonShell Orb — bottom-right fixed, mounted via `BotssonProvider` in the platform-admin layout, opens its own chat surface for general godmode interactions. Has no awareness of the wizard.

Both surfaces look like "talk to AI." Neither labels which is which. A user who types a journey-authoring message into the Orb expecting it to advance the wizard hits a different code path — the Orb posts to a different session, Botsson responds with a general answer, the wizard session receives nothing, the wizard phase does not advance. No error. No redirect. No signal.

This is silent-failure UX. The user sees a response, assumes success, and the system silently routed their input to the wrong place.

## Discovery

The shape generalizes: any time a page has its own embedded chat AND a global ambient chat (Orb), the user faces a routing decision they should never have to make. First-time users have no model for "which chat does what." Even returning users misroute under load.

Two acceptable solutions:
- **Suppress** — the page declares chat ownership; ambient surface goes passive.
- **Differentiate** — both surfaces stay live but are visually + lexically distinct (labels, tokens, distinct interaction patterns).

Status quo (no disambiguation) ships silent failure.

The bug class:
- Cognitive: user picks the wrong surface
- System: no detection of wrong-surface use (the message arrives somewhere, just not where the user wanted)
- Failure mode: the wizard appears stuck. Support ticket says "wizard isn't responding." Actual cause: user is talking to the Orb.

This is **not** a copy-engineering problem — better placeholder text doesn't fix it. The user is choosing between two visually-similar AI surfaces; copy nuance arrives too late.

## Impact

1. **ADR-0238 codifies suppression** as the chosen solution: BotssonShell renders in passive mode when a page declares chat ownership.
2. **Pattern documentation:** any future page mounting domain chat MUST declare ownership. Failure to declare = dual-surface confusion ships. Add to skill `smartout-page-polish` checklist.
3. **Sibling pages to watch:** helpdesk-preview, communications/compose templates, future authoring flows. All will need ownership declaration.
4. **Test pattern:** Playwright spec for any page-with-domain-chat must verify that BotssonShell renders in passive (not interactive) state when on that page. Single E2E pattern catches all instances.
5. **Design system implication:** Nordic Split design system needs a "passive Orb" visual variant — icon-only, distinct from "active Orb." Track in `smartout-nordic-split` skill.

## References

- ADR-0078 — channel restriction (chat-only surfaces)
- ADR-0238 — Botsson surface disambiguation (this council outcome)
- ADR-0239 — Journey-Authoring Capability via Stage Engine
- L-0151 — earlier dual-surface variant (different topic; same shape)
- Botsson Council R1 (2026-04-29) Phase 3 frontend designer

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
