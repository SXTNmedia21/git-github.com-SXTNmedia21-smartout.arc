---
title: "Contract End-to-End: Gap Closure + Template Binding + Composition Engine"
status: approved
updated: 2026-04-13
created: 2026-04-13
module: contracts
tags: [contracts, templates, cascade, composition, docuseal, hospitality]
council-session: 2026-04-13
council-verdict: APPROVE WITH CHANGES
---

# Contract End-to-End: Gap Closure + Template Binding + Composition Engine

> Council-approved 2026-04-13. Reviewed by System Steward, Supervisor, Agent Coordinator, Frontend Designer.
> Builds on ADR-0076, ADR-0077, ADR-0078, ADR-0079, ADR-0082.
> Tripletex researched for professional standard reference.

---

## 1. Problem Statement

The employment contract flow is completely broken. 13 gaps identified:

| # | Gap | Severity |
|---|-----|----------|
| G1 | Wizard SendStep has no submit action | CRITICAL |
| G2 | `employment_contract` row never created (API returns proposal only) | CRITICAL |
| G3 | `position_title` captured but never sent to API | HIGH |
| G4 | `employment_category` hardcoded `'fast'` in resolveComposition | HIGH |
| G5 | `employment_percentage` hardcoded `100` | HIGH |
| G6 | Send route never creates `contract` (DocuSeal entity) or sets `signing_contract_id` | CRITICAL |
| G7 | List page shows `contract` table; detail page shows `employment_contract` table | HIGH |
| G8 | Webhook sets `terminated` on decline instead of `declined` | MEDIUM |
| G9 | PII stored in plaintext (ADR-0077 mandates pgsodium) | HIGH/security |
| G10 | Reminders scheduled but never dispatched | MEDIUM |
| G11 | No idempotency on send (ADR-0082) | HIGH |
| G12 | Revise page is a stub | MEDIUM |
| G13 | Botsson capabilities unreachable | LOW |

Additionally: no template management, no connection to lonnsgrupper, no cascade-driven template selection.

---

## 2. Design Decisions (Council-Approved)

### 2.1 Template Ownership: System + Workspace (Model B)

- **System templates** (K1a): platform-owned, `workspace_id = NULL`, `is_system = true`. Seeded via migration. Immutable. Three employee templates exist: Fast ansatt, Deltid, Tilkallingsvikar.
- **Workspace templates** (K1b): admin copies a system template, customizes content/clauses, binds to their lonnsgrupper. Workspace-scoped.
- Workspace copies are snapshots, NOT live references. Platform template updates do not auto-propagate.

### 2.2 Three-Layer Template Resolution

```
employment_category  →  selects BASE template (fast/deltid/tilkalling)
payroll_employee_group  →  selects VARIANT template (if workspace has one for this group)
position_title  →  fills {{stilling}} placeholder (fritekst)
```

Resolution priority (highest wins):
1. Workspace template bound to this `employee_group_id` + `employment_category`
2. Workspace template bound to this `employment_category` only
3. System template matching this `employment_category`

Template resolution is INTERNAL to the composition engine. The admin never picks a template. The resolved template appears in the Review step as a GhostValueCard with ReasoningDrawer.

### 2.3 Lonnsgruppe = payroll_employee_group

The existing `payroll_employee_group` table IS the lonnsgruppe concept. It is already cross-cutting (used by break_rules, payroll, meal_rules). Using it as template selector is acceptable.

Riksavtalen defines two tariff categories (ufaglart/faglart), NOT named groups. Workspace groups ("Kokk", "Servitor") are K1b configuration. The mapping from group to tariff category uses `employee_payroll_profile.has_fagbrev` boolean.

### 2.4 employment_category as Enum

Currently plain TEXT. Must become a CHECK constraint or enum: `fast`, `deltid`, `tilkalling`. Three-layer resolution depends on a finite set of valid values.

### 2.5 API Pattern

- Do NOT create a new `/api/employment-contracts/create` endpoint
- Extend existing `POST /api/employment-contracts` with a `persist` flag in the request body
- `persist: false` (default) = return proposal only (current behavior)
- `persist: true` = insert `employment_contract` row + return with `contract_id`

### 2.6 DocuSeal Row Creation

In the send route (`POST /api/employment-contracts/[id]/send`), SYNCHRONOUSLY:
1. Create `contract` row (DocuSeal signing entity) with `contract_type = 'employee'`
2. Set `employment_contract.signing_contract_id` FK
3. Call contract-service for DocuSeal submission
4. Create `engine_state` for signing or intake process

This is NOT an engine step. The `contract` row is a precondition for signing.

### 2.7 PII Collection: Form Page, Not Agent (Phase 1-2)

G9 (PII encryption) is deferred. Phase 1-2 uses a simple form page for employee PII collection. Agent-based `contract_intake` capability is Phase 3.

### 2.8 Wizard: 5 Steps

