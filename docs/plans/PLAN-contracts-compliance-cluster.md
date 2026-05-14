---
title: Plan — Contracts Compliance Cluster (T1)
status: draft
created: 2026-05-14
updated: 2026-05-14
module: contracts
scope: sortie
tags: [sma-306, sma-307, sma-310, sma-311, compliance, aml-14-6, gate-action, walt, pdf-gate]
---

# Plan: Contracts Compliance Cluster (T1)

**Sortie branch:** `feat/contracts-compliance-cluster`
**Target merge:** `development` (single atomic PR — four blockers bundled)
**ADR slots:** 0308 (§14-6 rule-table), 0309 (Walt fallback hardening/removal), 0310 (PDF-gate server-enforce).
**Excluded:** SMA-309 workspace_framework_binding auto-seed (Pontus deferred).

---

## 1. Mapping (issue → file → line → change kind)

| Issue | Primary file | Lines | Change kind |
|---|---|---|---|
| SMA-306 §14-6 stub | `packages/ai/src/capabilities/legal/tools.ts` | 71–144 (validateAml146 body) | Replace stub with rule-driven validator that reads from `framework_rule` where `code LIKE 'aml.14_6.%'` |
| SMA-306 §14-6 seed | `supabase/migrations/<TS>_aml_14_6_framework_rules.sql` | new file | 17 INSERTs (bokstav a–q) into `framework_rule` at `framework_id = NULL` (platform-level statute, K1a). Bokstav m `required_when: { industry: 'hospitality', schedule_type: 'rotation' }`. Bokstav p `required: false` (valgfri per lovtekst). |
| SMA-307 Walt fallback | `apps/web/src/app/api/contracts/send/route.ts` | 473–555 | Delete dev-stub branch (lines 509–555). Keep ONLY the 503-return branch (lines 478–507). Dev banner to UI layer, never to DB. |
| SMA-310 PDF-gate server | `apps/web/src/app/api/contracts/send/route.ts` | 31–37 (schema), 86–93 (gate area) | Add `pdf_preview_viewed_at` to `SendBodySchema`, validate non-null + ISO, persist on contract row, fail 422 if missing |
| SMA-310 schema | `supabase/migrations/<TS+1>_employment_contract_pdf_preview_viewed.sql` | new file | `ALTER TABLE employment_contract ADD COLUMN pdf_preview_viewed_at timestamptz NULL` |
| SMA-310 client wiring | `apps/web/src/components/contracts/ContractDispatchDrawer.tsx` | 477–490 (POST body) | Send `pdf_preview_viewed_at: state.pdfPreviewViewedAt` in body |
| SMA-311 send | `apps/web/src/app/api/employment-contracts/[id]/send/route.ts` | 66–119 + 258–303 | Add `gateAction` call; capability `contract`, action_type `send_single`, entity_id = contract_id |
| SMA-311 revise | `apps/web/src/app/api/employment-contracts/[id]/revise/route.ts` | 12–110 | Add `gateAction` call before insert; action_type `revise` |
| SMA-311 regenerate | `apps/web/src/app/api/employment-contracts/[id]/regenerate/route.ts` | 14–102 | Add `gateAction` call before update; action_type `regenerate` |
| SMA-311 compose | `apps/web/src/app/api/employment-contracts/route.ts` | 36–134 | Wrap persist-mode insert in `gateAction`; action_type `compose`. **Also:** remove `workspace_id` from `composeSchema` (Zod), derive workspace from JWT actorProfile.workspace_id (ADR-0151 forgery fix). |
| SMA-311 send (5th route — Q-H2) | `apps/web/src/app/api/contracts/send/route.ts` | 301–309 | Add `gateAction` call before UPDATE. capability=`contract`, action_type=`send_dispatch`, entity_type=`employment_contract`. No C4 gate present; ADR-0099 requires gate_action for mutation authority. |
| ADR-0151 forgery fix | `apps/web/src/app/api/employment-contracts/route.ts` | 21 (composeSchema) | Remove `workspace_id: z.string().uuid()` from `composeSchema`. Derive workspace from JWT actorProfile row. Verify actorProfile membership in derived workspace. |

