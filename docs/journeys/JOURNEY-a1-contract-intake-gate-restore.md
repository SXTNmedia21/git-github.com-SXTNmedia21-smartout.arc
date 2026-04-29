---
title: "Journey — A1 Contract-Intake Gate Restore"
feature: a1-contract-intake-gate-restore
status: draft
updated: 2026-04-29
created: 2026-04-29
module: contract
tags: [contract-intake, gate-action, security, regression]
---

# Journey — A1 Contract-Intake Gate Restore

Single-purpose sortie. Restores authority gate on 4 contract-intake RPC paths. No new product flow — restores existing flow's security envelope.

## Journey 1: Ansatt submits PII via Botsson chat (gate restored)

**Mål:** Ansatt sender personnr/adresse/bank-data via Botsson chat under contract-intake. Authority gate evaluates BEFORE write. Rejected/escalated calls produce ADR-0138 discriminated union response.

**Precondition:**
- Ansatt invitert med pending contract (status `pending_data`)
- Ansatt har gyldig session, `ctx.profileId` derived server-side per ADR-0151
- `engine_authority_config` row for `contract_intake` capability — default-allow per ADR-0099 §5 + Wave H exclusion

### Steg

1. **Ansatt** sender melding "Personnr er XXXXXXXXXX" via Botsson chat
   → Stage Engine routes to `contract_intake` capability via intent classifier
   → Tool guard checks `ctx.channel === "chat"` (ADR-0078 Layer 3)
   → Tool runs Zod validation on field group BEFORE gate (defense-in-depth)

2. **System** invokes `callGateAction()` / `gatedMutation()` per ADR-0204:
   → `capability='contract_intake'`, `entityId=ctx.profileId`, `actionType='submit_field_group'`
   → RPC returns discriminated union: `applied | applied_with_exception | proposed | blocked`
   → Default-allow path returns `applied` (registry exclusion intentional)

3. **Tool writes** PII via `userClient.rpc("submit_own_pii", ...)` AFTER gate clears
   → Auth via employee-scoped client (auth.uid() resolves correctly) per ADR-0077
   → RLS narrows to ansatts own profile

4. **Tool emits** `contract_intake.submitted` with `nonEmpty(workspace_id)` + `nonEmpty(actor_id)` per ADR-0193
   → Activity-trail receives non-empty IDs (ADR-0152 fail-fast pass)

**Postcondition:**
- `profile.personal_number` / `address` / `bank_account` populated
- `engine_state` for contract progresses: `pending_data` → `ready_to_send`
- Audit trail row written with gate outcome
- Botsson confirms to ansatt

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Channel ≠ chat | Tool throws — voice/system blocked (ADR-0078) |
| Validation fail | Tool returns error before gate — Zod schema mismatch |
| Gate returns `blocked` | Discriminated union → Botsson surfaces user_message in Norwegian (ADR-0138) |
| Empty `actor_id` / `workspace_id` | `nonEmpty()` throws — ADR-0193 fail-closed |
| Activity-trail provider rejects | Throws per ADR-0152 fail-fast — surfaces as 500 to caller |
| RLS denies write | Postgres error — caller sees friendly Norwegian message via Botsson |

## Journey 2: Ansatt declines contract via Botsson (gate restored)

**Mål:** Ansatt avviser kontrakt via Botsson chat. Authority gate evaluates decline action.

**Precondition:**
- Pending contract sent to ansatt
- Ansatt session valid

### Steg

1. **Ansatt** sender "Jeg ønsker ikke å akseptere kontrakten" via chat
   → Botsson router → `contract_intake` capability → `declineIntake` tool
   → Channel guard passes (`chat`)

2. **Tool calls** `callGateAction({capability='contract_intake', actionType='decline'})` BEFORE write
   → Default-allow returns `applied`

3. **Tool writes** `ctx.supabaseAdmin.rpc("decline_contract_intake", ...)`
   → Updates `engine_state.status = 'declined'`
   → Updates `employment_contract.status = 'declined'`

4. **Tool emits** `contract_intake.declined` with non-empty IDs

**Postcondition:**
- Contract status `declined`
- Admin notified via existing notification path
- Ansatt confirmed via Botsson

**Error paths:**

| Scenario | System-respons |
|----------|----------------|
| Already declined | Idempotent — second call no-ops |
| Already signed | Cannot decline signed contract — error surfaced |
| Gate `blocked` | ADR-0138 user_message returned |

## Cascade-touchpoints

| Journey | Cascade-dimensjoner berørt | Kritiske entiteter |
|---------|---------------------------|---------------------|
| 1. Submit PII (gated) | D2 (resource pre-bind) | `profile`, `engine_state`, `engine_authority_config` |
| 2. Decline (gated) | D2 + C4 | `employment_contract`, `engine_state`, `engine_authority_config` |

## Telemetri pr journey

| Journey | Key events |
|---------|-----------|
| 1 | `contract_intake.submitted`, `gate.action_evaluated` |
| 2 | `contract_intake.declined`, `gate.action_evaluated` |

## Endringshistorikk

| Dato | Endring | Forfatter |
|------|---------|-----------|
| 2026-04-29 | Initial — A1 gate-restore journeys | Claude (caveman) |
