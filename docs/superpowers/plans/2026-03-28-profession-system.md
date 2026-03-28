# Profession System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Fag (profession), Lovfunksjon (legal function), authority levels, and profile access as core dimensions in Smartout. Fix onboarding location bug. Add onboarding step #3 for profession/position confirmation.

**Architecture:** K1a platform-level profession + legal_function tables with seed data. Existing `position` table extended with `profession_id` FK + `authority_level` enum. Profile-level access table seeded from position/legal_function. Onboarding wizard gets new step #3 for confirming positions grouped by profession.

**Tech Stack:** PostgreSQL (Supabase Local), Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, WizardShell

**Spec:** `docs/superpowers/specs/2026-03-28-profession-system-design.md`

---

### Task 1: Database Migration — Profession Tables + Seed

**Files:**

- Create: `supabase/migrations/20260328200000_add_profession_system.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ============================================================
-- Profession System: Fag, Legal Functions, Authority, Access
-- ============================================================

-- 1. Profession (Fag) — K1a platform + workspace override
CREATE TABLE public.profession (
  profession_id    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID REFERENCES public.workspace(workspace_id),
  slug             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  is_universal     BOOLEAN NOT NULL DEFAULT false,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE NULLS NOT DISTINCT (workspace_id, slug)
);
CREATE TRIGGER set_profession_updated_at
  BEFORE UPDATE ON public.profession
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. NACE code mapping
CREATE TABLE public.profession_industry (
  profession_id  UUID NOT NULL REFERENCES public.profession(profession_id),
  nace_code      TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profession_id, nace_code)
);
CREATE TRIGGER set_profession_industry_updated_at
  BEFORE UPDATE ON public.profession_industry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Authority level enum
CREATE TYPE authority_level AS ENUM ('duty', 'deputy', 'leader');

-- 4. Legal functions (K1a — static, law-defined)
CREATE TABLE public.legal_function (
  legal_function_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  description        TEXT,
  legal_basis        TEXT,
  training_hours     INTEGER,
  profession_id      UUID REFERENCES public.profession(profession_id),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_legal_function_updated_at
  BEFORE UPDATE ON public.legal_function
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Profile <-> Legal function (m2m)
CREATE TABLE public.profile_legal_function (
  profile_id         UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  legal_function_id  UUID NOT NULL REFERENCES public.legal_function(legal_function_id) ON DELETE CASCADE,
  assigned_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  assigned_by        UUID REFERENCES public.profile(profile_id),
  created_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, legal_function_id)
);
CREATE TRIGGER set_profile_legal_function_updated_at
  BEFORE UPDATE ON public.profile_legal_function
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Profession training (weighted m2m)
CREATE TABLE public.profession_training (
  profession_training_id  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profession_id           UUID NOT NULL REFERENCES public.profession(profession_id),
  protocol_id             UUID NOT NULL REFERENCES public.protocol(protocol_id),
  weight                  DECIMAL(3,2) NOT NULL DEFAULT 1.0
                            CHECK (weight >= 0 AND weight <= 1),
  is_required             BOOLEAN NOT NULL DEFAULT false,
  workspace_id            UUID REFERENCES public.workspace(workspace_id),
  created_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE NULLS NOT DISTINCT (profession_id, protocol_id, workspace_id)
);
CREATE TRIGGER set_profession_training_updated_at
  BEFORE UPDATE ON public.profession_training
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Profile access (fine-grained scopes)
CREATE TABLE public.profile_access (
  profile_id   UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  scope        TEXT NOT NULL
                 CHECK (scope ~ '^[a-z_]+\.[a-z_*]+$'),
  granted_by   TEXT NOT NULL DEFAULT 'manual'
                 CHECK (granted_by IN ('authority', 'legal_function', 'manual')),
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, scope)
);
CREATE TRIGGER set_profile_access_updated_at
  BEFORE UPDATE ON public.profile_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Profile <-> Position (m2m — en person kan ha flere posisjoner)
CREATE TABLE public.profile_position (
  profile_id    UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  position_id   UUID NOT NULL REFERENCES public.position(position_id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, position_id)
);
CREATE TRIGGER set_profile_position_updated_at
  BEFORE UPDATE ON public.profile_position
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Extend position table (fag-kobling only, authority lives on profile)
ALTER TABLE public.position
  ADD COLUMN profession_id UUID REFERENCES public.profession(profession_id) ON DELETE SET NULL;

-- 10. Extend profile (authority level — én per person, stabilt)
ALTER TABLE public.profile
  ADD COLUMN authority_level authority_level;

-- 11. Extend tariff_rate_table
ALTER TABLE public.tariff_rate_table
  ADD COLUMN profession_id UUID REFERENCES public.profession(profession_id) ON DELETE SET NULL;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.profession ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_professions" ON public.profession
  FOR SELECT USING (workspace_id IS NULL);
CREATE POLICY "read_workspace_professions" ON public.profession
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "manage_workspace_professions" ON public.profession
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

ALTER TABLE public.profession_industry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profession_industry" ON public.profession_industry
  FOR SELECT USING (true);

ALTER TABLE public.legal_function ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_legal_functions" ON public.legal_function
  FOR SELECT USING (true);

ALTER TABLE public.profile_legal_function ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_legal_functions" ON public.profile_legal_function
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_legal_functions" ON public.profile_legal_function
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

ALTER TABLE public.profession_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_platform_training" ON public.profession_training
  FOR SELECT USING (workspace_id IS NULL);
CREATE POLICY "read_workspace_training" ON public.profession_training
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "manage_workspace_training" ON public.profession_training
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

ALTER TABLE public.profile_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_access" ON public.profile_access
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_access" ON public.profile_access
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

ALTER TABLE public.profile_position ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_profile_positions" ON public.profile_position
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  ));
CREATE POLICY "manage_profile_positions" ON public.profile_position
  FOR ALL USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
      AND is_admin_in_workspace(auth.uid(), workspace_id)
  ));

-- API key policies
CREATE POLICY "api_key_read_profile_legal_function" ON public.profile_legal_function
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));
CREATE POLICY "api_key_read_profile_access" ON public.profile_access
  FOR SELECT USING (profile_id IN (
    SELECT profile_id FROM profile
    WHERE workspace_id = get_api_workspace_id()
  ));

-- ============================================================
-- Seed Data
-- ============================================================

INSERT INTO public.profession (slug, name, description, is_universal, sort_order) VALUES
  ('kjokken',    'Kjøkken',    'Matlaging, mise en place, hygiene',        false, 1),
  ('servering',  'Servering',  'Gjesteservice, bordservering, vin',        false, 2),
  ('bartending', 'Bartending', 'Drinkblanding, barservice, skjenking',     false, 3),
  ('ledelse',    'Ledelse',    'Drift, personal, økonomi',                 true,  4),
  ('renhold',    'Renhold',    'Rengjøring, hygienekontroll',              false, 5),
  ('resepsjon',  'Resepsjon',  'Innsjekk, gjestekontakt, booking',        false, 6);

INSERT INTO public.profession_industry (profession_id, nace_code) VALUES
  ((SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL),    '56.101'),
  ((SELECT profession_id FROM profession WHERE slug='servering' AND workspace_id IS NULL),  '56.101'),
  ((SELECT profession_id FROM profession WHERE slug='bartending' AND workspace_id IS NULL), '56.101'),
  ((SELECT profession_id FROM profession WHERE slug='resepsjon' AND workspace_id IS NULL),  '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='renhold' AND workspace_id IS NULL),    '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='servering' AND workspace_id IS NULL),  '55.101'),
  ((SELECT profession_id FROM profession WHERE slug='bartending' AND workspace_id IS NULL), '56.301'),
  ((SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL),    '56.301');

INSERT INTO public.legal_function (slug, name, legal_basis, training_hours, profession_id, sort_order) VALUES
  ('verneombud',            'Verneombud',            'Arbeidsmiljøloven §6-1',  40,   NULL, 1),
  ('brannvernleder',        'Brannvernleder',        'Brannvernforskriften §4', NULL, NULL, 2),
  ('mattrygghetsansvarlig', 'Mattrygghetsansvarlig', 'Matloven §4',            NULL,
    (SELECT profession_id FROM profession WHERE slug='kjokken' AND workspace_id IS NULL), 3),
  ('skjenkeansvarlig',      'Skjenkeansvarlig',      'Alkoholloven §1-7c',      NULL,
    (SELECT profession_id FROM profession WHERE slug='bartending' AND workspace_id IS NULL), 4);

-- API key RLS for workspace-scoped profession and profession_training
CREATE POLICY "api_key_read_profession" ON public.profession
  FOR SELECT USING (workspace_id = get_api_workspace_id());
CREATE POLICY "api_key_read_profession_training" ON public.profession_training
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Run migration against local Supabase**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260328200000_add_profession_system.sql`

