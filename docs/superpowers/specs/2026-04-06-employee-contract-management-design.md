---
title: Employee Contract Management — Dashboard + Botsson
status: review
updated: 2026-04-06
created: 2026-04-06
module: contracts
tags: [contracts, docuseal, botsson, dashboard, e-signing]
---

# Employee Contract Management — Design Spec

> Workspace admins can create, send, and track employee contracts with DocuSeal e-signing. Botsson handles contract work via voice/text. System templates with auto-filled placeholders.

## Council Verdict

**APPROVE WITH CHANGES** — Council session 2026-04-06. All 4 agents aligned. 5 blocking changes incorporated below.

---

## 1. Problem

Workspace admins have no way to send employment contracts to employees. The `employment_contract` table exists (D2 Resource) but has no document generation, no e-signing, no UI. Meanwhile, a full contract infrastructure exists for SaaS contracts (Platform Admin) — contract service, DocuSeal integration, templates, placeholders, reminders, audit trail. This spec bridges the gap.

## 2. Architecture

```
Admin / Botsson
      │
      ▼
Dashboard API Routes (/api/contracts/)
  │  Auth: JWT + is_admin_in_workspace()
  │
  ▼
Contract Service (port 5012, Fastify)
  │  Auth: X-Service-Key header
  │
  ▼
DocuSeal API
  │
  ▼ (webhook: form.completed)
DocuSeal Webhook Handler (/api/webhooks/docuseal/)
  │  Branches on contract_type:
  │  ├─ 'client'    → workspace.contract_status (existing)
  │  └─ 'employee'  → employment_contract.status + document_url + signed_at
```

### Key Principle: State Ownership

| State | Owned by | Mutated by |
|-------|----------|------------|
| `contract.status` | `contract` table | DocuSeal webhook only |
| `contract.signed_pdf_url` | `contract` table | DocuSeal webhook only |
| `employment_contract.signing_contract_id` | `employment_contract` | Dashboard API at send time (set once) |
| `employment_contract.status` | `employment_contract` | Webhook propagation from `contract.status` |
| `employment_contract.document_url` | `employment_contract` | Webhook copies from `contract.signed_pdf_url` |
| `employment_contract.signed_at` | `employment_contract` | Webhook sets on signing |
| `workspace.contract_status` | `workspace` | SaaS contract webhook ONLY — never from employee contracts |

## 3. Database Changes

### 3.1 Migration: Add FK on employment_contract

```sql
ALTER TABLE employment_contract
  ADD COLUMN signing_contract_id UUID REFERENCES contract(contract_id);

CREATE INDEX idx_employment_contract_signing
  ON employment_contract(signing_contract_id)
  WHERE signing_contract_id IS NOT NULL;

COMMENT ON COLUMN employment_contract.signing_contract_id IS
  'FK to contract table — links this HR record to the DocuSeal signing entity';
```

**Why `signing_contract_id` not `contract_id`:** The table already has `contract_id` as its PK. Using the same name for the FK would create ambiguity.

### 3.2 Migration: RLS policies for workspace-scoped contract access

New RLS policies on `contract` table for workspace admins:

```sql
-- Admin can read contracts in their workspace
CREATE POLICY "workspace_admin_read_contracts"
  ON contract FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Admin can insert employee contracts in their workspace
CREATE POLICY "workspace_admin_insert_contracts"
  ON contract FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Admin can update draft employee contracts
CREATE POLICY "workspace_admin_update_contracts"
  ON contract FOR UPDATE
  USING (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND status = 'draft'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );
```

**NOTE:** The existing contract migration (`20260228140000`) has reversed arg order `is_admin_in_workspace(workspace_id, auth.uid())` — this is a known bug. New policies use the correct order `(auth.uid(), workspace_id)`.

Employee can read their own contracts (via FK join, not email — avoids mismatch if login email differs from recipient):

```sql
CREATE POLICY "employee_read_own_contracts"
  ON contract FOR SELECT
  USING (
    contract_type = 'employee'
    AND contract_id IN (
      SELECT signing_contract_id FROM employment_contract ec
      JOIN profile p ON p.profile_id = ec.profile_id
      WHERE p.user_id = auth.uid()
      AND ec.signing_contract_id IS NOT NULL
    )
  );
```

### 3.3 Seed: Standard employee contract templates

3 system templates in `contract_template` with `contract_type = 'employee'`, `is_system = true`, `workspace_id = NULL`:

