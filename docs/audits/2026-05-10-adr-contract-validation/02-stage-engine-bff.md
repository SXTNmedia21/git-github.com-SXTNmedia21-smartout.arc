---
title: "Slice 02 — Stage Engine + BFF ADR/Contract Audit (Phase E)"
status: complete
created: 2026-05-10
updated: 2026-05-10
module: stage-engine
tags: [audit, stage-engine, bff, voice-agent, adr-compliance, phase-e]
auditor: botsson-harness-builder
---

# Slice 02 — Stage Engine + BFF Audit (Phase E, 2026-05-10)

**Scope:** `services/stage-engine/`, `services/voice-agent/`, `apps/web/src/app/api/`, `packages/ai/src/router/`, `supabase/functions/engine-dispatch/`
**ADRs checked:** 0042, 0049, 0078, 0132, 0151, 0186, 0246, 0247, 0248, 0255, 0261, 0276, 0282
**Phase E context:** ADR-0282 accepted 2026-05-10. `services/voice-agent/` imported from `@smartout/ai/missions` + `@smartout/telemetry/server`. Ultravox fully removed. Mission-aware dispatch via room-name pattern.
**Regression baseline:** 2026-05-06 slice findings F-01/F-02 (profile_id leak in BFF bodies), F-03/F-04 (dispatch/queue telemetry gap), F-05 (queue workspace scope).

---

## Summary — Top Findings

| # | ID | Severity | Title |
|---|-----|----------|-------|
| 1 | F-SE-01 | HIGH | Voice-agent workspace derivation: `BOTSSON_SERVICE_JWT` resolves service-account workspace, not caller workspace |
| 2 | F-SE-02 | HIGH | Voice telemetry events emit `actor_id: "anon"` sentinel for early turns — soft ADR-0193 violation |
| 3 | F-SE-03 | MEDIUM | `ws.ts` workspace auth via service-role profile query exposes cross-user profiles |
| 4 | F-SE-04 | MEDIUM | `workspace_context.workspace_id` (body) overrides `auth.workspaceId` (JWT) silently on voice path — partial L-0177 class risk |
| 5 | F-SE-05 | MEDIUM | BFF profile_id leak (F-01/F-02 from 2026-05-06) not yet fixed in `emma/chat` and `botsson/chat` |
| 6 | F-SE-06 | LOW | Mission manifest `firstSpeaker` vs `fullMission?.firstSpeaker` mix — `manifest.greeting` correctly used |
| 7 | F-SE-07 | LOW | Channel guard Layer 2 missing for several chat-only capabilities routed via voice `ask()` pipe |
| 8 | F-SE-08 | INFO | ADR-0246/0247/0248 remain `proposed` — engine_state migration unstarted (regression, same as 2026-05-06 F-06) |
| 9 | F-SE-09 | INFO | Voice runtime telemetry (4 Phase E events) correctly registered + wired — no finding |

---

## Detailed Findings

### F-SE-01 — HIGH: Voice-agent workspace derivation via `BOTSSON_SERVICE_JWT` is service-account workspace, not caller workspace

**File:** `services/voice-agent/src/adapter.ts:76`, `services/stage-engine/src/middleware/auth.ts:123-153`, `services/stage-engine/src/routes/agent/chat.ts:97-108`

**Trace:**

1. `adapter.ts:76` sends `Authorization: Bearer ${process.env.BOTSSON_SERVICE_JWT}` on every `ask()` call.
2. `auth.ts:validateJwt()` resolves the JWT → gets `user.id` for `admin@smartout.local` (the service account) → queries `profile` table for that user's first active workspace → sets `auth.workspaceId` to the dev workspace.
3. `chat.ts:97-108` uses `auth.workspaceId` as `rawWorkspaceId`. If `rawWorkspaceId` is falsy → 403. When the service JWT maps to a real workspace (local dev), this resolves to the dev workspace, NOT the calling user's workspace.
4. The actual calling user's `workspace_id` is in `body.workspace_context.workspace_id` (`adapter.ts:85-92`) but `chat.ts` does NOT use `workspace_context.workspace_id` to override `effectiveWorkspaceId` — the wizard_session_id branch (`chat.ts:121-138`) is the only override path, and it doesn't apply on ordinary voice calls.

