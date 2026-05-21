---
title: P3 botsson-context publish — L-0233 proof
status: done
created: 2026-05-20
updated: 2026-05-20
module: mobile-voice-runtime-wire
tags: [proof, l-0233, voice-agent, mobile, livekit]
---

# P3-VERIFY — L-0233 proof: mobile publishes botsson-context, voice-agent consumes

Scope: P3 of `feat/mobile-voice-runtime-wire`. Commit under inspection: `be6c825dd
feat(mobile-voice): publish botsson-context on LiveKit data channel at session start`.

## Verdict

**PASS** — both producer and consumer halves of the LiveKit `botsson-context`
data-channel contract are exercised by automated tests against the actual P3 code.

## Proof path

Path B + Path C combined (Path A — docker integration — infeasible in this
worktree without bringing up stage-engine + voice-agent + LiveKit dev cluster).

| Path | File | What it proves | Result |
|------|------|----------------|--------|
| C — producer | `apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts` | `publishBotssonContext` calls `room.localParticipant.publishData` exactly once with topic="botsson-context", reliable=true, and a UTF-8 JSON payload that satisfies the consumer discriminant (`type === "context_init"` + user + workspace + workforce). Retry-once back-off on first failure. Failure result shape on double-failure. | **4/4 PASS** |
| B — consumer | `services/voice-agent/__tests__/context.test.ts` | `parseContextPayload` accepts the mobile-shaped payload, `setSessionContext` stores it, and `getSessionContextSnapshot()` returns non-null `user`/`workspace`/`workforce`. Topic guard rejects payloads on other topics. Malformed JSON does not throw into the agent event loop. Unknown `type` discriminant returns null. `workforce` optional. | **5/5 PASS** |

## Run output

### Producer (mobile, jest)

```
$ pnpm --filter @smartout/mobile test -- --testPathPattern=livekit-data-publish
PASS src/lib/__tests__/livekit-data-publish.test.ts
  publishBotssonContext (L-0233 producer half)
    ✓ publishes exactly once on success with correct topic + reliable flag
    ✓ retries once after a 500ms back-off when the first publishData throws
    ✓ returns failure when both attempts throw and never makes a third attempt
    ✓ publishes with workforce omitted when caller passes undefined

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

### Consumer (voice-agent, vitest)

```
$ pnpm --filter @smartout/voice-agent test -- __tests__/context.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

## Shape contract — producer ↔ consumer alignment

Mobile (`apps/mobile/src/lib/livekit-data-publish.ts:37-42`):

```ts
export type BotssonContextInitPayload = {
  type: "context_init";
  user: Record<string, unknown>;
  workspace: Record<string, unknown>;
  workforce?: Record<string, unknown>;
};
```

Voice-agent (`services/voice-agent/src/context.ts:100-105`):

```ts
type ContextInitMessage = {
  type: "context_init";
  user: UserContext;
  workspace: WorkspaceContext;
  workforce?: WorkforceContext;
};
```

The discriminant (`type === "context_init"`) is the only thing
`parseContextPayload` enforces at runtime — the inner shapes are accepted as
opaque. Mobile-side typing is intentionally loose (`Record<string, unknown>`) so
mobile owns the shape; voice-agent never validates structure, it stores what
arrives. Round-trip test `round-trips a mobile-shaped context_init through
parse → set → snapshot` in `context.test.ts` confirms that the strongly-typed
voice-agent reads back the mobile-published payload correctly.

## Telemetry verification

`voice.bootstrap.snapshot_published` is registered in
`packages/telemetry/src/registry.ts:5077-5092` (interface) and routed to
posthog + logger + activity_trail in `registry.ts:14704-14707`. Emit site lives
in the module-private `publishSnapshotToRoom` function at
`apps/mobile/src/hooks/use-botsson-voice-session.ts:701-714`.