Expected: No errors. Tables created, seed data inserted.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "SELECT name, slug, is_universal FROM profession WHERE workspace_id IS NULL ORDER BY sort_order;"`

Expected: 6 rows (Kjokken, Servering, Bartending, Ledelse, Renhold, Resepsjon).

- [ ] **Step 4: Regenerate TypeScript types**

Run: `cd /home/sxtnl/dev/smartout.ai && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

Expected: File regenerated with profession, legal_function, profession_training, profile_access, profile_legal_function, authority_level types.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260328200000_add_profession_system.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add profession system tables, enums, RLS and seed data

Adds profession (fag), legal_function, profession_training, profile_access,
profile_legal_function tables. Extends position with profession_id FK and
authority_level enum. Seeds 6 professions, NACE mappings, 4 legal functions.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Onboarding Types + Industry Defaults

**Files:**

- Modify: `apps/web/src/app/onboarding/types.ts`
- Modify: `apps/web/src/app/onboarding/types-v2.ts`
- Modify: `packages/ai/src/industry/defaults.ts`
- Modify: `apps/web/src/app/onboarding/lib/industry-defaults.ts`

- [ ] **Step 1: Add ProfessionOption and PositionOption types to types.ts**

Add at end of `apps/web/src/app/onboarding/types.ts`:

