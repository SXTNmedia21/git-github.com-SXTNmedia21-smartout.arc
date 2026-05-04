---
title: "JOURNEY — honesty (Phase 0 remediation)"
feature: honesty
branch: feat/journey-engine-honesty
status: verified
updated: 2026-04-23
created: 2026-04-23
module: journey-engine
tags: [journey, remediation, phantom, authority, fjernkontroll]
---

# JOURNEY — Phase 0 Honesty

This sub-sortie is not a user-facing feature. It is internal remediation of three shipped-but-lying states in the Journey Engine. Nonetheless journeys are documented here because CLAUDE.md requires them for all sub-sortie closures, and the changes **do** alter observable behaviour for admins and end-users.

## Journey 1 — Admin: attempt to publish a mission (Track A)

**Precondition:** Admin is on `/platform-admin/journeys/versions/[id]` with a valid JourneyIR. Before Phase 0, clicking "Publish Mission" silently succeeded (toast "Published", zero rows in `engine_missions`).

1. Admin clicks **"Publish Mission"** → Agent or Server Action calls `journey.publish_mission`.
2. `publishMissionTool.execute` runs → guards pass (`workspaceId` + `profileId` resolved).
3. Tool returns `{ok:false, error:"not_implemented", message:"publish_mission body lands in Phase 3 per ADR-0194"}`.
4. Caller receives failure → UI renders error toast: **"Publisering ikke implementert ennå — ADR-0194 (IR → engine_missions mapping) må landes i Fase 3 av remediation-roadmap."**
5. Admin sees honest failure instead of silent success. No row appears in `engine_missions` (same as before), but now the admin knows that.

**Postcondition:** no database mutation; no telemetry event fired; admin explicitly informed that publishing is blocked on an upcoming phase.

**Error paths:**
- If agent context is missing `workspaceId` or `profileId`: `MISSING_CONTEXT` error returns (ADR-0134 guard unchanged).
- If LLM surfaces a misleading success message despite `ok:false`: router must respect the error field — verify in test.

**Same pattern applies to Journey 1b — Publish Guide** (via `journey.publish_guide`).

## Journey 2 — Admin: run a guided journey that lands on `stuck` (Track C)

**Precondition:** A runtime mission started via `journey.run_guided` has stalled past its `timeoutMs` on the current step. Fjernkontroll renders in `stuck` state. Before Phase 0, no buttons existed — user closed the tab.

1. Fjernkontroll shows **stuck** state (orb pulses amber per ADR-0177 motion tokens).
2. ARIA live region announces: **"Passet er sittende fast på steg {n} — {step.title}."**
3. `FjernkontrollActions` now renders two buttons:
   - **"Prøv igjen"** (RotateCw icon, primary action) → dispatches `RETRY` → state machine transitions to `running`. System re-enters the step, restarts the timer. Telemetry emits `journey.step_reached` with property `{recovery: "retry"}`.
   - **"Avslutt"** (X icon, secondary action) → dispatches `ABANDON` → state machine transitions to `idle`. Mission terminates. Telemetry emits `journey.run_failed` with `{error_code: "abandoned_by_user"}`.
4. Admin picks one. Buttons are ≥44pt (mobile-ready). `useReducedMotion()` respected on button state animation.

**Postcondition:** user has a deterministic escape from `stuck`. `engine_state.status` reflects the chosen path (running or aborted).

**Error paths:**
- If `gate_action` denies RETRY (workspace policy change mid-run): button shows denial reason, state stays `stuck`.

## Journey 3 — Admin: run a guided journey that lands on `failed` (Track C continued)

**Precondition:** `journey.run_guided` emitted `journey.run_failed` (e.g. DOM assertion mismatch, network error). Fjernkontroll renders in `failed` state. Before Phase 0, no exit.

1. Fjernkontroll shows **failed** state (orb static, muted tone per Nordic Split).
2. ARIA live region announces: **"Passet mislyktes på steg {n} — {error.message}."**
3. Single button renders:
   - **"Start på nytt"** (Refresh icon) → dispatches `RESET` → state machine transitions to `idle`. Mission state cleared. No side effects beyond state reset.
4. Admin can start a fresh run from scratch.

**Postcondition:** user escaped `failed` cleanly; no lingering state. `engine_state` row remains for audit; UI re-enters idle to allow a new run.

## Journey 4 — Agent: invoke a journey capability and get correct authority-level behaviour (Track B)

**Precondition:** Workspace has the 4 `engine_authority_config` rows seeded per migration `20260516000400_journey_authority_seed.sql` (3× `suggest` + 1× `autonomous` at `journey.run_guided`). Before Phase 0, row insertion order silently determined which tool surfaced at which authority level — `run_guided` could appear at `suggest` (confirmation required) or `publish_mission` at `autonomous` (no confirmation) randomly.

1. Agent begins a turn. Router resolves workspace → loads `engine_authority_config` rows.
2. `authority.ts` now stores each dotted key directly: `levels["journey.run_dev"] = "suggest"`, `levels["journey.publish_mission"] = "suggest"`, `levels["journey.publish_guide"] = "suggest"`, `levels["journey.run_guided"] = "autonomous"`.
3. `tool-selector.ts` iterates journey capability's tools. For each tool, reads `authorityConfig[tool.capability]` (dotted) → gets the correct per-tool level.
4. Agent's tool list at `suggest` authority: `run_dev`, `publish_mission`, `publish_guide` (3 tools). `run_guided` is **not** exposed at suggest.
5. Agent's tool list at `autonomous` authority: all 4 tools.

**Postcondition:** C4 policy seed (ADR-0176) is now deterministically applied. Two consecutive runs with identical workspace state yield identical tool lists.

**Error paths:**
- If `engine_authority_config` rows missing (unseeded workspace): `gate_action` RPC rejects per ADR-0099 / ADR-0192 bootstrap-trigger pattern.
- If row ordering changed post-fix: **no effect** — the fix removes dependency on row order. Test asserts determinism across 10 runs.

---

## Cross-journey guarantees

- **Telemetry honesty** (ADR-0196 Invariant 11): no `journey.run_started` fires from phantom capabilities.
- **Authorization determinism** (ADR-0195): per-capability authority is never non-deterministic.
- **UX integrity** (ADR-0177 amendment): state machine has no dead-end states.

## Manual test cases

See Phase 0 merge checklist in `PLAN-journey-engine-honesty.md §Quality gates`.
