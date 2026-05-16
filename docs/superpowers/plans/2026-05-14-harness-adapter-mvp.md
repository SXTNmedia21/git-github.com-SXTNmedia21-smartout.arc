---
title: HarnessAdapter MVP Implementation Plan
status: draft
updated: 2026-05-14
created: 2026-05-14
module: harness
tags: [plan, harness, botsson, adr-0327, dead-pipe-fix, mvp]
---

# HarnessAdapter MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the dead-pipe between client tool registry + site-map.json and any LLM consumer by shipping the unified `HarnessAdapter` (ADR-0327). MVP = ADR body completion + Phase 1 (interface scaffold) + Phase 2 (registry-source implementation). Consumer wiring (chat in Phase 3, voice in Phase 4) deferred to dedicated sortie.

**Architecture:** Single adapter in `packages/ai/src/harness/` exposing `getToolsForChannel`, `getSiteMap`, `subscribeToRouteChange`. Reads from existing capabilities registry + site-map.json + context-snapshot helper. Server-side authority enforcement (ADR-0078, ADR-0151, ADR-0244). Client-side bridge (POSTs selected_tools to server per session) deferred to Phase 3.

**Tech Stack:** TypeScript strict, vitest, no new dependencies. Existing types from `packages/ai/src/router/`, `packages/agent-sdk/src/types/`.

**Predecessor:** ADR-0327 (proposed) at `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` — frontmatter + context + decision sections only. Body deferred to Task 1 of this sortie.

**Council finding (2026-05-14):** L-0264 chair self-reversal — 75 page-scope tools dead-pipe. See HANDOFF-2026-05-14-polish-wave-council-harness-adapter.md for full code-trace.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `docs/decisions/0327-harness-adapter-unified-llm-consumer.md` | Modify | Complete body: alternatives weighed, consequences enumerated, phases 1-6 detailed, test strategy, status proposed → accepted |
| `packages/ai/src/harness/types.ts` | Create | HarnessAdapter interface + supporting types (Channel, ToolBundle, AuthorityConfig, SiteMap, UserContext) |
| `packages/ai/src/harness/index.ts` | Create | Re-exports + factory function `createHarnessAdapter(deps)` |
| `packages/ai/src/harness/sources/capabilities-source.ts` | Create | Read capability tools from existing `packages/ai/src/capabilities/` registry; filter by channel + authority |
| `packages/ai/src/harness/sources/site-map-source.ts` | Create | Read `apps/web/.botsson/site-map.json`; filter by user access; provide route catalog |
| `packages/ai/src/harness/authority.ts` | Create | Server-side authority enforcement per ADR-0078/0151/0244 — strips PII tools from voice, blocks financial mutations on passive surfaces |
| `packages/ai/src/harness/__tests__/types.test.ts` | Create | Type-level tests (compile-time only — verify interface shape) |
| `packages/ai/src/harness/__tests__/capabilities-source.test.ts` | Create | Unit tests for capability filtering |
| `packages/ai/src/harness/__tests__/site-map-source.test.ts` | Create | Unit tests for site-map filtering |
| `packages/ai/src/harness/__tests__/authority.test.ts` | Create | Unit tests for authority gates |
| `docs/journeys/JOURNEY-harness-adapter-mvp.md` | Modify | Add Phase 1/2 journeys + verification protocol; close gate writes results |
| `docs/HANDOFF-harness-adapter-mvp.md` | Create at close | Decisions + learnings + open Phase 3/4 work |

---

## Task 1: Complete ADR-0327 body

**Files:**
- Modify: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`

ADR body sections to add: Alternatives Considered, full Consequences enumeration, Phase-by-phase detail (1-6), Test Strategy, Migration Path, Open Questions.

- [ ] **Step 1.1: Read existing ADR + collect references**

Inputs: existing ADR-0327 (Status, Context, Decision sections); HANDOFF-2026-05-14; ADR-0078/0133/0151/0244/0297 references.

- [ ] **Step 1.2: Write Alternatives Considered section**

Three alternatives to weigh:
- **A. Per-consumer integration (status quo)** — each LLM consumer (chat, voice, future) does its own tool-fetch. Pros: no shared abstraction. Cons: 3 broken pipes today; multiplicatively worse with future consumers.
- **B. Server-side capability-only adapter** — adapter exposes only server-side capabilities; client tools stay client-only. Pros: simpler, no client→server tool POST. Cons: 75 page-scope tools remain dead-pipe; doesn't close the finding.
- **C. Unified HarnessAdapter (chosen)** — adapter exposes contract; client + server sources both feed it. Pros: closes dead-pipe; scales to N consumers. Cons: more architectural surface; single point of failure.

- [ ] **Step 1.3: Write Consequences section**

Positive, negative/risks, neutral — full enumeration per ADR template.

- [ ] **Step 1.4: Write Phase-by-phase detail**

Phases 1-6. Each phase: scope, files touched, acceptance criteria, dependencies.

- [ ] **Step 1.5: Write Test Strategy section**

Layer-by-layer test approach: type-level, unit, integration (consumer mocked), contract (consumer real). Mention which layers Phase 2 ships.

- [ ] **Step 1.6: Write Migration Path section**

How does existing `toVercelTools` chain integrate? Phase-gated cutover. Backward-compat plan.

- [ ] **Step 1.7: Write Open Questions section**

Decisions deferred to Phase 3/4: LiveKit transport, hot-swap mechanism, token-budget management.

- [ ] **Step 1.8: Flip status `proposed` → `accepted`**

Update frontmatter. Update decision-log entry.

- [ ] **Step 1.9: Commit**

```
docs(adr): ADR-0327 body complete — accepted

