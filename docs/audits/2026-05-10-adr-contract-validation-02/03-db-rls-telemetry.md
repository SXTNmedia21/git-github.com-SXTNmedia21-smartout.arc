---
title: Slice 03 — db-rls-telemetry Audit
status: done
created: 2026-05-10
updated: 2026-05-10
module: audit
tags: [audit, db-rls, telemetry, adr, smoke]
mode: smoke
baseline: 2026-05-10-adr-contract-validation
---

# Slice 03 — db-rls-telemetry Audit (Smoke Mode)

**Branch:** `feat/botsson-arena-phase-f0-perimeter`
**Worktree:** `/home/sxtnl/dev/smartout.ai-botsson-arena-wt-1`
**Mode:** smoke (delta from 2026-05-10 baseline)
**ADRs in scope:** 0004, 0011, 0012, 0029, 0044, 0107, 0151

---

## Summary

| # | ID | Severity | One-line |
|---|---|---|---|
| 1 | F-SE-01 | CLOSED | Voice multi-tenant workspace derivation fixed in `bb1178ac2` — verified PASS |
| 2 | F-DB-03 | LOW (unchanged) | `salary_type` + `end_date_reason` still lack RLS — baseline WARN persists; no new migration addresses it |
| 3 | F-DB-02 | MEDIUM (unchanged) | 6 workspace-scoped tables still missing `api_key_read_*` policy — no new migrations in this sortie touch them |
| 4 | F-DB-01 | HIGH (unchanged) | `engine_world_observe_platform` GRANT to authenticated without body guard — not addressed in Phase F0 scope |
| 5 | T-REG-01 | LOW | Zod session_id regex `[0-9a-f-]{36}` is permissive (allows leading hyphens) — defence-in-depth via `parseVoiceSessionProfileId` strict re-validation makes this safe but a tighter regex would be cleaner |

---

## Findings Table

| ID | Severity | File:line | ADR | Evidence |
|---|---|---|---|---|
| F-SE-01 | CLOSED | `services/stage-engine/src/routes/agent/chat.ts:180-198` | ADR-0151 | See F-SE-01 closure section below — PASS |
| F-DB-01 | HIGH (unchanged from baseline) | `supabase/migrations/20260526000000_engine_world_phase_1.sql:133-135` | ADR-0029 | No Phase F0 migration addresses the authenticated GRANT on `engine_world_observe_platform`; risk documented in ADR-0290 but no body guard added |
| F-DB-02 | MEDIUM (unchanged from baseline) | baseline finding — 6 tables | ADR-0029 | `employment_contract_detail`, `payroll_ledger_archive`, `agent_session_recording`, `agent_session_whisper`, `gate_evaluation`, `engine_state_archive` — all confirmed still missing `api_key_read_*`; no Phase F0 migration touches these |
| F-DB-03 | LOW (unchanged from baseline) | `supabase/migrations/20260519100100_contracts_module_foundation.sql` | ADR-0011/0029 | `salary_type` and `end_date_reason` have no `ENABLE ROW LEVEL SECURITY`. Migration creates both tables (lines 172-234) with no RLS block. Platform lookup tables, but `tariff_rate_table` / `public_holiday` precedent shows they should have at least an authenticated-read policy |
| T-REG-01 | LOW | `services/stage-engine/src/routes/agent/chat.ts:103` | ADR-0151 | Zod regex `/^voice-[0-9a-f-]{36}-[0-9a-f-]{36}$/i` — character class `[0-9a-f-]` includes `-` so a string like `voice-${"a".repeat(35)}-${"b".repeat(35)}-` could pass Zod but fail `parseVoiceSessionProfileId`. Strict re-validation inside the handler provides second-layer defence; low severity |

---

## Per-ADR Rollup

| ADR | Title | Phase F0 Verdict | Notes |
|---|---|---|---|
| ADR-0004 | Unified telemetry — every mutation emits | PASS (unchanged scope) | `botsson.turn_started` / `botsson.turn_completed` emitted in `chat.ts:347-435`; both registered with correct destinations (logger+activity_trail and posthog+logger+activity_trail). Voice quality events (F-DB-05 from baseline) confirmed in registry + voice-agent producers — no regression. |
| ADR-0011 | user_identity table naming | PASS | `contracts_module_foundation.sql:780,881` correctly references `user_identity(user_id)`. `database.types.ts` shows only `referencedRelation: "user_identity"` — no `"user"` table. No ADR-0011 violation in Phase F0 changes. |
| ADR-0012 | Subscription data on company table | PASS | No migrations in Phase F0 touch the `company` table or create a separate subscription table. No regression. |
| ADR-0029 | Workspace API gateway + dual-policy RLS | PARTIAL FAIL (unchanged) | F-DB-01 (engine_world authenticated GRANT) and F-DB-02 (6 tables missing api_key_read_*) carried from baseline. Phase F0 scope is perimeter closure (F-SE-01, F-AC-02); F-DB-01/F-DB-02 are out of scope for this sortie. New tables in `contracts_module_foundation.sql` (pension_scheme, contract_pay_rule, contract_tip_rule, contract_obligation, contract_amendment) correctly have both JWT and api_key policies at lines 1107-1228. |
| ADR-0044 | Invitation table naming | PASS | No Phase F0 migration references invitation table. No regression. |
| ADR-0107 | BotssonProvider channel derivation | PASS | Phase F0 did not touch `apps/mobile/src/providers/botsson-provider.tsx`. Baseline ADR-0107 PASS unchanged. |
| ADR-0151 | profile_id derived server-side | PASS — F-SE-01 CLOSED | Voice path now uses `parseVoiceSessionProfileId()` + DB profile verification instead of body-supplied id. Chat path unchanged (uses `deriveProfileId()`). See F-SE-01 closure section. |

