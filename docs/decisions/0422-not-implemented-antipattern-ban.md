---
title: "`not_implemented` Antipattern Ban — LLM-callable tools must ship bodies or hide"
id: ADR-0422
status: accepted
layer: decision
created: 2026-05-25
updated: 2026-05-25
---

# ADR-0422: `not_implemented` Antipattern Ban

## Context and Problem Statement

`packages/ai/src/capabilities/tips/tools.ts:1-17` self-documents the antipattern:

```typescript
/**
 * Sortie 1 scope: ALL tools return { ok: false, error: "not_implemented" }.
 */
```

Four tools (`set_pot`, `adjust_share`, `approve_distribution`, `query_own_share`) are
registered to the Vercel AI SDK, exposed via intent-classifier, and discoverable to the LLM
during conversation routing. When the LLM picks `tips.adjust_share`, the body returns
`{ ok: false, error: "not_implemented" }`. The LLM then stutters, hallucinates, or apologises
without explaining what's wrong. The user sees no useful feedback.

A second occurrence — `compose_shift_briefing` + `compile_day_brief` + `compile_preclose` —
ship with bodies but no engine_process consumer (council 2026-05-25 sortie sim). Same shape
of failure: registered surface, dead body path.

This is the LLM-routing variant of [[ADR-0421]] sub-pattern A.

## Decision Drivers

- Phantom tool registration breaks LLM trust: model picks a tool that returns no useful data
- Telemetry pollution: every `tips.*` call emits `success: false, error: "not_implemented"`
  to PostHog, masking real errors
- Intent-classifier confidence is degraded by phantom tools in the candidate set
- User experience: silent failure with no remediation guidance
- L-0287 carve-out documents a similar pattern (phantom contract avoidance on thin-shell pages)

## Considered Options

1. **A** — Tools registered must have bodies that ship real data
2. **B** — Tools may return `not_implemented` ONLY when capability declares `phase: scaffold`
   AND intent-classifier excludes them from candidate set
3. **C** — Tools may return error strings ONLY if user-facing message is explicit
   ("Tip distribution is not yet available — planned for Q3 2026")

## Decision Outcome

**Chosen: hybrid B + C.**

- **Rule 1 (HARD BAN):** No LLM-callable tool body may return the literal string
  `"not_implemented"`. ESLint rule: `no-not-implemented-tool-bodies`. Detected via AST scan
  on `packages/ai/src/capabilities/**/tools.ts` for return statements containing the literal.

- **Rule 2 (CARVE-OUT):** A capability MAY declare `phase: "scaffold"` in its
  `index.ts` declaration. Tools in scaffold-phase capabilities are EXCLUDED from
  intent-classifier candidate set AND from `getAllCapabilities()` runtime output. Audit-rule
  enforced via pgTAP-style test against intent-classifier output.

- **Rule 3 (USER-FACING ERRORS):** When a tool body returns an error, the message MUST be a
  user-facing sentence in Norwegian Bokmål (default) or English (workspace locale).
  Example: `"Tip-fordeling er ikke tilgjengelig ennå — planlagt Q3 2026."` NOT
  `"not_implemented"` or `"TODO"`.

## Rules & Consequences

- **Good:** LLM never picks dead tools (intent-classifier respects scaffold flag)
- **Good:** Telemetry stops emitting fake errors
- **Good:** Users get clear "coming Q3" messaging instead of stutter
- **Bad:** Migrating existing skeletons requires either body completion OR scaffold
  declaration — `tips/` capability needs Sortie 1.5 to either ship bodies or flip to scaffold
- **Bad:** Intent-classifier exclusion adds a runtime filter to capability registration —
  small perf cost

## Agent Impact

Per ADR-0421 sub-check C-A: every LLM-callable tool body MUST return real data OR an explicit
user-facing error message in workspace locale. The `tips/` capability MUST either ship bodies
within the next 4 weeks OR declare `phase: "scaffold"` in `tips/index.ts`. Other capabilities
with phantom tools must do the same.

## References

- 11-agent restaurant-week sim council 2026-05-25 (system-agent-coordinator code-trace)
- `packages/ai/src/capabilities/tips/tools.ts:1-17` — the antipattern self-documented
- [[ADR-0421]] sub-check C-A — this ADR enforces the rule
- L-0287 — phantom contract avoidance carve-out (thin-shell pages)
- L-0357 — `not_implemented` antipattern observed across `tips/` + 4 other surfaces
