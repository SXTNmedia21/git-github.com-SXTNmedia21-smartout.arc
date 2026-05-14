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

### Track A — POST `/api/payroll/consent-documents` (court_order only, Option B)

**Scope decision (2026-05-14)**: Court-order direct-insert only. DocuSeal-mediated flows (loan_agreement, uniform_policy, union_dues, other_voluntary) deferred to separate sortie (warrants own design — envelope template, signing UX, retry logic).

**Justification**: `consent_document.docuseal_submission_id` is NULLABLE. Court orders use lovhjemmel (utleggstrekk fra namsmann) — no employee signature required. This unblocks the most common manager flow without DocuSeal complexity.

**File**: NEW `apps/web/src/app/api/payroll/consent-documents/route.ts` (POST handler).
T2's existing GET handler stays (sibling file `deduction-consents/route.ts`).

**Endpoint shape**:

```typescript
POST /api/payroll/consent-documents
Body: {
  employeeProfileId: string;      // UUID
  consentType: 'court_order';     // only this type accepted in Option B
  courtOrderReference: string;    // utleggstrekk-saksnummer, REQUIRED for court_order
  signedAt: string;               // ISO timestamp — date court order issued
  signedDocumentUrl: string;      // URL to scanned court order PDF
  expiresAt?: string;             // optional end-date
}
Response 201: { ok: true, consentDocumentId: string }
Response 400: validation error
Response 403: not manager+ role
Response 404: profile not in workspace
```

**Implementation**:

1. Zod schema validates body. Reject non-`court_order` consentType with explicit error `consent_type_requires_docuseal` (404 + remediation: "DocuSeal flow not yet implemented for this consent type").
2. `resolvePayrollAuth(request)` → workspace_id + actor_profile_id from JWT (ADR-0151, mirrors T2 GET handler).
3. Authorization: actor must be manager+ in workspace. 403 otherwise.
4. Validate `employeeProfileId` belongs to JWT workspace (L-0177 fail-fast).
5. INSERT `payroll.consent_document`:
   - `consent_type = 'court_order'`
   - `court_order_reference = body.courtOrderReference`
   - `docuseal_submission_id = NULL`
   - `signed_at`, `signed_document_url` from body
   - `status = 'active'`
   - `paragraph_ref` defaults to `'Aml. §14-15 tredje ledd nr. 1-6'`
6. Emit telemetry event `payroll.consent_document.created` (new event, add to registry).
7. Write `activity_trail` row via emit (engine_event destination + audit).
8. Wrap in `gateAction('payroll', 'create_consent_document', {...})` (matches T1 pattern for consistency — admin gate-line).

**Telemetry**: 1 new event `payroll.consent_document.created`. Properties:
```
{
  consent_document_id: UUID,
  employee_profile_id: UUID,
  consent_type: 'court_order',
  court_order_reference: string,
  actor_role: string,
}
```

Add to:
- `SmartoutEvent` union (next free slot post current dev tip events)
- `EVENT_ROUTING` record: destinations `[posthog, activity_trail, logger, engine_event]`
- category `"payroll"` or `"compliance"`

**Risks**:
- `gateAction` capability/action_type combo — verify 'payroll' / 'create_consent_document' is the correct shape per T1's pattern. Track C adds `contract` capability seed; this endpoint should similarly seed `payroll.create_consent_document` OR rely on default-allow if Track C decides to limit scope.
- Activity log `entity_id` shape — use `consent_document_id` as entity_id, `entity_type = 'consent_document'`.

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

1. `journey-court-order-create.spec.ts` — Admin creates court_order consent:
   - Seed: workspace + admin + employee (no existing consent)
   - POST `/api/payroll/consent-documents` with court_order body
   - Assert 201 + consent_document_id in response
   - Assert `payroll.consent_document` row exists with `docuseal_submission_id IS NULL`
2. `journey-non-court-order-rejected.spec.ts` — Non-court_order types rejected (Option B scope):
   - POST with `consentType: 'loan_agreement'`
   - Assert 404 + error code `consent_type_requires_docuseal`
3. `journey-court-order-then-trekk.spec.ts` — End-to-end happy path:
   - Step 1: Admin creates court_order consent via POST
   - Step 2: Manager opens LineOverrideModal, picks category `deduction`, selects the new consent
   - Step 3: POST `/api/payroll/propose-line-override` succeeds with 200
   - Verify `change_proposal` row created referencing consent_document_id

Reference T2 journey files at `docs/journeys/JOURNEY-sma-328-aml-14-15-trekk-consent-*.md` for canonical step semantics. Note: T2's "with-consent" and "without-consent" journeys are partially testable today — full DocuSeal flow remains deferred.

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
