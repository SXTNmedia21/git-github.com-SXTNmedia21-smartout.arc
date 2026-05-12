---
title: "Dual-emit capability tool + BFF route — F-CT-01 5th occurrence"
id: LEARNING_0234
status: canonical
layer: learning
created: 2026-05-12
updated: 2026-05-12
tags: [emit, telemetry, dual-emit, f-ct-01, capability-tools, bff-routes, payroll]
---

# Learning-0234: Dual-emit capability tool + BFF route is recurring (F-CT-01)

## Context

Day-3 payroll period_locked notification handler council session 2026-05-12 surfaced that `packages/ai/src/capabilities/payroll/tools.ts:901-918` AND `apps/web/src/app/api/payroll/lock-period/route.ts:163-180` BOTH emit `payroll.period_locked` event. Different payload shapes:

| Field | `tools.ts:911-912` | `route.ts:175-177` |
|---|---|---|
| `profiles_count` | `0` (hardcoded) | real count via `payroll.calculation` distinct profile_id |
| `total_lines` | `0` (hardcoded) | real count from query |
| `gate_evaluation_id` | `gate.gateEvaluationId` | `null` |

Without subscriber fan-out (Phase 4 sortie), this dual-emit was latent: both went to PostHog + activity_trail but no consumer cared which was canonical. Once the Day-3 subscriber (engine_process listening on `payroll.period_locked`) ships, EVERY lock = 2 spawned states = N×2 notification_outbox rows = duplicate push notifications.

## Discovery

This is the **5th codified F-CT-01 occurrence** — pattern where a BFF route gets created that duplicates a capability tool's existing emit, but the capability emit is not retired:

1. Original F-CT-01 from cascade preview/apply (date TBD — see prior council log)
2. Onboarding workspace finalize
3. (Prior council — date TBD)
4. (Prior council — date TBD)
5. **Payroll period_locked Day-3 2026-05-12**

Pattern signature: capability tool ships first iteration with hardcoded/incomplete data fields. BFF route ships later with real data resolution. Author forgets to retire capability emit. Both emit-sites coexist invisibly until a downstream consumer (subscriber, fan-out handler, audit-driven query) reveals the divergence.

The tell: capability tool emit blocks with literal `0` values in numeric data fields ("profiles_count: 0, total_lines: 0"). Author knew the real data lived elsewhere — wrote zeros as placeholder, never wired the resolution path, but shipped the emit anyway. See L-0235 for the "hardcoded zeros is a tell" promotion.

## Impact

**Rule promotion:** When a BFF route is created that duplicates a capability tool's emit, the capability emit MUST be deleted in the same PR. Two emit-sites = two truths.

**CI grep check (proposed for `feat/gate-action-coverage-ci` sortie):**

```bash
# For every event name in registry.ts with destination 'engine_event':
# grep capability tool files for `event: "<name>"` AND
# grep app/api/**/route.ts files for `event: "<name>"`
# If BOTH match → flag as F-CT-01 candidate
```

**Manual review heuristic for code review:** When you see a capability tool's `emit()` block AND a route in `apps/web/src/app/api/**/route.ts` for the same domain operation, grep the event name in both files. Two matches = dual-emit smell.

**Resolution pattern for existing dual-emit:**
- Prefer killing capability emit when route emit has richer data (this case)
- Prefer killing route emit only if capability is the more-trafficked entry point (e.g. agent-driven domain)
- If both must coexist (e.g. different consumers): rename the events to disambiguate (e.g. `payroll.period_locked.from_route` vs `payroll.period_locked.from_capability`) and document in registry

**Day-3 sortie Amendment 2:** Delete capability emit at `tools.ts:901-918`. Make `lockPeriod` capability tool body invoke BFF route via internal HTTP, OR delete the emit-only block and let route be canonical. Route emit becomes single source of truth.

## References

- ADR-0297 — `notify_each_profile` dispatcher action_type (Day-3 verdict — blocks ship until dual-emit resolved)
- L-0235 — Hardcoded zeros in capability emit as tell (companion learning)
- Original F-CT-01 — see prior council log (cascade preview/apply session)
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-12 entry