| Template | Employment Category | Key Placeholders |
|----------|-------------------|------------------|
| Fast ansatt | `fast` | ansatt_navn, stilling, avdeling, startdato, maanedslonn, stillingsprosent |
| Deltidsansatt | `deltid` | ansatt_navn, stilling, avdeling, startdato, timelonn, avtalt_timer_uke, stillingsprosent |
| Tilkallingsvikar | `tilkalling` | ansatt_navn, stilling, avdeling, startdato, timelonn |

All templates in Norwegian. HTML content with Smartout branding. Include standard clauses from `clause_library` (parties, working hours, salary, termination, confidentiality, GDPR).

## 4. Placeholder Resolution for Employee Contracts

New resolver function that builds autofill map from employee data:

### Source → Placeholder mapping

| Placeholder Key | Source Table | Source Column |
|----------------|-------------|---------------|
| `ansatt_navn` | `profile` | `display_name` |
| `ansatt_epost` | `user_identity` | `email` |
| `ansatt_adresse` | `profile` | `address_line_1` + `postal_code` + `city` |
| `ansatt_personnummer` | `profile` | `personal_number` (fødselsnummer — used for contract identification) |
| `stilling` | `employment_contract` | `position_title` |
| `avdeling` | `department` (via profile) | `name` |
| `startdato` | `employment_contract` | `start_date` |
| `sluttdato` | `employment_contract` | `end_date` |
| `maanedslonn` | `employment_contract` | `monthly_salary` |
| `timelonn` | `employment_contract` | `hourly_rate` |
| `stillingsprosent` | `employment_contract` | `employment_percentage` |
| `avtalt_timer_uke` | `employment_contract` | `agreed_weekly_hours` |
| `arbeidsgiver_navn` | `workspace` + `company` | company name |
| `arbeidsgiver_org_nr` | `company` | `organization_number` |
| `arbeidsgiver_adresse` | `workspace` | address fields |
| `arbeidssted` | `workspace` | `name` |
| `kontraktdato` | auto | current date |

**Resolution happens at the dashboard API layer** (with user JWT for RLS scoping), then resolved values are passed to the contract service.

## 5. Dashboard API Routes

All routes at `apps/web/src/app/api/contracts/` (flat structure — no `/api/dashboard/` prefix exists in codebase).

Auth pattern for every route:
1. Extract user from JWT via `createClient()`
2. Get `workspace_id` from request (header or body)
3. Verify `is_admin_in_workspace(workspace_id)` — reject 403 if not
4. Call contract service with `X-Service-Key` for mutations

### Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/contracts` | GET | List employee contracts for workspace (pagination, filters) |
| `/api/contracts` | POST | Create draft contract from template for employee |
| `/api/contracts/templates` | GET | List available employee templates |
| `/api/contracts/[id]` | GET | Get contract detail + events |
| `/api/contracts/[id]/send` | POST | Send contract for DocuSeal signing |
| `/api/contracts/[id]/cancel` | POST | Cancel draft/sent contract |
| `/api/contracts/[id]/preview` | GET | Get resolved HTML preview |

### POST /api/contracts (Create)

Input:
```typescript
{
  template_id: string
  profile_id: string        // target employee
  workspace_id: string
  overrides?: Record<string, string>  // manual placeholder overrides
}
```

Flow:
1. Auth check (JWT + is_admin_in_workspace)
2. Fetch employee data (profile + employment_contract + department + workspace + company) — using user JWT for RLS
3. Build placeholder autofill map via new resolver
4. Merge with overrides
5. Call contract service POST /contracts with `{ template_id, workspace_id, contract_type: 'employee', recipient_name, recipient_email, resolved_values }`
6. Contract service creates draft in `contract` table
7. Update `employment_contract.signing_contract_id` = new contract_id
8. Return draft contract

## 6. Webhook Extension

Modify `apps/web/src/app/api/webhooks/docuseal/route.ts`:

### Changes (additive only — do not restructure existing flow)

1. **Add `contract_type` to initial query** (line ~79 — currently only selects `contract_id, status, workspace_id`)
2. **Wrap existing workspace update (lines 199-215) inside an `else` branch.** The existing unconditional `workspace.contract_status` update must ONLY fire for non-employee contracts:

```
if (contract.contract_type === 'employee') {
  // Find linked employment_contract by signing_contract_id
  // Update: status (contract_status enum), document_url (from signed_pdf_url), signed_at
  // Do NOT update workspace.contract_status
} else {
  // EXISTING behavior (lines 199-215): update workspace.contract_status (SaaS contracts)
  // Move the existing code INTO this else block — do not duplicate
}
```

