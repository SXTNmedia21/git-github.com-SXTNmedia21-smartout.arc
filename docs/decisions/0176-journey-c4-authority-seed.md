---
title: "Journey capability C4 authority seed — mandatory non-default rows"
id: ADR_0176
status: accepted
layer: decision
created: 2026-04-21
updated: 2026-04-22
appendix_updated: 2026-04-22
---

# ADR-0176: Journey capability C4 authority seed — mandatory non-default rows

## Context and Problem Statement

`engine_authority_config.level` default is `read_only` (migration `20260302000100_engine_authority_config.sql:10-11`). Spec v1.6.0 assumed default `suggest` — inverse of reality. Without explicit seed rows, all four journey capabilities (ADR-0173) are either (a) unreachable because the default blocks everything, or (b) in the dual-gate model (ADR-0091 `gate_action`) default-allowed to run autonomously if the SECURITY DEFINER RPC takes precedence — same class as L-0066 (default-allow CVE-class trap).

## Decision Drivers

- L-0066 / 2026-04-19 Kanaler council — every new capability must ship with explicit seed migration; no default-allow.
- ADR-0173 defines four journey capabilities — each needs a row.
- Runtime agent-guided journey (Journey 3) cannot run without authority; Trust Gate rejected spec v1.6.0 on this point.

## Considered Options

1. **Seed migration with four rows** — one per capability, explicit `level`, explicit `target_roles`.
2. **Rely on default** — accept whatever `read_only` produces.
3. **One umbrella row** with capability_pattern `journey.*` — single migration row.

## Decision Outcome

Chosen option: **"Seed migration with four rows"**, because default behavior is the wrong behavior for all four capabilities and pattern-matching on `journey.*` would grant a single authority level to capabilities that need different levels.

Seed table:

| Capability | `level` | `target_roles` | Reason |
|---|---|---|---|
| `journey.run_dev` | `suggest` | `{'platform_admin'}` | Dev runs should prompt-confirm; platform-admin only |
| `journey.publish_mission` | `suggest` | `{'workspace_admin'}` | Publishing mutates agent behavior; workspace-admin confirm |
| `journey.publish_guide` | `suggest` | `{'workspace_admin'}` | Publishing mutates user-facing docs; workspace-admin confirm |
| `journey.run_guided` | `autonomous` | `{'employee','workspace_admin','platform_admin'}` | Guided runs are read-only from user POV; per-step gates handle mutation surfaces |

Migration file ships as part of the v1.7.0 landing, in the 0a/0b/0c order (per L-0075) — enum first, capability registration second, authority seed third.

## Rules & Consequences

- **Good, because** every capability is explicitly reachable; no hidden default-allow.
- **Good, because** per-role targeting is explicit — future audit can grep for roles and answer "what can X role do?"
- **Bad, because** seed migration must be updated every time a capability is added.
- **Agent Impact:** Any capability added in `packages/ai/src/capabilities/` MUST ship with an `engine_authority_config` seed row in the same PR. `close-feature.sh` should grep for unseeded capabilities as a future gate.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.

---

## Appendix: actor_id Resolution per Surface

> **Added 2026-04-22** by sub-sortie S2.3 to close Trust-Gate Unblock #6. Gate B council (code-reviewer risk #9, CVE-class oversight) required an explicit invariant that mobile BFF routes must derive `actor_id` server-side. This appendix is additive — the main body of ADR-0176 is unchanged.

The five journey events in `packages/telemetry/src/registry.ts` all require `actor_id` in the payload (ADR-0175). The four journey capabilities in `packages/ai/src/capabilities/journey/tools.ts` all short-circuit with `{ok: false, error: "missing_context"}` when `ctx.workspaceId` or `ctx.profileId` is empty or null BEFORE any `emit()` side-effect (ADR-0134 guard). But HOW `actor_id` is resolved differs per surface — and until now those rules were never written down. Without a contract, the M5 subagent implementing the `journey.run_guided` BFF route for mobile has no constraint and can fall into the L-0097 trap a third time by trusting a client-supplied value.

This appendix binds every future journey capability call-site to one of four resolution mechanisms.

### 1. Resolution table — all 4 surfaces