```typescript
/** A profession (Fag) with positions for onboarding confirmation */
export interface ProfessionOption {
  id: string;
  slug: string;
  name: string;
  isUniversal: boolean;
  positions: PositionOption[];
}

/** A position within a profession for onboarding confirmation */
export interface PositionOption {
  id: string;
  name: string;
  slug: string;
  selected: boolean;
  authorityLevel: "duty" | "deputy" | "leader" | null;
}
```

- [ ] **Step 2: Add professions to OnboardingConfirmState in types-v2.ts**

In `apps/web/src/app/onboarding/types-v2.ts`, add to the interface:

```typescript
/** Professions with positions, loaded from K1a platform data */
professions: ProfessionOption[];
```

Add to `defaultOnboardingConfirmState`:

```typescript
professions: [],
```

Add import:

```typescript
import type {
  BusinessData,
  DepartmentOption,
  LocationData,
  ProcedureData,
  ProfessionOption,
} from "./types";
```

- [ ] **Step 3: Mark POSITION_MAP as @deprecated in defaults.ts**

In `packages/ai/src/industry/defaults.ts`, add JSDoc to POSITION_MAP and getPositionsForDepartment:

```typescript
/**
 * @deprecated Use profession + position tables in DB instead.
 * Kept for backward compatibility with TeamSetupStep and getDepartmentsForIndustry.
 * Remove after migrating all consumers to DB-based profession data.
 */
const POSITION_MAP: Record<string, string[]> = {
```

```typescript
/**
 * @deprecated Use profession + position tables in DB instead.
 * Kept for backward compatibility with TeamSetupStep.
 */
export function getPositionsForDepartment(departmentName: string): string[] {
```

