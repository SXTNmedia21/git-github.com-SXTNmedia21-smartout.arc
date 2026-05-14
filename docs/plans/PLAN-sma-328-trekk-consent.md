---
title: Plan — SMA-328 AML §14-15 Trekk-Consent (T2)
status: draft
created: 2026-05-14
updated: 2026-05-14
module: payroll
scope: sortie
tags: [sma-328, aml-14-15, trekk, consent, payroll, lovsen, lonnsgrunnlag]
---

# Plan: SMA-328 AML §14-15 Trekk-Consent (T2)

**Sortie branch:** `feat/sma-328-aml-14-15-trekk-consent` (active in `~/dev/smartout.ai-wt-1`)
**Journeys declared:** 3 (manager-applies-trekk-with-consent / manager-applies-trekk-without-consent-rejected / lovsen-validates-paragraph-binding)
**ADR slot:** 0311 (Consent-document FK on payroll-deductions §14-15)

---

## Probe Results

- **consent_document schema:** Does NOT exist. `confirmation_signature` (`supabase/migrations/20260412100200_completion_tracking.sql:56`) is the closest — immutable signed record per employee per confirmation. NO `confirmation_type` column today. Journeys declare `confirmation_type = deduction_consent` — enum extension required.
- **Trekk-code representation:** `payroll.salary_code_category` ENUM contains `'deduction'` (`20260422110000_payroll_enums.sql:26`). `payroll.calculation_line` has `line_type TEXT CHECK IN ('base','supplement','deduction','overtime','meal')` (`20260422110200_payroll_calculation_tables.sql:135`). Code 910 not yet typed (free-text). Spec doc defers 910 mapping to SMA-332.
- **LineOverrideModal category:** Local TS union `"manual_adjustment" | "tariff_interpretation" | "shift_data_error" | "other"` (line 74). Zod schema in `propose-line-override/route.ts:40` mirrors. Both must gain `"deduction"`.
- **ADR-0311:** Reserved + unused. Safe.

---

## 1. Schema Decision (Council resolved — Pontus approved Phase 6)

New table `payroll.consent_document` with own RLS, own enum, own DocuSeal binding. Drops confirmation_signature reuse path entirely.

**Rationale:** Cascade invariant 2 (one entity = one role). `confirmation_signature` is governance/training-attestation. Deduction consent is payroll-domain wage-trekk artifact (§14-15 tredje ledd). Different lifecycle, different RLS audience, different DocuSeal binding (different document templates).

Original Option A (extend `confirmation_signature` with `confirmation_type`) is REJECTED — FK chain violation: `confirmation_signature.confirmation_id → confirmation.confirmation_id` is NOT NULL; no `confirmation` row exists for `type='deduction_consent'`. Plan path = silent FK violation.

---

## 2. Migration

**M1 — Create `payroll.consent_document`:**

Migration: `20260615110000_create_payroll_consent_document.sql`

```sql
CREATE TABLE IF NOT EXISTS payroll.consent_document (
  consent_document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  employee_profile_id UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE RESTRICT,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('loan_agreement','uniform_policy','union_dues','court_order','other_voluntary')),
  court_order_reference TEXT NULL, -- required when consent_type='court_order'
  signed_at TIMESTAMPTZ NOT NULL,
  signed_document_url TEXT NOT NULL,
  docuseal_submission_id TEXT NULL,
  expires_at TIMESTAMPTZ NULL, -- e.g. loan-agreement repayment-end date
  superseded_by_id UUID NULL REFERENCES payroll.consent_document(consent_document_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','superseded')),
  paragraph_ref TEXT NOT NULL DEFAULT 'Aml. §14-15 tredje ledd nr. 1-6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (consent_type != 'court_order' OR court_order_reference IS NOT NULL)
);

CREATE INDEX idx_consent_doc_profile_status ON payroll.consent_document (employee_profile_id, workspace_id, status);
CREATE INDEX idx_consent_doc_expires ON payroll.consent_document (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE payroll.consent_document ENABLE ROW LEVEL SECURITY;

-- JWT policy: workspace_id scoped read for managers+
CREATE POLICY jwt_select_consent_doc ON payroll.consent_document
  FOR SELECT USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

-- Service role inserts via DocuSeal callback path (no JWT path for INSERT — consent is signed-by-employee)
CREATE POLICY service_role_consent_doc ON payroll.consent_document FOR ALL TO service_role USING (true);

-- API key read policy
CREATE POLICY api_key_select_consent_doc ON payroll.consent_document
  FOR SELECT USING (workspace_id = public.get_api_workspace_id());
```