| Step | Label | Content |
|------|-------|---------|
| 1 | Ansatt | Employee selection grid with search/filter |
| 2 | Stilling | Position title (text) + employment category (segmented: Heltid/Deltid/Tilkalling) + percentage (conditional slider) |
| 3 | Gjennomgang | Inline derivation loading → GhostValueCards (rate, percentage, lonnsgruppe, template) + ComplianceBadges + collapsible clauses |
| 4 | Bekreft | AcknowledgementRing (scroll-driven confirmation) + final summary |
| 5 | Send | Two-path submit: "Send kontrakt" (PII complete) or "Opprett og start innhenting" (PII missing) |

---

## 3. Database Changes

### 3.1 New: employment_category constraint

```sql
-- Add CHECK constraint to employment_contract.employment_category
ALTER TABLE employment_contract
  ADD CONSTRAINT chk_employment_category
  CHECK (employment_category IN ('fast', 'deltid', 'tilkalling'));
```

### 3.2 New: employment_category on contract_template

```sql
ALTER TABLE contract_template
  ADD COLUMN employment_category TEXT
  CHECK (employment_category IN ('fast', 'deltid', 'tilkalling'));

-- Update existing system templates
UPDATE contract_template SET employment_category = 'fast'
  WHERE name LIKE '%Fast ansatt%' AND is_system = true;
UPDATE contract_template SET employment_category = 'deltid'
  WHERE name LIKE '%Deltid%' AND is_system = true;
UPDATE contract_template SET employment_category = 'tilkalling'
  WHERE name LIKE '%Tilkallingsvikar%' AND is_system = true;
```

### 3.3 New: contract_template_binding (Phase 2)

```sql
CREATE TABLE public.contract_template_binding (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES contract_template(template_id) ON DELETE CASCADE,
  employment_category TEXT NOT NULL CHECK (employment_category IN ('fast', 'deltid', 'tilkalling')),
  employee_group_id   UUID REFERENCES payroll_employee_group(id) ON DELETE SET NULL,
  priority            INT NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, template_id, employment_category, employee_group_id)
);
```

Priority resolution: highest `priority` value wins. Ties broken by `employee_group_id IS NOT NULL` (more specific wins).

### 3.4 Fix: tariff_rate_table lookup

The current `resolveComposition` queries `tariff_rate_table` with `LIMIT 1` returning an arbitrary rate. Must filter by `rate_type` matching the employment context:

- `minstelonn_ufaglart` when `has_fagbrev = false`
- `minstelonn_faglart` when `has_fagbrev = true`

---

## 4. API Changes

### 4.1 Extend POST /api/employment-contracts

```typescript
const composeSchema = z.object({
  workspace_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  template_id: z.string().uuid().optional(),
  position_title: z.string().min(1).optional(),
  employment_category: z.enum(["fast", "deltid", "tilkalling"]).optional(),
  employment_percentage: z.number().min(1).max(100).optional(),
  persist: z.boolean().optional().default(false),
});
```

When `persist: true`: INSERT `employment_contract` row with derived values, return `{ contract_id, ...proposal }`.

### 4.2 Extend POST /api/employment-contracts/[id]/send

Add before engine_state creation:

1. Resolve template (via binding or direct employment_category match)
2. Resolve placeholders from profile + company + workspace + employment_contract
3. INSERT `contract` row with `contract_type = 'employee'`, `resolved_html`, `resolved_values`
4. SET `employment_contract.signing_contract_id = contract.contract_id`
5. Call contract-service DocuSeal send flow
6. Create `engine_state` for signing or intake

Add idempotency: accept `idempotency_key` in request body, check for existing `contract` row with same key.

### 4.3 Fix telemetry

- Remove `"contract composed"` emit from send route (line 205) — composition already emitted in wizard
- Emit `"contract sent"` after DocuSeal dispatch succeeds
- Emit `"contract created"` when persisting employment_contract row

---

## 5. Frontend Changes

### 5.1 CompositionWizard restructure (5 steps)

**Step 2 (Stilling):** Add segmented control for employment_category + conditional slider for percentage. Pass all values in fetch body to derivation API.

**Step 3 (Gjennomgang):** Inline loading → spring-animated GhostValueCards → ComplianceBadges → collapsible clauses. Template shown as derived value with ReasoningDrawer.

**Step 5 (Send):** Real submit button with two-path confirmation dialog:
- Path A (PII complete): "Send kontrakt" → creates row + sends
- Path B (PII missing): "Opprett og start innhenting" → creates row + transitions to pending_data

### 5.2 Contract hooks

New file: `apps/web/src/app/dashboard/contracts/_hooks/use-employment-contracts.ts`
- `useEmploymentContracts(workspaceId)` — list with filters
- `useEmploymentContract(id)` — single with events
- `useComposeContract()` — mutation calling POST with persist flag
- `useSendContract()` — mutation calling send route

### 5.3 Fix list/detail ID mismatch (G7)

Contract list page must query `employment_contract` table, NOT `contract` table. The `contract` table is for platform/B2B contracts only.

