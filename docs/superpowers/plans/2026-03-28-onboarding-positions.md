# Onboarding Positions & Leader Marking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the onboarding ConfirmDepartments step with position tags, leader marking, and I1-driven suggestions scaled by employee count.

**Architecture:** The `POSITION_MAP` in `packages/ai/src/industry/defaults.ts` gets a tier system (basis/mid/specialist). The onboarding adapter in `apps/web/src/app/onboarding/lib/industry-defaults.ts` maps tiers to `PositionOption[]` based on `employeeCount`. ConfirmDepartments renders position tags per department with a popover for adding more.

**Tech Stack:** TypeScript, React, shadcn/ui Popover, i18n (nb/en), existing wizard framework

**Spec:** `docs/superpowers/specs/2026-03-28-onboarding-positions-design.md`

**Onboarding safety:** This plan only modifies the ConfirmDepartments UI component and the industry-defaults adapter. It does NOT touch routing (`/join`, `/create-workspace`, `/dashboard/setup`), does NOT modify `workspace.onboarding_completed` logic, does NOT add dependencies on `activate-workspace`, and does NOT change the finalization Edge Function contract. The only `wizard-definition.ts` change is mapping `PositionOption` fields in the `onComplete` payload — no flow or routing changes.

---

## File Structure

| File                                                       | Responsibility                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/types/src/industry.ts`                           | Add `PositionTier` type, update `IndustrySuggestion.positions`                                            |
| `packages/ai/src/industry/defaults.ts`                     | Tiered `POSITION_REGISTRY`, update `POSITION_MAP` → registry, new `getPositionsForDepartment()` signature |
| `apps/web/src/app/onboarding/types.ts`                     | `PositionOption` interface, update `DepartmentOption.positions`                                           |
| `apps/web/src/app/onboarding/lib/industry-defaults.ts`     | Map tiered positions → `PositionOption[]` with employee threshold                                         |
| `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx` | Expanded cards with position tags + popover + leader toggle                                               |
| `apps/web/src/app/onboarding/wizard-definition.ts`         | Update `onComplete` payload to pass `isLeader` (no flow changes)                                          |
| `packages/i18n/locales/nb/onboarding.json`                 | Position-related keys                                                                                     |
| `packages/i18n/locales/en/onboarding.json`                 | Position-related keys                                                                                     |

---

### Task 1: Update types — PositionOption + tiered industry types

**Files:**

- Modify: `packages/types/src/industry.ts`
- Modify: `apps/web/src/app/onboarding/types.ts`

- [ ] **Step 1: Add PositionTier to shared types**

In `packages/types/src/industry.ts`, add after the existing `IndustrySuggestion` type:

```typescript
export type PositionTier = "basis" | "mid" | "specialist";

export type PositionTemplate = {
  name: string;
  isLeader: boolean;
  tier: PositionTier;
};
```

Update `IndustrySuggestion` to include tiered positions alongside the existing `positions: string[]` (keep backward compat):

```typescript
export type IndustrySuggestion = {
  name: string;
  icon: string;
  preselected: boolean;
  positions: string[];
  /** Tiered position templates for onboarding — if absent, falls back to positions[] */
  positionTemplates?: PositionTemplate[];
};
```

- [ ] **Step 2: Add PositionOption to onboarding types**

In `apps/web/src/app/onboarding/types.ts`, add after `ZoneData`:

```typescript
/** A position within a department — used in onboarding wizard */
export interface PositionOption {
  id: string;
  name: string;
  isLeader: boolean;
  selected: boolean;
}
```

Update `DepartmentOption.positions` from `string[]` to `PositionOption[]`:

```typescript
export interface DepartmentOption {
  id: string;
  name: string;
  icon: string;
  selected: boolean;
  positions: PositionOption[];
}
```

- [ ] **Step 3: Run typecheck to see what breaks**

Run: `pnpm turbo typecheck --filter=web --filter=@smartout/ui --filter=@smartout/types --filter=@smartout/ai`

Expected: Errors in `industry-defaults.ts` (adapter), `ConfirmDepartments.tsx`, and `wizard-definition.ts` where `positions` was `string[]`. These are fixed in subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/industry.ts apps/web/src/app/onboarding/types.ts
git commit -m "feat(onboarding): add PositionOption type and tiered position templates"
```

---

### Task 2: Tiered position registry in I1 defaults

**Files:**

- Modify: `packages/ai/src/industry/defaults.ts`