**M2 — ADD FK on `change_proposal`:**

Migration: `20260615110100_change_proposal_consent_fk.sql`

```sql
ALTER TABLE public.change_proposal
  ADD COLUMN IF NOT EXISTS consent_document_id UUID NULL REFERENCES payroll.consent_document(consent_document_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS deduction_type TEXT NULL CHECK (deduction_type IN ('loan_agreement','uniform_policy','union_dues','court_order','other_voluntary'));

CREATE INDEX IF NOT EXISTS idx_change_proposal_consent_doc ON public.change_proposal (consent_document_id) WHERE consent_document_id IS NOT NULL;
```

**Backfill (Council Q2 verdict — deviation-flag per lovsen):**

For existing `change_proposal` rows with `kind='wage_line_override'` and `changes->>'category' = 'deduction'` lacking `consent_document_id`:
- INSERT `payroll.deviation` row per missing-consent proposal
- `deviation_class = 'consent_gap_aml_14_15_tredje_ledd'` (per lovsen recommendation)
- Do NOT block export of historical periods (would violate Bokf.lov §7 journalføring per lovsen)
- Document gap in dashboard for auditor review

---

## 3. UI Delta — LineOverrideModal

**Decision:** Extend inline within `LineOverrideModal`, not standalone `DocumentPicker`. Single-context picker; premature abstraction otherwise.

**Changes to `apps/web/src/app/dashboard/payroll/[periodId]/_components/LineOverrideModal.tsx`:**
- Line 74: add `"deduction"` to `Category` union
- Lines 76–81: `CATEGORY_LABELS.deduction = "Trekk i lønn (Aml. §14-15)"`
- New state: `const [consentDocumentId, setConsentDocumentId] = useState<string | null>(null)`
- New hook: `useDeductionConsents(line?.profileId, workspaceId)` — queries `GET /api/payroll/deduction-consents` (returns `payroll.consent_document` rows for the employee)
- Conditional Select rendered when `category === "deduction"` showing consent rows (`{consent_type} — {signed_at}`)
- Empty-state helper: "Ansatt har ingen signerte trekk-samtykker. Send avtale via DocuSeal først."
- Inline error: when `consentDocumentId === null`, "Trekk krever signert samtykke (Aml. §14-15 tredje ledd nr. 1-6)"
- `canSubmit` (line 142): `&& (category !== "deduction" || consentDocumentId !== null)`
- `mutate` (line 129): pass `consent_document_id: consentDocumentId`
- `handleClose` (line 113): reset

**Amount sign:** Journey 1 step 5 says "fills amount (negative for trekk)". Current `parsedAmount > 0` (line 140) blocks negative. Update: `category === "deduction" ? parsedAmount < 0 : parsedAmount > 0`. Input `min="0.01"` (line 212) blocks too — switch to plain `type="number"` when category=deduction. Zod schema `proposed_amount: z.number().positive()` (route.ts:38) also blocks — switch to `z.number()` + superRefine by category.

---

## 4. Server Validation

**Changes to `apps/web/src/app/api/payroll/propose-line-override/route.ts`:**
- Line 40: extend `category` enum with `"deduction"`
- Line 38: `proposed_amount` to `z.number()` + superRefine on `category === "deduction" → < 0`, else `> 0`
- New field `consent_document_id: z.string().uuid().optional()` on `RequestSchema` with superRefine requiring presence when `category === "deduction"` (UNLESS `deduction_type === "court_order"` per §6)
- `workspaceId` is server-derived from JWT session only — do NOT accept as query param (ADR-0151). Mirror pattern from `/api/contracts/send/route.ts:54-66`. Only `profileId` accepted from client.
- Insert Step 5b after concurrent-edit guard, before `change_proposal` INSERT:
  - FK exists? → 404 `consent_not_found`
  - Row `workspace_id !== ctx.workspaceId`? → 403 `workspace_mismatch` (L-0177 fail-fast)
  - Belongs to correct `employee_profile_id`? → 403 `consent_profile_mismatch`
  - `status !== 'active'`? → 422 `consent_not_active`
