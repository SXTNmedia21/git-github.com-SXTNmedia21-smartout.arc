---
title: "Lovsen MCP→capability bridge transport — HTTP-via-BFF route + capability HTTP client"
id: ADR_0350
status: proposed
date: 2026-05-17
layer: decision
created: 2026-05-17
updated: 2026-05-17
module: MODULE_AGENT_SDK
tags: [lovsen, mcp, capability, bridge, transport, http, bff, payroll, phase-7d, dynamic-tariff]
amends: none
related_adrs: [ADR-0258, ADR-0342, ADR-0347, ADR-0351, ADR-0352, ADR-0353, ADR-0354]
---

# ADR-0350: Lovsen MCP→capability bridge transport

## Three foundational points

1. **No transport exists today** between TypeScript capability tools and Python Lovsen MCPs. This is the foundational blocker for the dynamic-MCP-fetch tariff system per Phase 7d council 2026-05-17. All companion ADRs (0351–0354) depend on this bridge being defined first.
2. **Option B (in-process SDK) is rejected** — embedding Python in the Node runtime or duplicating Lovdata fetch logic in TypeScript both violate the ADR-0258 boundary that keeps scraping logic in Python MCP. TypeScript capability tools cannot call Python stdlib without either shelling out or running a subprocess — at which point we are reinventing Option A with more complexity.
3. **Option A is chosen**: BFF route + capability HTTP client. The BFF layer already exists for payroll (`apps/web/src/app/api/payroll/`). MCP stays Python; the bridge is HTTP. This reuses ADR-0265 deployment pipeline conventions and requires zero new infrastructure.

---

## Context and Problem Statement

Phase 7 of the payroll campaign introduces dynamic-MCP-fetch tariff logic: capability tools must (a) fetch a specific Riksavtalen paragraph at workspace bootstrap, (b) derive the supplement set applicable to a workspace from Lovsen, and (c) verify citation freshness on a background cron. All three operations require a capability tool to call a Python Lovsen MCP.

Today's `packages/ai/src/capabilities/payroll/tools.ts` contains zero MCP calls. The current pattern for payroll BFF routes (`apps/web/src/app/api/payroll/`) shows HTTP routes that call TypeScript services — not Python MCPs. The Lovsen MCPs (`services/lovsen-lovdata-mcp/`, `services/lovsen-nho-reiseliv-mcp/`) expose their tools over MCP stdio transport — a stateless JSON-RPC protocol over stdin/stdout. There is no established convention for a capability tool to reach stdio across the process boundary.

This ADR defines the bridge.

---

## Decision Drivers

- **ADR-0258 boundary**: scraping and regulatory text fetching logic stays in Python MCP. TypeScript must not re-implement Lovdata HTTP fetch logic.
- **Capability layer is TypeScript**: `packages/ai/src/capabilities/` runs in the Node/stage-engine process. No Python embed is possible without significant operational complexity.
- **Stage engine uses fetch()**: capability tools run in the same Node process as stage-engine and can use the standard `fetch()` API to reach HTTP endpoints. This is already the pattern used by BFF-calling mutations.
- **MCP stdio is stateless per call**: each MCP tool invocation is a discrete JSON-RPC request-response over stdio. This maps cleanly to an HTTP POST request-response — the BFF can spawn a Python process, send one JSON-RPC call, receive the response, and return JSON to the caller.
- **BFF layer already exists**: `apps/web/src/app/api/payroll/` establishes the pattern. Adding Lovsen bridge routes extends this surface without new infrastructure.
- **ADR-0204 (gatedMutation)**: writes stay in the capability tool layer. The bridge is read-only from Lovsen's perspective; no gate required on the bridge itself.

---

## Considered Options

### Option A — BFF route per Lovsen MCP method (chosen)

New Next.js route handlers under `apps/web/src/app/api/lovsen/`. Each route spawns the relevant Python MCP via stdio, marshals one JSON-RPC call, and returns typed JSON. Capability tools call these routes via `fetch()` through a typed client at `packages/ai/src/lib/lovsen-client.ts`.

**Properties:**
- Zero new infrastructure (BFF is already deployed to Vercel)
- Python MCP stays as the authoritative source; TypeScript never duplicates Lovdata logic
- Spawn-per-request cold start ~500 ms — acceptable at bootstrap time (not on the calc-time critical path)
- 24 h cache at BFF layer mirrors the MCP 24 h freshness window (per ADR-0256)
- Auth propagated as JWT from capability layer through BFF