### 5.4 Fix ContractStatus type

Add `pending_data` and `declined` to the TypeScript type in `contracts-data-table.tsx`.

---

## 6. Composition Engine Changes

### 6.1 resolveComposition signature

```typescript
resolveComposition(supabase, workspaceId, profileId, {
  employment_category: EmploymentCategory,
  employment_percentage: number,
  position_title: string,
  employee_group_id?: string,
  template_id?: string,  // optional override
})
```

### 6.2 Template resolution (internal)

```typescript
async function resolveTemplate(
  supabase, workspaceId, employmentCategory, employeeGroupId?
): Promise<ContractTemplate> {
  // 1. Workspace binding for group + category
  if (employeeGroupId) {
    const groupMatch = await queryBinding(workspaceId, employmentCategory, employeeGroupId);
    if (groupMatch) return groupMatch;
  }
  // 2. Workspace binding for category only
  const categoryMatch = await queryBinding(workspaceId, employmentCategory, null);
  if (categoryMatch) return categoryMatch;
  // 3. System template fallback
  return querySystemTemplate(employmentCategory);
}
```

### 6.3 Fix tariff lookup

Filter by `rate_type` matching fagbrev status, not `LIMIT 1` on arbitrary rate.

---

## 7. Phasing

### Phase 1 — Gap Closure (blocks everything)

| Item | Files |
|------|-------|
| employment_category enum + CHECK | New migration |
| employment_category on contract_template + UPDATE seeds | New migration |
| Extend POST /api/employment-contracts with persist | `employment-contracts/route.ts` |
| Wire wizard Step 2 (category + percentage) | `CompositionWizard.tsx` |
| Wire wizard Step 5 (submit button) | `CompositionWizard.tsx` |
| Pass position_title to API | `CompositionWizard.tsx` + `route.ts` |
| Fix resolveComposition inputs (remove hardcoded values) | `resolve-composition.ts` |
| Create contract hooks (TanStack Query) | New `_hooks/use-employment-contracts.ts` |
| Fix send route: create contract row + signing_contract_id + DocuSeal dispatch | `send/route.ts` |
| Fix list page to use employment_contract | `contracts/page.tsx` |
| Fix ContractStatus TS type | `contracts-data-table.tsx` |
| Fix telemetry bug in send route | `send/route.ts` |
| 5-step wizard with Nordic Split motion | CompositionWizard + new components |

### Phase 2 — Template Binding + Composition Polish

| Item | Files |
|------|-------|
| contract_template_binding table + RLS | New migration |
| Template resolution in composition engine | `resolve-composition.ts` |
| Workspace template copy mechanism | New API route |
| Template binding CRUD (nested in employee-groups settings) | `employee-groups-settings.tsx` |
| Fix tariff lookup (rate_type filter) | `resolve-composition.ts` |
| Idempotency on send (ADR-0082) | `send/route.ts` |
| Simple PII collection form page | New page |
| 6 telemetry events wired | Various |

### Phase 3 — Agent + Polish (deferred)

| Item | Files |
|------|-------|
| contract_intake in intent classifier | `intent-classifier.ts` |
| Authority config seed for contract_intake | New migration |
| allowedChannels enforcement in tool-selector | `tool-selector.ts` |
| Engine-state to agent bridge (pull-based) | `agent-router.ts` |
| PII scrubbing from conversation history | Agent middleware |
| Revise page with pre-fill | `revise/page.tsx` |
| Reminder dispatcher | Edge Function |
| Webhook: declined status + reason columns | `webhooks/docuseal/route.ts` |

---

## 8. ADRs to Write/Amend

1. **Amend ADR-0076** step 1: add template resolution as explicit input source
2. **New ADR**: `employment_category` enum values mapped to Riksavtalen/Skatteetaten categories
3. **Amend ADR-0077**: Phase 1-2 use form-based PII collection, agent intake deferred to Phase 3

---

## 9. Tripletex Reference

Tripletex does NOT generate contract documents — pure data registry for a-melding. Our differentiators:
- Contract document generation via DocuSeal
- Cascade-derived salary from tariff framework
- Compliance checking against Riksavtalen rates
- Lonnsgruppe-driven template selection
- Onboarding flow connecting contract to training readiness

Tripletex patterns adopted:
- STYRK-08 occupation codes (yrkeskode) — store on employment_contract
- Append-only employment history (parent_contract_id lineage)
- Employment types aligned to Skatteetaten spec (5 types for 2025)
- Mandatory a-melding fields enforced in composition validation

---

## 10. Success Criteria

- Admin composes and sends a contract in < 2 minutes
- System auto-selects correct template from lonnsgruppe
- All cascade-derived values (rate, percentage, clauses) visible with source explanation
- DocuSeal signing link delivered to employee
- Webhook syncs signed status back to employment_contract
- Payroll sync trigger fires on signing
- 6 telemetry events emitted end-to-end