**Scope deviation from issue text (Council Q1):** Prompt cited bypass on `POST/PATCH/DELETE /api/employment-contracts/[id]`. The actual `[id]/route.ts` is GET-only — bypass surface is 4 sibling routes (`send`, `revise`, `regenerate`) + base POST. L-0107 invariant still holds. Q-H2 council finding expands to 5 routes by adding `/api/contracts/send/route.ts:301-309` UPDATE which has no gate.

**SMA-307 state correction:** Walt dev-stub at lines 473–555 of `/api/contracts/send/route.ts` is ALREADY env-gated (`NODE_ENV !== 'production'` AND `CONTRACT_SERVICE_DEV_FALLBACK === 'true'`). T1's SMA-307 scope is REMOVAL of the stub branch entirely, surface dev affordance as banner-only on Walt page, drop env flag.

---

## 2. validateAml146 rebuild spec (SMA-306)

**Rule source:** `framework_rule` table, scoped to `framework_id IS NULL` (platform-level statute, K1a), `code LIKE 'aml.14_6.%'`. 17 rows seeded (bokstav a–q) by paired migration. No new table — reuses K1a infrastructure. All workspaces inherit via K1a→K1b read-through, NOT fork-on-bind. Workspace-binding-specific overrides via `framework_id` match are reserved for future scope. Council Q3 escalates alternative (dedicated `aml_paragraph_rule` table).

**Function signature (preserved — defineTool schema unchanged):**
```
input:  { contract_id: uuid, validation_mode: 'strict' | 'advisory' }
output: JSON.stringify(Aml146ValidationResult)
```

**Body algorithm (replaces lines 110–142):**
1. Channel guard (lines 90–108) — keep.
2. Load contract row via `ctx.supabaseAdmin.from('employment_contract').select(...).eq('contract_id', params.contract_id).eq('workspace_id', ctx.workspaceId).single()`. Fail-fast on null (L-0177).
3. Load active framework via `workspace_framework_binding` (used for workspace-specific overrides; fallback used if absent).
4. Load `framework_rule` rows where `framework_id IS NULL AND code LIKE 'aml.14_6.%'` ORDER BY code. (Platform-level statute applies to ALL employers. Workspace-binding-specific overrides via `framework_id` match reserved for future scope.)
5. For each of 17 rules: read `evaluation_config.field`, `.required`, `.bokstav`, `.required_when`. Check contract column non-null/non-empty. Evaluate `.required_when` JSONB conditional per workspace context (e.g. bokstav m required when `industry='hospitality'` AND rotation schedule pattern).
6. `strict` mode: every required bokstav missing → `severity:'error'`. `advisory` mode: same checks as `severity:'warning'`.
7. `pass = errors.length === 0`.
8. Emit `legal.aml_14_6.validated` with `stub: false`, `rule_count`, `bokstaver_failed[]`.

**Failure mode structure:**
```ts
{
  severity: 'error' | 'warning',
  paragraph: 'Aml. §14-6 bokstav <a-q>',
  field: string,
  bokstav: 'a' | ... | 'q',
  message_no: string,
  remediation: string,
  evidence_required: string[],
  confidence: 'HØY' | 'MEDIUM' | 'LAV',
}
```

**Validator version bump:** `aml-14-6-2024-07-rule-driven-v1`.

---

## 3. Walt fallback removal (SMA-307)

**Decision:** Remove dev-stub branch entirely (lines 509–555). Replace with no-op continuation: when `!sendSucceeded`, always return 503. Dev affordance moves to UI surface only — `/walt/sign-dev/[contract_id]/page.tsx` reads `employment_contract` directly. No stub `contract` row ever inserted in any environment.

