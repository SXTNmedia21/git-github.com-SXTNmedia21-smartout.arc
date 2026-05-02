---
title: "Journey-Authoring Capability — Wizard via Stage Engine"
id: ADR_0239
status: accepted
layer: decision
created: 2026-04-29
updated: 2026-04-29
accepted: 2026-04-29
module: journey-engine
tags: [capability, stage-engine, journey, authoring, wizard, adr-0132, adr-0173]
---

# ADR-0239: Journey-Authoring Capability — Wizard via Stage Engine

## Context and Problem Statement

`apps/web/src/app/api/journey-agent/route.ts` calls `runJourneyAgent` → `generateText` directly
against OpenRouter, bypassing stage-engine entirely. This creates five concrete violations:

1. **ADR-0132** — all AI traffic must route `web BFF → stage-engine`, not raw model calls from
   a Next.js route handler.
2. **ADR-0078** — channel-security enforcement requires tool `ctx.channel`; the standalone agent
   has no channel context, so the chat-only restriction on authoring mutations is unenforceable.
3. **ADR-0099** — `gate_action` must wrap every mutation; `save_draft` calls `gatedMutation`
   referencing `capability="journey_wizard"`, which is not registered in `engine_authority_config`.
   The `gate_action` function default-allows any unregistered capability (L-0066 CVE-class),
   meaning the mutation silently passes with no authority record.
4. **ADR-0173** — the existing `journey` capability is frozen at exactly 4 tools (`run_dev`,
   `run_guided`, `publish_mission`, `publish_guide`). Wizard authoring tools cannot be added there
   without violating the frozen-4 rule.
5. **smartout-agent-dev guide** — every capability lives in `packages/ai/src/capabilities/`.
   The standalone `packages/ai/src/agents/journey.ts` is not a registered capability and therefore
   receives no intent classification, no telemetry, no memory integration, and no prompt caching.

Observed symptoms:
- `save_draft` persists empty `wizard_session` rows to DB (capability unregistered → gate
  default-allows → no authority record → tool body errors silently).
- The 6-phase wizard system prompt is hardcoded in `agents/journey.ts` rather than being
  a prime context injection on a registered capability — unkillable without a code deploy.
- No streaming, no telemetry emit, no PostHog tracking for any wizard interaction.
- ADR-0222 boundary: wizard `save_draft` writes `wizard_session` (runtime mutation). This is
  capability territory, not skill-op territory (skill ops are documentation-only per ADR-0222).

## Decision Drivers

- ADR-0132: BFF → stage-engine is mandatory for all AI traffic; no exceptions for "simple" agents.
- ADR-0078: chat-only restriction on PII and authoring mutations requires `ctx.channel` which only
  stage-engine provides.
- ADR-0099: `gate_action` audit chain requires the capability to be registered in
  `engine_authority_config` before tools run; default-allow is CVE-class (L-0066, L-0097).
- ADR-0173: `journey` capability is frozen at 4 tools — no 5th tool may be added; wizard authoring
  needs a separate capability registration.
- ADR-0222: wizard `save_draft`, `check_duplicates`, `lookup_journeys` all mutate or query
  workspace-scoped data — these are capability tools, not skill-ops.
- smartout-agent-dev guide: capability-per-domain pattern; standalone agents outside this pattern
  are architectural debt.

## Considered Options

**Option 1 — Add wizard tools to the existing `journey` capability.**
Rejected: violates ADR-0173 frozen-4 count. Mixing authoring (wizard state, draft management) with
runtime (guided execution, publishing) in the same capability also blurs separation of concerns.

**Option 2 — Keep standalone `journey-agent`, fix only the `save_draft` FK and
`engine_authority_config` seed.**
Rejected: fixing the symptom (missing seed row) without addressing the architectural violation
compounds the debt. ADR-0132 + ADR-0078 channel guard remain broken. No telemetry. No prompt
caching. Every future wizard tool lands in the standalone pattern.

**Option 3 — New `journey_authoring` capability + delete standalone agent.**
Chosen. All wizard tools migrate into a registered capability. The standalone route handler and
agent file are deleted. The 6-phase system prompt becomes the capability prime context (hot-swap
without deploy). Stage-engine intent classifier routes `journey-authoring` intents.

## Decision Outcome

Create a new capability `journey_authoring` with 4 tools (amended 2026-04-29 per Council R1
Phase 8 — original ADR Decision Outcome listed 3, implementation shipped with `publish_draft` as a
4th tool but the ADR table was not updated. ADR-0240 governs `publish_draft`'s gate boundary and
delegation pattern):

| Tool | Description | Mutation? |
|------|-------------|-----------|
| `save_draft` | Upsert `wizard_session` row for in-progress journey authoring | Yes — `gatedMutation` required |
| `check_duplicates` | Query `engine_missions` for slug/title collision before finalising | No — read-only |
| `lookup_journeys` | List existing missions with status for reference during authoring | No — read-only |
| `publish_draft` | Finalise wizard draft → `journey` + `journey_version` rows | Yes — MUST delegate to `journey.publish_mission` per ADR-0240 (frozen-4 boundary). Currently UNREGISTERED in production until ADR-0240 Phase 1 lands. |