- [ ] **Step 4: Add getProfessionsForIndustry to industry-defaults.ts**

Add to `apps/web/src/app/onboarding/lib/industry-defaults.ts`:

```typescript
import { createClient } from "@smartout/supabase/client";
import type { ProfessionOption } from "../types";

/** Fetch platform professions relevant for a NACE code from DB */
export async function getProfessionsForIndustry(naceCode: string): Promise<ProfessionOption[]> {
  const supabase = createClient();

  // Fetch professions linked to this NACE code + universal ones
  const { data: professions } = await supabase
    .from("profession")
    .select("profession_id, slug, name, is_universal, sort_order")
    .is("workspace_id", null)
    .order("sort_order");

  if (!professions) return [];

  // Fetch NACE mappings
  const { data: industryLinks } = await supabase
    .from("profession_industry")
    .select("profession_id")
    .eq("nace_code", naceCode);

  const relevantIds = new Set(industryLinks?.map((l) => l.profession_id) ?? []);

  // Filter: relevant for this NACE code OR universal
  const filtered = professions.filter((p) => p.is_universal || relevantIds.has(p.profession_id));

  // Map to ProfessionOption with default positions from POSITION_MAP (deprecated fallback)
  return filtered.map((p) => ({
    id: p.profession_id,
    slug: p.slug,
    name: p.name,
    isUniversal: p.is_universal,
    positions: getDefaultPositionsForProfession(p.slug),
  }));
}

/** Map profession slug to default positions (from deprecated POSITION_MAP) */
function getDefaultPositionsForProfession(slug: string): PositionOption[] {
  const PROFESSION_POSITION_MAP: Record<string, { name: string; preselected: boolean }[]> = {
    kjokken: [
      { name: "Kokk", preselected: true },
      { name: "Sous Chef", preselected: false },
      { name: "Kjokkenassistent", preselected: true },
    ],
    servering: [
      { name: "Servitor", preselected: true },
      { name: "Sommelier", preselected: false },
    ],
    bartending: [
      { name: "Bartender", preselected: true },
      { name: "Barback", preselected: false },
    ],
    ledelse: [
      { name: "Daglig leder", preselected: true },
      { name: "Skiftleder", preselected: true },
    ],
    renhold: [{ name: "Renholder", preselected: true }],
    resepsjon: [
      { name: "Resepsjonist", preselected: true },
      { name: "Nattevakt", preselected: false },
    ],
  };

  const positions = PROFESSION_POSITION_MAP[slug] ?? [];
  return positions.map((pos, i) => ({
    id: `pos-${slug}-${i}`,
    name: pos.name,
    slug: pos.name.toLowerCase().replace(/\s+/g, "-"),
    selected: pos.preselected,
    authorityLevel: null,
  }));
}
```

Add import for PositionOption:

