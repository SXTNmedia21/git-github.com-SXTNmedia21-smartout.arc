---
title: "Journey — Contract Binding Auto-Seed"
feature: contract-binding-auto-seed
status: draft
updated: 2026-05-06
created: 2026-05-06
module: contract
linear: SMA-309
tags: [journey, contract, onboarding, workspace-bootstrap]
---

# Journey: Contract Binding Auto-Seed

This sortie has ONE journey — the broken bootstrap path that SMA-309 fixes.

## Journey: New workspace creates first contract

**Role:** Admin (workspace owner)

**Precondition:**
- Smartout instance running with K1a `regulatory_framework` row for Riksavtalen Hospitality 2024 seeded (workspace_id IS NULL, is_active=true)
- Admin has just completed `/join` onboarding wizard → `finalize-workspace` Edge Function ran → new workspace row exists
- Admin profile has role=`owner` in new workspace
- At least one employee profile exists in workspace (created during onboarding)
- At least one contract template available (workspace template OR K1a system template)

### Steps

1. **Admin** navigates to `/dashboard/people/[id]` for new employee
   → System loads profile + Ansettelse section
   → Admin fills out 15 §14-6 fields → klikker "Lagre ansettelse"
   → `POST /api/contracts/employment/upsert` succeeds → `employment_contract` row created with `status='draft'`
   → Admin sees "Klar til å sende kontrakt"-badge

2. **Admin** navigates to `/dashboard/contracts` → klikker "Lag kontrakt"
   → `EmployeePickerDrawer` opens → admin picks the employee
   → `ContractDispatchDrawer` mounts (Step 1: Velg mal)

3. **Admin** selects template → klikker "Neste"
   → System fetches `/api/contracts/resolve-placeholders` for preview
   → **CRITICAL:** internally calls `resolveComposition()` which queries `workspace_framework_binding`

4. **System** reads `workspace_framework_binding`:
   → **WITH this fix:** trigger seeded binding on workspace INSERT → row exists → `resolveComposition()` succeeds → preview renders
   → **WITHOUT fix:** `.single()` throws PGRST116 → 500 → drawer shows toast "Kunne ikke laste forhåndsvisning" → admin stuck

5. **Admin** sees PDF preview → klikker "Jeg har lest gjennom" → AcknowledgementRing unlocks
   → Admin confirms 4 blocks → klikker "Send til signering"
   → `POST /api/contracts/send` succeeds → contract dispatched to DocuSeal

**Postcondition:**
- `workspace_framework_binding` row exists for this workspace (auto-seeded by trigger)
- `employment_contract.status = 'sent'`
- `framework_snapshot` JSONB frozen with `framework_id` from auto-seeded binding
- Telemetry: `workspace.framework_binding_auto_seeded` emitted at workspace creation; `contract.send_initiated` emitted at send

**Error paths:**

| Scenario | System response (with fix) |
|----------|----------------------------|
| K1a Riksavtalen row missing in DB | Trigger logs RAISE NOTICE + skips. Workspace insert succeeds. First contract send returns 400 with NEW error: "Workspace mangler regulatory framework. Kontakt support." |
| Workspace INSERT happens before K1a seed migration applied | Trigger fires but no matching framework — same as above. Backfill on later migration catches up. |
| Multiple K1a rows match (unlikely, partial unique broken) | Trigger uses `LIMIT 1` — picks newest. Document in HANDOFF as known limitation. |
| Existing workspace from before fix | Backfill INSERT in same migration handles it. Idempotent via `NOT EXISTS`. |
| Concurrent workspace INSERT | `AFTER INSERT FOR EACH ROW` runs in same transaction → atomic. No race. |

## What this journey replaces

**OLD broken flow** (without fix):
- Admin completes onboarding
- Admin tries to send first contract
- → 400 "No active framework binding for workspace"
- → Admin has no recourse — must contact support
- → Support manually runs `INSERT INTO workspace_framework_binding ...`
- → Admin retries, succeeds
- **Friction tax:** every single new workspace, manual intervention required.

**NEW fixed flow** (with this sortie):
- Admin completes onboarding
- Admin sends first contract → succeeds first try
- **Zero friction.** Zero support burden.

## Telemetry trace

```
workspace.created (existing, from finalize-workspace EF)
  ↓ (trigger fires same transaction)
workspace.framework_binding_auto_seeded (NEW — from this sortie)
  workspace_id, framework_id, framework_code: "riksavtalen_hospitality_2024", source: "trigger"
  ↓ (later, when admin sends first contract)
contract.send_initiated (existing)
contract.signed (existing, via DocuSeal webhook)
```

## Cascade-touchpoints

| Cascade dimension | Affected |
|---|---|
| K1a (regulatory_framework, tariff_rate_table) | Read-only — looked up to seed binding |
| K1b (workspace_framework_binding) | Write — auto-seeded on workspace INSERT |
| D2 (profile, employment_contract) | Indirect — composition can now succeed for fresh ws |
| C4 (engine_authority_config) | No change |

## Manual test cases

After deploy, verify:

1. Create new test workspace via Supabase Local SQL: `INSERT INTO workspace (...) VALUES (...)`
2. Query `workspace_framework_binding WHERE workspace_id = <new>` → row exists with framework_id pointing to Riksavtalen Hospitality 2024
3. Run end-to-end via E2E: signup new admin → onboarding → send first contract → verify success
4. Run backfill verification: temporarily delete a binding row, run migration via `npx supabase migration up`, verify row recreated
