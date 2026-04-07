---
title: Every Botsson mutation tool must call emit() — capability layer is part of telemetry coverage
id: LEARNING_0024
status: canonical
layer: learning
created: 2026-04-07
updated: 2026-04-07
module: contracts
tags: [botsson, telemetry, ai, capabilities]
---

# Learning-0024: Every Botsson mutation tool must call emit() — capability layer is part of telemetry coverage

## Context

During the employee contract management feature, the Next.js route handler for POST
/api/contracts correctly called `emit()` after creating a contract. But the parallel
Botsson tool `createEmployeeContract` (in `packages/ai/src/capabilities/contract/tools.ts`)
performed the same mutation via the contract service WITHOUT calling `emit()`.

This created a silent parallel mutation path: contracts created by an admin clicking
the dashboard would land in `activity_trail` and `engine_event` and PostHog. Contracts
created by an admin asking Botsson "lag en kontrakt for [employee]" would NOT.

The first council review missed this because reviewers verified that the route had
emit() and assumed the rule was satisfied. The capability layer was treated as
"separate" from the API layer for telemetry purposes. It is not.

A secondary issue arose during the fix: the agent attempting to add `emit()` to the
Botsson tool initially claimed `@smartout/telemetry` could not be imported into
`@smartout/ai` because of "DOM globals breaking library.json tsconfig". This was
incorrect — the telemetry package's PostHog provider used `void import("posthog-js")`
(dynamic import) but its other providers used `typeof window` and `document.cookie`
directly, which DID fail typecheck without DOM lib. The fix required refactoring
telemetry to use `globalThis["window"]` checks instead of `typeof window`, removing
direct DOM references from sync code paths.

## Discovery

CLAUDE.md says: "No mutation without emit." This rule applies to ALL mutation surfaces
of the application:

1. API route handlers (`app/api/**/route.ts`) — already enforced
2. Server actions (`_actions/*.ts`) — already enforced
3. **Botsson capability tools (`packages/ai/src/capabilities/**/tools.ts`)** — must be
   enforced going forward
4. Edge functions (`supabase/functions/**/index.ts`) — must be enforced

When an AI agent (Botsson, voice agent, future MCP server) performs a mutation, that
mutation must hit the same telemetry pipeline as a human user clicking the dashboard.
Otherwise the audit trail is incomplete and observability has blind spots that grow
over time as more mutations move into the agent layer.

The capability layer is NOT a separate concern from telemetry. It IS another telemetry
surface, and `emit()` must be called from every tool that mutates state — same event
names, same shapes, ideally with a `source: 'botsson'` discriminator in properties.

## Impact

### For Botsson capability tools

Every tool in `packages/ai/src/capabilities/**/tools.ts` that performs a mutation
(creates, updates, deletes, sends external requests) must call `emit()` from
`@smartout/telemetry` after the successful mutation. The event name must match
what the corresponding API route emits. The data payload should include a
discriminator (e.g. `source: 'botsson'`) so observability can distinguish
mutation paths.

### For the telemetry package

`@smartout/telemetry` must remain importable from server-only packages. This means:

- All sync references to browser globals must use `globalThis["window"]` /
  `globalThis["document"]` lookups, not `typeof window` checks (which leak DOM
  type assumptions into consuming packages without DOM lib)
- All browser-only modules (e.g. `posthog-js`) must be loaded via dynamic
  `import()` so they're tree-shaken out at typecheck time
- The `library.json` tsconfig (no DOM lib) must be the lowest common denominator
  the package supports

### For code review

When reviewing a Botsson capability addition or change, the reviewer must verify:

1. Does this tool perform a mutation? (creates, updates, deletes, external POST/DELETE)
2. If yes, does it call `emit()` after the mutation?
3. Is the event name and shape consistent with the corresponding API route's emit()?
4. Is there a `source` discriminator in the data?

This check should be added to the agent capability checklist alongside the existing
checks for column names, schema accuracy, and authority placement.

## References

- ADRs from feature: docs/decisions/0000-decision-log.md (employee-contract-management)
- Council session: docs/council/COUNCIL-LOG.md 2026-04-06 entry
- Telemetry package refactor: packages/telemetry/src/emit.ts, providers/engine-event.ts,
  providers/posthog-client.ts (commit d92a597e)
- Botsson tool with proper emit: packages/ai/src/capabilities/contract/tools.ts
  (createEmployeeContract)

---

> Registered in `docs/learnings/0000-learning-log.md`.