| Surface | Capability | Authenticating principal | Resolution mechanism | ADR |
|---|---|---|---|---|
| Dev | `journey.run_dev` | Developer user session (web) | `supabase.auth.getUser()` → `profile` table lookup via `user.id` | ADR-0134 |
| Publish (admin) | `journey.publish_mission`, `journey.publish_guide` | Admin user session (web platform-admin) | Same as Dev — Server Action reads session cookie, joins `profile` | ADR-0134 |
| Runtime web | `journey.run_guided` (web) | Authenticated end-user session | Stage engine resolves profile from session cookie; passes `ctx.profileId` to capability | ADR-0132 |
| Runtime mobile | `journey.run_guided` (mobile) | Mobile end-user session (Supabase Auth) | `getProfileContext()` at `apps/mobile/src/lib/profile-context.ts` — calls `supabase.auth.getUser()` server-side to validate JWT, then `profile` table lookup | ADR-0134 |

### 2. Invariants

> **Invariant 1 — Never-null pre-emit.** Every `execute()` in `packages/ai/src/capabilities/journey/tools.ts` MUST return `{ok: false, error: "missing_context"}` if `ctx.workspaceId` or `ctx.profileId` is empty or null, BEFORE any `emit()` side-effect. Enforced by the Gate A C-3 compliance test in `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts`.
>
> **Invariant 2 — Empty-string fallback forbidden.** `actor_id: profileId ?? ""` is banned. Enforced by Gate A C-5 grep gate: `grep -R "actor_id:.*?? \"\"" packages/ai/src/capabilities/journey/` returns 0 lines.
>
> **Invariant 3 — Server-side derivation on BFF routes (CVE-class).** The `journey.run_guided` BFF route for mobile (to be implemented in M5) MUST derive `actor_id` from the server-authenticated session (`supabase.auth.getUser()` on the server), NEVER from a client-supplied payload field. A malicious client can craft arbitrary JSON; only a server-validated JWT is trustworthy. This mirrors ADR-0134's mandate and extends it: BFF routes are the single server-side trust boundary for mobile journey runs.

### 3. Surface-specific notes

- **Dev + Publish (web platform-admin).** These surfaces run inside Next.js Server Actions with the admin's session cookie. Resolution is trivial — the session cookie is verified by Supabase middleware and the `profile` join produces `profile_id` + `workspace_id`. No separate context hook needed. The capability body (`runDevTool`, `publishMissionTool`, `publishGuideTool`) receives a non-null `ctx.profileId` from the Server Action's surrounding authentication layer; the `if (!ctx.workspaceId || !ctx.profileId)` guard at the top of each `execute()` is defense-in-depth against a future regression in that layer.

- **Runtime web (`journey.run_guided` in-browser).** The stage-engine (`services/stage-engine/`) already resolves session → profile during stage bootstrap. The capability receives a non-null `ctx.profileId` as a function parameter from stage-engine's `AgentToolContext`. No new resolution code is needed in the capability; the guard in `tools.ts` is defense-in-depth. Because `run_guided` defaults to `autonomous` (ADR-0173 seed row), any empty-context regression would silently emit broken telemetry — the guard prevents that.

- **Runtime mobile (`journey.run_guided` via BFF).** Mobile client calls `getProfileContext()` at `apps/mobile/src/lib/profile-context.ts` to prepare local telemetry payloads — see the existing implementation which throws on missing auth, missing profile, missing `profile_id`, or missing `workspace_id`. BUT the BFF route at `/api/journey/guided/...` MUST ignore any client-supplied `actor_id`/`workspace_id` in the request body and re-derive both from the request's session (server-side `supabase.auth.getUser()` + profile lookup). Any payload field the client sends is advisory only; it does not reach `emit()`. The M5 sub-sortie that implements the BFF route is responsible for this re-derivation. A client-supplied `actor_id` is untrusted input — Invariant 3 above is the hard gate.

### 4. Cross-references

- **ADR-0134** — [`docs/decisions/0134-mobile-telemetry-contract-enforcement.md`](0134-mobile-telemetry-contract-enforcement.md) — empty-string fallback prohibition and `getProfileContext()` contract. Invariants 1 and 2 above are direct applications of ADR-0134 Rules R1 and R2 to journey capabilities.
- **ADR-0132** — [`docs/decisions/0132-mobile-thin-client-via-web-bff.md`](0132-mobile-thin-client-via-web-bff.md) — BFF proxy pattern for mobile capability calls. Invariant 3 above is the journey-specific corollary of ADR-0132 R3 (channel pinning is a server-side decision): actor identity is also a server-side decision, not a client hint.
- **ADR-0078** — [`docs/decisions/0078-engine-process-channel-restriction.md`](0078-engine-process-channel-restriction.md) — voice channel restrictions. `journey.run_guided` is chat-only per its `allowedChannels: ["chat"]` setting at `packages/ai/src/capabilities/journey/index.ts`; voice is separately blocked by ADR-0078's three-layer defence. This appendix does not amend ADR-0078 — it only notes the cross-cut.