**Critical:** The existing workspace update code at lines 199-215 must be MOVED into the else branch, not left in place with a new if-block appended after. Leaving it in place means employee contract signings will still corrupt workspace.contract_status.

3. **Telemetry**: Existing `contract signed` event fires for both types. No new events needed for base flow.

## 7. UI Design

### 7.1 Entry Points

**A. People list — employee row action**
- Add "Send kontrakt" to `people-row-actions.tsx` dropdown menu
- Visible only for admin/owner (`isAdmin` check already exists)
- Opens contract creation Drawer

**B. /dashboard/contracts — overview page**
- New page with DataTable (server-side pagination)
- Columns: employee name, template, status badge, sent date, signed date, actions
- Filters: status, department
- Empty state with warm ghost card + CTA
- Botsson panel available

**C. Employee profile card — contract tab**
- New "Kontrakt" tab in `employee-profile-card.tsx`
- Contract history for this employee
- Active contract highlighted
- "Send nytt kontrakt" button (admin/owner only)
- Read-only for managers (see history, no send button)

### 7.2 Contract Creation Flow — Drawer

**Use Sheet (Drawer) — NOT wizard.** Contract sending is operational, not identity-forming. The AnimatedWizardShell brand panel is for onboarding-level flows.

Drawer width: `w-[540px]`, slides from right with Nordic Split spring (stiffness 35, damping 22, mass 2.2).

Three sections within one scrollable surface:

**Section 1: Template Selection**
- Card grid (if <4 templates) or radio list (if more)
- Each card: template name (Geist Sans), description, employment type badge
- Selected card gets `border-primary` with subtle glow

**Section 2: Employee Data Review**
- Auto-filled fields from profile/employment_contract
- Editable overrides for each placeholder
- Clear labels showing source ("Fra profil", "Fra arbeidsavtale")

**Section 3: Preview & Send**
- Rendered HTML preview in sandboxed iframe (`srcdoc`)
- "Forstørr" button to expand preview full-screen
- Summary: recipient, template, send method
- "Send kontrakt" primary button

### 7.3 Status Timeline Component

Build as reusable `<ContractTimeline>` in `packages/ui/`:

- Horizontal dots (8px) connected by thin lines (1px `border-border`)
- Completed: filled dot with Lucide Check icon, semantic warm color
- Active: pulsing opacity (CSS, not Framer Motion)
- Future: outline only (`border-border`)
- Timestamps below in Geist Mono, labels above in Geist Sans
- `role="list"` + `aria-current="step"` for accessibility

### 7.4 Status Badge Colors (OKLCH warm palette)

| Status | Token | Visual |
|--------|-------|--------|
| Draft | `text-muted-foreground` + `bg-muted` | Desaturated, quiet |
| Sent | `text-primary` + warm amber bg | Brand orange family |
| Viewed | Warm teal accent | Acknowledgment |
| Signed | Warm green (hue 50-60) | Success, not raw emerald |
| Expired | `text-destructive` low-opacity bg | Warm destructive |
| Cancelled | `text-muted-foreground` strikethrough | Inactive |

### 7.5 Interaction Details

**Send confirmation:** Clicking "Send kontrakt" opens a confirmation dialog (AlertDialog) with contract summary (recipient, template name). On confirm: button shows loading spinner, drawer stays open. On success: toast ("Kontrakt sendt til {name}"), drawer closes, DataTable refreshes. On error: toast with error, drawer stays open for retry.

**Drawer dismiss:** If user has selected a template or edited overrides, closing the drawer triggers a dismiss confirmation dialog ("Forkast endringer?"). No confirmation needed if drawer is in initial state.

**Template loading:** Skeleton cards (3) while loading. Empty state: ghost card with dashed border + "Ingen maler tilgjengelig" + CTA to contact admin. Error state: inline alert with retry button.

**DataTable defaults:** Page size 20, default sort by `sent_at` descending. Empty state (zero contracts): illustration + "Ingen kontrakter ennå" + "Send ditt første kontrakt" CTA. Empty after filter: "Ingen resultater" with clear-filter button.

### 7.6 Accessibility

- Drawer: focus trap, Escape to close, visible focus rings
- Timeline: `role="list"`, `aria-current="step"`, color + icon (not color alone)
- Badges: `aria-label` with full status description
- Template cards: keyboard navigation (arrow keys)
- All labels: i18n keys, no hardcoded Norwegian text
- DataTable: `aria-sort` on sortable columns

## 8. Botsson Contract Capability

### 8.1 Capability Registration