Alternatives weighed (A status-quo, B server-only, C unified [chosen]).
Consequences enumerated. Phases 1-6 detailed. Test strategy + migration
path + open questions for Phase 3/4.

Status: proposed → accepted.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

---

## Task 2: Phase 1 — HarnessAdapter interface + types

**Files:**
- Create: `packages/ai/src/harness/types.ts`
- Create: `packages/ai/src/harness/index.ts`
- Create: `packages/ai/src/harness/__tests__/types.test.ts`

- [ ] **Step 2.1: Inspect existing type space**

Read `packages/ai/src/capabilities/types.ts`, `packages/agent-sdk/src/types/index.ts`, `packages/ai/src/router/types.ts`. Identify reusable types (ClientToolDefinition, ClientToolImplementation, AuthorityConfig, channels enum).

- [ ] **Step 2.2: Write types.ts**

Interface signatures:
```typescript
export type Channel = "chat" | "voice" | "slack" | "email" | "api";

export type UserContext = {
  profile_id: string;
  workspace_id: string;
  role: string;
};

export type ToolBundle = {
  definitions: ClientToolDefinition[];
  implementations: Record<string, ClientToolImplementation>;
  systemPromptSlices: string[];
  authority: AuthorityConfig;
};

export type SiteMap = {
  routes: SiteMapRoute[];
  commonIntents: CommonIntent[];
};

export interface HarnessAdapter {
  getToolsForChannel(
    channel: Channel,
    pageRoute: string | null,
    userContext: UserContext,
  ): Promise<ToolBundle>;

  getSiteMap(userContext: UserContext): Promise<SiteMap>;

  subscribeToRouteChange(callback: (newRoute: string) => void): Unsubscribe;
}
```

- [ ] **Step 2.3: Write index.ts factory**

```typescript
export { createHarnessAdapter } from "./factory";
export type * from "./types";
```

- [ ] **Step 2.4: Write type-level test**

Verify interface shape compiles + matches ADR-0327 signature.

- [ ] **Step 2.5: Run typecheck**

`pnpm --filter @smartout/ai typecheck` must exit 0.

- [ ] **Step 2.6: Commit**

---

## Task 3: Phase 2 — Capabilities source

**Files:**
- Create: `packages/ai/src/harness/sources/capabilities-source.ts`
- Create: `packages/ai/src/harness/__tests__/capabilities-source.test.ts`

Reads from existing `packages/ai/src/capabilities/` registry. Filters by channel (some capabilities chat-only per ADR-0078), filters by user role + workspace authority.

- [ ] **Step 3.1: Inspect existing capability registry**

Locate registry (likely `packages/ai/src/capabilities/registry.ts` or similar). Identify channel + role metadata on each capability.

- [ ] **Step 3.2: Write CapabilitiesSource**

```typescript
export class CapabilitiesSource {
  async getToolsFor(channel: Channel, userContext: UserContext): Promise<{
    definitions: ClientToolDefinition[];
    implementations: Record<string, ClientToolImplementation>;
  }> { ... }
}
```

- [ ] **Step 3.3: Unit tests**

Test cases:
- Returns chat-only capabilities when channel = chat
- Excludes chat-only capabilities when channel = voice
- Filters by user role (manager-only tools excluded for employee)
- Filters by workspace authority (gate_action enforced)

- [ ] **Step 3.4: Run tests**

`pnpm --filter @smartout/ai test` must pass.

- [ ] **Step 3.5: Commit**

---

## Task 4: Phase 2 — Site-map source

**Files:**
- Create: `packages/ai/src/harness/sources/site-map-source.ts`
- Create: `packages/ai/src/harness/__tests__/site-map-source.test.ts`

Reads `apps/web/.botsson/site-map.json`. Filters routes by user access (some routes admin-only). Returns full filtered catalog.

- [ ] **Step 4.1: Inspect site-map.json shape**

Read `apps/web/.botsson/site-map.json`. Note schema: 47 routes / 70 useRegisterTools scopes / ~269 total tools (per HANDOFF-2026-05-14).

- [ ] **Step 4.2: Write SiteMapSource**

Read JSON at construction time (cache once); filter by `access` field per route + user role.

