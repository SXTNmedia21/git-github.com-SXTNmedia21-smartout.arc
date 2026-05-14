---
title: "Contracts Compliance Debt Cleanup"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: contracts
tags: [contracts, debt-cleanup, docuseal, authority, tests, sma-328, sma-306]
sortie: feat/contracts-compliance-debt-cleanup
worktree: ~/dev/smartout.ai-wt-1
---

# Contracts Compliance Debt Cleanup

Closes 3 mechanical debt items from 2026-05-14 contracts compliance cluster (T1 + T2 sorties merged). Out of scope: T1 §14-6 g/h/k/q field-mapping (needs design council).

## Background

Cluster shipped 2026-05-14:
- T1 `feat/contracts-compliance-cluster` → merge `f959d9643` — SMA-306/307/310/311
- T2 `feat/sma-328-aml-14-15-trekk-consent` → merge `6255f654d` — SMA-328 trekk-consent

Both HANDOFFs flagged debt items. This sortie closes the mechanical ones.

## Success Criteria

1. **DocuSeal webhook persists `payroll.consent_document`** when employee signs trekk-consent envelope. End-to-end consent loop closes.
2. **`engine_authority_config` row exists** for `capability='contract'` with explicit action_types — gateAction enforces allow/deny instead of default-allow on contract routes.
3. **Test coverage**: pgTAP for `payroll.consent_document` (3 RLS policies + FK + deviation trigger), Playwright specs for 3 T2 journeys.
4. Typecheck 52/52 green.
5. ADRs registered if any new architecture decisions emerge (DocuSeal multi-submission_type dispatch pattern is a candidate).

## Out of Scope

- T1 §14-6 bokstaver g/h/k/q field-mapping (`holiday_allowance_pct`, `notice_period_months`, `break_rule_id`, `otp_terms`). Decision A (add columns) vs B (mark `tracked: false`) → separate sortie with lovsen council.

## Tracks

### Track A — DocuSeal `deduction_consent` webhook branch

**File**: `apps/web/src/app/api/webhooks/docuseal/route.ts`

**Today**: Handles `submission_type ∈ {contract, employment_contract, contract_event}`. NO branch for `deduction_consent`.

**Tomorrow**: Add `deduction_consent` branch:

1. Read existing branches first — match pattern (signature verification, payload extraction, error handling).
2. Extract `change_proposal_id` from envelope metadata (T2 sortie injected this when DocuSeal envelope created).
3. Resolve `profile_id` + `workspace_id` server-side from `change_proposal.profile_id` + `change_proposal.workspace_id` (NEVER from request body per ADR-0151).
4. INSERT `payroll.consent_document`:
   ```sql
   INSERT INTO payroll.consent_document
     (id, workspace_id, profile_id, change_proposal_id, consent_type,
      docuseal_submission_id, signed_at, signature_data, status)
   VALUES (...)
   ```
5. UPDATE `change_proposal.consent_document_id = NEW.id` (closes FK loop).
6. Emit telemetry event `payroll.deduction_consent.signed` (add to registry if missing). Properties: `change_proposal_id`, `consent_document_id`, `signed_at`, `submission_id`.
7. Write `activity_trail` row (workspace-scoped audit).
8. Idempotency: if `docuseal_submission_id` already exists in consent_document, return 200 no-op (DocuSeal retries).

**Telemetry**: 1 new event `payroll.deduction_consent.signed`. Add to:
- `SmartoutEvent` union (next free slot post existing T2 events)
- `EVENT_ROUTING` record: destinations `[posthog, activity_trail, logger, engine_event]`
- category `"payroll"` or `"compliance"`

**Risk**: DocuSeal payload shape for `deduction_consent` envelopes — T2 sortie set the metadata, but exact JSON path for `change_proposal_id` extraction unclear. Build agent must read T2's BFF route at `apps/web/src/app/api/payroll/deduction-consents/route.ts` to confirm what metadata gets attached to envelope.

### Track B — Tests (depends on Track A)

**pgTAP** in `supabase/tests/`:

1. `payroll_consent_document_rls.sql`:
   - `jwt_read_consent_document` (profile_id = own OR manager+ in workspace)
   - `jwt_insert_consent_document` (deny — webhook-only via service_role)
   - `api_key_read_consent_document` (workspace_id = `get_api_workspace_id()`)
2. `payroll_consent_document_fk.sql`:
   - FK `change_proposal.consent_document_id → consent_document(id)` enforces RESTRICT on delete
   - `consent_document.profile_id → profile(id)` cascade
3. `payroll_consent_document_deviation.sql`:
   - Trigger backfills `payroll.deviation` row when `change_proposal` deletes its consent (historical-gap case)

**Playwright E2E** in `apps/e2e/tests/contracts-compliance-debt/`:

1. `journey-with-consent.spec.ts` — Manager applies trekk with valid consent:
   - Seed: workspace + manager + employee + valid `consent_document` row
   - Manager opens LineOverrideModal, picks category `deduction`, selects consent
   - POST `/api/payroll/propose-line-override` succeeds with 200
   - Verify `change_proposal` row created with `consent_document_id` set
