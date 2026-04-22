---
title: "primeContext enrichment is the fix when an AI affordance feels broken — not removal"
id: LEARNING_0101
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [botsson, primeContext, ai-surface, ux, affordance, stage-engine, capability]
---

# Learning-0101: primeContext enrichment is the fix when an AI affordance feels broken — not removal

## Context

Council 2026-04-22 (contract-management-redesign) Q3 initially framed the Botsson button on the contract hub as "theatre — remove it". The evidence: users tap the button expecting it to create a contract, Botsson opens, and its first turn asks "for whom?" — feeling like a dead or broken button.

Agent-coord code-trace contradicted the framing. The button IS wired end-to-end:

- `apps/web/src/app/dashboard/contracts/_components/ContractHubToolbar.tsx` dispatches a primeContext payload → BotssonProvider.
- BotssonProvider forwards to the BFF → stage-engine with `capability: "create_contract"` primed.
- `create_contract` capability tool exists and is registered; it accepts primed context and executes the flow.

The real defect was that the primeContext payload from the hub button passed only `{ capability: "create_contract" }`. It did NOT include `profileId` or `profileName` for the subject employee. On the contract hub there is no selected-employee row context — the button is a global "create contract" shortcut — so Botsson's first turn reasonably asked "for whom?". The user perceived this as a broken AI; the fix is to enrich the payload or reshape the entry point, not remove the button.

## Discovery

When an AI affordance feels broken because the agent asks "for whom?" or "for what?" on its first turn, the usual bug is NOT that the surface is theatre. The usual bug is that the primeContext from the surface is thin — the code path is live but the context handoff is missing the identifiers the agent needs.

Two investigation steps before deciding to remove the affordance:

1. **Code-trace the wire** — is the button actually dispatching to BotssonProvider? Does the capability exist and execute? (In 4 of 5 recent cases, the answer was yes.)
2. **Inspect the primeContext payload** — does it carry the entity identifiers the first-turn tool call needs? If the surface has no entity (e.g. a global hub), can the agent reasonably ask? If the surface HAS an entity (e.g. an employee row), is it being passed?

If the wire is live and the agent is asking a question the surface CAN answer, fix primeContext — add `profileId`, `profileName`, `entityId`, or whatever the first-turn capability needs. If the surface genuinely cannot provide the identifier (global hub, no selection), consider relocating the button to a place that CAN provide it (row-level instead of toolbar-level).

Removing the button should be the last resort, not the first. Surfaces with working wires are hard to rebuild; broken-feeling UX from thin primeContext is cheap to fix.

## Impact

Audit checklist for every page carrying a Botsson affordance:

- [ ] Code-trace the dispatch path from button → BotssonProvider → BFF → stage-engine.
- [ ] Confirm the capability is registered, has a tool, and is seeded in `engine_authority_config` (ADR-0097).
- [ ] Inspect the primeContext payload — list every identifier the first-turn tool call expects.
- [ ] Confirm the surface can provide each identifier; if not, relocate or enrich.

Promote to `smartout-agent-dev` skill if a second AI-surface council repeats this pattern. Until then, use this learning as the first investigation hook for any "remove the theatre button" verdict.

Pages to audit against this checklist (carry-forward from 2026-04-22):

- `/contracts` hub toolbar — add row-level trigger or relocate.
- `/dashboard/schedule` — shift-related Botsson entry points.
- `/dashboard/year-wheel` — planning-cycle Botsson entry points.
- `/dashboard/helpdesk` — ticket-related Botsson entry points post-Progressive Channel (ADR-0165).

Not a hard rule yet — three confirmed uses needed before promotion. This is occurrence 1.

## References

- ADR-0076 — composition as cascade derivation (create_contract capability foundation).
- ADR-0097 — C4 authority defaults are not free (capability must be seeded to execute).
- ADR-0132 — mobile Botsson routed through web BFF (thin-client surface pattern).
- ADR-0133 — mobile surface boundary (informs WHICH surface a Botsson button belongs on).
- L-0046 — AI provider promises must match capability reality (opposite failure mode — this learning is the counter-example where the capability IS real).
- L-0060 — "theatre" verdicts have layers (transport / telemetry / design presence); primeContext is a fourth layer.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
