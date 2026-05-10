---
title: "ADR + Contract Audit Smoke Summary — 2026-05-10 (run 02)"
status: complete
created: 2026-05-10
updated: 2026-05-10
mode: smoke
run_id: 2026-05-10-adr-contract-validation-02
slices_run: 3
baseline: 2026-05-10-adr-contract-validation
campaign: campaign/botsson-arena
phase_f0_status: closed
tags: [audit, summary, smoke, phase-f0, post-fix-verification]
---

# ADR + Contract Audit Smoke Summary — 2026-05-10 run 02

## Purpose

Post Phase-F0-perimeter-closure verification. Confirm whether the two promotion-blockers from baseline (`docs/audits/2026-05-10-adr-contract-validation/00-SYNTHESIS.md`) are now closed:

- **F-AC-02 CRITICAL** — landing wizard voice path calling deleted `/adapters/ultravox/create-call`
- **F-SE-01 HIGH** — voice multi-tenant workspace derivation breach

## Headline verdict

✅ **Both promotion-blockers CLOSED.** Phase F0 sortie effective. Campaign closer to promotable.

⚠️ Non-blocking baseline findings outside Phase F0 scope remain open (capability gate gaps + 2 ADR-0179 EF violations + db-rls debt). These were never claimed as Phase F0 scope.

## Aggregate counts

| Slice | C | H | M | L | Notes |
|---|---|---|---|---|---|
| 01 capability-tools | 0 | 3 | 2 | 2 | 1 new (F-CT-04 deepened with L-0176 layer) |
| 02 edge-functions | 0 | 2 | 1 | 2 | 1 reclassified HIGH→LOW (F-EF-02b false-positive in baseline) |
| 03 db-rls-telemetry | 0 | 0* | 0* | 2 | F-SE-01 closed; F-DB-01/02/03 carried unchanged |
| **Total** | **0** | **5** | **3** | **6** | |

*Slice 03 did not re-flag F-DB-01 (HIGH) or F-DB-02 (MEDIUM) as smoke-scope; carried from baseline unchanged.

## Closure verification

### F-AC-02 CRITICAL → CLOSED ✅ (Slice 02)

Edge-functions slice ran `grep -rn "ultravox" supabase/functions/` = **0 hits**. Combined with Phase F0 commit `6d52c6522` (apps/landing strip), ADR-0282 acceptance contract `grep ultravox in apps/ packages/ = 0` is met.

### F-SE-01 HIGH → CLOSED ✅ (Slice 03)

Slice 03 verified all four closure criteria in `services/stage-engine/src/routes/agent/chat.ts` (commit `bb1178ac2`):

1. Service-account voice branch at `chat.ts:180-198` uses `body.workspace_context.workspace_id`, NOT JWT-derived service-account workspace
2. Fail-closed `400 MISSING_WORKSPACE_CONTEXT_FOR_SERVICE_ACCOUNT` when `workspace_context` absent (L-0177 compliant)
3. Zod schema extended via `z.union()` to accept voice session_id format (prior schema would have rejected ALL voice calls)
4. Profile derivation via `parseVoiceSessionProfileId()` + DB existence check (not body-supplied actor — ADR-0151 compliant)

## Phase F0 churn assessment

Phase F0 sortie introduced **0 new HIGH or CRITICAL violations** across the 3 smoke slices.

Notable POSITIVE findings from this run:

- `engine-world/tools.ts` (new on `campaign/botsson-arena` pre-Phase-F0): gold-standard implementation — full `gatedMutation()` Pathway A+B, server-derived workspace_id, post-gate emit.
- All webhook EFs (Stripe, SendGrid, LiveKit) signature-verified.
- All cron/internal EFs use fail-closed secret-bearer patterns.
- `database.types.ts` zero `"user"` table references (only `user_identity`).

## Open items outside Phase F0 scope

These were NOT promotion-blockers in baseline and NOT claimed by Phase F0. Listed for downstream sortie planning, not for blocking promotion.