2. `journey-without-consent.spec.ts` — Rejected without consent:
   - Same seed minus consent_document
   - Manager opens modal, picks `deduction`, no consent available
   - POST returns 422 with error code `consent_required_aml_14_15`
   - Verify NO `change_proposal` row created
3. `journey-lovsen-paragraph-binding.spec.ts` — Lovsen validates §14-15:
   - Call `validateAml1415` tool directly
   - Assert paragraph reference returns `aml.14_15.tredje_ledd.nr_1` through `nr_6`
   - Assert deduction without consent fails validation with `error.paragraph`

Reference T2 journey files at `docs/journeys/JOURNEY-sma-328-aml-14-15-trekk-consent-*.md` for canonical step semantics.

### Track C — Authority config seed

**Migration**: `supabase/migrations/<post-tip>_contract_capability_authority_seed.sql`

Current dev tip: `20260616100200_agent_session_whisper_per_verb.sql`. New migration must be `>= 20260616100300`.

**Action**:

```sql
INSERT INTO engine_authority_config (
  workspace_id,
  capability,
  action_types,
  default_action,
  required_role,
  created_at,
  updated_at
) VALUES (
  NULL, -- platform-default (NULL workspace_id)
  'contract',
  ARRAY['send', 'send_single', 'revise', 'regenerate', 'compose', 'send_dispatch'],
  'allow', -- pair with required_role for net allow-if-admin
  'admin',
  now(),
  now()
)
ON CONFLICT (workspace_id, capability) WHERE workspace_id IS NULL DO NOTHING;
```

**Verify first**:
1. `\d+ engine_authority_config` — confirm column types (`action_types text[]` vs `jsonb`, `default_action` enum values)
2. `grep "gateAction(.*'contract'" apps/web/src/app/api/` — confirm exhaustive action_types list
3. `grep -r "capability = 'contract'" supabase/migrations/ apps/web/` — confirm no prior seed
4. Migration must be idempotent (`ON CONFLICT DO NOTHING`)

**Effect**: gateAction transitions from default-allow (no row) to explicit allow-if-admin. Non-admin attempts denied with `gate_denied` 403.

## Dispatch Order

1. **Parallel**: Track A + Track C (no shared files, no FK dependency)
2. **Sequential after A**: Track B (E2E needs working webhook for happy path)

## Review Gates

| Gate | Criteria |
|------|----------|
| G1 Pre-dispatch | Plan committed to main, propagated to wt-1, fact-check pass (migration timestamp, file paths, telemetry slot) |
| G2 Track returns | typecheck 52/52, files staged, HANDOFF section drafted, journey frontmatter `status: verified` |
| G3 Pre-merge | No migration collision, no ADR collision, no registry conflicts |
| G4 Council | Only if Track A/C diverge from plan or new ADR proposed |

## Council Escalation Triggers

- DocuSeal payload shape ambiguous after agent reads code → `system-agent-coordinator` for code-trace
- `engine_authority_config` action_types format uncertain → `botsson-harness-builder` (knows authority schema laws)
- Track A wants new ADR for multi-submission_type dispatch pattern → full council

## Migration Timestamps

- Track C migration: `20260616100300` or higher. Verify dev tip first via `ls supabase/migrations/ | tail -3`.

## ADR Slots

If new ADR needed:
- Dev tip ADR count: 0316 (Track A Min Dag) is latest. Next free = 0317.
- Track A *may* warrant ADR for "DocuSeal multi-submission_type dispatch" if pattern is new. Build agent decides at HANDOFF time.

## Files Likely Modified

- `apps/web/src/app/api/webhooks/docuseal/route.ts` (Track A)
- `packages/telemetry/src/registry.ts` (Track A — new event)
- `supabase/migrations/20260616100300_contract_capability_authority_seed.sql` (Track C — new)
- `supabase/tests/payroll_consent_document_*.sql` (Track B — 3 new files)
- `apps/e2e/tests/contracts-compliance-debt/*.spec.ts` (Track B — 3 new files)
- `docs/HANDOFF-contracts-compliance-debt-cleanup.md` (orchestrator — synthesized at end)

## Journey Files

3 T2 journeys already exist at `docs/journeys/JOURNEY-sma-328-*.md` — reuse those for Track B E2E. No new journey files needed for this sortie unless Track A's webhook handler warrants a separate journey (orchestrator decides).

## Closure Checklist

- [ ] Track A typecheck 52/52 green
- [ ] Track C migration applies clean to local
- [ ] Track B pgTAP green
- [ ] Track B 3 Playwright specs green
- [ ] HANDOFF written with debt-closure summary
- [ ] ADR-0317 registered if Track A added new architecture decision
- [ ] All journey frontmatter `status: verified` (3 existing T2 journeys remain `verified` from T2 close)

## Risks

- DocuSeal webhook payload shape mismatch with T2's envelope metadata → reverse-engineer via `apps/web/src/app/api/payroll/deduction-consents/route.ts`
- engine_authority_config schema may use jsonb not text[] → verify before write
- Migration race: parallel sorties may push migrations between dispatch and merge → recheck tip before commit
- Sub-agent confusion: Track A vs T1 ADR-0204 gatedMutation vs gateAction → use `gateAction` (T1 pattern), NOT `gatedMutation`