- [ ] **Step 4.3: Unit tests**

Test cases:
- All routes visible to admin
- Admin routes hidden from employee
- Workspace-specific routes filtered by workspace_id
- Empty result when no routes accessible

- [ ] **Step 4.4: Commit**

---

## Task 5: Phase 2 — Authority enforcement

**Files:**
- Create: `packages/ai/src/harness/authority.ts`
- Create: `packages/ai/src/harness/__tests__/authority.test.ts`

Server-side enforcement of ADR-0078 (channel pinning), ADR-0151 (workspace_id derivation), ADR-0244 (financial-mutation risk tier).

- [ ] **Step 5.1: Define AuthorityConfig type**

```typescript
export type AuthorityConfig = {
  channel: Channel;
  workspace_id: string;  // server-derived, never body-forged
  role: string;
  blockedTools: string[];  // tools stripped from bundle
};
```

- [ ] **Step 5.2: Write applyAuthority(bundle, config)**

Strips PII tools from voice (ADR-0078). Strips financial-mutation tools from passive surfaces (ADR-0244). Replaces any body-forged workspace_id with server-derived.

- [ ] **Step 5.3: Unit tests**

Test cases:
- PII tool present in chat bundle, stripped from voice bundle
- Financial mutation tool blocked when channel = voice
- workspace_id from request body is OVERRIDDEN by server-derived value

- [ ] **Step 5.4: Commit**

---

## Task 6: Phase 2 — Factory + integration

**Files:**
- Create: `packages/ai/src/harness/factory.ts`
- Create: `packages/ai/src/harness/__tests__/factory.test.ts`

Composes CapabilitiesSource + SiteMapSource + Authority into a HarnessAdapter instance.

- [ ] **Step 6.1: Write factory**

```typescript
export function createHarnessAdapter(deps: {
  capabilities: CapabilitiesSource;
  siteMap: SiteMapSource;
}): HarnessAdapter { ... }
```

- [ ] **Step 6.2: Integration test**

Builds adapter with stub sources, calls `getToolsForChannel`, verifies output matches contract.

- [ ] **Step 6.3: Commit**

---

## Task 7: Journey doc

**Files:**
- Modify: `docs/journeys/JOURNEY-harness-adapter-mvp.md`

Document the 3 journeys this MVP enables (consumer-side verification protocols).

- [ ] **Step 7.1: Write Journey 1 — Server-side consumer fetches tools for chat**

User flow: stage-engine BFF receives `/agent/chat` request → calls `adapter.getToolsForChannel("chat", pageRoute, ctx)` → receives bundle → passes to vercel-ai SDK. Verify bundle includes both capability tools + (eventually, when Phase 3 ships) page-scope tools.

- [ ] **Step 7.2: Write Journey 2 — Adapter exposes site map**

User flow: `adapter.getSiteMap(ctx)` returns 47-route catalog filtered to user's access. Used by capability `query_smartout` to answer "hvor finner jeg X?" without round-trips.

- [ ] **Step 7.3: Write Journey 3 — Authority strips PII from voice**

User flow: voice consumer requests bundle for channel "voice" + page `/dashboard/my-profile/complete`; bundle excludes the PII-revealing tools that chat sees. Verify per ADR-0078.

- [ ] **Step 7.4: Flip verified flag**

After all 3 journeys traced + tests pass, mark `verified: true`.

---

## Task 8: HANDOFF + closure

**Files:**
- Create: `docs/HANDOFF-harness-adapter-mvp.md`

- [ ] **Step 8.1: Summary** — What was built, why, what's deferred.
- [ ] **Step 8.2: Decisions** — Register all decisions made (ADR-0327 body, source-architecture, authority placement) in decision log.
- [ ] **Step 8.3: Learnings** — Capture any discoveries (likely: type-space surprises, capability-registry shape gotchas, site-map.json schema drift).
- [ ] **Step 8.4: Open issues / debt** — Phase 3 (chat consumer wire) + Phase 4 (voice consumer wire) explicitly out of scope.
- [ ] **Step 8.5: Next steps** — Dedicated sortie for Phase 3 BFF wiring.
- [ ] **Step 8.6: Run close-feature.sh from wt-1**

---

## Self-Review

Will refine plan in worktree before dispatching agents. Plan is currently a STUB — Task 1 alone has 9 steps but lacks the actual ADR body text. Phase 2 tasks reference existing files (capabilities registry) without naming them. Steps 2.2, 3.2, 4.2, 5.2 give signatures but not bodies.

**Acceptable for stub:** plan exists, scope clear, file layout drawn, journeys named. Refinement happens in worktree before subagent dispatch.

**Required before dispatching agents:** refine Task 1 (write ADR body text inline), refine Task 3 (read existing capability registry first, then write source code), refine all test cases with concrete examples.

---

## Execution

Recommend: refine plan in worktree first, then dispatch via superpowers:subagent-driven-development (same protocol as polish-pipe-fix plan).