```typescript
import type { ProfessionOption, PositionOption } from "../types";
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/types.ts apps/web/src/app/onboarding/types-v2.ts packages/ai/src/industry/defaults.ts apps/web/src/app/onboarding/lib/industry-defaults.ts
git commit -m "feat(onboarding): add profession types and DB-backed industry defaults

Adds ProfessionOption/PositionOption types. Marks POSITION_MAP as deprecated.
Adds getProfessionsForIndustry() that queries platform profession data from DB.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wizard Definition — loadState + Step #3 + Location Fix

**Files:**

- Modify: `apps/web/src/app/onboarding/wizard-definition.ts`

- [ ] **Step 1: Add professions to loadState()**

In `apps/web/src/app/onboarding/wizard-definition.ts`, import the new function:

```typescript
import { getProfessionsForIndustry } from "./lib/industry-defaults";
```

In `loadState()`, after the departments/procedures section (around line 139), add:

```typescript
// Professions from DB (K1a platform data)
const professions = await getProfessionsForIndustry(nace);
```

Add `professions` to the return object (around line 166):

```typescript
return {
  business: merged,
  departments,
  locations,
  procedures,
  professions,
  workspaceId: ws.workspace_id,
  workspaceSlug: ws.slug,
};
```

- [ ] **Step 2: Fix location auto-generation**

In `loadState()`, after the locations array is built (around line 157), add:

```typescript
// Auto-generate default location from business name if scraping returned none
if (locations.length === 0 && merged.name) {
  locations.push({
    id: "loc-default-0",
    name: merged.name,
    type: "main",
    zones: [],
  });
}
```

- [ ] **Step 3: Add ConfirmProfessions step to wizard**

Import at top of file:

```typescript
import { Users } from "lucide-react";
import { ConfirmProfessions } from "./steps/ConfirmProfessions";
```

Add step to the `steps` array, between `confirm-locations` and `confirm-procedures`:

```typescript
{
  id: "confirm-professions",
  labelKey: "confirm.professions_title",
  icon: Users,
  component: ConfirmProfessions,
},
```

Add brand panel message in `brandPanel.messages`:

```typescript
"confirm-professions": {
  heading: "brandPanel.confirmProfessions_heading",
  sub: "brandPanel.confirmProfessions_sub",
},
```

- [ ] **Step 4: Add professions to onComplete()**

In `onComplete()`, build the professions payload and add to `workspacePayload`:

```typescript
const professionPayload = state.professions
  .filter((p) => p.positions.some((pos) => pos.selected))
  .map((p) => ({
    professionId: p.id,
    professionSlug: p.slug,
    professionName: p.name,
    positions: p.positions
      .filter((pos) => pos.selected)
      .map((pos) => ({
        name: pos.name,
        slug: pos.slug,
        authorityLevel: pos.authorityLevel,
      })),
  }));
```

Add `professions: professionPayload` to the `workspacePayload` object.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/wizard-definition.ts
git commit -m "feat(onboarding): integrate professions into wizard loadState and onComplete

Loads professions from DB in loadState, adds step #3, sends profession payload
on finalization. Fixes location bug: auto-generates default location from
business name when scraping returns none.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ConfirmProfessions UI Component

**Files:**

- Create: `apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

/**
 * ConfirmProfessions — Step 3 of onboarding confirmation wizard.
 *
 * Shows professions (Fag) as compact group headings with positions as
 * selectable ghost cards underneath. Pre-selected positions are on by default.
 * Users confirm and adjust before finalizing.
 *
 * Design: Compact grouped layout per council recommendation. One "add" button
 * at the bottom. Pre-selected common positions. ARIA groups per profession.
 */

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";

