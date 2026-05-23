---
title: "Channel + Platform Descriptors on Tool Contract"
id: ADR_0399
status: proposed
layer: decision
created: 2026-05-23
updated: 2026-05-23
---

# ADR-0399: Channel + Platform Descriptors on Tool Contract

## Context and Problem Statement

Tool descriptors today lack a uniform way to declare the channels (chat/voice) and platforms (web/mobile) on which the tool is valid for invocation and result rendering. ADR-0078 (channel pinning) is enforced ad-hoc inside tool bodies (e.g. `approveShift` rejects voice at `shift-lifecycle/tools.ts:294`). ADR-0133 (web composes, mobile executes) is not encoded in any tool descriptor — there is no machine-checkable way to say "this tool's output renders on web only" vs "this tool's output renders on web and mobile." During the InlineConfirmCard council (ADR-0398), three reviewers proposed three different field shapes — a clear sign the contract needs to be settled now.

## Decision Drivers

- Tool authors must declare ADR-0078 channel scope at the descriptor level (not buried in tool body), so the harness can pre-filter tools by channel and the LLM never sees tools it cannot use.
- ADR-0133 mobile boundary must be machine-checkable on tool registration — `publish_announcement` (compose verb) should not even be exposed to a mobile chat surface; `approve_shift` (execute verb) should be exposed on both.
- BIR already uses `allowed_channels: SessionChannel[]` (`packages/ai/src/primitives/input-request/types.ts:104-105`) — convention should align.
- Result descriptors (InlineConfirmCardDescriptor per ADR-0398) also need channel/platform constraints — voice can never render a card, mobile cannot render compose-only cards.

## Considered Options

1. **Two-value enum `channel_constraint: "chat_only" | "any"`.** Too thin — cannot express "chat + telegram but not voice."
2. **`allowed_channels: SessionChannel[]` only (BIR pattern).** Solves the channel axis but ignores the orthogonal platform axis (ADR-0133).
3. **Two orthogonal array fields: `channel_constraint: ("chat"|"voice")[]` + `platforms: ("web"|"mobile")[]`.** Backward-compatible if defaults are sensible. Maps cleanly to ADR-0078 (channel pinning) and ADR-0133 (mobile boundary).
4. **Single combined enum `surface_target: "chat_web_only" | "chat_any_platform" | "voice_any" | ...`.** Combinatorial explosion; not extensible.

## Decision Outcome

Chosen option: **Option 3 — two orthogonal array fields.** Channel and platform are independent axes; encoding them separately preserves clarity and avoids enum bloat.

### Contract Additions (Phase 1)

Added to:
- `packages/ai/src/harness/types.ts` — tool descriptor base type.
- `packages/ai/src/primitives/inline-confirm-card/types.ts` — result descriptor (ADR-0398).
- `packages/ai/src/primitives/input-request/types.ts` — extended where `allowed_channels` already exists; `platforms` is the new addition.

```ts
type ToolSurfaceConstraints = {
  channel_constraint: ("chat" | "voice")[];          // defaults to ["chat", "voice"] (unconstrained)
  platforms: ("web" | "mobile")[];                   // defaults to ["web", "mobile"] (unconstrained)
};
```

### Per-Consumer Initial Values (Phase 1)

| Tool / surface | `channel_constraint` | `platforms` | Rationale |
|---|---|---|---|
| `publish_announcement` (compose verb, ADR-0133) | `["chat"]` | `["web"]` | PII-adjacent audience preview = chat-only per ADR-0078; compose verb = web-only per ADR-0133. |
| `send_message` (Phase 2) | `["chat"]` | `["web", "mobile"]` | Chat-only (voice already rejected at `tools.ts:165`); mobile parity required (D6 message-send is execute-side). |
| `approve_shift` (Phase 2) | `["chat"]` | `["web", "mobile"]` | Chat-only per existing `tools.ts:294`; execute verb = mobile included per ADR-0133. |
| `InlineConfirmCardDescriptor` (default) | inherits from emitting tool | inherits from emitting tool | Card descriptor inherits constraints from its parent tool. |
| `BIR / InputRequestDescriptor` | existing `allowed_channels` field | NEW: `platforms` field added with default `["web", "mobile"]` | Backward-compatible. |

### Enforcement Layers (defense-in-depth)

