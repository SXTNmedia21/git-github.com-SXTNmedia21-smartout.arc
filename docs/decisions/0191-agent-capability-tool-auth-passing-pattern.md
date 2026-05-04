---
id: ADR-0191
title: "Agent capability tool auth-passing pattern"
status: proposed
date: 2026-04-22
created: 2026-04-22
updated: 2026-04-22
deciders: [pontus, council]
superseded_by: null
module: MODULE_AGENT
tags: [adr, capability, agent, auth, bff, supabaseAdmin, contract-hub-redesign]
---

# ADR-0191 — Agent capability tool auth-passing pattern

## Context and Problem Statement

Post-merge code-trace of `contract-hub-redesign` (PR #234) found three sibling capability tools in the same module using two different auth/write patterns:

- `forkTemplate` — invoked the BFF route (`/api/contracts/templates/[id]/fork`) with no `Cookie` header and no agent signature → BFF `requireUser()` returned 401, tool failed silently for every agent caller.
- `publishWorkspaceTemplate` — bypassed the BFF entirely and wrote directly via `ctx.supabaseAdmin` after a `gate_action` check.
- `deprecateWorkspaceTemplate` — same direct-admin pattern as publish.

The mixed PR shipped without anyone noticing the divergence. The 401 path was caught only at post-merge code-trace — a single agent-invocation E2E test would have caught it (see L-0118).

This is the agent-side analogue of the long-standing tension between "always go through the BFF policy layer" (latency + duplicate auth ceremony) and "write direct via service-role admin" (faster, but bypasses any per-route policy and request shaping that lives only in the BFF). Both patterns have legitimate uses; mixing them inside the same capability is what produced the bug.

## Decision Drivers

- **Eliminate silent-401 class of bugs** — agent capability tools must have a single, explicit auth path. `forkTemplate`-style "call BFF without cookie" is forbidden.
- **Preserve performance for write-heavy capability tools** — direct-admin writes after a `gate_action` check are 1 RTT; BFF round-trips add ~50–200ms (CORS pre-flight, header parsing, second auth resolution).
- **Preserve BFF policy enforcement where it matters** — some routes carry rate-limiting, audit hooks, or intermediate workflow shaping that lives only in the route handler. Skipping them silently is a regression.
- **Per-PR uniformity** — sibling tools added in one PR must match. Divergence is a Trust Gate failure (see L-0116).
- **Per-capability flexibility** — a workspace may have one capability where every tool fits Pattern A and another where every tool fits Pattern B. Hybrid is fine across capabilities, never inside one.

## Considered Options

1. **Always BFF** — every capability tool calls the BFF. Rejected: adds latency to every write, doubles auth ceremony for service-role contexts, and requires every tool to manufacture a forwardable session — exactly the trap `forkTemplate` fell into.
2. **Always direct-admin** — every capability tool writes via `ctx.supabaseAdmin` after `gate_action`. Rejected: bypasses BFF policy layer (rate limiting, audit hooks, route-specific shaping), and `gate_action` alone does not replicate route-handler invariants.
3. **Per-capability binary choice** — chosen. Each capability picks ONE pattern for ALL its tools, declared in the capability ADR.

## Decision Outcome

Chosen option: **Per-capability binary choice** (option 3).

Every agent capability tool that mutates MUST follow ONE of two patterns:

**Pattern A — BFF route + agent signature**
- Tool calls the BFF route (`fetch('/api/...', ...)`).
- Request carries `x-agent-actor: <profile_id>` header AND a service-key-signed envelope (HMAC of body + actor + timestamp).
- BFF route handler verifies the signature, resolves the actor profile, and proceeds as if the user invoked it directly.
- Use when: the BFF route owns rate limiting, audit hooks, or intermediate workflow steps that the agent must respect.

**Pattern B — Direct admin after `gate_action`**
- Tool calls `gate_action` (or equivalent C4 authority RPC) to authorize.
- On `outcome:'allow'`, tool writes directly via `ctx.supabaseAdmin`.
- Tool calls `emit()` for telemetry as the BFF would have.
- Use when: the BFF route is a thin pass-through to a single table mutation and the round-trip is pure overhead.

**Choose per-capability, document per-tool.** The capability ADR (or capability `index.ts` doc-comment) declares the chosen pattern. Every tool in the capability follows it. **NEVER mix in the same capability.**

## Rules & Consequences

- **Good, because** silent-401 disappears as a class — Pattern A guarantees the tool has the actor identity, Pattern B never touches BFF auth.
- **Good, because** sibling-tool divergence becomes a one-line review check: "does every tool in this capability use the same pattern?"
- **Good, because** performance trade-offs are explicit at the capability level, not accidental at the tool level.
- **Bad, because** changing pattern mid-capability requires a coordinated migration (every tool rewritten in one PR + capability ADR updated). This is the intended cost.
- **Agent Impact:** Every NEW capability ADR must include a "Tool Auth Pattern" section declaring A or B with one-line justification. Every NEW capability tool must match the declared pattern. Code-trace gate (Phase 3) verifies uniformity by counting BFF-call sites vs `ctx.supabaseAdmin.from()` writes inside `tools.ts` — divergence is a merge-blocker.

## Alternatives Considered

- See "Considered Options" above. Always-BFF and always-direct-admin both rejected on first principles; the bug `forkTemplate` produced is exactly what option 1 would re-create at scale, and option 2 silently bypasses route-handler invariants.

## Open Questions

- **Service-key signature scheme** — HMAC over `body || actor || timestamp` with key rotation cadence is the obvious shape, but we have no existing service-to-service signing convention. First implementation (likely the `forkTemplate` fix in the post-merge sortie) sets precedent. Pre-write a sub-ADR if the scheme grows beyond one capability.
- **Telemetry parity for Pattern B** — Pattern A inherits BFF-side `emit()` automatically; Pattern B requires the tool to emit explicitly. Risk of phantom contracts (L-0094) if a tool forgets. Solve via lint rule that asserts `emit()` is reachable from any `ctx.supabaseAdmin.<table>.insert/update/delete` in `tools.ts`.
- **Hybrid pre-existing capabilities** — a few capabilities (e.g., `shift-lifecycle`) already mix patterns historically. Out of scope for this ADR; document migration path in a follow-up if Trust Gate flags them.

## Related ADRs

- **ADR-0091** — `cascade_gate_write` / `gate_action` is the C4 authority gate Pattern B depends on.
- **ADR-0114** — Server Actions canonical mutation primitive for web; this ADR is the agent-tool analogue.
- **ADR-0132** — Mobile thin-client BFF routing; mobile mutations are Pattern A by construction.
- **ADR-0162** — Helpdesk capability placement; helpdesk tools are Pattern B today.

---

> Council: 2026-04-22 post-merge review of contract-hub-redesign (PR #234). Verdict: APPROVE WITH FIX-FORWARD SORTIE. After writing: register in `docs/decisions/0000-decision-log.md`.
