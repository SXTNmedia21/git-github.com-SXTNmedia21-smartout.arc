---
title: ADR-0117 — Authority Model after Phase 4 (Single Source via gate_action)
status: accepted
created: 2026-04-16
updated: 2026-04-16
module: ai-agent
tags: [adr, authority, governance, gate-action, agent-router]
---

# ADR-0117 — Authority Model after Phase 4 (Single Source via gate_action)

## Context

Council 2026-04-16 R2 review (see `docs/council/COUNCIL-LOG.md`) flagged that Phase 4 of the Botsson Observability Foundation removed `applyMinRoleDowngrade` from `services/stage-engine/src/core/agent-router.ts` without a governing ADR. Since this removed a governance defence primitive, it must be documented.

Previously the router executed TWO authority decisions per turn:
1. `gate_action` RPC (authoritative per ADR-0099) — returns `{ allow, downgrade_to, reason, gate_evaluation_id }` for the matched capability
2. `applyMinRoleDowngrade` over the full advisory `authorityConfig` map — downgraded all capabilities the actor's role didn't satisfy

Phase 4 (commit `b4857384`) removed step 2. `gate.downgrade_to` is now applied ONLY to `intent.capability`; other capabilities retain their workspace-advisory levels.

## Decision

`gate_action` is the single source of authority decisions per agent turn. `applyMinRoleDowngrade` is deprecated from the runtime path. `rawAuthority.minRoles` is retained but unread (Phase 4 cleanup is a follow-up).

## Consequences

**Positive:**
- Single authority oracle — no double-decision
- `gate_evaluation_id` is the only audit trail for the decision
- Fewer RPC-adjacent re-derivations per turn (remove ~10 LOC)

**Negative — latent leak on low-confidence classifier fallback:**
- `packages/ai/src/router/tool-selector.ts:67-78` iterates ALL capabilities when `intent.confidence < 0.7 || intent.capability === "general"`, using advisory levels without per-capability `gate_action` calls
- Pre-existing design (not introduced by Phase 4), but Phase 4 removed the min-role-downgrade defence that was catching it
- Mitigation: fallback branch restricts to `read_only` tools only, and no tool in that branch can mutate without its own capability-level gate

**Neutral:**
- `services/stage-engine/src/core/authority.ts` still populates `minRoles` — dead field post-Phase 4. Cleanup in Phase 7 sweep.

## Scope

Affects `services/stage-engine/src/core/agent-router.ts` authority resolution. Does NOT affect `gate_action` RPC itself (ADR-0099 authoritative) or per-capability emit paths (ADR-0116).

## Related

- Builds on: ADR-0099 (Unified Authority Gate — gate_action RPC)
- Amends: ADR-0116 (Runtime Telemetry Standard — Phase 4 clarifies C4 authority flow)
- Follow-up: remove unread `minRoles` field in agent-router.ts authority config, and either restrict low-confidence fallback to `read_only` OR run `gate_action` per capability in the fallback branch