### Option B — Lovsen TypeScript SDK (rejected)

Package that capability tools import directly. Two sub-variants:

- **B-i: Embed Python in Node** — requires `python-shell` or similar; introduces Python runtime dependency into Node image; complicates Docker build; subprocess management lives inside capability tool; no cache sharing; violates clean separation.
- **B-ii: Re-implement Lovdata fetch in TypeScript** — duplicates ADR-0258-governed logic, diverges from the Python MCP over time, introduces a second implementation of the same regulatory fact retrieval. Legally dangerous (two implementations can diverge on rate values).

Both B variants rejected per ADR-0258 boundary.

### Option C — Direct stdio from capability tool (rejected)

Capability tool spawns Python MCP directly, manages the stdio process lifecycle, and communicates via JSON-RPC. Operationally feasible but requires stage-engine to own Python subprocess lifecycle: PID tracking, restart on crash, stdout buffering, stderr logging. This is exactly what a BFF-as-subprocess-manager accomplishes, but without the HTTP abstraction layer, logging infrastructure, or cache. Rejected: operational burden is too high vs HTTP-via-BFF, and it bypasses the existing BFF observability (Next.js request logging, Vercel function metrics).

---

## Decision Outcome

**Chosen option: Option A — BFF route + capability HTTP client.**

Bridge pattern:

```
capability tool (TS)
  → fetch(BFF route)
    → BFF route handler (TS, Next.js)
      → spawn lovsen MCP (Python stdio)
        → Lovdata HTTP (or fixture if LOVSEN_FIXTURE_MODE=true)
      ← JSON-RPC response
    ← typed JSON response
  ← typed result
```

### BFF routes to build (Phase 7e)

| Route | Wraps MCP method | Consumer |
|---|---|---|
| `POST /api/lovsen/fetch-riksavtalen-paragraph` | `lovsen-lovdata-mcp` `fetch_riksavtalen_paragraph` | `payroll` capability bootstrap |
| `POST /api/lovsen/derive-supplement-set` | proposed `derive_supplement_set` (ADR-0352) | `payroll` capability bootstrap |
| `POST /api/lovsen/verify-citation-freshness` | `verify_citation_freshness` (ADR-0342) | background cron (Phase 7e+) |

File locations:
- `apps/web/src/app/api/lovsen/fetch-riksavtalen-paragraph/route.ts`
- `apps/web/src/app/api/lovsen/derive-supplement-set/route.ts`
- `apps/web/src/app/api/lovsen/verify-citation-freshness/route.ts`

### Capability HTTP client

`packages/ai/src/lib/lovsen-client.ts` — typed wrappers around `fetch()`. Returns ADR-0256 Citation envelope shapes (already defined). Validates responses with Zod at the client boundary. Does NOT contain any regulatory logic — it is a typed HTTP adapter.

### MCP subprocess management (V1)

BFF spawns the Python MCP process per request using Node `child_process.spawn()`. Cold start approximately 500 ms. Acceptable at bootstrap time (workspace session init) — this is not called during `evaluateSupplements()` calc-time. A persistent MCP daemon (subprocess pool) is a Phase 7e+ optimization; V1 is spawn-per-request.

24 h cache at BFF level (keyed on `(mcp_name, method, args_hash)`) mirrors the MCP 24 h freshness window. Cache avoids repeated spawns within a session.

### Authority and auth

Bridge routes are read-only from Lovsen. They do NOT require `gate_action` (per ADR-0099 — gate is for mutations). Capability layer JWT is propagated through the BFF via `Authorization: Bearer <jwt>` header. BFF validates JWT server-side before spawning MCP. No anonymous access to bridge routes.

Writes triggered by Lovsen data (e.g., storing a fetched citation in the database) happen on the capability tool side via `gatedMutation` per ADR-0204. The bridge itself never writes.

### Telemetry

Bridge fires `lovsen.bridge.fetched` event with payload:

```typescript
{
  mcp_name: string;          // "lovsen-lovdata-mcp" | "lovsen-nho-reiseliv-mcp"
  method: string;            // "fetch_riksavtalen_paragraph" | "derive_supplement_set" | ...
  latency_ms: number;
  cache_hit: boolean;
  workspace_id: string;
}
```

