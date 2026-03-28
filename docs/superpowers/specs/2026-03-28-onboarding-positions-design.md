---
title: "Onboarding: Department Positions & Leader Marking"
status: draft
updated: 2026-03-28
created: 2026-03-28
module: onboarding
tags: [onboarding, positions, departments, I1, wizard]
---

# Onboarding: Department Positions & Leader Marking

## Problem

The onboarding wizard confirms departments but doesn't let the user define which positions (stillinger) exist in each department or who the leader is. This information is needed before employees can be invited and scheduled.

Most restaurants have a flat structure: one leader (kjøkkensjef, hovmester) and staff. The number and variety of positions scales with business size.

## Design

### What changes

**ConfirmDepartments** is expanded — no new wizard steps. Each selected department card shows:

- Position tags (solid = active)
- One position marked as ★ leader per department
- A "+ Legg til" button that opens a popover with I1 suggestions + "Egendefinert"

### Card layout

```
┌─ Kjøkken ─────────────────────────────────┐
│  Kjøkkensjef ★   Kokk           + Legg til │
└─────────────────────────────────────────────┘
```

Clicking "+ Legg til" opens a popover:

```
┌──────────────────────┐
│  Sous Chef           │
│  Kjøkkenassistent    │
│  Oppvaskhjelp        │
├──────────────────────┤
│  Egendefinert...     │
└──────────────────────┘
```

- Only shows suggestions NOT already on the card
- "Egendefinert..." switches to a text input inside the popover
- Clicking a suggestion immediately adds it as a tag and closes the popover

### Position tags

- Solid rounded tag with text
- Click ★ icon to toggle leader (one leader per department)
- Click × to remove
- Leader tag gets a subtle visual distinction (star icon + brand-orange tint)

### Employee count thresholds

`employeeCount` comes from `state.business.employeeCount` (set in Join wizard or intelligence pipeline). Controls both which positions are pre-selected and which suggestions appear.

| Employees | Pre-selected per dept | Available via + Legg til |
| --------- | --------------------- | ------------------------ |
| 1–5       | Leader + 1 basis      | 2–3 more                 |
| 6–15      | Leader + 2–3          | 4–5 more                 |
| 16–30     | Leader + 3–4          | 5–7 more                 |
| 30+       | Leader + 5–6          | All I1 positions         |

"Egendefinert" is always available regardless of threshold.

### I1 position registry

`industry-defaults.ts` gets a new function:

```typescript
function getPositionsForDepartment(
  deptName: string,
  nace: string,
  employeeCount: number,
): PositionSuggestion[];
```

Returns `{ name: string; isLeader: boolean; tier: 'basis' | 'mid' | 'specialist' }[]`

Tier determines threshold visibility:

- `basis` → always shown (1+)
- `mid` → shown at 6+ employees
- `specialist` → shown at 16+ employees

All tiers appear in the "+ Legg til" popover for 30+ employees.

#### Position registry per department (NACE 56.101 — Restaurant)

| Department         | Basis (1+)            | Mid (6+)                    | Specialist (16+)                     |
| ------------------ | --------------------- | --------------------------- | ------------------------------------ |
| **Kjøkken**        | Kjøkkensjef ★, Kokk   | Sous Chef, Kjøkkenassistent | Gardemanger, Patissier, Oppvaskhjelp |
| **Restaurant/Sal** | Hovmester ★, Servitør | Runner                      | Sommelier, Vertinne                  |
| **Bar**            | Bartender ★           | Barback                     | Barsjef ★, Sommelier                 |
| **Event**          | Eventkoordinator ★    | Eventmedarbeider            | —                                    |
| **Renhold**        | Renholder ★           | —                           | Renholdsansvarlig ★                  |
| **Levering**       | Sjåfør ★              | —                           | Leveringskoordinator ★               |
| **Catering**       | Cateringsjef ★        | Cateringmedarbeider         | —                                    |

★ = default leader for that department.

### Data model changes

**`DepartmentOption.positions`** changes from `string[]` to:

```typescript
interface PositionOption {
  id: string;
  name: string;
  isLeader: boolean;
  selected: boolean; // true = on the card, false = available in popover
}
```

**`OnboardingConfirmState.departments`** keeps its shape — `DepartmentOption[]` — but `positions` is now `PositionOption[]`.

### Finalization

`onComplete` maps positions to the `position` table:

```typescript
departments: selectedDepts.map((d) => ({
  name: d.name,
  positions: d.positions
    .filter((p) => p.selected)
    .map((p) => ({
      name: p.name,
      isLeader: p.isLeader,
    })),
}));
```

The `finalize_onboarding_workspace` RPC writes to `position` with:

- `minimum_role = 'manager'` for `isLeader = true`
- `minimum_role = 'employee'` for `isLeader = false`

### What this does NOT do

- No org chart or hierarchy building — flat structure (leader + staff)
- No person-to-position assignment — that happens at employee invite
- No shift/schedule connection — that's the scheduling module
- No changes to the `position` DB table schema — it already has all needed columns

## Files to modify

| File                                                       | Change                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/app/onboarding/types.ts`                     | `PositionOption` interface, update `DepartmentOption.positions` type |
| `apps/web/src/app/onboarding/types-v2.ts`                  | Import updated types                                                 |
| `packages/ai/src/industry/defaults.ts`                     | Add `getPositionsForDepartment()` with tier system                   |
| `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx` | Expand cards with position tags + popover + leader toggle            |
| `apps/web/src/app/onboarding/wizard-definition.ts`         | Update `onComplete` to pass position leader flag                     |
| `apps/web/src/app/onboarding/lib/finalization.ts`          | Map `isLeader` to `minimum_role`                                     |
| `packages/i18n/locales/nb/onboarding.json`                 | Add position-related i18n keys                                       |
| `packages/i18n/locales/en/onboarding.json`                 | Add position-related i18n keys                                       |

## Scope boundary

This spec covers ONLY the onboarding wizard department expansion. It does NOT modify:

- The `position` or `department` DB table schemas
- The I1 SQL templates (`departments.sql`)
- The scheduling or shift assignment modules
- Employee invitation flow