1. **Harness pre-filter (L4):** when stage-engine resolves the tool registry for a session, tools whose `channel_constraint` doesn't include the active channel OR whose `platforms` doesn't include the active platform are **stripped before the LLM ever sees them**. This is the primary defense (ADR-0078 layer).
2. **Tool-body guard (L4):** capability bodies retain channel check as belt-and-suspenders (`if (channel !== "chat") return "chat-only"`). Pattern from `approve_shift` line 294 stays. Both layers must agree.
3. **Result-descriptor guard (L3):** stage-engine inspects `client_tool_calls` before emitting to BFF — if the descriptor's `channel_constraint` or `platforms` excludes the active surface, the call is intercepted and replaced with a verbal-fallback text result (e.g. `voice_prompt` field per ADR-0398).
4. **Render-time guard (L1):** `BotssonChat` checks descriptor constraints before mounting card; mobile chat checks `platforms`. Bug-class defense — a misrouted descriptor renders nothing or shows fallback text rather than corrupted UI.

### Active Channel & Platform Resolution

- **Active channel** is already resolved in `agent-router.ts` per ADR-0078 (chat/voice/SMS pinning). No new resolution needed.
- **Active platform** is resolved server-side from request headers (`x-platform: web | mobile` set by the mobile BFF; absent = `web` default). Mobile chat sends `platforms: ["mobile"]` when registering its tool set; web chat sends `platforms: ["web"]`. The mobile BFF wrapper (`/api/emma/chat`) injects the header before forwarding to stage-engine.

### Mobile Carve-Out per ADR-0394

`publish_announcement` is **web-only** (`platforms: ["web"]`) regardless of the broader ADR-0394 mobile-camera-capture carve-out. ADR-0394 governs author-surface camera capture from mobile; it does NOT extend to general compose verbs. Reviewer escalation required if a future capability claims mobile authoring for compose verbs.

## Rules & Consequences

- **Good, because** ADR-0078 + ADR-0133 become machine-checkable rather than prose contracts repeatedly broken at tool-author time.
- **Good, because** stage-engine can strip tools BEFORE LLM sees them, eliminating the entire class of "LLM calls tool, gets channel rejection, dead-ends." LLM never sees inapplicable tools.
- **Good, because** result descriptors inherit constraints from their emitting tool, so card rendering follows tool reachability automatically.
- **Bad, because** every existing tool requires an explicit declaration (default-unconstrained behavior preserved by absent-field semantics — backward-compatible). Tool authors who skip the declaration get the lenient default; over time we may want to flip the default to "must declare" via lint rule.
- **Bad, because** the platform axis adds 2 enum values today (`web`, `mobile`) with no clean extension point if we add `desktop`/`tv`/`embedded` later. Mitigation: enum can grow; consumers must handle unknown values defensively.

### Agent Impact

- **Tool authors:** every new tool descriptor MUST declare `channel_constraint` + `platforms` explicitly (lint rule deferred to Phase 2). Existing tools migrate opportunistically — no big-bang rewrite required.
- **Harness maintainers:** filter logic added to `factory.ts` tool-resolution path. Filter is a pure function over (tool, channel, platform) → boolean.
- **Stage-engine maintainers:** result-descriptor inspection added to `agent-router.ts` client-tool emission path. Voice fallback uses `voice_prompt` field from ADR-0398; if absent, generic fallback text (`"Du har et nytt forslag til gjennomgang."`).
- **Mobile BFF:** `/api/emma/chat` (and Phase 2 mobile chat route) MUST inject `x-platform: mobile` header before forwarding. Web BFF does NOT inject `x-platform: web` — absent header defaults to web (one-way safe default).
- **Test authors:** for any tool/descriptor change, add a unit test for the filter (tool present in `["web","mobile"]` channels but absent from `["voice"]`-only channel set, etc.).

## Forbidden Patterns

- **NEVER** add `channel_constraint: "chat_only" | "any"` two-value enum to a new tool. Only `("chat"|"voice")[]` array shape.
- **NEVER** combine channel and platform into a single composite enum.
- **NEVER** rely solely on tool-body guard — harness pre-filter is mandatory primary defense.
- **NEVER** invent platform values outside `("web" | "mobile")` without amending this ADR.

## References

- ADR-0078 (channel pinning), ADR-0133 (mobile = execute), ADR-0134 (mobile telemetry), ADR-0238 (Botsson surface disambiguation), ADR-0394 (mobile camera capture carve-out), ADR-0398 (InlineConfirmCard companion).
- Code: `packages/ai/src/harness/types.ts`, `packages/ai/src/primitives/input-request/types.ts:104-105`, `packages/ai/src/capabilities/shift-lifecycle/tools.ts:294`, `packages/ai/src/capabilities/communication/tools.ts:165`, `services/stage-engine/src/core/agent-router.ts`, `apps/web/src/app/Botsson/_components/BotssonChat.tsx`.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