- Call shared utility `validateAml1415Logic` directly (see §5a). Returns structured error `{ code: "AML_14_15_CONSENT_REQUIRED", paragraph: "Aml. §14-15 tredje ledd nr. 1-6" }` on fail
- `proposalPayload` (line 172): include `consent_document_id` + `deduction_type` when applicable
- Telemetry Step 7: emit `payroll.deduction_consent_referenced` on success
- Compliance-blocked path: emit `payroll.deduction_rejected_no_consent` + `activity_trail` write with `event = "compliance.blocked"`, `data.paragraph = "Aml. §14-15"`

**New BFF route `GET /api/payroll/deduction-consents/route.ts`:**
- Query param: `profileId` only. `workspaceId` server-derived from JWT (ADR-0151 — no client-supplied workspace).
- Server validates profile belongs to JWT workspace before returning rows.
- Returns `payroll.consent_document` rows filtered by `employee_profile_id` + `status='active'`.

---

## 5. Lovsen Capability Addition

**New `validateAml1415`** in `packages/ai/src/capabilities/legal/tools.ts`.

Pattern mirrors `validateAml146` (lines 71–144) but single-rule. Per L-0176: write body first, docstring last.

**Output type:**
```ts
type Aml1415ValidationResult = {
  pass: boolean;
  status: "passes" | "consent_missing" | "consent_expired" | "consent_type_mismatch" | "skip";
  paragraph: "Aml. §14-15 tredje ledd nr. 1-6";
  consent_document_id: string | null;
  signed_at: string | null;
  expires_at: string | null; // read from payroll.consent_document.expires_at
  validator_version: string;
}
```

**Schema:** `z.object({ consent_document_id: z.string().uuid(), profile_id: z.string().uuid(), validation_mode: z.enum(["strict","advisory"]).default("strict") })`

**Channel guard:** `"system"` only. `"autonomous"` dropped — dead code per Layer 1 capability `allowedChannels = ["chat","system"]`. If autonomous needed: separate ADR to extend allowedChannels.

**Body (Phase T2):** Read `payroll.consent_document` via `ctx.supabaseAdmin`. Fail-fast: `if (row.workspace_id !== ctx.workspaceId) return error('workspace_mismatch')` (L-0177). Verify `status === 'active'`, `signed_at` present. For revocable consents: verify `signed_at` not older than 12 months OR document explicitly that signed_at presence alone is sufficient for v1. Emit `legal.aml_14_15.validated`.

**Registry:** export alongside `validateAml146`, `citeLaw`, `classifyAmendment`.

**Tier:** `validateAml1415` goes in `legal/index.ts` `systemTools` array — NOT `readOnlyTools`. Chat sessions at read_only authority must not invoke compliance validation.

### 5a. Shared Utility Extraction

**File:** `packages/ai/src/capabilities/legal/aml-14-15.ts`

**Export:** `validateAml1415Logic(consentDocumentId: string, profileId: string, workspaceId: string, supabaseAdmin: SupabaseAdminClient): Promise<Aml1415ValidationResult>`

- BFF route `propose-line-override/route.ts` calls this utility directly (no agent context needed for server-side enforcement).
- `validateAml1415` capability tool wraps this utility: adds channel guard + `emit()` for agent-channel use.
- Both paths share identical rule logic — no duplication, no divergence.

---

## 6. Trekk-Code Coverage (Council Q3 + Q4)

Spec doc defers code 910 to SMA-332. This sortie covers `category === "deduction"` app-level only.

**Court orders:** Bypass `consent_document_id` requirement — lovhjemmel sufficient per lovsen Q3 verdict. BUT require `payroll.consent_document` row with `consent_type='court_order'` AND `court_order_reference` non-null (utleggstrekk-saksnummer). The row proves the court order is on file; no employee signature required.

**Union dues (fagforeningstrekk):** Tariffavtale = sufficient hjemmel per lovsen Q4 verdict. `deduction_type='union_dues'` advisory mode — allow with non-blocking UI warning: "Bekreft at ansatt er registrert som fagforeningsmedlem" when `deduction_type='union_dues'`. Do not block submit — inform manager only. Future ADR for tariff_framework verification.

---

## 7. Telemetry Deltas

Two new events in `packages/telemetry/src/registry.ts`. **Pre-flag conflict:** `payroll.line_override_proposed` at line 8847. Payroll block ends ~9131. Grep before insertion.

