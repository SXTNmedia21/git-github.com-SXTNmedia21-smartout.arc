---
title: "`not_implemented` LLM-Callable Skeleton Antipattern"
id: L-0357
status: accepted
layer: learning
created: 2026-05-25
updated: 2026-05-25
---

# L-0357: `not_implemented` LLM-Callable Skeleton Antipattern

## What happened

Restaurant-sim council 2026-05-25 (system-agent-coordinator code-trace). The `tips`
capability self-documents the antipattern at `packages/ai/src/capabilities/tips/tools.ts:1-17`:

```typescript
/**
 * Sortie 1 scope: ALL tools return { ok: false, error: "not_implemented" }.
 */
```

Four LLM-callable tools (`set_pot`, `adjust_share`, `approve_distribution`,
`query_own_share`) are registered to the Vercel AI SDK, exposed via intent-classifier,
discoverable to the LLM during conversation routing. When the LLM picks
`tips.adjust_share`, the body returns `{ ok: false, error: "not_implemented" }`. The LLM
stutters, hallucinates, or apologises without explaining what's wrong. User sees no useful
feedback.

The capability file SELF-NOTES the phantom-emit risk and the `tips` ADR-0196 reference.
Despite self-awareness, the tools are still LLM-callable and intent-classifier-routable.

## Why it matters

This is sub-pattern A from [[L-0353]] Contract-Promise-Without-Fulfillment meta-pattern,
at its purest form: tool registered + body deliberately empty. Three failure modes
compound:

1. **LLM trust degradation** — model picks tools that return useless data; learns to avoid
   the capability entirely, even after bodies ship
2. **Telemetry pollution** — every `tips.*` call emits `success: false, error:
   "not_implemented"` to PostHog, masking real errors
3. **Intent-classifier confidence degradation** — phantom tools in candidate set lower
   classification precision

Sortie 1 / phase-1 / MVP shipping discipline allows skeletons for some reason. The
shortcut is wrong — register with bodies OR declare scaffold-phase + exclude from
intent-classifier.

Same class as L-0287 (phantom contract avoidance) but inverted: L-0287 documents when
NOT registering is the right move; L-0357 documents when registering-with-empty-body is
the wrong move.

## Lesson learned

**Capability registration MUST be paired with either bodied implementation OR explicit
scaffold-phase declaration that excludes the tool from intent-classifier candidate set.**

[[ADR-0422]] formalizes the ban:

- Rule 1 (HARD BAN): no LLM-callable tool body may return literal `"not_implemented"`
- Rule 2 (CARVE-OUT): `phase: "scaffold"` capability flag excludes from
  intent-classifier + getAllCapabilities() runtime output
- Rule 3 (USER-FACING ERRORS): if tool body returns error, message MUST be user-facing
  sentence in workspace locale, not engineering shortcut

## How to apply

- **When sortie scope cannot ship bodies for all capability tools:** declare capability
  `phase: "scaffold"` in `index.ts` — tools won't be LLM-callable until phase changes to
  `production`
- **When tools partially work** (e.g. 2 of 4 bodies ready): split capability into
  production-phase + scaffold-phase, OR register only the ready tools
- **For existing skeletons** (`tips/`, possibly others): file follow-up sortie to either
  ship bodies OR flip to scaffold within 4 weeks
- **When writing user-facing errors:** Norwegian Bokmål default — "Tip-fordeling er ikke
  tilgjengelig ennå — planlagt Q3 2026" — NOT "not_implemented" / "TODO" / "coming soon"

## References

- 11-agent restaurant-week sim council 2026-05-25 (system-agent-coordinator code-trace)
- `packages/ai/src/capabilities/tips/tools.ts:1-17` — the antipattern self-documented
- [[ADR-0422]] — `not_implemented` Antipattern Ban (this learning's enforcement ADR)
- [[L-0353]] sub-pattern A — surface manifestation of the meta-pattern
- L-0287 — phantom contract avoidance (sibling carve-out)
- ADR-0196 — referenced by tips capability for phantom-emit risk
