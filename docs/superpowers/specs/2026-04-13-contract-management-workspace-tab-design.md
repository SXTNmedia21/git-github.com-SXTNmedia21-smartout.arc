---
title: Contract Management on Platform-Admin Workspace Detail Page
status: approved
updated: 2026-04-13
created: 2026-04-13
module: platform-admin
tags: [contracts, pricing, platform-admin, CRM, workspace]
council-verdict: APPROVE WITH CHANGES
council-date: 2026-04-13
---

# Contract Management on Platform-Admin Workspace Detail Page

**Council verdict:** APPROVE WITH CHANGES (2026-04-13)
**Agents consulted:** System Steward, Supervisor, Agent Coordinator, Frontend Designer

---

## 1. Problem

The platform-admin workspace detail page (`/platform-admin/workspaces/[id]`) has no contract management. The Subscription tab is nearly empty (plan name, trial days, 3 disabled buttons saying "Stripe integration coming"). When managing a customer workspace in the CRM, the admin must navigate to a separate `/platform-admin/contracts/` page and manually cross-reference.

**What's needed:** View and manage contracts, edit pricing terms, and track the commercial relationship — all from the workspace detail page.

---

## 2. Decision

Replace the Subscription tab with an **"Avtaler"** tab that combines:
- Subscription/contract status overview
- Editable pricing terms
- Contract list with actions

---

## 3. Design

### 3.1 Tab Structure

The "Subscription" tab is removed. A new "Avtaler" tab takes its position in the tab bar. The tab contains three vertically stacked sections separated by `space-y-6`.

### 3.2 Section 1: Status Row

Three compact cards in `grid-cols-1 sm:grid-cols-3 gap-4`, matching the Overview tab's stats pattern.

| Card | Source | Content |
|------|--------|---------|
| **Abonnement** | `company.subscription_plan` + `company.subscription_status` | Plan name + StatusBadge |
| **Kontraktstatus** | `workspace.contract_status` | Badge: none / pending_contract / active / suspended / deactivated |
| **Trial** | `company.trial_ends_at` | Days remaining + expiry date. Only rendered when trial is active. |

**Ownership clarity:** `company.*` fields are Stripe-managed (per ADR-0012). `workspace.contract_status` is platform-legal contract lifecycle. These are different systems and must be labeled distinctly. A code comment documents this boundary.

### 3.3 Section 2: Prisvilkar (Editable)

A Card with header "Gjeldende vilkar" and an Edit button. Uses the same `isEditing` toggle pattern as the Overview tab's workspace/company editing.

**Fields (from existing `pricing_terms` table):**

| Field | Column | Type | Notes |
|-------|--------|------|-------|
| Basispris / mnd | `monthly_cost` | number | Required |
| Pris per ekstra ansatt | `price_per_employee` | number | Required |
| Faktureringsintervall | `billing_interval` | select | monthly / quarterly / yearly |
| Valuta | `currency` | read-only | NOK / SEK / DKK / EUR |
| Rabatt | `discount_percent` + `discount_label` | number + text | 0-100%, optional label |
| Onboarding-pakke | `onboarding_package` | text | Optional |
| Onboarding-kostnad | `onboarding_cost` | number | Optional |
| Trial-dager | `trial_days` | number | Optional |
| Gyldig fra | `effective_from` | date | Required |
| Gyldig til | `effective_until` | date | Optional (null = current) |
| Notater | `notes` | textarea | Special agreements |

**Footer:** "Sist endret [date]" in `text-xs text-muted-foreground`.

**No JSONB extensions in phase 1.** Volume tiers, module pricing, and custom line items are deferred until there is an actual consumer. The existing `pricing_terms` columns cover the current pricing model (995 NOK base + 50 NOK/extra employee).

**Empty state:** If no pricing_terms row exists for this workspace, show a ghost card with dashed border and "Ingen prisvilkar registrert" + "Opprett vilkar" button.

### 3.4 Section 3: Kontrakter (List + Actions)

A Card with header "Kontrakter" and a "Ny kontrakt" button in the card header.

**Contract list** reuses the existing `ContractListClient` component (or a simplified variant) with data pre-filtered by `workspace_id`.

| Column | Content |
|--------|---------|
| Tittel | Contract title, links to `/platform-admin/contracts/[id]` |
| Type | Badge: client / employee / custom |
| Status | Badge: draft / sent / viewed / signed / expired / declined / cancelled |
| Sendt | Date |
| Signert | Date |
| Handlinger | Dropdown: Send, Purr, Kanseller, Last ned PDF |

**Active contract:** The row matching `workspace.active_contract_id` is highlighted with `bg-primary/5` and `border-l-2 border-primary`.

**Contract type filtering:** Per ADR-0079, the query fetches all contracts where `workspace_id` matches. Both B2B (client) and employee signing entities appear. The Type badge distinguishes them.

**Actions dropdown:**
- "Kanseller" uses `text-destructive` and is separated by `DropdownMenuSeparator`
- All action buttons (Send, Purr, Kanseller) are disabled with tooltip "Kontrakttjeneste ikke konfigurert" when `isContractServiceConfigured()` returns false
- "Last ned PDF" works independently of the contract service

**"Ny kontrakt" button:** Links to `/platform-admin/contracts/new?workspace_id={id}&company_id={companyId}`. The existing new contract page auto-fills company and workspace from URL params. No inline form.

**Empty state:** "Ingen kontrakter" with a "Ny kontrakt" button.

