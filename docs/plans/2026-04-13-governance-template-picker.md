---
title: "Governance Template Picker — Implementation Plan"
status: in_progress
updated: 2026-04-13
created: 2026-04-13
module: governance
tags: [wizard, templates, governance, implementation]
---

# Governance Template Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the placeholder in WorkspaceSetupWizard step 1 with an intelligent governance template picker that bootstraps policies from industry-appropriate templates.

**Architecture:** Filter-based template picker with 4 yes/no toggles that control which templates are recommended. Templates are created via chained client-side Supabase inserts (policy -> protocol -> procedure + steps -> knowledge_test -> confirmation). Industry defaults come from querying the `company` table via the workspace's `company_id`.

**Tech Stack:** React, TanStack Query, Supabase client, shadcn/ui (Switch, Sheet), @smartout/telemetry emit()

---

## Task 1: Create use-governance-templates.ts — Template Data + Hooks

**Files:**

- Create: `apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts`

**Context:**

- Existing mutations pattern: `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts`
- Workspace context: `useWorkspace()` provides `workspace_id` and `company_id`
- Profile ID: `useContext(DashboardContext).profileId`
- Query keys: `dashboardKeys.governanceOverview(workspaceId)` from `apps/web/src/app/dashboard/_hooks/dashboard-keys.ts`
- `industry` enum lives on `company` table (not workspace): `"restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other"`
- Telemetry: every mutation must call `emit()` from `@smartout/telemetry`

**Step 1: Create file with types, constants, and 10 template definitions**

The file exports:

- `FILTER_QUESTIONS` — 4 filter definitions with `key: FilterKey` and `label: string`
- `INDUSTRY_DEFAULTS` — `Record<Industry, Record<FilterKey, boolean>>` mapping each industry to default filter answers
- `GOVERNANCE_TEMPLATES` — array of 10 `GovernanceTemplate` objects (2 mandatory with `filterKey: null`, 8 recommended each tagged with their filterKey)
- `getVisibleTemplates(filters)` — pure function splitting templates into `{ mandatory, recommended }`
- `useIndustryFilters()` — queries `company.industry` via `company_id`, returns `Record<FilterKey, boolean>` defaults
- `useCreatedPolicies()` — queries `policy` table with nested `protocol(procedure)` select for procedure counts
- `useCreateFromTemplate()` — mutation that chains 5 sequential inserts: policy -> protocol -> procedures+steps -> knowledge_test -> confirmation

Each template contains:

- `id`, `name`, `description`, `policy_type`, `filterKey`
- `protocol: { name, description }`
- `procedures: [{ name, description, procedure_type, steps: [{ title, description, step_order, is_required, estimated_minutes }] }]`
- `knowledgeTest: { name, pass_threshold, questions: [{ id, text, options, correctOptionId }] }`
- `confirmation: { name, confirmation_text, requires_signature }`

The 10 templates:

1. **Arbeidsmiljo og HMS** (mandatory) — vernerunde procedure, HMS test
2. **Brannsikkerhet** (mandatory) — evakueringsprosedyre, branntest
3. **Mathandtering og hygiene** (food) — temperaturkontroll + handhygiene procedures
4. **Allergenhandtering** (food) — allergenmerking procedure
5. **Alkoholservering** (alcohol) — alderskontroll procedure
6. **Skjenkekontroll** (alcohol) — beruselseskontroll procedure
7. **Gjestesikkerhet** (overnight) — nokkelkort-handtering procedure
8. **Romrenhold** (overnight) — daglig romrenhold procedure
9. **Leveringssikkerhet** (delivery) — pakking og levering procedure
10. **Emballasjehygiene** (delivery) — emballasjekontroll procedure

All text in Norwegian. Each template has 1-2 procedures with 2-4 steps, 1-2 test questions, and a confirmation with `requires_signature: true`.

Key implementation details for `useCreateFromTemplate`:

- Sequential `.insert().select().single()` calls
- Each insert uses the ID from the previous result
- `questions` needs `as unknown as Json` cast for Supabase
- `onSuccess` calls `emit()` with `trackingId: "governance-template-created"`
- Invalidates `dashboardKeys.governanceOverview(workspace_id)`

**Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No new errors

**Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts
git commit -m "feat(governance): add template definitions and creation hooks"
```

---

## Task 2: Create GovernanceSetupStep.tsx — UI Component

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/GovernanceSetupStep.tsx`

**Dependencies:** Task 1 must be complete

**Context:**

- Component receives `isDark: boolean` prop (from WorkspaceSetupWizard)
- Uses `Switch` from shadcn/ui — verify it exists: `ls apps/web/src/components/ui/switch.tsx`. If missing: `cd apps/web && npx shadcn@latest add switch`
- PolicyForm from `apps/web/src/app/dashboard/governance/_components/PolicyForm.tsx` — renders its own Sheet trigger button, just mount `<PolicyForm />` directly

**Step 1: Create directory and component file**

```bash
mkdir -p apps/web/src/components/dashboard/wizard-steps
```