---

## F-SE-01 Closure Verification

**Status: PASS**

### Evidence from `services/stage-engine/src/routes/agent/chat.ts`

**1. Service-account branch present (line 180-198)**

```typescript
} else if (body.channel === "voice") {
  // Priority 2 — voice channel: trust body.workspace_context.workspace_id
  // over the JWT-derived service-account workspace (F-SE-01 fix).
  const voiceWorkspaceId = body.workspace_context?.workspace_id;
  if (!voiceWorkspaceId) {
    // Fail-closed: voice requests without workspace_context are malformed.
    return c.json(
      {
        error: "MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT",
        ...
        status: 400,
      },
      400,
    );
  }
  effectiveWorkspaceId = nonEmpty(voiceWorkspaceId, "workspaceId");
}
```

**2. body.workspace_context preferred when actor=service-account (line 183-198)**
`voiceWorkspaceId = body.workspace_context?.workspace_id` is used as `effectiveWorkspaceId` when `body.channel === "voice"`. The JWT-derived `auth.workspaceId` (which would be the service-account's workspace) is NOT used on this branch.

**3. Fail-closed `MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT` 400 when both null (line 186-196)**
When `voiceWorkspaceId` is falsy (null, undefined, or empty string), the handler returns `400 MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT` — never falls back to JWT workspace. L-0177 compliance confirmed.

**4. Voice session_id format `voice-<uuid>-<uuid>` accepted by Zod schema (line 102-103)**

```typescript
session_id: z
  .union([z.string().uuid(), z.string().regex(/^voice-[0-9a-f-]{36}-[0-9a-f-]{36}$/i)])
  .optional(),
```

The `z.union()` accepts both formats. The prior version only accepted `z.string().uuid()`, which would have rejected voice session IDs. This schema gap was caught and fixed in commit `bb1178ac2`.

**5. Profile derivation on voice path (line 224-262)**
`parseVoiceSessionProfileId(body.session_id)` extracts the profile UUID from the session_id, then verifies it against the DB (`profile.profile_id = voiceProfileId AND workspace_id = workspaceId`). If not found: `403 PROFILE_NOT_FOUND`. No body-supplied actor ID accepted.

**6. Unit tests (12 tests) at `services/stage-engine/src/__tests__/chat.workspace-derivation.test.ts`**
`parseVoiceSessionProfileId` is covered with 8 unit tests (valid, null, empty, one-UUID, malformed workspace, malformed profile, case-insensitive, second-UUID extraction). 4 contract-intent tests are documented stubs pending test-app helper. The 8 pure-function tests pass independently of runtime.

**Verdict: F-SE-01 CLOSED.** All four closure criteria met.

---

## Delta vs Baseline

| Finding | Baseline status | Phase F0 status | Change |
|---|---|---|---|
| F-SE-01 (voice workspace derivation) | HIGH — promotion-blocker | CLOSED | Fixed in `bb1178ac2` |
| F-DB-01 (engine_world_observe_platform authenticated grant) | HIGH — promotion-blocker | HIGH — UNCHANGED | Out of Phase F0 scope |
| F-DB-02 (6 tables missing api_key_read_*) | MEDIUM | MEDIUM — UNCHANGED | Out of Phase F0 scope |
| F-DB-03 (salary_type + end_date_reason no RLS) | LOW | LOW — UNCHANGED | Out of Phase F0 scope |
| New contracts tables RLS (pension_scheme, contract_pay_rule etc.) | N/A (new) | PASS | 5 new tables have both JWT + api_key policies |
| Voice quality events (F-DB-05) | PASS | PASS — unchanged | No regression |
| user_identity naming (ADR-0011) | PASS | PASS — unchanged | No regression |
| ADR-0107 channel derivation | PASS | PASS — unchanged | No regression |

**New finding this pass:**
- T-REG-01 (LOW) — Zod regex permissiveness for voice session_id. Safe due to defence-in-depth; not present in baseline because the union itself is new.

---

## Verified Intentional

- **Botsson runtime events not on all 4 destinations:** `botsson.turn_started` routes `["logger", "activity_trail"]` only (no posthog, no engine_event). `botsson.turn_completed` routes `["posthog", "logger", "activity_trail"]` (no engine_event). Registry comment at line 9801 attributes these to ADR-0116 Phase 3 intent. Not a violation — conversation turns are not workflow triggers.
- **Voice quality events posthog+logger only:** `voice.first_speech_ts_ms`, `voice.turn_end_ts_ms`, `voice.user_recut`, `voice.session_abandonment` route to `["posthog", "logger"]`. Intentional per registry comment at lines 9847-9849: "OBSERVATIONAL only — no activity_trail, no engine_event." PASS.
- **`outreach sms_sent` / `outreach call_initiated` — no producer:** Pre-declared in registry ahead of capability ship (TRANSITIONAL comment in `tool-selector.ts:121-126`). Acknowledged INFO, not phantom event.
- **`salary_type` / `end_date_reason` no workspace_id:** These are platform-level K1a lookup tables (no workspace scope). Missing RLS is the finding (F-DB-03), but absence of `workspace_id` is correct by design.