export function ConfirmProfessions({
  state,
  updateState,
  t,
}: WizardStepProps<OnboardingConfirmState>) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [newPositionProfession, setNewPositionProfession] = useState("");

  const professions = state.professions;
  const totalPositions = professions.reduce((sum, p) => sum + p.positions.length, 0);
  const selectedCount = professions.reduce(
    (sum, p) => sum + p.positions.filter((pos) => pos.selected).length,
    0,
  );

  function togglePosition(professionId: string, positionId: string) {
    updateState({
      professions: professions.map((p) =>
        p.id === professionId
          ? {
              ...p,
              positions: p.positions.map((pos) =>
                pos.id === positionId ? { ...pos, selected: !pos.selected } : pos,
              ),
            }
          : p,
      ),
    });
  }

  function addPosition() {
    const trimmed = newPositionName.trim();
    if (!trimmed || !newPositionProfession) return;

    updateState({
      professions: professions.map((p) =>
        p.id === newPositionProfession
          ? {
              ...p,
              positions: [
                ...p.positions,
                {
                  id: `pos-custom-${Date.now()}`,
                  name: trimmed,
                  slug: trimmed.toLowerCase().replace(/\s+/g, "-"),
                  selected: true,
                  authorityLevel: null,
                },
              ],
            }
          : p,
      ),
    });
    setNewPositionName("");
    setNewPositionProfession("");
    setShowAddInput(false);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="text-foreground text-2xl font-bold">
          {t("confirm.professions_title", { defaultValue: "Fag og posisjoner" })}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("confirm.professions_description", {
            defaultValue: "Bekreft hvilke posisjoner dere trenger, gruppert etter fagomrade.",
          })}
        </p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {selectedCount} valgt av {totalPositions} forslag
        </p>
      </div>

      {/* Profession groups */}
      <div className="space-y-6">
        {professions.map((profession, groupIndex) => (
          <div key={profession.id} role="group" aria-label={profession.name}>
            {/* Fag heading — compact label */}
            <span className="text-muted-foreground mb-2 block text-xs font-medium tracking-wider uppercase">
              {profession.name}
            </span>

            {/* Position ghost cards */}
            <div className="space-y-2">
              {profession.positions.map((position) => (
                <button
                  key={position.id}
                  type="button"
                  aria-pressed={position.selected}
                  onClick={() => togglePosition(profession.id, position.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all duration-200",
                    position.selected
                      ? "text-foreground border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5"
                      : "border-border text-muted-foreground hover:text-foreground border-dashed bg-white/50 hover:border-[var(--brand-orange)]/30 hover:bg-[var(--brand-orange)]/5",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={[
                        "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-all duration-200",
                        position.selected
                          ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                          : "border-border bg-card text-transparent",
                      ].join(" ")}
                    >
                      &#10003;
                    </span>
                    <span className="text-sm font-medium">{position.name}</span>
                  </span>

                  {!position.selected && (
                    <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
                      Forslag
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add custom position */}
      {showAddInput ? (
        <div className="border-border bg-card space-y-3 rounded-lg border p-4">
          <select
            value={newPositionProfession}
            onChange={(e) => setNewPositionProfession(e.target.value)}
            className="border-border bg-background text-foreground focus-visible:ring-brand-orange/40 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">Velg fagomrade</option>
            {professions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newPositionName}
            onChange={(e) => setNewPositionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPosition()}
            placeholder="Posisjonsnavn"
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-brand-orange/40 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPosition}
              className="bg-brand-orange/10 text-foreground hover:bg-brand-orange/20 flex-1 rounded-md py-2 text-sm transition-colors"
            >
              Legg til
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddInput(false);
                setNewPositionName("");
                setNewPositionProfession("");
              }}
              className="text-muted-foreground hover:text-foreground px-3 py-2 text-sm transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddInput(true)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors"
        >
          <Plus className="size-3.5" />
          Legg til egen posisjon
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter web typecheck 2>&1 | tail -5`

Expected: No errors related to ConfirmProfessions.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/steps/ConfirmProfessions.tsx
git commit -m "feat(onboarding): add ConfirmProfessions wizard step component

Grouped layout per profession with ghost cards for positions. Pre-selected
common positions. Single 'add position' drawer at bottom. ARIA groups per
profession with aria-pressed toggles.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Update ConfirmSummary + Finalize RPC

**Files:**

- Modify: `apps/web/src/app/onboarding/steps/ConfirmSummary.tsx`
- Create: `supabase/migrations/20260328200100_update_finalize_rpc_professions.sql`

- [ ] **Step 1: Add professions to ConfirmSummary**

In `apps/web/src/app/onboarding/steps/ConfirmSummary.tsx`, add a summary section for professions. Find where departments/locations/procedures are displayed and add after them:

```tsx
{
  /* Professions & Positions */
}
<div>
  <dt className="text-muted-foreground text-xs font-medium">Fag & posisjoner</dt>
  <dd className="text-foreground mt-1 text-sm">
    {state.professions
      .filter((p) => p.positions.some((pos) => pos.selected))
      .map((p) => {
        const selected = p.positions.filter((pos) => pos.selected);
        return `${p.name}: ${selected.map((pos) => pos.name).join(", ")}`;
      })
      .join(" | ")}
  </dd>
</div>;
```

- [ ] **Step 2: Write finalize RPC migration**

Create `supabase/migrations/20260328200100_update_finalize_rpc_professions.sql`.

**CRITICAL: Do NOT use the skeleton SQL below as-is. Follow this procedure exactly:**

1. Read the FULL body of `finalize_onboarding_workspace` from the latest migration: `supabase/migrations/20260406100000_harden_industry_enum_in_rpcs.sql`
2. Copy the ENTIRE function (all existing department/location/procedure logic)
3. Add the following DECLARE variables at the top of the DECLARE block:
   ```sql
   v_prof RECORD;
   v_pos RECORD;
   v_profession_id UUID;
   v_authority authority_level;
   v_dept_id UUID;
   ```
4. APPEND the following block AFTER the locations section (before the END of the function):

   ```sql
   -- 8. Create positions linked to professions
   IF p_data->'professions' IS NOT NULL THEN
     FOR v_prof IN SELECT * FROM jsonb_array_elements(p_data->'professions')
     LOOP
       v_profession_id := (v_prof.value->>'professionId')::UUID;

       IF v_prof.value->'positions' IS NOT NULL THEN
         FOR v_pos IN SELECT * FROM jsonb_array_elements(v_prof.value->'positions')
         LOOP
           -- Map authority level (nullable)
           v_authority := NULL;
           IF v_pos.value->>'authorityLevel' IS NOT NULL
              AND v_pos.value->>'authorityLevel' != '' THEN
             v_authority := (v_pos.value->>'authorityLevel')::authority_level;
           END IF;

           -- Find matching department by profession slug, fall back to first department
           SELECT d.department_id INTO v_dept_id
           FROM public.department d
           JOIN public.profession p ON p.profession_id = v_profession_id
           WHERE d.workspace_id = p_workspace_id
             AND lower(d.name) = lower(p.name)
           LIMIT 1;

           IF v_dept_id IS NULL THEN
             SELECT department_id INTO v_dept_id
             FROM public.department
             WHERE workspace_id = p_workspace_id
             ORDER BY created_at LIMIT 1;
           END IF;

           INSERT INTO public.position (
             workspace_id, department_id, name, slug, profession_id, authority_level
           ) VALUES (
             p_workspace_id,
             v_dept_id,
             v_pos.value->>'name',
             COALESCE(
               v_pos.value->>'slug',
               lower(regexp_replace(v_pos.value->>'name', '[^a-zA-Z0-9]+', '-', 'g'))
             ),
             v_profession_id,
             v_authority
           );
         END LOOP;
       END IF;
     END LOOP;
   END IF;
   ```

5. Keep the SAME return type as the existing function (RETURNS UUID, NOT VOID)
6. Also apply the same professions block to `activate_workspace_v3` in the same migration file

**The department mapping logic:** First tries to match profession name to department name (e.g., profession "Kjøkken" → department "Kjøkken"). Falls back to first department only if no match found. This avoids the "all positions in wrong department" problem.

- [ ] **Step 3: Run migration**

Run: `docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260328200100_update_finalize_rpc_professions.sql`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/steps/ConfirmSummary.tsx supabase/migrations/20260328200100_update_finalize_rpc_professions.sql
git commit -m "feat(onboarding): add professions to summary step and finalize RPC

Shows selected professions/positions in the summary step. Updates
finalize_onboarding_workspace RPC to create positions linked to professions
during workspace finalization.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Telemetry Events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add profession events to registry**

In `packages/telemetry/src/registry.ts`, make these changes:

**A) Add to `EntityType` union** (around line 44):

```typescript
| "profession"
| "legal_function"
```

**B) Add to `ActionVerb` union** (around line 106) if not present:

```typescript
| "confirmed"
| "granted"
| "revoked"
```

**C) Add 7 event interfaces** (after the Org Structure Events section, around line 250):

```typescript
// ─── Profession System Events ──────────────────
export interface ProfessionWorkspaceCopied extends BaseEvent {
  event: "profession created";
  properties: {
    entity: EntityRef;
    data: { name: string; slug: string; source: "onboarding" | "admin" };
  };
}

export interface PositionCreated extends BaseEvent {
  event: "position created";
  properties: {
    entity: EntityRef;
    data: { name: string; profession_id?: string; authority_level?: string };
  };
}

export interface PositionAuthorityChanged extends BaseEvent {
  event: "position updated";
  properties: {
    entity: EntityRef;
    changes: { authority_level: { before: string | null; after: string } };
  };
}

export interface LegalFunctionAssigned extends BaseEvent {
  event: "legal_function assigned";
  properties: {
    entity: EntityRef;
    data: { profile_id: string; slug: string };
  };
}

export interface ProfileAccessGranted extends BaseEvent {
  event: "profile granted";
  properties: {
    entity: EntityRef;
    data: { scope: string; granted_by: "position" | "legal_function" | "manual" };
  };
}

export interface ProfileAccessRevoked extends BaseEvent {
  event: "profile revoked";
  properties: {
    entity: EntityRef;
    data: { scope: string };
  };
}

export interface OnboardingProfessionsConfirmed extends BaseEvent {
  event: "profession confirmed";
  properties: {
    entity: EntityRef;
    data: { profession_count: number; position_count: number };
  };
}
```

**D) Add to `SmartoutEvent` union** (around line 2015):

```typescript
| ProfessionWorkspaceCopied
| PositionCreated
| PositionAuthorityChanged
| LegalFunctionAssigned
| ProfileAccessGranted
| ProfileAccessRevoked
| OnboardingProfessionsConfirmed
```

**E) Add to `EVENT_ROUTING` map** (around line 2236):

```typescript
"profession created": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "org_structure",
},
"position created": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "org_structure",
},
"position updated": {
  destinations: ["logger", "activity_trail"],
  category: "org_structure",
},
"legal_function assigned": {
  destinations: ["logger", "activity_trail", "engine_event"],
  category: "org_structure",
},
"profile granted": {
  destinations: ["logger", "activity_trail"],
  category: "org_structure",
},
"profile revoked": {
  destinations: ["logger", "activity_trail"],
  category: "org_structure",
},
"profession confirmed": {
  destinations: ["posthog", "logger", "activity_trail"],
  category: "onboarding",
},
```

Note: `emit()` calls for these events will be added in a follow-up PR when the admin CRUD UI and access seeding logic are built. The `onboarding.professions_confirmed` emit should be added to `onComplete()` in `wizard-definition.ts` — this is deferred since telemetry wiring in onComplete requires the emit helper to be available in the wizard context.

- [ ] **Step 2: Verify types compile**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm --filter telemetry typecheck 2>&1 | tail -5`

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add profession system events to registry

Adds 7 events: profession.workspace_copied, position.created,
position.authority_changed, profile.legal_function_assigned,
profile.access_granted, profile.access_revoked,
onboarding.professions_confirmed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Mark POSITION_MAP @deprecated + Update DATABASE.md

**Files:**

- Modify: `docs/reference/DATABASE.md`

- [ ] **Step 1: Document new tables in DATABASE.md**

Add a section for the new tables. Follow existing patterns in the file. Include:

- `profession` — K1a competence domain table
- `profession_industry` — NACE code mapping
- `legal_function` — Legally mandated functions
- `profile_legal_function` — Person to legal function assignment
- `profession_training` — Weighted training requirements per profession
- `profile_access` — Fine-grained system access per profile
- `authority_level` enum
- FK additions to `position` and `tariff_rate_table`

- [ ] **Step 2: Commit**

```bash
git add docs/reference/DATABASE.md
git commit -m "docs(db): document profession system tables and relationships

Adds profession, legal_function, profession_training, profile_access,
profile_legal_function, authority_level to DATABASE.md reference.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Typecheck Full Project

- [ ] **Step 1: Run full typecheck**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck 2>&1 | tail -20`

Expected: 0 errors. If errors appear, fix them in the relevant files.

- [ ] **Step 2: Run lint**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm lint 2>&1 | tail -20`

Expected: No new lint errors from changed files.

- [ ] **Step 3: Fix any issues and commit**

If fixes needed:

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues from profession system

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