**Replacement at lines 478–507 (keep as-is):**
- Hard 503 with `code: 'CONTRACT_SERVICE_DOWN'`
- Console.error retained
- `emit({ event: 'contract.send_failed.service_down', ... })` already wired; **verify** registered (Council Q4) — alternative is new `contract.dispatch_failed_safe`

**Drop env flag:** `CONTRACT_SERVICE_DEV_FALLBACK` removed from `.env.template`, `apps/web/src/env.ts`, droplet env. Mention in ADR-0309.

**E2E adjustment:** `journey-3-walt-sign.spec.ts` line 130 must seed stub via admin client directly rather than relying on route fallback. Pre-flag.

---

## 4. PDF-gate server-enforce (SMA-310)

**Schema delta — NEW migration:** Column does NOT exist on `employment_contract` (verified `database.types.ts:7873-7928`).

```sql
ALTER TABLE public.employment_contract
  ADD COLUMN pdf_preview_viewed_at timestamptz NULL;
COMMENT ON COLUMN public.employment_contract.pdf_preview_viewed_at IS
  'ADR-0244/0310: server-enforced PDF preview gate. Set by /api/contracts/send before DocuSeal dispatch. NULL until admin confirmed PDF read.';
```

No backfill needed.

**SendBodySchema delta:**
```ts
const SendBodySchema = z.object({
  template_id: z.string().uuid(),
  target_profile_id: z.string().uuid(),
  blocks_acknowledged: z.array(z.string()).min(1),
  existing_contract_id: z.string().uuid().nullable().optional(),
  resolved_html: z.string().optional(),
  pdf_preview_viewed_at: z.string().datetime(),  // NEW
});
```

**Server validation (after line 93 missing-blocks gate, before line 95 admin client):**
```ts
const pdfViewedAt = new Date(parsed.data.pdf_preview_viewed_at);
if (isNaN(pdfViewedAt.getTime()) || pdfViewedAt > new Date()) {
  return NextResponse.json(
    {
      error: 'pdf_preview_viewed_at must be a valid past timestamp',
      code: 'INVALID_PDF_GATE',
      i18n_key: 'contracts.send.errors.invalid_pdf_gate',
    },
    { status: 422 },
  );
}
```

**i18n key (add to Norwegian locale file):**
```json
"contracts.send.errors.invalid_pdf_gate": "PDF-forhåndsvisning må være gyldig tidspunkt i fortiden"
```

**Constraint:** NEVER hardcode Norwegian text in server responses per CLAUDE.md. Use i18n keys or English error codes. Client renders i18n_key value.

**Persistence at lines 301–313:** add `pdf_preview_viewed_at: parsed.data.pdf_preview_viewed_at` to UPDATE payload.

**Post-persist verification (before line 327 compliance gate):** SELECT row, fail 422 `PDF_GATE_NOT_PERSISTED` if `pdf_preview_viewed_at IS NULL`.

**Client side (drawer line 480–490):** Add `pdf_preview_viewed_at: state.pdfPreviewViewedAt` to POST body. Client `pdfViewed` state remains for UX disable.

---

## 5. C4 gate wiring (5 routes) (SMA-311 + Q-H2)

Use `gateAction` from `apps/web/src/app/dashboard/_actions/_shared.ts` (NOT `gatedMutation`). `gateAction` is the function the bulk route uses at `bulk/route.ts:135-142`. `gateAction` is unconditional (no feature flag), safe for production routes. `gatedMutation` (ADR-0204 composition orchestrator) is feature-flagged behind `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` (SS-4) and would throw `not_implemented` in prod for all 4 sibling routes — do NOT use. ADR-0309 records this decision explicitly.

| Route | Verb | action_type | capability | channel | On deny |
|---|---|---|---|---|---|
| `[id]/send/route.ts` | POST | `send_single` | `contract` | `system` | 403 gate_denied |
| `[id]/revise/route.ts` | POST | `revise` | `contract` | `system` | 403 |
| `[id]/regenerate/route.ts` | POST | `regenerate` | `contract` | `system` | 403 |
| `route.ts` POST | POST | `compose` | `contract` | `system` | 403 |
| `/api/contracts/send/route.ts` UPDATE | POST | `send_dispatch` | `contract` | `system` | 403 (Q-H2 expansion) |

