---
title: "Context-hook consumer merges must verify provider-ancestor chain"
id: LEARNING_0289
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [react, context, provider, botsson, adr-0238, adr-0337, adr-0350, verification, council, l-0147]
---

# Learning-0289: Context-hook consumer merges must verify provider-ancestor chain

## Context

ADR-0337 (commit `16b000387`, accepted 2026-05-16) shipped the
`<DomainChatOwnership>` component implementing the ADR-0238 contract. Three
consumers were wired in the same campaign window:

- `apps/web/src/app/dashboard/komm/_components/chat-page-client.tsx:36`
- `apps/web/src/app/dashboard/komm/thread/[channelId]/_components/TicketConversationView.tsx:103`
- `apps/web/src/app/dashboard/shift-clock/ShiftClockTabs.tsx:89`

All three call `useDeclareDomainChatOwnership()` → `useBotsson()` which requires
a `BotssonProvider` ancestor. None of these routes had a provider ancestor in
their layout chain — `DashboardShell` rendered `{children}` as a sibling of
`<EmmaOverlay />`, and `EmmaOverlay` self-contained its `BotssonProvider`
around only its own `BotssonShell`. Three consumers; zero reachable providers.

The runtime throw `useBotsson must be used within <BotssonProvider>` surfaced
2026-05-17 when Pontus navigated to `/dashboard/komm`. The consumers had been
merged, typecheck was green, the component compiled. The contract gap was
purely topological — a class of bug TypeScript cannot catch.

Council R1 2026-05-17 reviewed the in-place fix (rewriting `EmmaOverlay` to
wrap `{children}` as well as its own shell) and REVERSED Phase 3 chair verdict
(8th L-0147 self-reversal precedent). Solution C (split `BotssonHost`
SSR-safe wrapper from `EmmaOverlay` dynamic-Orb-only) shipped under ADR-0350.

## Discovery

**Adding a consumer of a React context hook is a contract that requires the
provider chain to be verified at merge time. Typecheck cannot enforce it.
Compile success ≠ runtime success.**

Sibling pattern to:

- **L-0176** (2026-04-29) — capability tool docstrings claimed ADR compliance
  before the body satisfied it; docstrings drift from bodies.
- **L-0177** (2026-04-29) — silent fallback to JWT-default workspace when row
  reference missing; fail-fast required, no else-branch.
- **L-0257** (2026-05-14) — phantom-contract accumulator: 40+ JSX comment refs
  to non-existent `<DomainChatOwnership>` component.

All four are variants of one class: **artifact author asserts compliance the
artifact body / surrounding tree does not provide**. Each one is invisible to
typecheck and ships green.

The specific failure mode here:

1. Author of `<DomainChatOwnership>` (ADR-0337) builds the component correctly.
2. Author of the three consumers (same or sibling PR) mounts the component in
   pages they own. Local typecheck passes — the component exists, the import
   resolves.
3. Nobody greps `useBotsson` callers to verify each new consumer has a
   reachable `BotssonProvider` ancestor.
4. Code merges. Routes render at runtime. React throws on mount.

**Per-tool/per-consumer verification table is the missing artifact.**
A merge introducing N new consumers of a context hook should include a table
asserting the provider-ancestor for each consumer, by file:line.

## Impact

**Promote to skill check when seen 2nd time as a documented incident.** First
documented incident is today (2026-05-17). If a 3rd consumer-merge ships
without provider-ancestor verification and throws, promote to:

- `run-council` Phase 3 hard rule: when topic adds a context-hook consumer
  (recognised by `useBotsson`, `useEntityDrawer`, `useChatPanel`,
  `useScheduleCoordination`, `useWorkspace`, etc.), the Code-Tracer reviewer
  MUST produce a "consumer × provider-ancestor" table by file:line. No
  paragraph-level "context wired correctly" claim accepted.
- Pre-merge audit pattern: `grep -r "useBotsson\b" apps/web/src` (or whichever
  hook), cross-reference each result against the route's layout chain to
  confirm a `BotssonProvider` mounts above. Same shape as `gate_action`
  per-tool coverage check (`check-intent-coverage.ts`).

**Steward Phase 3 protocol gap noted in same session:** when a diff moves a
dynamic-import boundary, chair must explicitly check SSR-vs-CSR for every
child route the boundary now gates. Phase 3 chair missed the SSR regression
caused by the in-place fix; 3-of-5 reviewers caught it independently.

## References

- ADR-0238 — Botsson Surface Disambiguation
- ADR-0337 — DomainChatOwnership component build
- ADR-0350 — BotssonHost mount pattern, amends ADR-0113 §R51
- L-0147 — Chair Self-Reversal Protocol (8th precedent today)
- L-0176, L-0177 — sibling artifact-vs-body / contract-vs-fallback class
- L-0257 — phantom-contract accumulator
- Council R1 2026-05-17 — recorded in `docs/council/COUNCIL-LOG.md`

---
