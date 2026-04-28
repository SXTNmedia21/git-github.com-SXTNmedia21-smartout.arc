---
title: "Journey-Authoring Capability — Wizard via Stage Engine"
id: ADR_0226
status: accepted
layer: decision
created: 2026-04-29
updated: 2026-04-29
accepted: 2026-04-29
module: journey-engine
tags: [capability, stage-engine, journey, authoring, wizard, adr-0132, adr-0173]
---

# ADR-0226: Journey-Authoring Capability — Wizard via Stage Engine

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

Create a new capability `journey_authoring` with 3 tools:

| Tool | Description | Mutation? |
|------|-------------|-----------|
| `save_draft` | Upsert `wizard_session` row for in-progress journey authoring | Yes — `gatedMutation` required |
| `check_duplicates` | Query `engine_missions` for slug/title collision before finalising | No — read-only |
| `lookup_journeys` | List existing missions with status for reference during authoring | No — read-only |

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

## References

- ADR-0132 — Mobile thin client → web BFF → stage-engine (all AI traffic)
- ADR-0173 — `journey` capability frozen at 4 tools
- ADR-0222 — Skill-ops are not capabilities (boundary rule)
- ADR-0078 — Channel security (chat-only enforcement for mutations)
- ADR-0099 — `gate_action` on every mutation
- ADR-0176 — Authority config is migration-only
- L-0066 / L-0097 — `gate_action` default-allow CVE-class
- `packages/ai/src/capabilities/journey-authoring/` — new capability (created in same PR)
- `supabase/migrations/20260429000000_seed_journey_authoring_authority.sql` — authority seed