**Gate call pattern (mirror `bulk/route.ts:135–142`):**
```ts
import { gateAction } from '@/app/dashboard/_actions/_shared';

const gateResult = await gateAction(supabase, {
  workspace_id,                    // server-derived from JWT
  actor_profile_id,                // from actorProfile row
  capability: 'contract',          // existing 'contract' group row covers all action_types (Revision 4 — no seed migration needed)
  action_type: 'send_single',      // 'revise' | 'regenerate' | 'compose' | 'send_dispatch' per route
  entity_type: 'employment_contract',
  entity_id: id,
  channel: 'system',
});

if (!gateResult.allow) {
  return NextResponse.json(
    { error: 'gate_denied', reason: gateResult.reason, denied_by: gateResult.denied_by },
    { status: 403 },
  );
}

// Continue with mutation — gate audit row already written
```

**Pre-build verification (§12 step 7 prerequisite):** `SELECT * FROM engine_authority_config WHERE capability = 'contract' AND workspace_id IS NULL;` — confirm row exists with appropriate level + min_role. If row missing or shape unexpected, council Q5 reopens.

**Q-H2 expansion note:** `/api/contracts/send/route.ts:301-309` UPDATE has no gate_action. ADR-0099 requires gate_action for mutation authority. This is the 5th route. Pontus may narrow scope — flag as council follow-up if blocked.

**Future migration to gatedMutation:** separate ADR + sortie when SS-4 (`SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED`) flag flips on.

---

## 6. Telemetry deltas

| Event | New/Existing | Registry line (predict) | Routing |
|---|---|---|---|
| `contract.dispatch_failed_safe` | NEW (alias of `contract.send_failed.service_down`) | ~6633 (near contract.pdf_preview_viewed) | posthog + logger + activity_trail |
| `contract.aml_14_6.validation_failed` | NEW | ~2480 (contract diagnostics) | posthog + logger + activity_trail |
| `contract.pdf_gate.enforced` | NEW | ~2480 | posthog + logger |
| `contract.pdf_gate.bypassed_attempt` | NEW (attack signal) | ~2480 | posthog + logger + activity_trail |
| `gate.contract_send_denied` | NEW | ~6515 | posthog + logger + activity_trail |
| `legal.aml_14_6.validated` | EXISTING (tools.ts:126) | unchanged | shape change: add `bokstaver_failed[]`, `rule_count`, drop `stub` flag |

**Conflict pre-flag:** `registry.ts` is touched by ~every campaign closure. Single early commit `feat(telemetry): contract-compliance-cluster events`.

---

## 7. Migration list

**Current dev HEAD max:** `20260611100000_call_log_unique_session.sql`. All new migration timestamps MUST be strictly greater.

| Slot | File | Purpose |
|---|---|---|
| `20260615200000_aml_14_6_framework_rules.sql` | NEW | 17 INSERTs into `framework_rule` at `framework_id = NULL` (platform-level K1a statute) for bokstav a–q. Bokstav m includes `evaluation_config.required_when: { industry: 'hospitality', schedule_type: 'rotation' }`. Bokstav p `required: false`. Pattern matches `20260424100000_seed_hospitality_framework.sql:56-122`. |
| `20260615200100_employment_contract_pdf_preview_viewed.sql` | NEW | ADD COLUMN `pdf_preview_viewed_at timestamptz NULL` |

**DROPPED:** `20260514100200_contract_capability_action_types_seed.sql` — REMOVED per Revision 4. AI-arch traced `engine_authority_config` schema (`database.types.ts:8238-8250`): NO `action_type` column, `gate_action` takes `p_action_type` as RPC audit param only. Existing 'contract' capability group row covers all SMA-311 routes. Pre-build verification in §12 step 7 confirms row exists before building.

**Regenerate types** after migrations (no `op run` wrap per memory).

