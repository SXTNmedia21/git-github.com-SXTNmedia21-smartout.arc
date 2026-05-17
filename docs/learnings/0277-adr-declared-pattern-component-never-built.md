---
id: L-0277
title: "ADR declares component pattern but component is never built"
status: accepted
date: 2026-05-16
discovered_in: chat-whatsapp Phase 3 priority council (2026-05-16) — ADR-0238 finding
related_adrs: [ADR-0238, ADR-0337, L-0257]
tags: [adr, component, phantom-contract, enforcement, botsson]
---

# ADR declares component pattern — component never built

## Discovery

ADR-0238 (Botsson Surface Disambiguation, 2026-04-29) declared the
`<DomainChatOwnership>` pattern. The ADR is accepted. The pattern is documented.
But as of 2026-05-16:

```bash
grep -r "DomainChatOwnership" apps/web/src/
# 0 component definition hits
# 40+ JSX comment hits of the form:
# {/* No <DomainChatOwnership> required */}
# {/* owns_chat_surface: false */}
```

The component does not exist. The comment-convention ("fake it with comments")
was never intended to be permanent — it was a placeholder until the component
shipped. The placeholder became the permanent state.

L-0257 (2026-05-14) had already caught this as a "phantom-contract accumulator"
reaching the build-or-retract threshold (40+ comment refs). The council
2026-05-16 confirmed it as a **silent dual-surface UX bug shipping now** on
`/dashboard/komm/chat`.

## Pattern anatomy

1. ADR declares a component pattern (or contract, or interface)
2. Implementers reference it via comment-convention while deferring the build
3. Comment convention accumulates across waves (each wave adds 3-5 more refs)
4. No one counts the references or notices the build never shipped
5. The ADR acceptance criteria lack a "component exists in grep" check

This is structurally identical to the phantom-emit pattern (L-0083/L-0094)
and the phantom-tool pattern (L-0207): declared in ADR/registry, never
implemented, silently broken.

## Fix — ADR acceptance criteria must include a grep-verifiable artifact

When an ADR declares a component pattern, the ADR's acceptance criteria MUST
include at minimum:

```markdown
**Acceptance criteria:**
- `grep -r "ComponentName" apps/web/src/` returns component definition
  (NOT only comment references)
- Component is mounted on at least one page per ADR-0238 intent
```

This is an addition to the standard ADR template — apply at write-time for
any ADR that declares a component, hook, or named pattern.

## Detection heuristic

When reviewing an existing ADR for compliance:
1. Extract any component/hook/function names from the ADR body
2. Run `grep -r "ComponentName" apps/web/src/ --include="*.tsx"`
3. Count: definition hits vs comment hits
4. If definition hits = 0 and comment hits ≥ 5: ADR phantom-component gap
5. Threshold for escalation to build-or-retract: ≥10 comment refs, 0 definition

## What happened here

- ADR-0238 accepted 2026-04-29
- Phase 3 chat (next wave after 2026-04-29) added 5+ comment refs
- Phase 3 dagslinjen, Phase 3 WFM polish each added refs
- No wave ever built the component
- L-0257 (2026-05-14) flagged it; council 2026-05-16 confirmed it critical
- ADR-0337 created to mandate the build

## Relationship to other learnings

- L-0083 — registered telemetry event without producer (same structural class)
- L-0094 — phantom emit contracts
- L-0207 — phantom-tool pattern (tool referenced in spec, never built)
- L-0257 — ADR-0238 phantom-contract accumulator (direct precursor)