---

## 4. Data Flow

### 4.1 Server-Side Fetching (page.tsx)

Add to the existing `Promise.all()`:

```
// Contracts for this workspace
admin.from("contract")
  .select("contract_id, title, status, contract_type, recipient_name, recipient_email, sent_at, signed_at, expires_at, created_at, signed_pdf_url, template:template_id(name)")
  .eq("workspace_id", id)
  .order("created_at", { ascending: false })
  .limit(20)

// Current pricing terms
admin.from("pricing_terms")
  .select("*")
  .eq("workspace_id", id)
  .is("effective_until", null)
  .order("effective_from", { ascending: false })
  .limit(1)
  .maybeSingle()
```

Add workspace fields to prop mapping:
- `contractStatus: workspace.contract_status`
- `activeContractId: workspace.active_contract_id`
- `trialStartedAt: workspace.trial_started_at`
- `trialEndsAt: workspace.trial_ends_at`

### 4.2 Client Props

New props passed to `WorkspaceDetailClient` (and forwarded to `ContractTab`):
- `contracts: ContractRow[]`
- `pricingTerms: PricingTermsData | null`
- Updated `WorkspaceData` type with contract/trial fields

### 4.3 Mutations

| Action | Endpoint | Method | Telemetry |
|--------|----------|--------|-----------|
| Update pricing terms | `/api/platform-admin/pricing-terms` | PATCH | "pricing terms updated" |
| Create pricing terms | `/api/platform-admin/pricing-terms` | POST | "pricing terms created" |
| Send contract | `/api/platform-admin/contracts/[id]/send` | POST | existing |
| Remind contract | `/api/platform-admin/contracts/[id]/remind` | POST | existing |
| Cancel contract | `/api/platform-admin/contracts/[id]/cancel` | POST | existing |

---

## 5. Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ContractTab.tsx` | New "Avtaler" tab component |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/OverviewTab.tsx` | Extracted from workspace-detail-client.tsx |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/ChampionsTab.tsx` | Extracted |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/IntelligenceTab.tsx` | Extracted |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/CommunicationTab.tsx` | Extracted |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/tabs/NotesTab.tsx` | Extracted |
| `apps/web/src/app/api/platform-admin/pricing-terms/route.ts` | GET + POST + PATCH for pricing terms |

## 6. Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/platform-admin/workspaces/[id]/page.tsx` | Add contracts + pricing_terms + workspace fields to SSR fetch |
| `apps/web/src/app/platform-admin/workspaces/[id]/_components/workspace-detail-client.tsx` | Slim to ~200-line tab shell, import tab components |
| `apps/web/src/app/platform-admin/contracts/new/page.tsx` | Read workspace_id + company_id from URL params for pre-fill |
| `packages/telemetry/src/registry.ts` | Register "pricing terms created" + "pricing terms updated" events |

## 7. Files NOT to Touch

| File | Reason |
|------|--------|
| `supabase/migrations/*` | No new migration in phase 1 (existing pricing_terms columns suffice) |
| `packages/ai/*` | No agent capabilities on this tab |
| `services/contract-service/*` | Reuse existing, don't modify |
| `apps/web/src/app/api/platform-admin/contracts/route.ts` | Existing contract CRUD, out of scope |
| `supabase/functions/contract-lifecycle/*` | Telemetry gap is pre-existing, out of scope |

---

## 8. Implementation Order

1. **Extract existing tabs** — Split workspace-detail-client.tsx into tab shell + 5 tab components. Verify no regressions. Isolated commit.
2. **Add workspace fields to SSR** — contract_status, active_contract_id, trial_started_at, trial_ends_at
3. **Fetch contracts + pricing_terms server-side** — Add to Promise.all, define prop types
4. **Create pricing-terms API** — `/api/platform-admin/pricing-terms/route.ts` with GET + POST + PATCH + emit()
5. **Build ContractTab** — Three sections: status row, pricing editor, contract list
6. **Wire "Ny kontrakt" pre-fill** — URL params on contracts/new page
7. **Register telemetry events** — pricing terms created/updated in registry

---

## 9. Out of Scope (Logged as Gaps)

These are real issues discovered by the council but belong in separate work:

| Gap | Owner | Where to Log |
|-----|-------|-------------|
| `contract_data_intake` + `contract_signing` engine processes have no `engine_trigger` rows | Agent Coordinator | STATE.md |
| `contract-lifecycle` Edge Function has no `emit()` calls | Agent Coordinator | STATE.md |
| `"contract created"` event not routed to `engine_event` | Agent Coordinator | STATE.md |
| Workspace update route missing `emit()` | Supervisor | STATE.md |
| Contract remind route missing `emit()` | Supervisor | STATE.md |
| JSONB pricing extensions (volume_tiers, module_config, custom_line_items) | Phase 2 | Pricing roadmap |

---

## 10. Open Questions Resolved by Council

| Question | Answer | Decided by |
|----------|--------|-----------|
| "Ny kontrakt" — navigate or stay? | Navigate to existing page with query params | Supervisor |
| Pricing history — visible? | Only current terms in phase 1 | Council consensus |
| JSONB editors — now or later? | Later (no migration, no UI) | Supervisor + Steward synthesis |
| Active contract marking? | Yes, bg-primary/5 + border-l-2 | Frontend Designer |
| Disabled vs hidden actions? | Disabled with tooltip | Steward |
| Tab name? | "Avtaler" | Frontend Designer + Steward synthesis |