`publishSnapshotToRoom` is **not exported** from the hook module, so it is not
unit-tested directly here. The producer test exercises `publishBotssonContext`
(the inner call) which carries `payload_bytes` + `latency_ms` + `attempts` on
the result — the exact values `publishSnapshotToRoom` then forwards to the
emit payload. The L-0177 fail-fast (`getProfileContext()` throw → skip
telemetry but never abort publish) is documented in the calling code; the
test does not exercise that pathway because the function is module-private.

## CRITICAL findings (bugs surfaced in P3 production code)

1. **P3 builder's existing test file is broken** —
   `apps/mobile/src/hooks/__tests__/use-voice-transcripts-snapshot.test.ts:24`
   imports from `"vitest"`, but the mobile workspace uses **jest**. The test
   never executes — jest reports `Vitest cannot be imported in a CommonJS
   module using require()`. Mobile typecheck also surfaces it as TS2307. The
   four assertions claimed by the P3 commit message (inline payload, payload_url
   GET, no snapshot on warm turn, 404 swallowed) are unverified. **Not
   patched in this sortie — surfaced for P3 builder follow-up.**

2. **`publishSnapshotToRoom` is module-private** in
   `apps/mobile/src/hooks/use-botsson-voice-session.ts:679`. Direct producer
   testing of the snapshot → publish boundary (the function that maps
   `ResolvedSnapshot` → `BotssonContextInitPayload` and emits telemetry) is
   blocked behind that boundary. The dispatch contract said to STOP-and-report
   rather than patch the export. Producer-half rigor is at the
   `publishBotssonContext` layer (one call inside `publishSnapshotToRoom`), so
   the topic + reliable + payload-shape contract is fully proved; the
   ResolvedSnapshot → BotssonContextInitPayload mapping (`snapshot.payload.user`
   → `payload.user` etc., lines 686-691) is unit-uncovered.

## Open questions for P4 dispatch

- Should `publishSnapshotToRoom` be exported to enable direct unit testing
  of the snapshot → payload mapping + telemetry emit? Trade-off: export
  widens the module API surface vs. testability gain.
- The broken `use-voice-transcripts-snapshot.test.ts` file should be rewritten
  to jest APIs or moved into a vitest-running package. P3 builder should
  decide which fixture path matches the intent — almost certainly jest, since
  the test exercises `useVoiceTranscripts` which lives under `apps/mobile`.
- voice-agent `voice-tool-resolver.test.ts` fails on pre-existing missing
  `@smartout/ai/harness` export — unrelated to L-0233 but blocks the
  voice-agent suite from reporting "all green". Unblocking it requires
  `pnpm --filter @smartout/ai build` (per L-stage_engine_subpath_imports).

## Artefacts

- Test source: `apps/mobile/src/lib/__tests__/livekit-data-publish.test.ts`
- Test source: `services/voice-agent/__tests__/context.test.ts`
- This file: `docs/proofs/P3-context-publish-proof.md`

## L-0233 closure status

L-0233 ("Two LLM contexts — voice-agent setSessionContext must fire for mobile
sessions"). With this proof:

- Mobile reliably publishes `botsson-context` with the correct envelope
  whenever `publishBotssonContext` is called (verified by Path C).
- Voice-agent parses that exact envelope and exposes it via
  `getSessionContextSnapshot()` (verified by Path B).

What is NOT closed by this proof:

- The producer half is at the `publishBotssonContext` layer. The chain from
  `RoomEvent.Connected` → `publishSnapshotToRoom` → `publishBotssonContext`
  is read-only verified (code inspection), not test-verified. Risk surface: the
  `snapshot.payload["user"] ?? {}` defaults at
  `use-botsson-voice-session.ts:688-690` could feed an empty object into
  voice-agent, where `setSessionContext` would set `_user` to `{}` and
  `snapshot.user` would be truthy but useless. The voice-agent's
  `setSessionContext` does no shape validation. Recommend a future test (when
  `publishSnapshotToRoom` is exportable) asserting the snapshot → payload
  mapping handles a missing `payload.user` field correctly.

Refs P3 commit `be6c825dd`, L-0233 (two LLM contexts), ADR-0297 (workforce
bootstrap pipe).