Register in `packages/telemetry/src/registry.ts` (Phase 7e). Telemetry destination: PostHog (analytics) + Logger (stdout). Does NOT route to `activity_trail` (non-mutation, no audit obligation).

---

## Implementation gates (Phase 7e)

| Task | Deliverable |
|---|---|
| T1 | Build `packages/ai/src/lib/lovsen-client.ts` — typed wrappers + Zod response validation |
| T2 | Build `POST /api/lovsen/fetch-riksavtalen-paragraph/route.ts` — spawn Python MCP, marshal stdio JSON-RPC, 24 h cache |
| T3 | Build `POST /api/lovsen/derive-supplement-set/route.ts` — same pattern, depends on ADR-0352 MCP contract |
| T4 | Register `lovsen.bridge.fetched` telemetry event in registry.ts |
| T5 | Integration test: capability tool calls `lovsenClient.fetchRiksavtalenParagraph()` → BFF → MCP (fixture mode) → returns Citation with ADR-0256 envelope |
| T6 | Cache layer at BFF: 24 h TTL per `(mcp_name, method, stableArgsHash)` |

Fixture mode: BFF must forward `LOVSEN_FIXTURE_MODE=true` to MCP subprocess when environment variable is set. This preserves ADR-0258 fixture determinism through the bridge layer.

---

## Open questions

| Question | V1 resolution |
|---|---|
| Subprocess pool vs spawn-per-request | V1 = spawn-per-request; tune in Phase 7e+ based on measured bootstrap frequency |
| MCP call timeout | Default 30 s per call; BFF returns 504 on timeout |
| MCP crash recovery | BFF catches spawn errors; returns typed error response to capability client; capability tool logs + returns fallback (fixture-mode values if available) |
| `verify-citation-freshness` cron consumer | Phase 7e+ — cron calls BFF directly (not via capability tool); same auth pattern |

---

## Rules & Consequences

- **Good, because** preserves the ADR-0258 boundary: all Lovdata fetch logic stays in Python MCP, TypeScript never duplicates regulatory retrieval. BFF pattern is already established for payroll — no new infrastructure required. Capability tools gain a typed, cached, observable path to Lovsen data.
- **Good, because** subprocess management is isolated in the BFF layer, not scattered across capability tools. Cache hits prevent repeated cold starts within a workspace session.
- **Bad, because** spawn-per-request adds ~500 ms latency to first bootstrap call (mitigated by 24 h cache; acceptable since this is workspace-init time, not calc-time).
- **Bad, because** BFF surface expands by one route per MCP method. Each new Lovsen MCP tool requires a companion BFF route. This is intentional and bounded — the bridge is narrow by design.
- **Agent Impact:** Capability tools that need Lovsen data MUST call `lovsenClient.*` from `packages/ai/src/lib/lovsen-client.ts` — never spawn Python directly, never duplicate Lovdata HTTP fetch logic in TypeScript. Document in CLAUDE.md: "Capability HTTP calls allowed only for Lovsen bridge via `lovsen-client.ts`." New Lovsen MCP methods require a companion BFF route before capability tools can consume them.

---

## References

- [ADR-0258](0258-lovsen-mcp-scraping-boundary.md) — Python MCP boundary (scraping logic stays in Python)
- [ADR-0265](0265-enforced-deployment-pipeline.md) — Deployment pipeline + BFF surface conventions
- [ADR-0204](0204-gated-mutations.md) — gatedMutation pattern (writes require gate; bridge is read-only)
- [ADR-0256](0256-lovsen-citation-envelope.md) — Citation envelope shape returned by MCP tools
- [ADR-0342](0342-lovsen-mcp-freshness-verification-tool.md) — `verify_citation_freshness` MCP contract
- [ADR-0347](0347-lovdata-canonical-source-for-riksavtalen.md) — Lovdata as K1a canonical source
- [ADR-0351](0351-workspace-supplement-policy.md) — Companion: workspace supplement policy (tariff floor)
- [ADR-0352](0352-derive-supplement-set-mcp-contract.md) — Companion: `derive_supplement_set` MCP contract
- [ADR-0353](0353-workspace-framework-binding-bootstrap.md) — Companion: workspace framework binding bootstrap
- [ADR-0354](0354-snapshot-freshness-staleness-ops.md) — Companion: snapshot freshness/staleness ops
