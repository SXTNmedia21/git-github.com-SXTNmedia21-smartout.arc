---
title: "Design — Governance Template Picker (Wizard Step 1)"
status: approved
updated: 2026-04-13
created: 2026-04-13
module: governance
tags: [wizard, templates, onboarding, governance]
---

# Design — Governance Template Picker

## Problem

WorkspaceSetupWizard step 1 ("governance") has a placeholder. New workspaces need a way to bootstrap governance policies from industry-appropriate templates instead of creating everything from scratch.

## Approved Design

### Section 1: "Hva gjelder for dere?"

4 yes/no toggle questions that filter which templates are recommended:

| Key         | Question                              | Default ON for industries         |
| ----------- | ------------------------------------- | --------------------------------- |
| `food`      | Serverer dere mat?                    | restaurant, hotel, cafe, catering |
| `alcohol`   | Serverer dere alkohol?                | restaurant, hotel, bar            |
| `overnight` | Har dere overnattingsgjester?         | hotel                             |
| `delivery`  | Tilbyr dere take-away eller levering? | restaurant, catering              |

Defaults derived from `workspace.industry` enum.

### Section 2: "Foreslåtte retningslinjer"

Split into two groups:

**Lovpålagt (mandatory)** — always shown, can't be unchecked:

1. Arbeidsmiljø og HMS
2. Brannsikkerhet

**Anbefalt for din virksomhet** — filtered by section 1 answers, can be unchecked: 3. Mathåndtering og hygiene (`food`) 4. Allergenhåndtering (`food`) 5. Alkoholservering (`alcohol`) 6. Skjenkekontroll (`alcohol`) 7. Gjestesikkerhet (`overnight`) 8. Romrenhold (`overnight`) 9. Leveringssikkerhet (`delivery`) 10. Emballasjehygiene (`delivery`)

Each template card shows: name, short description, badge count of included items (e.g. "3 prosedyrer, 1 test").

### Section 3: Created policies

- "Opprett egen" button opens existing PolicyForm as Sheet
- Query `policy` table for workspace, show created policies with name + procedure count
- Auto-refreshes via TanStack Query invalidation after template creation

### Transaction Pattern

Client-side chained inserts (Approach A):

1. Insert policy → get policy_id
2. Insert protocol (with policy_id) → get protocol_id
3. Insert procedure + steps (with protocol_id)
4. Insert knowledge_test (with protocol_id)
5. Insert confirmation (with protocol_id)

Each template defines the full chain data. Mutations use sequential `.insert().select().single()`.

### Files

| File                                                                       | Action | Purpose                                                                               |
| -------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts` | CREATE | 10 template definitions, `useCreateFromTemplate` mutation, `useCreatedPolicies` query |
| `apps/web/src/components/dashboard/wizard-steps/GovernanceSetupStep.tsx`   | CREATE | Filter toggles + template groups + created policies list                              |
| `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`               | MODIFY | Replace governance placeholder with `<GovernanceSetupStep />`                         |

### Component State

```typescript
filters: Record<string, boolean>; // from industry defaults
unchecked: Set<string>; // user-unchecked recommended templates
```

### Telemetry

Every template creation emits via `emit()` with `trackingId: "governance-template-created"`.