**Impact:** On the voice path, `workspaceId` throughout the agent pipeline (capability tools, gate_action, emit) is the service-account's workspace, not the user's workspace. Capability queries that scope by `ctx.workspaceId` would return wrong-workspace data. Gate_action would evaluate against the wrong workspace policy. All emitted telemetry would carry the wrong workspace_id. This is a phantom workspace scope — the voice session appears to work but silently reads and writes against the wrong tenant.

**Why it hasn't caused visible breakage yet:** Local dev has one workspace, so `BOTSSON_SERVICE_JWT` → `admin@smartout.local`'s workspace = the only workspace = the calling user's workspace. In multi-workspace production (multiple restaurant clients), this breaks.

**Root cause:** The voice-agent adapter was designed before the BOTSSON_SERVICE_JWT pattern was finalised. `body.workspace_context` carries the trusted workspace (resolved by the BFF from the user's JWT at token-mint time), but `chat.ts` only uses `auth.workspaceId` (from the JWT) to set `effectiveWorkspaceId`. No code path promotes `workspace_context.workspace_id` to be the authoritative scope.

**ADR references:** ADR-0042 (workspace scope on every query), ADR-0151 (server-derive identity), L-0177 (fail-closed on scope resolution).

**Fix pattern:** In `chat.ts`, when `body.workspace_context?.workspace_id` is non-empty, validate it against `auth.workspaceId` (the service-account workspace) via a DB check — if the service-account JWT is allowed to act cross-workspace, promote `workspace_context.workspace_id` to `effectiveWorkspaceId` with an explicit fail-closed guard (not a silent fallback). Alternatively, issue per-user JWTs from the voice token route rather than a shared service JWT.

---

### F-SE-02 — HIGH: Voice telemetry emits `actor_id: "anon"` for early turns

**File:** `services/voice-agent/src/agent.ts:157-165`, `packages/telemetry/src/registry.ts:9850-9865`

**Trace:**

```typescript
// agent.ts:157-165
const rawProfileId = ctx_meta.user?.profile_id ?? "anon";
const wsStr = rawWorkspaceId ?? "anon";
return {
  workspace_id: rawWorkspaceId !== null ? nonEmpty(rawWorkspaceId, "workspace_id") : null,
  actor_id: nonEmpty(rawProfileId, "actor_id"),
  ...
};
```

- `voice.first_speech_ts_ms` fires on the very first user speech event. At that point, `context_init` may not have arrived yet.
- When `ctx_meta.user` is null, `rawProfileId = "anon"`, which is passed to `nonEmpty("anon", "actor_id")` — this does not throw (nonEmpty only checks for empty string), producing `actor_id: "anon"` in the event payload.
- The comment at line 157 explicitly acknowledges this: `"actor_id: 'anon' sentinel when profile not resolved yet — nonEmpty('anon') is valid."`.

**Impact:** The `voice.first_speech_ts_ms` and potentially `voice.session_abandonment` events in PostHog carry `actor_id = "anon"`, making them unattributable to a user. This is a soft ADR-0193 violation (no empty-string sentinel, but "anon" is a semantic sentinel rather than a real actor_id). The telemetry registry marks these events destinations as `["posthog", "logger"]` only — no `activity_trail`, no `engine_event` — so no downstream RLS or gate logic is affected. The risk is observational integrity only (Phase F1 cannot correctly attribute sessions to users for early-abandon metrics).

**ADR references:** ADR-0193 (telemetry parity), ADR-0134 (telemetry contract — actor_id non-null).

**Disposition:** Accepted trade-off for observational events (no `activity_trail` destination means no audit risk). Should be documented explicitly in the telemetry registry comment. Flag for Phase F1 review.

---

### F-SE-03 — MEDIUM: `ws.ts` workspace auth uses service-role profile query scoped by session.workspace_id

**File:** `services/stage-engine/src/routes/ws.ts:65-77`

**Trace:**

```typescript
// ws.ts:65-73
const { data: profile } = await supabaseAdmin
  .from("profile")
  .select("workspace_id")
  .eq("user_id", user.id)
  .eq("workspace_id", session.workspace_id)
  .eq("is_active", true)
  .limit(1)
  .single();

if (!profile) {
  wsCtx.close(4003, "Forbidden");
  return;
}
```

The check is correct in intent: verify the JWT user has an active profile in the session's workspace. However, `supabaseAdmin` (service role) is used here. Service role bypasses RLS, so the profile lookup is correct but bypasses any tenant-isolation policies. This is a known pattern in the codebase (service role for cross-context lookups). The check does correctly scope to `session.workspace_id`, so no cross-workspace data leaks.

**Impact:** Low in isolation, but the combination with F-SE-01 (service JWT sending wrong workspace_id) means a WebSocket session could be opened to a session belonging to a different workspace than the voice session is actually querying. Not exploitable without F-SE-01 as a prerequisite.

**ADR references:** ADR-0042 (workspace scope), ADR-0151.

---

### F-SE-04 — MEDIUM: `workspace_context.workspace_id` silently overrides via body without cross-check on voice path

**File:** `services/stage-engine/src/routes/agent/chat.ts:85-92`, `services/voice-agent/src/adapter.ts:83-93`

**Trace:**

The voice adapter sends `body.workspace_context.workspace_id = ctx.workspace.workspace_id` (the user's workspace from `context_init`). In `chat.ts`, `workspaceContext` is passed through to `routeAgentMessage` where it enriches the agent context (`body.workspace_context → routeAgentMessage.workspaceContext`). This means the LLM prompt builder receives the correct workspace context for narratives — but `effectiveWorkspaceId` (the actual scope for DB queries) is still set from `auth.workspaceId` (the service JWT workspace, per F-SE-01).

This creates a split-brain: the prompt has the right workspace name (e.g. "Strøm Mat & Bar") but capability tools query the wrong tenant's database. The user sees contextually correct speech but gets wrong-workspace data from tools.

This is a L-0177 class risk: `workspace_context.workspace_id` acts like the body-supplied workspace reference that overrides the JWT-derived scope, but without the fail-closed guard that L-0177 requires (the wizard path at `chat.ts:121-138` has the guard; the general voice path does not).

**ADR references:** ADR-0151, L-0177.

---

### F-SE-05 — MEDIUM: BFF `profile_id` leak in `emma/chat` and `botsson/chat` not fixed (regression from 2026-05-06 F-01/F-02)

**Files:** `apps/web/src/app/api/emma/chat/route.ts:192`, `apps/web/src/app/api/botsson/chat/route.ts:191`

Previously found in the 2026-05-06 slice audit as F-01/F-02. Both routes still send `profile_id: profile.profile_id` in the body to stage-engine. Stage-engine's `chatSchema` does not accept this field (removed at `chat.ts:36`), so the field is silently dropped. No security breach today, but creates a forgeable injection vector if `chatSchema` is ever relaxed.

Verified: no fix landed between 2026-05-06 and 2026-05-10 for these files. The 2026-05-06 audit finding is confirmed as a regression.

**ADR references:** ADR-0151.

---

### F-SE-06 — LOW: `fullMission?.firstSpeaker` vs `manifest.greeting` mismatch — benign as coded

**File:** `services/voice-agent/src/agent.ts:264-268`

```typescript
// agent.ts:264-268
if (fullMission?.firstSpeaker === "agent") {
  session.generateReply({
    instructions: manifest.greeting || "Hils brukeren kort og varmt på norsk. Maks to setninger.",
  });
}
```

`fullMission` is the `AgentMission` (full registry entry with `firstSpeaker`). `manifest` is the `MissionManifestEntry` (client-safe, has `greeting` but not `firstSpeaker`). Both are derived from the same mission registry entry. The code correctly uses `fullMission.firstSpeaker` for the decision gate and `manifest.greeting` for the instruction text. Both fields exist on their respective types (`AgentMission.firstSpeaker?: "agent" | "user"`, `MissionManifestEntry.greeting: string`). No bug — this is correct as coded.

However, `MissionManifestEntry` does not expose `firstSpeaker`, so if `manifest` were used for the gate (instead of `fullMission`), the condition would always be false (field missing → falsy). The current code is correct. Noting for future devs who might refactor.

**Verdict:** PASS. No finding required — noted for clarity.

---

### F-SE-07 — LOW: Layer 2 channel guard missing for chat-only capabilities on voice `ask()` path

**Files:** `services/voice-agent/src/tools-capability.ts`, `services/stage-engine/src/router/tool-selector.ts:136-144`

The voice adapter correctly documents that Layer 3 (tool-selector checking `capability.allowedChannels`) rejects chat-only capabilities. Verified: `tool-selector.ts:136-144` checks `capability.allowedChannels` and returns `[]` for capabilities where `channel="voice"` is not in `allowedChannels`.

The gap: the voice-agent client tools (`get_helpdesk_status`, `get_shift_swap_status`, `get_governance_summary`) proxy to capabilities with `allowedChannels: ["chat"]`:

| Voice Tool | Proxied Capability | `allowedChannels` |
|-----------|-------------------|-------------------|
| `get_helpdesk_status` → | `helpdesk_query` | `["chat"]` |
| `get_shift_swap_status` → | `shift_swap` | `["chat"]` |
| `get_governance_summary` → | `governance` | `["chat"]` |

When these tools call `ask()`, the stage-engine intent classifier correctly classifies the intent and `tool-selector.ts` returns `[]` for the capability because `channel="voice"` is not allowed. The LLM then produces a no-tools response (falls back to general reasoning).

The result is not a security failure — the tools don't leak PII. But the user hears a generic "I can't help with that via voice" from the LLM narrative rather than the explicit "Av sikkerhetshensyn må dette skje i chat" message that a Layer 3 tool-execute guard would return. The user experience is degraded: the voice agent offers these tools in its description to the LLM but cannot fulfil them.

**ADR references:** ADR-0078 (layered defence — all three layers should reject, not just Layer 3).

**Recommendation:** Add Layer 1 guard by removing `get_helpdesk_status`, `get_shift_swap_status`, and `get_governance_summary` from the voice tool surface, or update their descriptions to say "chat-only" so the LLM self-redirects to chat naturally.

---

### F-SE-08 — INFO: ADR-0246/0247/0248 remain `proposed` (regression from 2026-05-06 F-06)

**Files:** `docs/decisions/0246-*.md`, `0247-*.md`, `0248-*.md`

No change since 2026-05-06. Engine_state migration unstarted. Stage-engine exclusively reads `engine_sessions`. Not a Phase E concern but tracking for completeness.

---

### F-SE-09 — INFO: Voice runtime telemetry (Phase E, 4 new events) correctly wired

**Files:** `services/voice-agent/src/agent.ts:170-261`, `packages/telemetry/src/registry.ts:9847-9865`

All four Phase E events verified end-to-end:

| Event | Producer | Registry | Destinations | Verdict |
|-------|----------|----------|--------------|---------|
| `voice.first_speech_ts_ms` | `agent.ts:176-188` | `registry.ts:9850-9853` | `["posthog","logger"]` | PASS |
| `voice.turn_end_ts_ms` | `agent.ts:222-237` | `registry.ts:9854-9857` | `["posthog","logger"]` | PASS |
| `voice.user_recut` | `agent.ts:192-208` | `registry.ts:9858-9861` | `["posthog","logger"]` | PASS |
| `voice.session_abandonment` | `agent.ts:243-260` | `registry.ts:9862-9865` | `["posthog","logger"]` | PASS |

No `activity_trail` or `engine_event` destination — intentional per ADR-0282 R6 amendment comment (observational only). The "anon" sentinel on early events noted in F-SE-02 is the only sub-finding.

---

## Channel Guard Layered Defence Table

Per ADR-0078 (three-layer defence for voice+PII):

| Capability | L1 (allowedChannels) | L2 (voice tool surface exclusion) | L3 (tool execute guard) | Verdict |
|-----------|---------------------|----------------------------------|------------------------|---------|
| `helpdesk_query` | `["chat"]` — chat-only | NOT excluded from voice `ask()` path | tool-selector returns `[]` | L2 MISSING |
| `shift_swap` | `["chat"]` | NOT excluded from voice `ask()` path | tool-selector returns `[]` | L2 MISSING |
| `governance` | `["chat"]` | NOT excluded from voice `ask()` path | tool-selector returns `[]` | L2 MISSING |
| `profile` | `["chat"]` | NOT exposed in voice tools | tool-selector returns `[]` | PASS (L2 present) |
| `memory` | `["chat"]` | NOT exposed in voice tools | tool-selector returns `[]` | PASS (L2 present) |
| `contract_intake` | `["chat"]` | NOT exposed in voice tools | tool-selector returns `[]` | PASS (L2 present) |
| `billing_query` | `["chat"]` | NOT exposed in voice tools | tool-selector returns `[]` | PASS (L2 present) |
| `schedule` | `["chat","voice","system"]` | `get_my_shifts` exposed | tool-selector includes schedule tools | PASS |
| `legal` | `["chat","voice","system"]` | `cite_legal_paragraph` exposed | tool-selector includes legal tools | PASS |
| `onboarding` | `["chat","voice","system"]` | routed via `query_smartout` fallback | tool-selector includes onboarding tools | PASS |

---

## Per-ADR Rollup

| ADR | Status | Verdict | Notes |
|-----|--------|---------|-------|
| ADR-0042 (Workspace scope) | accepted | FAIL (F-SE-01) | Voice path uses service-JWT workspace, not caller workspace |
| ADR-0049 (Agent SDK Package) | accepted | PASS | SDK boundary respected. No direct Ultravox imports remain (verified by `grep -rn "ultravox" services/voice-agent/` returning 0 results) |
| ADR-0078 (Channel guard) | accepted | PARTIAL (F-SE-07) | L1+L3 present for all capabilities. L2 missing for `helpdesk_query`, `shift_swap`, `governance` on voice tool surface |
| ADR-0132 (Mobile AI routing) | accepted | PASS | Voice-agent routes all capability calls via stage-engine `/agent/chat`. No direct capability imports |
| ADR-0151 (Server-derive identity) | accepted | FAIL (F-SE-01, F-SE-05) | Voice path workspace is service-account workspace not caller workspace. BFF profile_id leak persists |
| ADR-0186 (Guardian Bus pg_notify) | accepted | PASS | `emitGuardianEvent` called at `chat.ts:222, 286`. pg_notify trigger confirmed live in prior audit |
| ADR-0193 (Telemetry parity / no empty-string) | accepted | PARTIAL (F-SE-02) | `actor_id: "anon"` sentinel for early voice events — soft violation, observational scope only |
| ADR-0246 (Engine State migration) | proposed | PENDING | No change from 2026-05-06 |
| ADR-0247 (engine_state schema) | proposed | PENDING | No change from 2026-05-06 |
| ADR-0248 (B5 emit producer) | proposed | PENDING | No change from 2026-05-06 |
| ADR-0255 (Sixten integration) | proposed | PARTIAL | Phase 0/0.5 routes exist. No telemetry on dispatch/queue (2026-05-06 F-03/F-04 unresolved) |
| ADR-0261 (BFF as mutation host) | accepted | PASS | Tips/payroll mutations not observed routing via stage-engine |
| ADR-0276 (Voice plane consolidation plan) | accepted | PASS | Plan implemented per ADR-0282 |
| ADR-0282 (LiveKit as sole voice transport) | accepted | PASS | Ultravox fully removed. 4 runtime telemetry events wired. Dockerfile correct (`ca-certificates` present) |

---

## BOTSSON-SYSTEM-MAP.md Row Status Corrections

| Component | Current Map Status | Actual Code Status | Change Required |
|-----------|-------------------|-------------------|----------------|
| L3 `ws.ts` (WebSocket) | 🟢 | 🟢 | None |
| L3 voice-agent | 🟢 | 🟡 | F-SE-01: workspace derivation broken on multi-tenant voice path. Map should reflect 🟡 until fixed |
| L2 BFF routes (`emma/chat`, `botsson/chat`) | 🟢 | 🟡 | F-SE-05: profile_id still leaked in request body. Map row should be 🟡 |
| Voice runtime telemetry | 🟢 (Phase E claim) | 🟢 | Correctly wired — no change needed |

**Recommendation:** Update `docs/architecture/BOTSSON-SYSTEM-MAP.md` L3 voice-agent row to 🟡 with note "workspace_id derivation via BOTSSON_SERVICE_JWT routes to service-account workspace — broken on multi-tenant (F-SE-01, Phase F fix required)."

---

## Open Phase Gaps Cited

| Gap ID | Description | This Audit |
|--------|-------------|------------|
| A1 | `contract_intake` bypasses `gate_action` | Not in scope |
| B1 | Dual-gate divergence | Not in scope |
| B5 | 3 action handlers (engine dispatch) | ADR-0248 still proposed |
| C1 | Mobile LiveKit wiring | Not in scope |
| D1 | Session recorder Phase 2c | Not in scope |
| **NEW** | Voice workspace derivation (F-SE-01) | Phase F pre-condition; no existing gap ID |