Routing changes:
- Wizard UI sends chat requests to `/api/emma/chat` with `mission="journey_authoring"`.
- Stage-engine intent classifier adds `journey-authoring` intent label.
- The 6-phase wizard prompt becomes the capability's prime context injection, mirroring the
  `contract_intake` mission pattern.

Authority:
- `engine_authority_config` seeded via `20260429000000_seed_journey_authoring_authority.sql`
  (this migration, same PR as capability registration — prevents CVE-class gap per L-0097).
- Default: `level=autonomous` for `owner` + `admin`. Journey authoring is a platform-admin
  authoring surface; manager/employee have no authoring rights.
- Default: `level=disabled` for `manager` + `employee`.

Standalone agent files deleted:
- `apps/web/src/app/api/journey-agent/route.ts`
- `packages/ai/src/agents/journey.ts`

## Rules & Consequences

- **Good:** Removes ADR-0132 violation; wizard interactions now route through stage-engine and
  are telemetry-emitting, gate-audited, and channel-guarded.
- **Good:** ADR-0173 frozen-4 preserved — `journey` capability is untouched.
- **Good:** ADR-0222 boundary enforced — authoring mutations live in a capability, not a skill-op.
- **Good:** 6-phase wizard prompt becomes prime context on the capability — hot-swappable without
  a code deploy.
- **Good:** `save_draft` authority gap (L-0066 default-allow) is closed by seeding
  `engine_authority_config` before capability registration lands.
- **Bad:** Requires migrating 3 tools + wiring intent classifier label in stage-engine + updating
  wizard UI call site from `/api/journey-agent` → `/api/emma/chat`.
- **Agent Impact:** Future wizard/authoring tools (e.g. `discard_draft`, `lock_for_review`) MUST
  land in `journey_authoring` capability — never in a standalone agent file.

## Phase 2 — Full Pipe Closure (2026-04-29)

Phase 1 (commit `c1dedcc6`) shipped capability registration + intent classifier
+ BFF mission handling. A subsequent harness audit (system-agent-coordinator)
identified two HARD BLOCKERS that prevented the pipe from running end-to-end.
Phase 2 (commit `ef955ea3`) closes both.

### I1 — `ctx.sessionId` mismatch

Stage-engine creates a fresh `engine_sessions` row per agent turn and threads
its `id` as `ctx.sessionId`. The Phase-1 `save_draft` tool wrote to
`wizard_session.wizard_session_id` using that mismatched id — a silent UPDATE
no-op (zero-row UPDATE returns no error in PostgREST). Wizard UI appeared
functional but `wizard_session.draft_journey` stayed `{}` after every phase.

**Fix:** add `wizardSessionId?: string` to `AgentToolContext`. Threaded:

```
wizard URL :sessionId
  → wizard-chat.tsx posts `wizardSessionId` field on every turn
  → /api/emma/chat BFF accepts `wizardSessionId` schema field
  → forwards as `wizard_session_id` to stage-engine /agent/chat
  → stage-engine schema accepts `wizard_session_id` field
  → routeAgentMessage() takes `wizardSessionId` arg
  → builds toolContext with wizardSessionId
  → save_draft + publish_draft READ ctx.wizardSessionId only,
    fail-fast if missing (no fallback to ctx.sessionId)
```

### I2 — No publish handoff

`journey.publish_mission` (frozen-4, ADR-0173) takes `journey_version_id`
(UUID) and reads `journey_version.ir_json` (v2.1 IR). The wizard had only
`wizard_session.draft_journey` (free-form JSONB). No code path connected
them.

**Fix:** add `publish_draft` tool to `journey_authoring` capability. Review-
phase only, requires explicit `confirm: true`. Reads
`wizard_session.draft_journey`, transforms to v2.1 JourneyIR, inserts
`journey` row + `journey_version` row, marks wizard_session completed,
returns `journey_version_id`. Agent then chains into
`journey.publish_mission(journey_version_id)` — frozen-4 untouched.

### Sequence diagram