---

## 8. ADR drafts (skeletons)

### ADR-0308 — §14-6 17-Bokstav Rule-Table-Driven AML Validation
- Status proposed at PR open, accepted at merge.
- Decision: rule-driven validator reading `framework_rule` rows at `framework_id IS NULL AND code LIKE 'aml.14_6.%'`; 17 bokstaver (a–q) per post-2024 lov-revisjon; no hardcoded paragraphs in TS. Platform-level statute applies to ALL employers via K1a→K1b read-through (not hospitality-specific fork-on-bind).
- Bokstav m `required_when: { industry: 'hospitality', schedule_type: 'rotation' }` — vaktendringer (§10-3) + overtid-ordninger, introduced post-2024.
- Bokstav p `required: false` per lovtekst (kompetanseutvikling valgfri).
- Bokstav a–l, n, o, q `required: true`.
- Drivers: ADR-0244 strict/advisory contract; ADR-0181 K1a→K1b inheritance; L-0176 docstring-after-body invariant; Lovdata confirmation 2026 lovsen Phase 3.
- Bind: ADR-0244, ADR-0259, ADR-0078.

### ADR-0309 — gateAction Adoption for SMA-311 Contract-Route Family
- Decision: `gateAction` adopted for all 5 SMA-311 contract routes (send, revise, regenerate, compose, send_dispatch). `gatedMutation` (ADR-0204 composition orchestrator) deferred until SS-4 flag (`SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED`) is enabled. Walt dev-stub branch removed entirely; service-down state is always 503.
- Rationale: `gatedMutation` is feature-flagged and would throw `not_implemented` in production. `gateAction` is unconditional and matches bulk route pattern. Future migration to `gatedMutation` requires separate ADR + sortie.
- Contract-Service Dispatch: remove dev-stub-row branch entirely. Service-down state is always 503. Principle: "no synthetic database state for environment convenience."
- `CONTRACT_SERVICE_DEV_FALLBACK` env flag removed from `.env.template`, `apps/web/src/env.ts`, droplet env.
- Drivers: L-0107; ADR-0265 drift discipline; ADR-0204 SS-4 feature-flag boundary.
- Bind: ADR-0151, ADR-0186, ADR-0204.

### ADR-0310 — Server-Enforced PDF-Preview Gate
- Decision: `pdf_preview_viewed_at timestamptz` column on `employment_contract`; required field in `SendBodySchema`; verified post-persist before DocuSeal dispatch. Error returned as English error code + i18n_key (never hardcoded Norwegian).
- Drivers: ADR-0244 Aml. §14-5 bevisbyrde; L-0107 (third manifestation); ADR-0151 (server source of truth); CLAUDE.md i18n constraint.
- Bind: ADR-0244, ADR-0151.

---

## 9. Conflict surface (pre-flag)

| File | Conflict zone | Lines | Mitigation |
|---|---|---|---|
| `packages/telemetry/src/registry.ts` | Contract diagnostic ~2400–2510 + obligation ~6515–6620 + types map ~11786 | ~30 new lines split 3 zones | Single early commit |
| `docs/decisions/0000-decision-log.md` | Append 0308/0309/0310 | 3 lines | Single late commit |
| `packages/supabase/src/database.types.ts` | `employment_contract` Row/Insert/Update + Relationships | ~9 lines | Regen, never hand-edit |
| `apps/web/src/app/api/contracts/send/route.ts` | Touched by all 4 issues | ~120 lines net | Order edits to minimize rebasing |

ADR slots `0308–0310` confirmed free. Migration timestamps `20260615200000` and `20260615200100` are above current dev HEAD max `20260611100000` — verified safe.

**Pre-build migration timestamp verification:** Run `ls supabase/migrations/ | tail -1` in worktree before writing migrations to confirm no new HEAD migration landed since this plan was revised.

---

## 10. Journey spec (4)

**File:** `docs/journeys/JOURNEY-contracts-compliance-cluster.md`