| Event | Destinations | Properties |
|---|---|---|
| `payroll.deduction_consent_referenced` | posthog, activity_trail, logger | `consent_document_id`, `change_proposal_id`, `profile_id`, `period_id`, `paragraph_ref: "Aml. §14-15 tredje ledd nr. 1-6"` |
| `payroll.deduction_rejected_no_consent` | activity_trail, logger (NOT posthog — blocked actions skip analytics funnel) | `profile_id`, `period_id`, `paragraph: "Aml. §14-15"`, `reason: "missing_consent_document_id"` |
| `legal.aml_14_15.validated` | posthog, activity_trail | `consent_document_id`, `profile_id`, `pass`, `status`, `validator_version` |

---

## 8. ADR-0311 Draft Skeleton

File: `docs/decisions/0311-consent-document-payroll-deductions-aml-14-15.md`

```
title: "Trekk-samtykke som payroll-domain artifact (Aml. §14-15 tredje ledd)"
id: ADR_0311
status: proposed
layer: decision
created: 2026-05-14
module: payroll
bind: [ADR-0151, ADR-0235, ADR-0244, ADR-0249]

Context: Aml. §14-15 tredje ledd nr. 1-6 requires lovhjemmel OR written consent for any wage
deduction. LineOverrideModal had only a reason field — compliance theater.
confirmation_signature reuse rejected: FK chain violation (confirmation_id NOT NULL, no
confirmation row for deduction_consent). Cascade invariant 2: one entity = one role.

Decision: New table payroll.consent_document — own RLS, own lifecycle, own DocuSeal binding.
FK consent_document_id on change_proposal. Shared utility validateAml1415Logic in
packages/ai/src/capabilities/legal/aml-14-15.ts, wrapped by lovsen capability tool.
workspaceId server-derived (ADR-0151), never client-supplied.

Key rules:
- category='deduction' + deduction_type !== 'court_order' MUST have consent_document_id
- court_order: consent_document row required with consent_type='court_order' + court_order_reference non-null (lovhjemmel sufficient, no employee signature)
- union_dues: advisory mode — non-blocking warning pending tariff_framework FK (future ADR)
- BFF validates FK ownership + workspace match before INSERT (L-0177)
- validateAml1415 systemTools tier only — not readOnlyTools
- paragraph_ref column value: 'Aml. §14-15 tredje ledd nr. 1-6'
```

---

## 9. Conflict Surface (Pre-flag)

| Surface | Risk | Mitigation |
|---|---|---|
| `change_proposal` table — parallel campaigns | ADD COLUMN may conflict if helpdesk/billing/daily-operation campaigns ALTER same table | Grep `campaign/*` for `change_proposal ALTER` pre-PR |
| `payroll` schema namespace — new table | Verify no campaign creates `payroll.consent_document` independently | Grep all campaign branches for `consent_document` |
| Telemetry registry (`registry.ts`) | All campaigns append | Grep event names across campaign branches |
| `propose-line-override/route.ts` RequestSchema | Tests `__tests__/payroll-period-locked-handler.test.ts` hardcode category values | Update fixtures in same PR |
| `useProposeLineOverride` (`use-line-overrides.ts:39`) | `ProposeOverridePayload` union hardcoded | Single file change |
| Migration timestamps | Dev HEAD max: `20260611100000` | M1: `20260615110000`, M2: `20260615110100` — strictly after HEAD |

---

## 10. Build Sequence

**Phase 1 — Schema (migrations only)**
- [ ] Write `20260615110000_create_payroll_consent_document.sql`
- [ ] Write `20260615110100_change_proposal_consent_fk.sql`
- [ ] Apply: `npx supabase migration up`
- [ ] Regen `database.types.ts` (NO `op run` wrap)

**Phase 2 — Telemetry registry**
- [ ] Grep new event names across all branches
- [ ] Add 3 events to `registry.ts` payroll + legal blocks
- [ ] `pnpm --filter @smartout/telemetry build`

**Phase 3 — Lovsen capability**
- [ ] Write shared utility `validateAml1415Logic` in `packages/ai/src/capabilities/legal/aml-14-15.ts`
- [ ] Write `validateAml1415` tool body in `packages/ai/src/capabilities/legal/tools.ts` — wraps utility with channel guard (`"system"` only) + `emit()`
- [ ] Add to `systemTools` array in `packages/ai/src/capabilities/legal/index.ts` (NOT readOnlyTools)
- [ ] Docstring AFTER body verified (L-0176)
- [ ] `pnpm --filter @smartout/ai build`