- [ ] **Step 1: Replace POSITION_MAP with POSITION_REGISTRY**

Replace the existing `POSITION_MAP` (lines 52–65) with a tiered registry. Import `PositionTemplate` from types:

```typescript
import type {
  IndustrySuggestion,
  IndustryProcedureSuggestion,
  PositionTemplate,
} from "@smartout/types";

/** Tiered position registry — tier controls visibility by employee count */
const POSITION_REGISTRY: Record<string, PositionTemplate[]> = {
  Kjøkken: [
    { name: "Kjøkkensjef", isLeader: true, tier: "basis" },
    { name: "Kokk", isLeader: false, tier: "basis" },
    { name: "Sous Chef", isLeader: false, tier: "mid" },
    { name: "Kjøkkenassistent", isLeader: false, tier: "mid" },
    { name: "Gardemanger", isLeader: false, tier: "specialist" },
    { name: "Patissier", isLeader: false, tier: "specialist" },
    { name: "Oppvaskhjelp", isLeader: false, tier: "specialist" },
  ],
  Sal: [
    { name: "Hovmester", isLeader: true, tier: "basis" },
    { name: "Servitør", isLeader: false, tier: "basis" },
    { name: "Runner", isLeader: false, tier: "mid" },
    { name: "Sommelier", isLeader: false, tier: "specialist" },
    { name: "Vertinne", isLeader: false, tier: "specialist" },
  ],
  Bar: [
    { name: "Bartender", isLeader: true, tier: "basis" },
    { name: "Barback", isLeader: false, tier: "mid" },
    { name: "Barsjef", isLeader: true, tier: "specialist" },
  ],
  Ledelse: [
    { name: "Daglig leder", isLeader: true, tier: "basis" },
    { name: "Skiftleder", isLeader: false, tier: "mid" },
  ],
  Event: [
    { name: "Eventkoordinator", isLeader: true, tier: "basis" },
    { name: "Eventmedarbeider", isLeader: false, tier: "mid" },
  ],
  Housekeeping: [
    { name: "Renholder", isLeader: true, tier: "basis" },
    { name: "Renholdsansvarlig", isLeader: true, tier: "specialist" },
  ],
  Resepsjon: [
    { name: "Resepsjonist", isLeader: true, tier: "basis" },
    { name: "Nattevakt", isLeader: false, tier: "mid" },
  ],
  Restaurant: [
    { name: "Hovmester", isLeader: true, tier: "basis" },
    { name: "Servitør", isLeader: false, tier: "basis" },
    { name: "Kokk", isLeader: false, tier: "basis" },
  ],
  Spa: [
    { name: "Terapeut", isLeader: true, tier: "basis" },
    { name: "Resepsjonist", isLeader: false, tier: "mid" },
  ],
  Administrasjon: [
    { name: "Leder", isLeader: true, tier: "basis" },
    { name: "Koordinator", isLeader: false, tier: "mid" },
  ],
  Drift: [
    { name: "Driftsansvarlig", isLeader: true, tier: "basis" },
    { name: "Tekniker", isLeader: false, tier: "mid" },
  ],
  Kundeservice: [{ name: "Kundebehandler", isLeader: true, tier: "basis" }],
  Catering: [
    { name: "Cateringsjef", isLeader: true, tier: "basis" },
    { name: "Cateringmedarbeider", isLeader: false, tier: "mid" },
  ],
  Levering: [
    { name: "Sjåfør", isLeader: true, tier: "basis" },
    { name: "Leveringskoordinator", isLeader: true, tier: "specialist" },
  ],
};
```

- [ ] **Step 2: Update getDepartmentsForIndustry to include templates**

```typescript
export function getDepartmentsForIndustry(naceCode: string): IndustrySuggestion[] {
  const config = DEPARTMENT_CONFIGS[naceCode] ?? DEPARTMENT_CONFIGS["default"]!;
  return config.map((dept) => ({
    name: dept.name,
    icon: dept.icon,
    preselected: dept.preselected,
    positions: (POSITION_REGISTRY[dept.name] ?? []).map((p) => p.name),
    positionTemplates: POSITION_REGISTRY[dept.name] ?? [],
  }));
}
```

- [ ] **Step 3: Update getPositionsForDepartment to return templates**

Replace the existing function:

```typescript
/** Get tiered position templates for a department */
export function getPositionsForDepartment(departmentName: string): PositionTemplate[] {
  return POSITION_REGISTRY[departmentName] ?? [];
}
```