### Journey A: Attacker forges singular-path bypass — REJECTED
- POST `[id]/regenerate` as employee → `gateAction` denies → 403 `gate_denied`. `gate.contract_send_denied` emitted.

### Journey B: Malformed §14-6 contract — REJECTED with bokstav list
- POST `/api/contracts/send` with NULL agreed_weekly_hours + start_date → `validateAml146` reads 17 `framework_rule` rows (a–q) at `framework_id IS NULL` → returns `pass:false, bokstaver_failed:['d','j']` (start_date → bokstav d; agreed_weekly_hours → bokstav j) → 422 `aml_errors[]` → drawer renders "Mangler etter §14-6: d, j."

### Journey C: Walt-disabled prod path — 503 not stub-row
- Production, `CONTRACT_SERVICE_URL` unset, all other gates pass → `isContractServiceConfigured() === false` → 503 `CONTRACT_SERVICE_DOWN` → NO `contract` row inserted → `employment_contract.status` UNCHANGED.

### Journey D: Missing `pdf_preview_viewed_at` — REJECTED
- Scripted client POST without field → Zod 400 → `contract.pdf_gate.bypassed_attempt` emitted (attack signal).

---

## 11. Council questions (5 + 2 new)

- **Q1:** Prompt scope expansion from 3 to 4 routes — accept or split base POST as separate sortie? *(phase 5 verdict: 4 routes accepted, Q-H2 expands to 5)*
- **Q2:** Strict-mode treatment of optional bokstav — per-bokstav `evaluation_config.required` boolean + `required_when` JSONB conditional determines fail/warn? *(answered: yes — bokstav p required:false, m required_when hospitality+rotation)*
- **Q3:** Rule source — `framework_rule` reuse vs dedicated `aml_paragraph_rule` table? *(chair ruling: reuse at framework_id IS NULL platform-level)*
- **Q4:** Rename `contract.send_failed.service_down` → `contract.dispatch_failed_safe`, or emit both transitionally?
- **Q5:** Authority seed delta — land in this PR (atomic) or paired pre-PR? **RESOLVED — Pontus approved drop. Existing 'contract' capability group row covers all SMA-311 routes. No seed migration needed. Pre-build verification confirms row exists (`SELECT * FROM engine_authority_config WHERE capability = 'contract' AND workspace_id IS NULL`).**
- **Q-H2 (harness finding):** `/api/contracts/send/route.ts:301-309` UPDATE has no gate_action — ADR-0099 requires gate. 5th route added to §1 mapping. Pontus may narrow scope — flag as council follow-up.
- **Q-H3 (event version):** `legal.aml_14_6.validated` shape mutation (adding `bokstaver_failed[]` + `rule_count`). Resolution: add `validator_version` field — existing consumers gate on `properties.data.stub === true`; new field non-breaking. Document in ADR-0308.

**SMA-309 silent dependency RESOLVED:** `validateAml146` now loads `framework_rule` at `framework_id IS NULL` (platform-level). No `workspace_framework_binding` required for base validation. Workspace-specific overrides via `framework_id` match deferred.

---

## 12. Build sequence (ordered tasks for build agent)

1. **Pre-flight:** `git status` clean; worktree on `feat/contracts-compliance-cluster`; verify ADR slots 0308–0310 free; `pnpm --filter @smartout/telemetry build` + `pnpm --filter @smartout/ai build` produce dist. Run `ls supabase/migrations/ | tail -1` to confirm current dev HEAD max — new migrations must be strictly greater than result (expected ≥ `20260611100000`).
2. **Pre-build: verify 'contract' authority row exists:**
   ```sql
   SELECT * FROM engine_authority_config WHERE capability = 'contract' AND workspace_id IS NULL;
   ```
   Must return row with appropriate level + min_role. If missing: council Q5 reopens — halt and report.