```
Wizard UI (chat textarea)
  │ user types message
  │ POST { workspaceId, userMessage, sessionId, wizardSessionId, mission="journey_authoring" }
  ▼
/api/emma/chat (apps/web BFF)
  │ verifies auth (cookie or Bearer per ADR-0132)
  │ resolves profile_id (server-derived per ADR-0151)
  │ prepends prime context on first turn (mission=journey_authoring block)
  │ POST { message, session_id, profile_id, channel="chat", wizard_session_id, user_jwt }
  ▼
stage-engine /agent/chat (services/stage-engine)
  │ verifies workspace context
  │ creates/loads engine_sessions row (id ≠ wizardSessionId — distinct)
  │ calls routeAgentMessage with wizardSessionId
  ▼
agent-router.ts → routeAgentMessage()
  │ loadAuthorityConfig(workspaceId)
  │ classifyIntent(message) → "journey_authoring"
  │ selectTools(intent, authority, channel="chat")
  │ builds toolContext { ..., sessionId, wizardSessionId, channel="chat" }
  │ generateText(model, system, tools, messages)
  ▼
LLM picks tools per phase:
  - Phases 1-5     → save_draft({ draft, next_phase })
  - Classification → check_duplicates({ title, module, actor })
  - Discovery      → lookup_journeys({ keyword })
  - Phase 6        → publish_draft({ confirm: true })   [Review-only]
  ▼
journey_authoring tools execute (each routes through gatedMutation):
  save_draft:
    │ guards: workspaceId, profileId, wizardSessionId
    │ gatedMutation(supabaseAdmin, { capability="journey_authoring",
    │              entity_id=wizardSessionId, action_type="advance_phase" })
    │ UPDATE wizard_session SET draft_journey, current_phase
    │   WHERE wizard_session_id = wizardSessionId
  publish_draft:
    │ guards: confirm=true, workspaceId, profileId, wizardSessionId
    │ reads wizard_session.draft_journey
    │ validates required fields (title, module, actor, platform, steps)
    │ builds v2.1 JourneyIR (synthetic step keys, bounded weights)
    │ INSERT journey (status=ready_test)
    │ INSERT journey_version (ir_json, status=ready_test, version_number=1)
    │ UPDATE wizard_session SET status=completed
    │ returns journey_version_id for chaining
  ▼
Agent chains (next turn):
  publish_mission({ journey_version_id })          [ADR-0173 frozen-4 — UNTOUCHED]
    │ validateV21IrForMission(ir_json)
    │ callGateAction(capability="journey.publish_mission")
    │ INSERT engine_missions (id="journey_<slug>_v1", is_active=false per ADR-0194)
    │ INSERT engine_stages (1 row per IR step)
    │ emit("journey run_started")
  ▼
Mission ready for activation.
Activation = separate enrich + activate flow per ADR-0194 (out of scope here).
```

### Phase 2 file map

| File | Change |
|---|---|
| `packages/ai/src/capabilities/types.ts` | `AgentToolContext.wizardSessionId?: string` |
| `services/stage-engine/src/routes/agent/chat.ts` | schema accepts `wizard_session_id` |
| `services/stage-engine/src/core/agent-router.ts` | `AgentRouterInput.wizardSessionId` threaded to toolContext |
| `apps/web/src/app/api/emma/chat/route.ts` | BFF schema + forward to stage-engine |
| `apps/web/src/app/platform-admin/journeys/wizard/[sessionId]/_components/wizard-chat.tsx` | UI sends wizardSessionId every turn |
| `packages/ai/src/capabilities/journey-authoring/tools.ts` | save_draft requires wizardSessionId + new publish_draft tool |
| `packages/ai/src/capabilities/journey-authoring/index.ts` | publishDraftTool added to tools + suggestTools |
| `packages/telemetry/src/registry.ts` | `journey_authoring phase_advanced` + `journey_authoring journey_published` events registered |
| `docs/journeys/platform-admin-authors-journey/` | 13-file protocol package materialized |

## Open items / Phase 3

- **Authority dotted-key fallback:** seed migration uses
  `journey_authoring` (autonomous for owner+admin) and
  `journey_authoring.employee` (disabled for manager+employee). Verify
  whether `gate_action` RPC matches the dotted key when intent classifier
  emits the base capability name. If not, the manager+employee rows are
  dead seed data.
- **Per-stage tool subset:** stage-engine MISSION mode currently
  inherits the capability's full tool set per turn. `engine_stages.deferred_templates`
  JSONB exists but no consumer wires it. Per-stage tool gating is a future
  enhancement (not blocking this ADR).
- **Mission activation:** `engine_missions.is_active=false` on insert
  (ADR-0194). Activation is out of scope here; tracked under separate
  enrich + activate flow.
- **Integration test:** scaffold lives at
  `docs/journeys/platform-admin-authors-journey/e2e.spec.ts`. Real
  Playwright integration deferred to Phase 4.

## References

- ADR-0132 — Mobile thin client → web BFF → stage-engine (all AI traffic)
- ADR-0173 — `journey` capability frozen at 4 tools
- ADR-0194 — engine_missions is_active=false at publish; enrich before activate
- ADR-0222 — Skill-ops are not capabilities (boundary rule)
- ADR-0078 — Channel security (chat-only enforcement for mutations)
- ADR-0099 — `gate_action` on every mutation
- ADR-0134 — non-empty workspace_id + actor_id (telemetry contract)
- ADR-0176 — Authority config is migration-only
- ADR-0204 — `gatedMutation()` Pathway A + B
- L-0066 / L-0097 — `gate_action` default-allow CVE-class
- `packages/ai/src/capabilities/journey-authoring/` — new capability
- `supabase/migrations/20260519100002_seed_journey_authoring_authority.sql` — authority seed
- `docs/journeys/platform-admin-authors-journey/` — meta-journey protocol package
