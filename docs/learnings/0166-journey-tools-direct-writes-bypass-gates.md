---
title: "journey/tools.ts Has 7 Direct Writes Bypassing Both Gates"
id: LEARNING_0166
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [gate, capability, journey, audit-gap, adr-0091, adr-0099]
---

# Learning-0161: Direct-Write Sites in Capability Tools Bypass Both Gates

## Context

Supervisor Phase 3 review (2026-04-28 dual-gate reconciliation council) ran `grep -rn "\.from\(.*\)\.insert\|\.from\(.*\)\.update" packages/ai/src/capabilities apps/web/src/app/dashboard/*/_actions/`. Found **20 direct-write sites total**, including:

- `packages/ai/src/capabilities/journey/tools.ts:239,242,461,497,503,991,994` — 7 direct writes to `engine_state`, `engine_state_step`, `engine_missions`. **Both gates bypassed** despite `journey/gate.ts` existing.
- `packages/ai/src/capabilities/helpdesk_query/tools.ts:107` — direct `channel_member` insert.
- `apps/web/src/app/dashboard/komm/_actions/helpdesk-channel-actions.ts` — 5 direct `channel_*` writes via service-role admin client.
- `apps/web/src/app/dashboard/website/_actions/publish-actions.ts` — 3 direct `website_publish_event` inserts.

ESLint rule `smartout/no-direct-supabase-write` exists at `packages/eslint-config/plugins/smartout/rules/no-direct-supabase-write.mjs` on `warn` severity (wired in `base.mjs:36` + `next.mjs:16`). Companion rule `no-gated-write-in-capabilities` exists on `error` severity in `capabilities.mjs:24` (ADR-0190 Control 4) — but multiple sites slip through, suggesting the rule's targeting is incomplete.

## Discovery

The pattern is not "people forgot to call the gate" — it's "people authored writes against tables that the rule doesn't recognize as governance-affected". Examples:

- `engine_state` / `engine_state_step` writes in `journey/tools.ts` are workflow-internal and feel like "engine machinery", not domain mutations. ADR-0091 framework_trigger could match them, though.
- `channel_*` writes in helpdesk feel like "messaging infrastructure", not governance — but the helpdesk council (2026-04-19) explicitly wired `channel_event` + `channel_ai_policy` as governance surfaces.
- `website_publish_event` writes are audit-table inserts that may or may not need gate enforcement.

The lint rule's allowlist needs explicit governance-affected-table enumeration. Without it, every new domain table starts as ungated by default, and Phase 3 code-trace becomes the only safety net.

## Impact

1. **ADR-0091 violation pattern is recurring**: same class of bug as Wave 2A's `shift-lifecycle/tools.ts` direct-write finding (council 2026-04-18). 5th occurrence promotes this from advisory to **Phase 3 mandatory grep** in run-council SKILL.md (per Phase 9 Step 4 — promote pattern after 3+ recurrences).
2. **ADR-0229 Phase 0 backlog**: enumerate "governance-affected tables" explicitly in the ESLint rule config. Tables include (non-exhaustive): `schedule_shift`, `schedule_absence`, `engine_state`, `engine_state_step`, `engine_missions`, `season`, `season_budget`, `day_factor`, `hour_factor`, `employment_contract`, `profile`, `channel_event`, `channel_ai_policy`, `channel_member`, `website_publish_event`. Lint rule severity raised to `error` for all enumerated tables.
3. **Audit gap closure**: 20 direct-write sites tracked to closure as part of ADR-0229 Phase 0 deliverable. Each site either (a) gets gate enforcement or (b) gets explicit ADR exemption with rationale.
4. **Generalization**: any time a capability has a `gate.ts` file but `tools.ts` writes directly via `.from()`, that's a structural smell — the gate.ts is decorative if tools bypass it. Future capability scaffolding should template both files together with a passing test that verifies every `.from()` call goes through `gate.ts`.

## References

- ADR-0091 (cascade_gate_write WP2)
- ADR-0099 (gate_action)
- ADR-0190 (no-gated-write-in-capabilities lint rule)
- ADR-0229 (dual-gate transitional architecture — Phase 0 backlog includes this)
- L-0036 (4-layer review pattern — column-level + trigger semantics + capability-consumer trace)
- Council session 2026-04-18 (Wave 2A — shift-lifecycle direct-write finding)
- Council session 2026-04-19 (helpdesk — `channel_event` + `channel_ai_policy` as governance)
- Council session 2026-04-28 (this council — 20 direct-write sites enumerated)

> After writing: register in `docs/learnings/0000-learning-log.md`.