### From slice 01 (capability-tools)

| Finding | Severity | File:line | ADR | One-liner |
|---|---|---|---|---|
| F-CT-02 | HIGH | `communication/tools.ts:174` | 0204 | `sendMessage` INSERT `channel_message` — no `callGateAction`, no `gate_evaluation` row |
| F-CT-03 | HIGH | `guardian/tools.ts:83-91` | 0204, 0186 | `acknowledgeSignal` UPDATE `guardian_signal` — no gate, no emit (audit-critical table) |
| F-CT-04 | MEDIUM (deepened) | `onboarding/tools.ts:730,760-790` | 0204, L-0176 | `add_key_fact` body bypasses gate while docstring claims compliance — 6th L-0176 occurrence |

### From slice 02 (edge-functions)

| Finding | Severity | File:line | ADR | One-liner |
|---|---|---|---|---|
| F-EF-01 | HIGH (open) | `analyze-setup-documents` | 0179 | `verify_jwt=false` + header-presence-only + service_role + browser-direct |
| F-EF-02a | HIGH (open) | `ingest-workspace-knowledge` | 0179 | Browser-callable from `wizard-definition.ts:295` (`"use client"`) + wildcard CORS |
| F-EF-03 | MEDIUM (new) | `ingest-workspace-knowledge` | — | Inline `Access-Control-Allow-Origin: *` |

### From slice 03 (db-rls-telemetry)

| Finding | Severity | File:line | ADR | One-liner |
|---|---|---|---|---|
| F-DB-01 | HIGH (open) | `engine_world_observe_platform` | 0012 | GRANT to `authenticated` without body guard — promotion-blocker per baseline; out of Phase F0 scope |
| F-DB-02 | MEDIUM (open) | 6 tables | 0012 | Missing `api_key_read_*` policy — Phase F0 new contract tables correctly wired |
| F-DB-03 | LOW (open) | `salary_type`, `end_date_reason` | 0012 | Tables created without `ENABLE ROW LEVEL SECURITY` |
| T-REG-01 | LOW (new) | chat schema regex | — | Voice session_id regex `[0-9a-f-]{36}` slightly permissive; safe via second-layer parse validator |

## Reclassifications from baseline

| Finding | Before | After | Reason |
|---|---|---|---|
| F-EF-02b (`send-login-code` browser-invoke claim) | HIGH | LOW (false positive) | Caller `people-actions.ts:766` is `"use server"` Server Action, ADR-0179 mutation surface table compliance |

## Promotion gate status

| Gate | Status |
|---|---|
| F-AC-02 CRITICAL closed | ✅ |
| F-SE-01 HIGH (multi-tenant) closed | ✅ |
| ADR-0282 grep contract (apps/ packages/ supabase/) | ✅ 0 hits |
| Phase F0 introduced no new HIGH/CRITICAL | ✅ |
| Pre-existing F-DB-01 HIGH (`engine_world_observe_platform`) | ⚠️ Open — was open before Phase F0, not Phase F0 scope. Pontus decision: include in promotion or carry to next sortie. |
| Pre-existing 2× ADR-0179 EF violations (F-EF-01, F-EF-02a) | ⚠️ Open — was open before Phase F0, not Phase F0 scope. Same decision. |

## Recommendation

Phase F0 perimeter closure achieved its declared scope. Two promotion-blockers it owned are closed. Pontus to decide on remaining out-of-scope HIGHs:

- **Option A:** Promote `campaign/botsson-arena → development` now. Carry F-DB-01 + F-EF-01 + F-EF-02a as standalone sorties.
- **Option B:** Open Phase F sortie 2 to close F-DB-01 + F-EF-01 + F-EF-02a before promoting. Adds ~2 days.

No basis to revert anything. No new regression introduced this sortie.

## Per-slice reports

- [01-capability-tools.md](01-capability-tools.md)
- [02-edge-functions.md](02-edge-functions.md)
- [03-db-rls-telemetry.md](03-db-rls-telemetry.md)
