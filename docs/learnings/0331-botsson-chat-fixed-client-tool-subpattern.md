---
title: "BotssonChat-fixed client-tool sub-pattern — two coexisting registries with collision precedence"
id: LEARNING_0331
status: canonical
layer: learning
created: 2026-05-23
updated: 2026-05-23
tags: [botsson, harness, client-tool, registration, useRegisteredTools, sub-pattern]
---

# Learning-0331: BotssonChat-fixed client-tool sub-pattern

## Context

Council 2026-05-23 reviewed the InlineConfirmCard HITL primitive (ADR-0398). The Harness Builder flagged a critical gap: `show_proposal_card` is a CHAT-SURFACE tool, not a PAGE-SCOPED tool. It must be available on every chat surface regardless of which page hosts the BotssonChat component. Existing `useRegisteredTools()` (`apps/web/src/app/Botsson/_components/tool-registry.ts`) is page-keyed (`source = page path`). Tools registered via this hook live only on the page that calls `useRegisterTools(...)` inside its bridge component.

**Today there is no registration tier between "global tool definitions sent to stage-engine" (via `BotssonTools.ts`) and "page-scoped client-tool implementations" (via `useRegisteredTools`).** A primitive like `show_proposal_card` lives outside both — it ships with the chat shell, never page-dependent.

## Discovery

A **new sub-pattern is required**: **BotssonChat-fixed client-tool**. Two registries coexist at dispatch time inside `BotssonChat.tsx`:

1. **Fixed primitives** — hardcoded into the chat shell's `implementations` record. Available on every chat surface (admin chat, employee chat, helpdesk chat, etc.). Examples: `show_proposal_card`, future fixed primitives.
2. **Page tools** — contributed via `useRegisteredTools()` from page bridges. Examples: `help-takeover-kit` (helpdesk page), `tour-tools-bridge` (tour pages).

**Precedence on name collision:** fixed wins. Page tools cannot override a fixed primitive's implementation. Pattern documented in ADR-0398 §Registration Sub-Pattern.

The merge happens inside `BotssonChat.tsx` just before calling `executeClientToolRoundtrip` — both records are spread into a single `implementations` Record<string, ClientToolImplementation>, with the fixed record applied LAST so any page-supplied implementation of the same name is overwritten by the fixed one.

## Impact

**Implementation pattern (Phase 1 ships first instance via ADR-0398):**

```ts
// apps/web/src/app/Botsson/_components/BotssonChat.tsx
const fixedPrimitives: Record<string, ClientToolImplementation> = {
  show_proposal_card: showProposalCardImpl,
  // future fixed primitives go here
};

const registeredTools = useRegisteredTools();
const mergedImplementations = {
  ...registeredTools.implementations,
  ...fixedPrimitives, // fixed wins on collision
};

const result = await executeClientToolRoundtrip({
  endpoint: chatEndpoint,
  initialBody,
  implementations: mergedImplementations,
});
```

**Stabilization tracking:** once the second fixed primitive ships (likely Phase 2 send_message or approve_shift in their own ADRs), extract the fixed-record builder into its own module (`apps/web/src/app/Botsson/_components/fixed-primitives.ts`) and document the pattern in `docs/architecture/BOTSSON-SYSTEM-MAP.md` under L4 (capabilities + harness).

**Anti-patterns to avoid:**

- Do NOT register `show_proposal_card` via `useRegisterTools("botsson-chat", kit)` from inside BotssonChat itself — this re-uses the page-tool tier for something it's not designed for, and breaks the source-key semantics (`source` is page path; `BotssonChat` is a component, not a page).
- Do NOT add `show_proposal_card` to the global tool definitions sent to stage-engine via `BotssonTools.ts` — those are definitions the LLM knows about, not implementations the browser runs. Fixed primitives need definitions AND implementations on the browser side.
- Do NOT let fixed and page-scoped tools share names — the precedence rule prevents bugs but obscures intent. Document fixed primitive names as reserved.

**Cascade-integrity-mandate update (deferred until Phase 2 ships):** add a section on "two-tier client-tool registration" describing fixed vs page tiers and the precedence rule.

## References

- ADR-0398 — InlineConfirmCard Primitive (first consumer of this sub-pattern).
- `apps/web/src/app/Botsson/_components/BotssonChat.tsx:35,208` — current `useRegisteredTools()` integration point.
- `apps/web/src/app/Botsson/_components/tool-registry.ts` — page-tool registry.
- `apps/web/src/app/Botsson/_components/BotssonTools.ts` — global definitions sent to stage-engine.
- `apps/web/src/app/Botsson/_components/help-takeover-kit.ts` — example page-tool kit.
- `packages/ai/src/harness/types.ts:88` — `implementations: Record<string, ClientToolImplementation>` shape.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