- [ ] **Step 4: Verify the ai package builds**

Run: `pnpm turbo build --filter=@smartout/ai`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/industry/defaults.ts
git commit -m "feat(industry): add tiered position registry with leader flags"
```

---

### Task 3: Onboarding adapter — map tiers to PositionOption by employee count

**Files:**

- Modify: `apps/web/src/app/onboarding/lib/industry-defaults.ts`
- Modify: `apps/web/src/app/onboarding/wizard-definition.ts` (payload mapping only, no flow changes)

- [ ] **Step 1: Update getDepartmentsForIndustry adapter**

The adapter maps `IndustrySuggestion` → `DepartmentOption`. Now it needs to convert `positionTemplates` → `PositionOption[]` using employee count:

```typescript
import {
  getDepartmentsForIndustry as getRawDepartments,
  getProceduresForIndustry as getRawProcedures,
} from "@smartout/ai/industry";
import type { DepartmentOption, PositionOption, ProcedureData } from "../types";
import type { PositionTemplate } from "@smartout/types";

/** Tier thresholds — positions at or below this tier are pre-selected */
function getMaxPreselectedTier(employeeCount: number): "basis" | "mid" | "specialist" {
  if (employeeCount >= 16) return "specialist";
  if (employeeCount >= 6) return "mid";
  return "basis";
}

/** How many non-leader positions to pre-select per tier threshold */
function getPreselectedCount(employeeCount: number): number {
  if (employeeCount >= 30) return 6;
  if (employeeCount >= 16) return 4;
  if (employeeCount >= 6) return 3;
  return 1;
}

const TIER_ORDER: Record<string, number> = { basis: 0, mid: 1, specialist: 2 };

function buildPositionOptions(
  templates: PositionTemplate[],
  employeeCount: number,
): PositionOption[] {
  const maxTier = getMaxPreselectedTier(employeeCount);
  const maxPreselected = getPreselectedCount(employeeCount);

  const sorted = [...templates].sort((a, b) => TIER_ORDER[a.tier]! - TIER_ORDER[b.tier]!);

  let nonLeaderCount = 0;
  return sorted.map((t, i) => {
    const withinTier = TIER_ORDER[t.tier]! <= TIER_ORDER[maxTier]!;
    let selected: boolean;

    if (t.isLeader) {
      selected = withinTier;
    } else {
      selected = withinTier && nonLeaderCount < maxPreselected;
      if (withinTier) nonLeaderCount++;
    }

    return {
      id: `pos-${i}-${t.name.toLowerCase().replace(/\s/g, "-")}`,
      name: t.name,
      isLeader: t.isLeader,
      selected,
    };
  });
}