The component has 3 sections stacked vertically:

**Section 1: "Hva gjelder for dere?"**

- 4 filter questions as labeled toggle rows (label + Switch)
- 2-column grid on sm+, single column on mobile
- Active toggles get orange-tinted border, inactive get neutral

**Section 2: "Foreslatte retningslinjer"**

- "Lovplagt" subheading (red accent) — mandatory templates, no toggle, always included
- "Anbefalt for din virksomhet" subheading (orange accent) — recommended templates with Switch to uncheck
- Each template: TemplateCard showing name, description, procedure/test badge counts, and action button
- Action button states: "Opprett" (default) | Loader2 spinner (creating) | CheckCircle2 green (created)
- "Opprett alle (N)" button in section header — creates uncreated templates sequentially
- Created detection: match template.name against existing policy names

**Section 3: "Egne retningslinjer"**

- `<PolicyForm />` mounted directly (its trigger button says "Ny Policy")
- List of created policies from `useCreatedPolicies()` — name + protocol count

Component state:

- `filters: Record<FilterKey, boolean>` — initialized from `useIndustryFilters()`
- `unchecked: Set<string>` — template IDs user has unchecked
- `creatingId: string | null` — currently creating template ID
- `hasUserEdited: boolean` — tracks if user has toggled filters (prevents industry default override)

Important: `useState(industryDefaults)` captures initial value only. Add a `useEffect` to sync when industry query resolves, gated by `hasUserEdited`:

```typescript
useEffect(() => {
  if (!hasUserEdited) setFilters(industryDefaults);
}, [industryDefaults, hasUserEdited]);
```

**Step 2: Verify typecheck**

Run: `pnpm --filter web exec tsc --noEmit --pretty 2>&1 | tail -10`
Expected: No new errors

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/GovernanceSetupStep.tsx
git commit -m "feat(governance): add GovernanceSetupStep wizard component"
```

---

## Task 3: Wire GovernanceSetupStep into WorkspaceSetupWizard

**Files:**

- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`

**Dependencies:** Task 2 must be complete

**Step 1: Add import**

After line 8 (`import { useWorkspaceSetup } ...`), add:

```typescript
import { GovernanceSetupStep } from "@/components/dashboard/wizard-steps/GovernanceSetupStep";
```

**Step 2: Replace placeholder div (lines 256-269)**

Replace the entire dashed-border `<div>` block:

```typescript
{/* Form — governance uses real component, others keep placeholders */}
{step.id === "governance" ? (
  <GovernanceSetupStep isDark={isDark} />
) : (
  <div
    className={`min-h-[280px] rounded-2xl border-2 border-dashed p-8 ${
      isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50/50"
    }`}
  >
    <p className={`text-center text-sm ${isDark ? "text-zinc-600" : "text-zinc-400"}`}>
      {step.id === "handbook" && "Personalhåndbok-editor kobles inn her"}
      {step.id === "team" && "Invitasjonsskjema kobles inn her"}
      {step.id === "shift-template" && "Vaktmal-skjema kobles inn her"}
      {step.id === "season" && "Sesongoppsett kobles inn her"}
    </p>
  </div>
)}
```

**Step 3: Run full typecheck**

Run: `pnpm turbo typecheck 2>&1 | tail -20`
Expected: All packages pass

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx
git commit -m "feat(wizard): wire GovernanceSetupStep into wizard step 1"
```

---

## Task 4: Verify + Fix + Update Docs

**Dependencies:** Tasks 1-3 must be complete

**Step 1: Full typecheck**

Run: `pnpm turbo typecheck 2>&1 | tail -20`
Expected: All packages pass (19/19 or similar)

**Step 2: Fix common issues**

Watch for:

- Missing `Switch` component: `cd apps/web && npx shadcn@latest add switch`
- `Json` cast errors: use `as unknown as Json`
- Supabase relation select syntax for nested queries
- `policy_type` enum values must match database enum exactly

**Step 3: Update WORKLOG**

Add to `docs/worklogs/WORKLOG-zero-to-production.md` Done section:

```markdown
- [x] Governance template picker — filter-based wizard step 1 with industry defaults
```

**Step 4: Commit**

```bash
git add -u
git commit -m "fix(governance): typecheck fixes and worklog update"
```

---

## Acceptance Criteria

- [ ] 4 filter toggles control which templates appear
- [ ] Industry defaults auto-set toggles based on company.industry
- [ ] 2 mandatory templates always shown, can't be unchecked
- [ ] 8 recommended templates filtered and toggleable
- [ ] "Opprett" creates full chain: policy -> protocol -> procedures -> test -> confirmation
- [ ] "Opprett alle" creates all uncreated templates sequentially
- [ ] Created templates show green checkmark
- [ ] "Ny Policy" button opens PolicyForm Sheet for custom creation
- [ ] Created policies list shows name + protocol count
- [ ] Every creation emits telemetry event
- [ ] Full typecheck passes (pnpm turbo typecheck)