3. **Fix composeSchema ADR-0151 forgery (SMA-311 base POST, step before gate wiring):**
   - Remove `workspace_id: z.string().uuid()` from `composeSchema` in `apps/web/src/app/api/employment-contracts/route.ts:21`
   - Derive `workspace_id` from JWT actorProfile.workspace_id
   - Verify actorProfile membership in derived workspace
4. **Migrations first** (atomic, must apply before code references new columns):
   - Write `20260615200000_aml_14_6_framework_rules.sql` (17 INSERTs at `framework_id = NULL` with `evaluation_config.bokstav`, `field`, `required`, `required_when`). Bokstav m includes `required_when: { industry: 'hospitality', schedule_type: 'rotation' }`. Bokstav p `required: false`.
   - Write `20260615200100_employment_contract_pdf_preview_viewed.sql`
   - `npx supabase migration up` (Local only)
   - `cd packages/supabase && npx supabase gen types typescript --local > src/database.types.ts` (NO `op run` wrap)
5. **Telemetry registry commit (single, early):** add 4 new events. Add `validator_version` field to `legal.aml_14_6.validated` event shape (Q-H3 — non-breaking, existing consumers gate on `stub` field). `pnpm --filter @smartout/telemetry build`.
6. **Capability tool rebuild (SMA-306):** rewrite `validateAml146.execute` body per §2 (17-bokstav, platform-NULL rules). Docstring AFTER body verified (L-0176).
   - Update `capabilities/legal/__tests__/tools.test.ts:48-88` — current stub-path tests break after validateAml146 rebuild. Mock `framework_rule` rows (17 rows at `framework_id = NULL`) or convert to local-DB integration test.
7. **API route /api/contracts/send (SMA-307 + SMA-310 + AML wire + 5th gate):**
   - Add `pdf_preview_viewed_at` to `SendBodySchema`
   - Add server validation (English error code + i18n_key, NOT hardcoded Norwegian) + post-persist verification
   - Delete Walt dev-stub branch (lines 509–555)
   - Remove `CONTRACT_SERVICE_DEV_FALLBACK` from env.ts + .env.template
   - Add `gateAction` call at lines 301–309 UPDATE (5th route — Q-H2): capability=`contract`, action_type=`send_dispatch`
8. **Drawer wiring:** `ContractDispatchDrawer.tsx` line 488 add `pdf_preview_viewed_at` to POST body.
9. **i18n locale file:** add `contracts.send.errors.invalid_pdf_gate` key with Norwegian value to locale file.
10. **API routes (SMA-311) — one route per commit:** send/revise/regenerate/route.ts → wrap in `gateAction` (NOT `gatedMutation`). Per-route action_types: `send_single`, `revise`, `regenerate`, `compose`.
11. **Walt sign-dev page check:** verify `apps/web/src/app/walt/sign-dev/[contract_id]/page.tsx` reads `employment_contract` not `contract`. Patch if needed.
12. **E2E test repairs:**
    - `apps/e2e/tests/contract-employee/journey-3-walt-sign.spec.ts` — admin INSERT for stub setup
    - `journey-2-admin-send.spec.ts` line 233+ — same
    - NEW: `journey-d-pdf-gate-bypass.spec.ts` (SMA-310)
    - NEW: `journey-a-singular-bypass.spec.ts` (SMA-311)
13. **ADR drafts:** 0308 (17-bokstav rule-table + validator_version), 0309 (gateAction adoption + Walt removal), 0310 (PDF-gate + i18n constraint). Register in `0000-decision-log.md` (single final commit).
14. **Journey doc:** `JOURNEY-contracts-compliance-cluster.md` with 4 journeys (A–D).
15. **Typecheck cascade:** telemetry → ai → supabase → web (clear `.next/types/`) → `pnpm turbo typecheck`.
16. **Tool Compliance Self-Check (L-0176):** verify `validateAml146` body matches docstring claims.
17. **PR open:** `feat(contracts): compliance cluster (SMA-306/307/310/311)`. Lists 5 routes, 5 issues, 3 ADRs, schema deltas, journey file.

Build agent halts at step 17. `/close-feature` is operator decision.