New capability at `packages/ai/src/capabilities/contract/`:

```
packages/ai/src/capabilities/contract/
├── index.ts      # exports contractCapability (CapabilityDefinition)
└── tools.ts      # 5 tools defined with defineTool + Zod schemas
```

Register in **all 3 locations atomically** (must be updated in the same PR):
1. `packages/ai/src/capabilities/types.ts` — add `"contract"` to `CapabilityName` union (line ~5-15)
2. `packages/ai/src/capabilities/registry.ts` — add `contract: contractCapability` to capabilities map
3. `packages/ai/src/router/intent-classifier.ts` — update **both** the `z.enum` array (line ~27-40) AND the system prompt capability descriptions (line ~59-71). Description: "Creating, sending, and checking status of employment contracts and agreements"

### 8.2 Tools

| Tool | Authority Tier | Description |
|------|---------------|-------------|
| `list-employee-templates` | readOnlyTools | List available contract templates (employee type) |
| `list-employee-contracts` | readOnlyTools | List contracts in workspace with filters |
| `check-contract-status` | readOnlyTools | Check signing status of a specific contract |
| `create-employee-contract` | suggestTools | Create draft contract from template for employee |
| `send-employee-contract` | tools (confirm+) | Send contract for DocuSeal signing — irreversible |

### 8.3 Tool Context Extension

`AgentToolContext` needs access to contract service. Options:

**Chosen approach:** Tools use the Supabase admin client from `AgentToolContext` for reads, and call the contract service directly (via `CONTRACT_SERVICE_URL` env var + `CONTRACT_SERVICE_KEY`) for mutations. This means:
- Read tools (list, check status) query Supabase directly via `ctx.supabaseAdmin` with workspace_id filter
- Write tools (create, send) call contract service HTTP API — read `CONTRACT_SERVICE_URL` and `CONTRACT_SERVICE_KEY` from `process.env` directly inside execute (same pattern as `getSecrets()` in `agent-router.ts`)
- Role checks happen inside each tool's execute function before any mutation — this is a **new pattern** (first capability to enforce caller-role inside tools)
- No dependency on dashboard API routes — tools and UI are independent consumers of the same contract service

### 8.4 Role Checks

Authority config is role-agnostic. Each write tool must verify the calling profile's role:

```
// Inside tool execute:
// 1. Get profile role from ctx.profileId
// 2. Reject if not admin/owner
// 3. Proceed with action
```

### 8.5 Intent Classifier Description

```
contract: "Creating, sending, tracking, and managing employment contracts and agreements for employees in the workspace"
```

## 9. Telemetry

Existing contract events in `packages/telemetry/src/registry.ts` cover the flow:

| Event | Trigger |
|-------|---------|
| `contract created` | Draft created via dashboard API |
| `contract sent` | Sent for DocuSeal signing |
| `contract viewed` | DocuSeal webhook (form.viewed) |
| `contract signed` | DocuSeal webhook (form.completed) |
| `contract cancelled` | Admin cancels via dashboard API |
| `contract expired` | DocuSeal webhook or contract-lifecycle Edge Function |

All dashboard API mutations must call `emit()`. The webhook already emits.

## 10. Implementation Order

| Phase | Scope | Dependencies |
|-------|-------|-------------|
| 1 | **Migration**: `signing_contract_id` FK, RLS policies, seed templates | None |
| 2 | **Dashboard API routes**: CRUD + auth | Phase 1 |
| 3 | **Webhook extension**: contract_type branching | Phase 1 |
| 4 | **Botsson capability**: tools + registry + intent classifier | Phase 2 |
| 5 | **UI**: contracts page, send drawer, timeline, profile tab, row action | Phase 2 |

Phases 4 and 5 can run in parallel after Phase 2.

## 11. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Webhook corrupts wrong status field | High | contract_type branching gate — never update workspace.contract_status for employee contracts |
| DocuSeal API changes | Medium | Zod validation on webhook payloads |
| Tool authority misconfiguration | Medium | E2E test: send-contract requires confirm authority |
| Placeholder data incomplete | Low | Validation step in create flow — warn admin of missing fields |

## 12. ADR Required

**ADR: Contract integration pattern — DocuSeal webhook branching by contract_type**

This pattern applies to any future contract types (HACCP, training, season). The webhook must always check `contract_type` and route side effects accordingly.

## 13. Out of Scope (Future)

- Custom template editor for workspace admins (Tiptap — Phase 2)
- Contract renewal/amendment flow
- Bulk contract sending
- Mobile contract signing UI
- Contract analytics/reporting