export function getDepartmentsForIndustry(naceCode: string, employeeCount = 5): DepartmentOption[] {
  const suggestions = getRawDepartments(naceCode);
  return suggestions.map((dept, i) => ({
    id: `dept-${i}`,
    name: dept.name,
    icon: dept.icon,
    selected: dept.preselected,
    positions: dept.positionTemplates
      ? buildPositionOptions(dept.positionTemplates, employeeCount)
      : dept.positions.map((name, j) => ({
          id: `pos-${j}-${name.toLowerCase().replace(/\s/g, "-")}`,
          name,
          isLeader: j === 0,
          selected: true,
        })),
  }));
}
```

- [ ] **Step 2: Update wizard-definition loadState to pass employeeCount**

In `apps/web/src/app/onboarding/wizard-definition.ts`, update the `getDepartmentsForIndustry` call:

```typescript
const employeeCount = merged.employeeCount ?? 5;
const departments = getDepartmentsForIndustry(nace, employeeCount);
```

- [ ] **Step 3: Update onComplete payload mapping**

In `apps/web/src/app/onboarding/wizard-definition.ts`, update the department mapping in `onComplete`:

```typescript
const selectedDepts = state.departments
  .filter((d) => d.selected)
  .map((d) => ({
    name: d.name,
    positions: d.positions
      .filter((p) => p.selected)
      .map((p) => ({ name: p.name, isLeader: p.isLeader })),
  }));
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: Only remaining error should be in `ConfirmDepartments.tsx` (fixed in Task 4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/lib/industry-defaults.ts apps/web/src/app/onboarding/wizard-definition.ts
git commit -m "feat(onboarding): map tiered positions to PositionOption by employee count"
```

---

### Task 4: ConfirmDepartments UI — position tags + popover + leader toggle

**Files:**

- Modify: `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx`
- Modify: `packages/i18n/locales/nb/onboarding.json`
- Modify: `packages/i18n/locales/en/onboarding.json`

- [ ] **Step 1: Add i18n keys**

In `packages/i18n/locales/nb/onboarding.json`, add inside the `"confirm"` object:

```json
"positions_add": "Legg til",
"positions_custom": "Egendefinert...",
"positions_custom_placeholder": "Stillingstittel",
"positions_leader": "Leder"
```

In `packages/i18n/locales/en/onboarding.json`, same section:

```json
"positions_add": "Add",
"positions_custom": "Custom...",
"positions_custom_placeholder": "Position title",
"positions_leader": "Leader"
```

- [ ] **Step 2: Rewrite ConfirmDepartments with position tags**

Replace the full component with the expanded version. Key changes:

- Each selected department card expands to show position tags below it
- Tags show ★ (filled = leader, empty = staff). Click ★ to toggle.
- Click × on tag to deselect (moves back to popover suggestions)
- "+ Legg til" opens a popover listing unselected positions + "Egendefinert..." for custom input
- Popover closes on outside click

Full component code:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, Sparkles, Star } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmDepartments({
  state,
  updateState,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showDeptInput, setShowDeptInput] = useState(false);
  const [customDeptName, setCustomDeptName] = useState("");
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [customPosInput, setCustomPosInput] = useState<string | null>(null);
  const [customPosName, setCustomPosName] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!openPopover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
        setCustomPosInput(null);
        setCustomPosName("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openPopover]);

  const departments = state.departments;
  const selectedCount = departments.filter((d) => d.selected).length;
  const hasSuggestions = departments.some((d) => !d.selected);

  function toggleDepartment(id: string) {
    updateState({
      departments: departments.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)),
    });
  }

  function addCustomDepartment() {
    const trimmed = customDeptName.trim();
    if (!trimmed) return;
    updateState({
      departments: [
        ...departments,
        {
          id: `custom-${Date.now()}-${departments.length}`,
          name: trimmed,
          icon: "plus",
          selected: true,
          positions: [],
        },
      ],
    });
    setCustomDeptName("");
    setShowDeptInput(false);
  }

  function togglePosition(deptId: string, posId: string) {
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? { ...d, positions: d.positions.map((p) => (p.id === posId ? { ...p, selected: !p.selected } : p)) }
          : d,
      ),
    });
  }

  function toggleLeader(deptId: string, posId: string) {
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? { ...d, positions: d.positions.map((p) => (p.id === posId ? { ...p, isLeader: !p.isLeader } : p)) }
          : d,
      ),
    });
  }

  function addPositionFromSuggestion(deptId: string, posName: string) {
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? { ...d, positions: d.positions.map((p) => (p.name === posName ? { ...p, selected: true } : p)) }
          : d,
      ),
    });
    setOpenPopover(null);
  }

  function addCustomPosition(deptId: string) {
    const trimmed = customPosName.trim();
    if (!trimmed) return;
    updateState({
      departments: departments.map((d) =>
        d.id === deptId
          ? {
              ...d,
              positions: [
                ...d.positions,
                { id: `pos-custom-${Date.now()}`, name: trimmed, isLeader: false, selected: true },
              ],
            }
          : d,
      ),
    });
    setCustomPosName("");
    setCustomPosInput(null);
    setOpenPopover(null);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">{t("confirm.departments_title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("confirm.departments_description")}</p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {selectedCount} valgt av {departments.length} forslag
        </p>
      </div>

      <div className="space-y-2">
        {departments.map((dept) => (
          <div key={dept.id}>
            {/* Department toggle */}
            <button
              type="button"
              onClick={() => toggleDepartment(dept.id)}
              className={[
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200",
                dept.selected
                  ? "text-foreground border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                  : "border-dashed border-border bg-white/50 text-muted-foreground hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5 hover:text-foreground",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <span
                  className={[
                    "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-all duration-200",
                    dept.selected
                      ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                      : "border-border bg-card text-transparent",
                  ].join(" ")}
                >
                  &#10003;
                </span>
                <span className="text-sm font-medium">{dept.name}</span>
              </span>
              {!dept.selected && (
                <span className="text-[10px] tracking-wider text-muted-foreground uppercase">Forslag</span>
              )}
            </button>

            {/* Position tags — only when department is selected */}
            {dept.selected && (
              <div className="ml-8 mt-2 mb-1 flex flex-wrap items-center gap-1.5">
                {dept.positions.filter((p) => p.selected).map((pos) => (
                  <span
                    key={pos.id}
                    className={[
                      "group flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      pos.isLeader
                        ? "border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                        : "border-border bg-muted/50 text-foreground",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => toggleLeader(dept.id, pos.id)}
                      title={t("confirm.positions_leader")}
                    >
                      <Star className={["size-3", pos.isLeader ? "fill-current" : "text-muted-foreground/40"].join(" ")} />
                    </button>
                    {pos.name}
                    <button
                      type="button"
                      onClick={() => togglePosition(dept.id, pos.id)}
                      className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}

                {/* + Legg til popover */}
                <div className="relative" ref={openPopover === dept.id ? popoverRef : undefined}>
                  <button
                    type="button"
                    onClick={() => setOpenPopover(openPopover === dept.id ? null : dept.id)}
                    className="border-border text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors"
                  >
                    <Plus className="size-3" />
                    {t("confirm.positions_add")}
                  </button>

                  {openPopover === dept.id && (
                    <div className="border-border bg-card absolute left-0 z-20 mt-1 w-48 rounded-lg border py-1 shadow-lg">
                      {dept.positions.filter((p) => !p.selected).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addPositionFromSuggestion(dept.id, p.name)}
                          className="text-foreground hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)] flex w-full items-center px-3 py-1.5 text-left text-xs"
                        >
                          {p.name}
                        </button>
                      ))}

                      {dept.positions.filter((p) => !p.selected).length > 0 && (
                        <div className="border-border my-1 border-t" />
                      )}

                      {customPosInput === dept.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={customPosName}
                            onChange={(e) => setCustomPosName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addCustomPosition(dept.id);
                              if (e.key === "Escape") { setCustomPosInput(null); setCustomPosName(""); }
                            }}
                            placeholder={t("confirm.positions_custom_placeholder")}
                            className="border-border bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded border px-2 py-1 text-xs focus-visible:outline-none"
                            autoFocus
                          />
                          <button type="button" onClick={() => addCustomPosition(dept.id)} className="text-[var(--brand-orange)] px-1 text-xs font-medium">OK</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCustomPosInput(dept.id)}
                          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs"
                        >
                          <Plus className="size-3" />
                          {t("confirm.positions_custom")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add custom department */}
        {showDeptInput ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customDeptName}
              onChange={(e) => setCustomDeptName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustomDepartment();
                if (e.key === "Escape") { setShowDeptInput(false); setCustomDeptName(""); }
              }}
              placeholder="Avdelingsnavn"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/40 focus-visible:outline-none"
              autoFocus
            />
            <button type="button" onClick={addCustomDepartment} className="rounded-lg bg-[var(--brand-orange)]/10 px-3 py-2 text-sm text-[var(--brand-orange)] transition-colors hover:bg-[var(--brand-orange)]/20">
              Legg til
            </button>
            <button type="button" onClick={() => { setShowDeptInput(false); setCustomDeptName(""); }} className="text-muted-foreground hover:text-foreground p-1.5 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowDeptInput(true)} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors">
            <Plus className="size-3.5" />
            Legg til egen avdeling
          </button>
        )}
      </div>

      {hasSuggestions && (
        <p className="text-muted-foreground text-xs">
          Stiplede kort er forslag basert på bransjen din. Klikk for å velge.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm turbo typecheck --filter=web`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx packages/i18n/locales/nb/onboarding.json packages/i18n/locales/en/onboarding.json
git commit -m "feat(onboarding): expand departments with position tags, leader toggle, and I1 suggestions"
```

---

### Task 5: Final typecheck + manual verification

- [ ] **Step 1: Full typecheck**

Run: `pnpm turbo typecheck`

Expected: PASS across all packages

- [ ] **Step 2: Manual verification checklist**

Open `http://localhost:3060/onboarding` and verify:

1. Department cards show position tags underneath when selected
2. Leader positions have ★ filled, others have ★ empty
3. Clicking ★ toggles leader status
4. Clicking × on a tag deselects it (moves to popover)
5. "+ Legg til" opens popover with unselected positions
6. Clicking a suggestion adds it as a tag
7. "Egendefinert..." opens inline text input
8. Popover closes on outside click

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(onboarding): complete department positions implementation"
```