**Phase 4 — BFF routes**
- [ ] Extend `RequestSchema` in `propose-line-override/route.ts` (drop `workspaceId` param, add `consent_document_id`)
- [ ] Add Step 5b consent validation (workspace_mismatch fail-fast per L-0177)
- [ ] Call `validateAml1415Logic` utility directly (not tool)
- [ ] Emit telemetry events
- [ ] Write `GET /api/payroll/deduction-consents/route.ts` (profileId only, workspace server-derived)

**Phase 5 — UI**
- [ ] Add `"deduction"` to `Category` union + `CATEGORY_LABELS`
- [ ] Add `consentDocumentId` state (replaces old `consentSignatureId`)
- [ ] Write `useDeductionConsents` hook (fetches from `payroll.consent_document` via BFF)
- [ ] Add conditional consent picker section
- [ ] Update `canSubmit` guard
- [ ] Update `ProposeOverridePayload` type
- [ ] Fix `min="0.01"` for negative amounts
- [ ] Add union_dues non-blocking advisory warning UI

**Phase 6 — ADR + tests**
- [ ] Write ADR-0311 (file: `0311-consent-document-payroll-deductions-aml-14-15.md`)
- [ ] Register in decision-log
- [ ] Update test fixtures
- [ ] `pnpm turbo typecheck` — 0 errors

---

## 11. Council Questions — Resolved

**Q1 (Schema):** RESOLVED — Phase 5 council + Pontus. `confirmation_signature` reuse REJECTED. New `payroll.consent_document` table.

**Q2 (Backfill):** RESOLVED — deviation-flag, not block-on-export. `deviation_class = 'consent_gap_aml_14_15_tredje_ledd'`. Bokf.lov §7 compliance preserved.

**Q3 (Court orders):** RESOLVED — bypass signature requirement; require `consent_document` row with `consent_type='court_order'` + `court_order_reference` non-null.

**Q4 (Union dues):** RESOLVED — advisory mode, non-blocking warning "Bekreft at ansatt er registrert som fagforeningsmedlem". Future ADR for tariff_framework FK.

---

## 12. DocuSeal Integration Verification (pre-build gate)

**Status: MUST verify before T2 build dispatches.**

New `payroll.consent_document` needs its own DocuSeal template + its own callback handler. Before T2 ships, confirm:

1. `apps/web/src/app/api/contracts/send` and related callback paths do NOT hardcode `confirmation_signature` as the only signature destination.
2. Existing DocuSeal adapter can handle a new submission type (`deduction_consent`) routing to `payroll.consent_document` instead of `confirmation_signature`.

**Grep results — sites needing classification:**

```
packages/training/src/hooks/use-assigned-protocols.ts:79   → .from("confirmation_signature")   — training/governance read, SAFE
packages/training/src/hooks/use-step-completion.ts:141     → .from("confirmation_signature")   — training completion write, SAFE
packages/supabase/src/database.types.ts                    → auto-generated types, SAFE (regen after migration)
packages/supabase/dist/*.d.ts                              → compiled dist, SAFE (regen after migration)
packages/Botsson/blueprints/database-spread.md             → documentation/blueprint only, SAFE (update after schema ships)
```

**No hits in `apps/web/src/app/api/contracts/` or `services/contract-service/`** — those paths do not reference `confirmation_signature` directly.

**Required adapter work (flag for T2 build agent):**
- Identify where DocuSeal callback writes completed-submission data — likely `supabase/functions/` or `services/contract-service/`. Verify callback does not INSERT into `confirmation_signature` for ALL submission types.
- Create a new DocuSeal template for `deduction_consent` document type.
- Callback handler must branch on submission type: `deduction_consent` → INSERT `payroll.consent_document`; training/governance types → existing `confirmation_signature` path unchanged.
- Add `docuseal_submission_id` to `payroll.consent_document` — column already included in M1 schema above.

**Pontus must verify before T2 dispatches:** Grep full DocuSeal callback chain:
```bash
grep -rn "confirmation_signature" supabase/functions/ services/ apps/web/src/app/api/ \
  --include="*.ts" --include="*.sql" | grep -v "node_modules" | grep -v ".next"
```
