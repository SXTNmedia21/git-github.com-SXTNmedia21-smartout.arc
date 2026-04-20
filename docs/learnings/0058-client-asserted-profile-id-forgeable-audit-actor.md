---
title: "`agent-router` forwards `profile_id` from request body without `auth.uid()` verification"
id: LEARNING_0058
status: canonical
layer: learning
created: 2026-04-18
updated: 2026-04-18
tags: [security, audit, forgeable, stage-engine, capability, non-repudiation]
---

# Learning-0058: `agent-router` forwards `profile_id` from request body without `auth.uid()` verification

## Context

Gate-Client Wave 2 council (2026-04-18). While the original migration scope
would have expanded capability tools into the `cascade_gate_write` path
(Wave 2B), general-purpose fact-check traced the identity flow from HTTP
request → capability tool → audit table. The trace revealed a pre-existing
security vulnerability in the stage-engine, unrelated to gate migration but
amplified by it.

`services/stage-engine/src/routes/agent/chat.ts:33` accepts `profile_id` from
the request body:

```ts
const { profile_id, workspace_id, ... } = await c.req.json();
```

`services/stage-engine/src/agent-router.ts:207-216` forwards `profile_id`
verbatim into `toolContext.profileId` without any verification against
`auth.uid()` or the signed session. `assert_gate_caller()` (the Postgres
function that gates service-role writes) checks for non-null actor but does
not verify that the supplied `profile_id` belongs to the authenticated user.

## Discovery

A compromised or malicious client can supply ANY `profile_id` in the
request body. That value becomes the `actor_id` in:

- `activity_trail` (audit trail — now records actions against spoofed actor);
- `change_proposal.proposed_by` (governance — proposals appear to come from
  arbitrary profiles);
- `gate_evaluation.actor_id` (authority audit — who was "asked" for the gate).

**This is a forgeable audit actor vulnerability.** Pre-existing; not
introduced by gate migration. But the gate migration AMPLIFIES blast
radius because more write paths now produce audited trails under the
spoofable actor. Every capability tool migrated into the gate path inherits
this forgeability.

The vulnerability destroys the non-repudiation property of `activity_trail`.
A workspace admin reviewing `change_proposal` rows cannot trust
`proposed_by` to identify the real proposer. A compliance review cannot
trust the audit log for any action that flowed through the stage-engine.

## Impact

**Fix pattern:** Any capability tool context carrying an identity field
MUST verify it against a signed session. Resolve `profile_id` server-side
from `auth.uid()` → `profile.user_identity_id` FK lookup. NEVER accept
`profile_id` from the request body.

**For this specific case:** Wave 2B (capability gate migration) is blocked
on an ADR that formalizes:

- (a) Identity resolution in `agent-router.ts` MUST be server-side from
  JWT claims, not from request body.
- (b) Any request body field named `profile_id`, `actor_id`, or similar
  identity claim should be removed from the schema entirely — if it cannot
  be removed, it must be rejected at the edge (Zod schema refuses, or
  middleware strips).
- (c) An edge-function test proves that spoofed `profile_id` in the body
  is ignored and the server-resolved value wins.

**For security review process:** Add "identity claim origin" to the
checklist. For every endpoint that writes to an audit-tracked table, trace
where the actor value came from. Request body = finding. JWT-resolved =
pass. No exceptions.

**For documentation:** `smartout-edge-function-guide` skill gains a hard
rule: server-resolve all identity claims. Client-asserted identity is a
security vulnerability, not a convenience feature.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-18 (Gate-Client Wave 2)
- Affected file: `services/stage-engine/src/routes/agent/chat.ts:33`
- Affected file: `services/stage-engine/src/agent-router.ts:207-216`
- Related: Learning 0045 (emit() payload broken — similar class: audit tables populated with wrong/missing actor)
- Related: Learning 0047 (channel security needs tool execution path — similar "defense exists but can be bypassed" shape)
- Related: ADR-0078 (channel restriction — another enforcement layer that needs a verified actor to work)
- Cascade Invariant 8: provenance must identify the real actor.
