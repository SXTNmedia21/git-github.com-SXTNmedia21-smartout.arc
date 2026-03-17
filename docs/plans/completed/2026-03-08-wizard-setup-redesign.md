---
title: "Workspace Setup Wizard — Full Implementation Plan"
status: in_progress
updated: 2026-03-08
created: 2026-03-08
module: cross-cutting
tags: [wizard, setup, industry-package, document-drop, botsson]
---

# Workspace Setup Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the 7-step workspace setup wizard into a 9-step "confirm, don't create" experience driven by industry packages, scraped data, and optional document analysis.

**Architecture:** Industry package JSON files define all templates, defaults, and filter logic. A shared `SetupWizardState` in `WorkspaceSetupWizard.tsx` flows data between steps. Step 0 shows scraped intelligence. Step 1 uploads documents for AI extraction. Steps 2-7 consume pre-filled data. Step 8 auto-generates handbook chapters from all prior steps. Botsson tip box appears on every step.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, TanStack Query v5, Supabase (Storage + Edge Functions + RLS), Tiptap, shadcn/ui, Tailwind v4, react-dropzone, Papaparse (already used)

---

## Task 1: Industry Package Data Layer

**Goal:** Create the `useIndustryPackage()` hook and data files that drive ALL wizard defaults.

**Files:**

- Create: `apps/web/src/lib/industry/types.ts`
- Create: `apps/web/src/lib/industry/packages/hospitality.ts`
- Create: `apps/web/src/lib/industry/packages/default.ts`
- Create: `apps/web/src/lib/industry/use-industry-package.ts`

**Context:**

- Industry type is stored in `workspace.intelligence_data` (from `gather-workspace-intelligence` Edge Function). The NACE code and business classification are in `onboarding_session.brreg_data`.
- The `use-governance-templates.ts` hook already has `FILTER_QUESTIONS`, `useIndustryFilters()`, and `getVisibleTemplates()` — these currently hardcode restaurant data. The new package system should feed into these.
- Read `docs/engines/industri-inteligence/hospitalety/` for canonical templates.

**Step 1: Create industry package types**

Create `apps/web/src/lib/industry/types.ts`:

```typescript
export type IndustryType = "hospitality" | "retail" | "default";

export type IndustryFilterKey = "food" | "alcohol" | "overnight" | "delivery";

export type IndustryTariff = {
  key: string;
  label: string;
  supplements: {
    kveldstillegg: { rate: number; unit: string; from_hour: string; to_hour: string };
    helgetillegg: { rate: number; unit: string; days: string[] };
    helligdagstillegg: { rate: number; unit: string };
    overtid_50: { threshold_hours: number; unit: string };
    overtid_100: { threshold_hours: number; unit: string };
  };
  minWagePerHour: number;
};

export type IndustryShiftTemplate = {
  name: string;
  department: string;
  startTime: string;
  endTime: string;
  subcategory?: string[];
};

export type IndustrySeasonTemplate = {
  name: string;
  startMonth: number;
  endMonth: number;
  description: string;
};

export type IndustryEmploymentDefaults = {
  probationMonths: number;
  vacationDays: number;
  extraVacationDays: boolean;
  otpPct: number;
  employerTaxPct: number;
};

export type IndustryPackage = {
  id: IndustryType;
  label: string;
  filterDefaults: Record<IndustryFilterKey, boolean>;
  tariffs: IndustryTariff[];
  defaultTariffKey: string;
  shiftTemplates: IndustryShiftTemplate[];
  seasonTemplates: IndustrySeasonTemplate[];
  employmentDefaults: IndustryEmploymentDefaults;
  botsson: Record<string, string>; // step id -> tip text
};
```

**Step 2: Create hospitality package**

Create `apps/web/src/lib/industry/packages/hospitality.ts` — the full data file with:

- `filterDefaults`: `{ food: true, alcohol: true, overnight: false, delivery: true }`
- `tariffs`: Riksavtalen + Hotelloverenskomsten with rates from `PayrollSetupStep.tsx` lines 44-73
- `shiftTemplates`: Morning (09:00-15:00), Evening (15:00-23:00), Split (10:00-14:00 + 17:00-23:00) per department (Kjøkken, Service, Bar) — sourced from `docs/engines/industri-inteligence/hospitalety/03-templates/restaurant-business-structure-template.md`
- `seasonTemplates`: Sommer (May-Sep), Vinter (Oct-Apr), Jul (Nov-Dec)
- `employmentDefaults`: probation 6, vacation 25, OTP 2%, AGA 14.1%
- `botsson`: one tip per wizard step ID (9 entries)

**Step 3: Create default package**

Create `apps/web/src/lib/industry/packages/default.ts` — same shape, neutral defaults (no tariff preset, generic shifts, empty botsson tips).

**Step 4: Create useIndustryPackage hook**

Create `apps/web/src/lib/industry/use-industry-package.ts`:

```typescript
import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { hospitalityPackage } from "./packages/hospitality";
import { defaultPackage } from "./packages/default";
import type { IndustryPackage, IndustryType } from "./types";

const PACKAGES: Record<IndustryType, IndustryPackage> = {
  hospitality: hospitalityPackage,
  retail: defaultPackage, // future
  default: defaultPackage,
};

function detectIndustryType(intelligenceData: unknown): IndustryType {
  if (!intelligenceData || typeof intelligenceData !== "object") return "default";
  const data = intelligenceData as Record<string, unknown>;
  const naceCode = (data.brregData as Record<string, unknown>)?.naceCode;
  // NACE 56.x = restaurants/catering, 55.x = hotels
  if (typeof naceCode === "string" && (naceCode.startsWith("56") || naceCode.startsWith("55"))) {
    return "hospitality";
  }
  return "default";
}

export function useIndustryPackage(): IndustryPackage {
  const { workspace } = useWorkspace();
  return useMemo(() => {
    const type = detectIndustryType(workspace.intelligence_data);
    return PACKAGES[type];
  }, [workspace.intelligence_data]);
}
```

**Step 5: Typecheck**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm turbo typecheck --filter=web
```

**Step 6: Commit**

```bash
git add apps/web/src/lib/industry/
git commit -m "feat(wizard): add industry package data layer with hospitality defaults"
```

---

## Task 2: SetupWizardState + Shared Context

**Goal:** Add shared state to `WorkspaceSetupWizard.tsx` that flows data between steps. Each step reads and writes to this state.

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/wizard-state.ts`
- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`

**Context:**

- Current wizard has no shared state — each step is self-contained.
- Scraped data comes from `workspace.intelligence_data` (jsonb on workspace table).
- Document extraction results will be stored in wizard state (client-side).
- The wizard must still work if Steps 0 and 1 are skipped.

**Step 1: Create wizard state types**

Create `apps/web/src/components/dashboard/wizard-steps/wizard-state.ts`:

```typescript
import type { IndustryPackage } from "@/lib/industry/types";

// ─── Scraped Data (from onboarding intelligence) ───

export type ScrapedIntelligence = {
  companyName?: string;
  orgNumber?: string;
  industryType?: string;
  openingHours?: string;
  departments?: string[];
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
  googleRating?: number;
  menuItemCount?: number;
  [key: string]: unknown;
};

// ─── Document Extraction (from Step 1) ───

export type DocumentExtractionResult = {
  policies?: Array<{ name: string; content: string; source: string }>;
  payroll?: { tariff?: string; supplements?: Record<string, unknown>; source: string };
  employees?: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    department?: string;
    position?: string;
    source: string;
  }>;
  shiftPatterns?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    department?: string;
    source: string;
  }>;
  employmentTerms?: { noticePeriod?: string; probation?: string; source: string };
  handbookSections?: Array<{ chapterKey: string; content: string; source: string }>;
};

// ─── Wizard-Level State ───

export type SetupWizardState = {
  scrapedData: ScrapedIntelligence;
  extractedData: DocumentExtractionResult;
  industryPackage: IndustryPackage;
  // Downstream step summaries (set by each step on save)
  createdPolicyIds: string[];
  payrollSaved: boolean;
  employmentSaved: boolean;
  invitedCount: number;
  shiftTemplateCount: number;
  seasonCreated: boolean;
};

export const EMPTY_EXTRACTION: DocumentExtractionResult = {};
```

**Step 2: Update WorkspaceSetupWizard — STEPS array**

Replace the existing `STEPS` constant (lines 28-92) with 9 steps:

```typescript
const STEPS: SetupStep[] = [
  {
    id: "welcome",
    title: "Velkommen til Smartout",
    subtitle: "Det vi vet om deg",
    explanation:
      "Vi har hentet informasjon om bedriften din fra Brønnøysund, Google og nettsiden din. Se over at det stemmer, og juster det som trengs.",
    helpTip: "Dataene er hentet automatisk. Alt kan endres.",
  },
  {
    id: "document-drop",
    title: "Last opp dokumenter",
    subtitle: "Valgfritt — vi analyserer",
    explanation:
      "Last opp det dere har — rutineperm, vaktlister, kontrakter, HMS-plan, personalhandbok, meny, tariffavtale. Vi analyserer og fyller ut resten for dere.",
    helpTip: "Dokumentene analyseres med AI. Du kan hoppe over dette steget.",
  },
  {
    id: "governance",
    title: "Dine retningslinjer",
    subtitle: "Regler og prosedyrer",
    explanation:
      "Retningslinjer er reglene som styrer restauranten din. Mattrygghet, hygiene, brannsikkerhet — alt som ansatte må kunne. Når du legger inn reglene her, vil systemet automatisk sørge for at alle ansatte lærer dem og blir testet på at de kan dem.",
    helpTip:
      "Retningslinjer er reglene som styrer virksomheten. De blir automatisk til opplæring for ansatte.",
  },
  {
    id: "payroll",
    title: "Lønn og tillegg",
    subtitle: "Tariff og satser",
    explanation:
      "Sett opp lønnssatser og tillegg for virksomheten din. Velg tariffavtale, juster kvelds-, helge- og overtidstillegg, og sett timelønn per stilling.",
    helpTip:
      "Lønnsoppsettet bestemmer satser og tillegg. Det brukes automatisk når du inviterer ansatte og lager vaktplaner.",
  },
  {
    id: "employment",
    title: "Ansettelsesvilkår",
    subtitle: "Avtaleformer og betingelser",
    explanation:
      "Definer hvilke ansettelsesformer dere bruker og standardvilkårene for hver. Prøvetid, ferie, pensjon og arbeidsgiveravgift — alt samles her.",
    helpTip:
      "Ansettelsesvilkår definerer kontraktsmalene. Valget her bestemmer hva som står i arbeidsavtalene.",
  },
  {
    id: "team",
    title: "Ditt team",
    subtitle: "De første ansatte",
    explanation:
      "Legg til de første i teamet ditt. De får en invitasjon og starter med å lese håndboken og retningslinjene du nettopp la inn.",
    helpTip:
      "Inviter ansatte manuelt eller last opp en CSV-fil. De får tilgang til opplæring og håndbok automatisk.",
  },
  {
    id: "shift-template",
    title: "Dine vaktmaler",
    subtitle: "Grunnlaget for vaktplanen",
    explanation:
      "En vaktmal er en oppskrift for en vakt — navn, start- og sluttid, og hvilken avdeling den tilhører. Du bygger den ekte vaktplanen etterpå.",
    helpTip:
      "Vaktmaler er gjenbrukbare oppskrifter for vakter. De gjør det raskt å bygge ukeplaner.",
  },
  {
    id: "season",
    title: "Din sesong",
    subtitle: "Budsjett og mål",
    explanation:
      "Sesongen setter rammene for alt: budsjett, bemanningsmål, og KPI-er. Når sesongen er aktiv, begynner dashboardet å vise ekte tall.",
    helpTip:
      "Sesongen er tidsrammen for budsjett og mål. Dashboard viser først ekte data når en sesong er aktiv.",
  },
  {
    id: "handbook",
    title: "Din personalhåndbok",
    subtitle: "Generert fra oppsettet ditt",
    explanation:
      "Personalhåndboken er auto-generert fra det du har lagt inn i steg 1–7. Gå gjennom kapitlene, juster teksten der det trengs, og publiser.",
    helpTip:
      "Håndboken genereres automatisk fra data du allerede har lagt inn. Du reviewer og redigerer — ikke skriver.",
  },
];
```

**Step 3: Add shared state and wire industry package**

In the `WorkspaceSetupWizard` component body, add:

```typescript
import { useIndustryPackage } from "@/lib/industry/use-industry-package";
import type {
  SetupWizardState,
  DocumentExtractionResult,
  ScrapedIntelligence,
} from "./wizard-steps/wizard-state";
import { EMPTY_EXTRACTION } from "./wizard-steps/wizard-state";

// Inside component:
const industryPackage = useIndustryPackage();

// Parse scraped data from workspace intelligence
const scrapedData = useMemo<ScrapedIntelligence>(() => {
  const intel = ctx?.workspace.intelligence_data;
  if (!intel || typeof intel !== "object") return {};
  const data = intel as Record<string, unknown>;
  return {
    companyName: ctx?.workspace.name,
    orgNumber: (data.brregData as Record<string, unknown>)?.orgNumber as string | undefined,
    departments: data.departments as string[] | undefined,
    address: (data.brregData as Record<string, unknown>)?.address as string | undefined,
    website: data.website as string | undefined,
    email: data.email as string | undefined,
    phone: data.phone as string | undefined,
    googleRating: ctx?.workspace.google_rating ?? undefined,
    openingHours: (data.placesData as Record<string, unknown>)?.openingHours as string | undefined,
  };
}, [ctx]);

const [wizardState, setWizardState] = useState<SetupWizardState>(() => ({
  scrapedData,
  extractedData: EMPTY_EXTRACTION,
  industryPackage,
  createdPolicyIds: [],
  payrollSaved: false,
  employmentSaved: false,
  invitedCount: 0,
  shiftTemplateCount: 0,
  seasonCreated: false,
}));

const handleExtractionComplete = useCallback((result: DocumentExtractionResult) => {
  setWizardState((prev) => ({ ...prev, extractedData: result }));
}, []);
```

**Step 4: Update step rendering to pass props**

Replace the step rendering block (lines 296-302) with:

```tsx
{
  step.id === "welcome" && <WelcomeStep scrapedData={wizardState.scrapedData} isDark={isDark} />;
}
{
  step.id === "document-drop" && (
    <DocumentDropStep isDark={isDark} onExtractionComplete={handleExtractionComplete} />
  );
}
{
  step.id === "governance" && (
    <GovernanceSetupStep
      isDark={isDark}
      industryPackage={wizardState.industryPackage}
      extractedPolicies={wizardState.extractedData.policies}
    />
  );
}
{
  step.id === "payroll" && (
    <PayrollSetupStep
      isDark={isDark}
      industryTariffs={wizardState.industryPackage.tariffs}
      defaultTariffKey={wizardState.industryPackage.defaultTariffKey}
      extractedPayroll={wizardState.extractedData.payroll}
    />
  );
}
{
  step.id === "employment" && (
    <EmploymentSetupStep
      isDark={isDark}
      industryDefaults={wizardState.industryPackage.employmentDefaults}
      extractedTerms={wizardState.extractedData.employmentTerms}
    />
  );
}
{
  step.id === "team" && (
    <TeamSetupStep isDark={isDark} extractedEmployees={wizardState.extractedData.employees} />
  );
}
{
  step.id === "shift-template" && (
    <ShiftTemplateSetupStep
      isDark={isDark}
      suggestedTemplates={wizardState.industryPackage.shiftTemplates}
      extractedShiftPatterns={wizardState.extractedData.shiftPatterns}
      openingHours={wizardState.scrapedData.openingHours}
    />
  );
}
{
  step.id === "season" && (
    <SeasonSetupStep
      isDark={isDark}
      suggestedSeasons={wizardState.industryPackage.seasonTemplates}
    />
  );
}
{
  step.id === "handbook" && <HandbookSetupStep isDark={isDark} wizardState={wizardState} />;
}
```

**Step 5: Update STEP_TO_MODULE**

```typescript
const STEP_TO_MODULE: Record<string, string> = {
  welcome: "governance", // welcome doesn't have its own module
  "document-drop": "governance",
  governance: "governance",
  payroll: "governance",
  employment: "governance",
  team: "people",
  "shift-template": "schedule",
  season: "season",
  handbook: "governance",
};
```

**Step 6: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/wizard-state.ts apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx
git commit -m "feat(wizard): add SetupWizardState shared context and 9-step layout"
```

---

## Task 3: WelcomeStep (Step 0)

**Goal:** Show what we already know about the business from scraped data. Admin confirms.

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/WelcomeStep.tsx`
- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx` (add import)

**Context:**

- Scraped data lives in `workspace.intelligence_data`.
- Available fields: companyName, orgNumber, address, departments, openingHours, website, email, phone, googleRating.
- Pattern: Show each known fact with ✅ and "Endre" button. Unknown facts hidden.

**Step 1: Create WelcomeStep**

```typescript
"use client";

import { useMemo } from "react";
import { CheckCircle2, Pencil, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import type { ScrapedIntelligence } from "./wizard-state";

type KnownFact = {
  label: string;
  value: string;
  editable?: boolean;
};

export function WelcomeStep({
  scrapedData,
  isDark,
}: {
  scrapedData: ScrapedIntelligence;
  isDark: boolean;
}) {
  const { workspace } = useWorkspace();

  // Also query departments from DB (may have been created in onboarding)
  const { data: departments } = useQuery({
    queryKey: ["departments", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      return data ?? [];
    },
  });

  const facts = useMemo<KnownFact[]>(() => {
    const items: KnownFact[] = [];

    if (scrapedData.companyName) {
      const orgPart = scrapedData.orgNumber ? ` (org.nr ${scrapedData.orgNumber})` : "";
      items.push({ label: "Bedrift", value: `${scrapedData.companyName}${orgPart}` });
    }

    if (scrapedData.industryType) {
      items.push({ label: "Bransje", value: scrapedData.industryType });
    }

    if (scrapedData.openingHours) {
      items.push({ label: "Åpningstider", value: scrapedData.openingHours });
    }

    if (departments && departments.length > 0) {
      items.push({
        label: "Avdelinger",
        value: `${departments.length} avdelinger: ${departments.map((d) => d.name).join(", ")}`,
      });
    }

    if (scrapedData.address) {
      items.push({ label: "Adresse", value: scrapedData.address });
    }

    if (scrapedData.googleRating) {
      items.push({ label: "Google-vurdering", value: `${scrapedData.googleRating} / 5` });
    }

    if (scrapedData.website) {
      items.push({ label: "Nettside", value: scrapedData.website });
    }

    return items;
  }, [scrapedData, departments]);

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="space-y-4">
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${
          isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
        }`}>
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <div className="space-y-2">
            <p className={`text-sm leading-relaxed ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
              Smartout er din digitale kollega. Vi sørger for at alle ansatte er klare — trent, compliant, og informert.
            </p>
            <div className="space-y-1.5">
              {[
                { icon: "📋", text: "Retningslinjer — reglene dine, automatisk til opplæring" },
                { icon: "📅", text: "Vaktplan — riktig person, riktig tid, riktig rolle" },
                { icon: "🔄", text: "Drift — dagen styrer seg selv, fra åpning til stenging" },
              ].map((item) => (
                <p key={item.text} className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                  {item.icon} {item.text}
                </p>
              ))}
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              La oss sette opp arbeidsplassen din. Det tar ca. 10 minutter.
            </p>
          </div>
        </div>
      </div>

      {/* Known facts */}
      {facts.length > 0 && (
        <div className="space-y-3">
          <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            Det vi allerede vet
          </h3>
          <div className="space-y-2">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {fact.label}
                    </p>
                    <p className={`truncate text-sm font-medium ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      {fact.value}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  }`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {facts.length === 0 && (
        <div className={`rounded-xl border border-dashed p-6 text-center ${
          isDark ? "border-zinc-700" : "border-zinc-300"
        }`}>
          <p className={`text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Vi har ikke hentet noe data enda. Gå videre for å fylle ut manuelt.
          </p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Wire into WorkspaceSetupWizard**

Add `import { WelcomeStep } from "@/components/dashboard/wizard-steps/WelcomeStep";`

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/WelcomeStep.tsx apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx
git commit -m "feat(wizard): add WelcomeStep showing scraped intelligence"
```

---

## Task 4: DocumentDropStep (Step 1)

**Goal:** Drag-and-drop document upload with AI analysis that pre-fills subsequent steps.

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/DocumentDropStep.tsx`
- Create: `supabase/functions/analyze-setup-documents/index.ts`
- Modify: `supabase/config.toml` (add storage bucket)
- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx` (add import)

**Context:**

- Existing upload pattern: `apps/web/src/app/platform-admin/contracts/templates/[id]/edit/upload-action.ts`
- Existing OCR pattern: `supabase/functions/process-settlement-image/index.ts` — uses Google Vision API
- Storage config: `supabase/config.toml` lines 110-154

**Step 1: Install react-dropzone**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm --filter web add react-dropzone
```

**Step 2: Add storage bucket to config.toml**

Add after existing buckets:

```toml
[storage.buckets.setup-documents]
public = false
file_size_limit = "10MB"
allowed_mime_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "image/jpeg", "image/png", "text/plain"]
```

**Step 3: Create DocumentDropStep component**

UI structure:

1. Large drop-zone with `react-dropzone`. Accept: PDF, DOCX, XLSX, CSV, JPG/PNG, TXT. Max 20 files, 10MB each.
2. After drop: show file list with upload progress.
3. After upload: call `analyze-setup-documents` Edge Function.
4. Show animated checklist of extraction results.
5. "Hopp over" is handled by wizard's Next button — no upload means empty extraction.

Props: `isDark: boolean`, `onExtractionComplete: (result: DocumentExtractionResult) => void`

Upload flow:

```typescript
// 1. Upload each file to Supabase Storage
const path = `${workspaceId}/setup-documents/${crypto.randomUUID()}_${file.name}`;
await supabase.storage.from("setup-documents").upload(path, file);

// 2. After all uploads, call Edge Function
const { data } = await supabase.functions.invoke("analyze-setup-documents", {
  body: { workspace_id: workspaceId, file_paths: uploadedPaths },
});

// 3. Call onExtractionComplete
onExtractionComplete(data as DocumentExtractionResult);
```

State machine: `idle` → `uploading` (per-file progress) → `analyzing` (spinner) → `done` (checklist) | `error`

**Step 4: Create analyze-setup-documents Edge Function**

Create `supabase/functions/analyze-setup-documents/index.ts`:

Follow `process-settlement-image` pattern:

1. Receive `{ workspace_id, file_paths }`.
2. Download each file from Storage.
3. For images: Google Vision OCR.
4. For text-based files: extract text directly (PDF text extraction via Deno).
5. For CSV/XLSX: parse rows, identify column structure.
6. Combine all extracted text.
7. Call Anthropic Claude API for structured extraction (use `ANTHROPIC_API_KEY` env var).
8. Return `DocumentExtractionResult` JSON.

Claude extraction prompt:

```
Du er en AI-assistent for Smartout, et system for arbeidsplassadministrasjon.
Analyser disse dokumentene og trekk ut strukturert data.
Returner JSON med disse feltene (inkluder bare det du finner):

- policies: array av {name, content, source}
- payroll: {tariff, supplements, source}
- employees: array av {firstName, lastName, email, phone, department, position, source}
- shiftPatterns: array av {name, startTime, endTime, department, source}
- employmentTerms: {noticePeriod, probation, source}
- handbookSections: array av {chapterKey, content, source}

Kapittelnøkler for håndbok: identity-mission, organization-model, daily-operations, safety-compliance, communication, onboarding-training, scheduling, quality-service, incident-response, kpi-review

Dokumenter:
[extracted text per file]
```

**Step 5: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/DocumentDropStep.tsx supabase/functions/analyze-setup-documents/ supabase/config.toml apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx
git commit -m "feat(wizard): add DocumentDropStep with AI document analysis"
```

---

## Task 5: Modify GovernanceSetupStep (Step 2)

**Goal:** Wire industry package filter defaults and extraction data into governance step.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/GovernanceSetupStep.tsx`
- Modify: `apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts`

**Step 1: Update useIndustryFilters to accept IndustryPackage**

In `use-governance-templates.ts`, modify `useIndustryFilters()`:

```typescript
export function useIndustryFilters(pkg?: IndustryPackage): Record<FilterKey, boolean> {
  if (pkg) {
    return pkg.filterDefaults as Record<FilterKey, boolean>;
  }
  // ... existing fallback logic
}
```

**Step 2: Update GovernanceSetupStep props**

```typescript
export function GovernanceSetupStep({
  isDark,
  industryPackage,
  extractedPolicies,
}: {
  isDark: boolean;
  industryPackage?: IndustryPackage;
  extractedPolicies?: Array<{ name: string; content: string; source: string }>;
});
```

Pass `industryPackage` to `useIndustryFilters(industryPackage)`.

If `extractedPolicies` provided, fuzzy-match against template names and show a banner: "Fant N retningslinjer i dokumentene dine."

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/GovernanceSetupStep.tsx apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts
git commit -m "feat(wizard): wire industry package into GovernanceSetupStep"
```

---

## Task 6: Modify PayrollSetupStep (Step 3)

**Goal:** Pre-fill tariff selection from industry package and document extraction.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/PayrollSetupStep.tsx`

**Step 1: Add props**

```typescript
export function PayrollSetupStep({
  isDark,
  industryTariffs,
  defaultTariffKey,
  extractedPayroll,
}: {
  isDark: boolean;
  industryTariffs?: IndustryTariff[];
  defaultTariffKey?: string;
  extractedPayroll?: { tariff?: string; supplements?: Record<string, unknown> };
});
```

**Step 2: Use industry tariffs when available**

If `industryTariffs` provided, use them to build the tariff options and presets dynamically. Set initial `selectedTariff` from `defaultTariffKey`.

If `extractedPayroll?.tariff` provided, try to match against known tariffs and auto-select.

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/PayrollSetupStep.tsx
git commit -m "feat(wizard): wire industry tariffs into PayrollSetupStep"
```

---

## Task 7: Modify EmploymentSetupStep (Step 4)

**Goal:** Pre-fill employment defaults from industry package.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/EmploymentSetupStep.tsx`

**Step 1: Add props**

```typescript
export function EmploymentSetupStep({
  isDark,
  industryDefaults,
  extractedTerms,
}: {
  isDark: boolean;
  industryDefaults?: IndustryEmploymentDefaults;
  extractedTerms?: { noticePeriod?: string; probation?: string };
});
```

**Step 2: Use industry defaults for initial state**

If `industryDefaults` provided, use for `INITIAL_COMMON_TERMS` instead of hardcoded values. Apply `extractedTerms` on top if available.

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/EmploymentSetupStep.tsx
git commit -m "feat(wizard): wire industry defaults into EmploymentSetupStep"
```

---

## Task 8: Modify TeamSetupStep (Step 5)

**Goal:** Pre-fill invite table from document-extracted employee list.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx`

**Step 1: Add props**

```typescript
export function TeamSetupStep({
  isDark,
  extractedEmployees,
}: {
  isDark: boolean;
  extractedEmployees?: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    department?: string;
    position?: string;
  }>;
});
```

**Step 2: Pre-populate on mount**

If `extractedEmployees` is non-empty and the invite list is currently empty, convert to the component's internal invite row format and set as initial state.

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx
git commit -m "feat(wizard): pre-fill team from document extraction"
```

---

## Task 9: Modify ShiftTemplateSetupStep (Step 6)

**Goal:** Auto-suggest shift templates from industry package and scraped opening hours.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/ShiftTemplateSetupStep.tsx`

**Step 1: Add props**

```typescript
export function ShiftTemplateSetupStep({
  isDark,
  suggestedTemplates,
  extractedShiftPatterns,
  openingHours,
}: {
  isDark: boolean;
  suggestedTemplates?: IndustryShiftTemplate[];
  extractedShiftPatterns?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    department?: string;
  }>;
  openingHours?: string;
});
```

**Step 2: Auto-populate entries on mount**

Priority: extractedShiftPatterns > suggestedTemplates > computed from openingHours.

Pre-fill the `entries` state. User can edit/remove before saving.

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/ShiftTemplateSetupStep.tsx
git commit -m "feat(wizard): auto-suggest shift templates from industry package"
```

---

## Task 10: Modify SeasonSetupStep (Step 7)

**Goal:** Suggest seasons from industry package as clickable cards.

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx`

**Step 1: Add props**

```typescript
export function SeasonSetupStep({
  isDark,
  suggestedSeasons,
}: {
  isDark: boolean;
  suggestedSeasons?: IndustrySeasonTemplate[];
});
```

**Step 2: Show suggestion cards**

If `suggestedSeasons` provided and no existing season, show clickable season suggestion cards above the form. Clicking a card populates name, start date, and end date.

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/SeasonSetupStep.tsx
git commit -m "feat(wizard): suggest seasons from industry package"
```

---

## Task 11: Modify HandbookSetupStep (Step 8) — Auto-Generation

**Goal:** Pre-fill handbook chapters from all gathered data (Steps 0-7).

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/generate-chapter-content.ts`
- Modify: `apps/web/src/components/dashboard/wizard-steps/HandbookSetupStep.tsx`

**Step 1: Create chapter content generator**

Create `generate-chapter-content.ts`:

```typescript
import type { ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";
import type { SetupWizardState } from "./wizard-state";

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string }>;
};

function heading(level: number, text: string): TiptapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function paragraph(text: string): TiptapNode {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function bulletList(items: string[]): TiptapNode {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

export function generateChapterContent(
  chapterKey: ChapterKey,
  state: SetupWizardState,
): Record<string, unknown> {
  const nodes: TiptapNode[] = [];

  switch (chapterKey) {
    case "identity-mission": {
      const name = state.scrapedData.companyName ?? "Bedriften";
      nodes.push(heading(2, `Velkommen til ${name}`));
      if (state.scrapedData.address) {
        nodes.push(paragraph(`Vi holder til i ${state.scrapedData.address}.`));
      }
      nodes.push(
        paragraph("Vår visjon er å levere den beste opplevelsen for gjestene våre, hver dag."),
      );
      break;
    }
    case "organization-model": {
      nodes.push(heading(2, "Organisasjonen vår"));
      if (state.scrapedData.departments && state.scrapedData.departments.length > 0) {
        nodes.push(paragraph("Vi er organisert i følgende avdelinger:"));
        nodes.push(bulletList(state.scrapedData.departments));
      }
      break;
    }
    case "daily-operations": {
      nodes.push(heading(2, "Daglig drift"));
      if (state.scrapedData.openingHours) {
        nodes.push(paragraph(`Åpningstider: ${state.scrapedData.openingHours}`));
      }
      nodes.push(paragraph("Hver dag følger en fast rutine: åpning, drift, og lukking."));
      break;
    }
    case "safety-compliance": {
      nodes.push(heading(2, "Sikkerhet og etterlevelse"));
      nodes.push(paragraph("Alle ansatte skal kjenne til og følge våre sikkerhetsrutiner."));
      break;
    }
    case "communication": {
      nodes.push(heading(2, "Kommunikasjon"));
      nodes.push(paragraph("God kommunikasjon er grunnlaget for en trygg arbeidsplass."));
      break;
    }
    case "onboarding-training": {
      nodes.push(heading(2, "Onboarding og opplæring"));
      nodes.push(paragraph("Nye ansatte gjennomgår et strukturert opplæringsprogram."));
      break;
    }
    case "scheduling": {
      nodes.push(heading(2, "Vaktplan og bemanning"));
      if (state.shiftTemplateCount > 0) {
        nodes.push(paragraph(`Vi har ${state.shiftTemplateCount} vaktmaler definert.`));
      }
      break;
    }
    case "quality-service": {
      nodes.push(heading(2, "Kvalitet og service"));
      nodes.push(paragraph("Vår servicestandard setter gjestens opplevelse i sentrum."));
      break;
    }
    case "incident-response": {
      nodes.push(heading(2, "Avvik og hendelser"));
      nodes.push(paragraph("Alle avvik rapporteres umiddelbart."));
      break;
    }
    case "kpi-review": {
      nodes.push(heading(2, "KPI og evaluering"));
      nodes.push(paragraph("Vi følger opp resultater daglig, ukentlig og månedlig."));
      break;
    }
  }

  // Also inject document-extracted content if available
  const extracted = state.extractedData.handbookSections?.find((s) => s.chapterKey === chapterKey);
  if (extracted) {
    nodes.push(heading(3, `Fra ${extracted.source}`));
    nodes.push(paragraph(extracted.content));
  }

  if (nodes.length === 0) {
    nodes.push(paragraph("Skriv innholdet for dette kapittelet her."));
  }

  return { type: "doc", content: nodes };
}
```

**Step 2: Update HandbookSetupStep to accept wizardState**

```typescript
export function HandbookSetupStep({
  isDark,
  wizardState,
}: {
  isDark: boolean;
  wizardState?: SetupWizardState;
});
```

In the `ChapterEditor`, when `existingContent` is null and `wizardState` is provided, use `generateChapterContent(chapterKey, wizardState)` as initial editor content.

**Step 3: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/generate-chapter-content.ts apps/web/src/components/dashboard/wizard-steps/HandbookSetupStep.tsx
git commit -m "feat(wizard): auto-generate handbook chapters from wizard state"
```

---

## Task 12: BotsTip Component

**Goal:** Add Botsson contextual tip to every wizard step.

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/BotsTip.tsx`
- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`

**Step 1: Create BotsTip component**

Small fixed box at bottom of each step:

- Lightbulb icon + "Botsson:" + tip text
- "Mer ▸" opens a Sheet

```typescript
"use client";

import { Lightbulb } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function BotsTip({
  tip,
  extendedTip,
  isDark,
}: {
  tip: string;
  extendedTip?: string;
  isDark: boolean;
}) {
  if (!tip) return null;

  return (
    <div
      className={`mt-8 flex items-start gap-3 rounded-xl border px-4 py-3 ${
        isDark
          ? "border-amber-500/20 bg-amber-500/5"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isDark ? "text-amber-200/80" : "text-amber-800"}`}>
          <span className="font-semibold">Botsson:</span> {tip}
        </p>
        {extendedTip && (
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className={`mt-1 text-xs font-medium transition-colors ${
                  isDark
                    ? "text-amber-400/60 hover:text-amber-400"
                    : "text-amber-600/60 hover:text-amber-600"
                }`}
              >
                Mer ▸
              </button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Botsson forklarer</SheetTitle>
              </SheetHeader>
              <p className="mt-4 text-sm leading-relaxed">{extendedTip}</p>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Wire into WorkspaceSetupWizard**

After the step component block, add:

```tsx
<BotsTip tip={wizardState.industryPackage.botsson[step.id] ?? ""} isDark={isDark} />
```

**Step 3: Add botsson tips to hospitality package**

In `packages/hospitality.ts`:

```typescript
botsson: {
  welcome: "Vi har hentet informasjon fra Brønnøysund, Google og nettsiden din. Se over at alt stemmer.",
  "document-drop": "Last opp det dere har — vi finner ut hva som er rutiner, vaktlister, lønnssatser og kontrakter.",
  governance: "Basert på at dere håndterer mat, anbefaler vi Mattrygghet, Hygiene og Allergenhåndtering. Disse er påkrevd av Mattilsynet.",
  payroll: "Basert på Riksavtalen er minstelønn for kokk 198,50 kr/t. Kveldstillegg er 56 kr/t etter kl. 21.",
  employment: "Prøvetid på 6 måneder er standard. Dere kan sette kortere, men ikke lenger.",
  team: "Alle nye ansatte starter som trainee. De får automatisk opplæring basert på stilling og avdeling.",
  "shift-template": "Basert på åpningstidene deres foreslår vi 2 skift per dag for kjøkkenet.",
  season: "De fleste restauranter i Trondheim kjører sommersesong mai–september og vintersesong oktober–april.",
  handbook: "Vi har laget et utkast basert på det du har fylt inn. Les gjennom og juster — dette er det ansatte leser første dag.",
},
```

**Step 4: Typecheck + commit**

```bash
pnpm turbo typecheck --filter=web
git add apps/web/src/components/dashboard/wizard-steps/BotsTip.tsx apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx apps/web/src/lib/industry/packages/hospitality.ts
git commit -m "feat(wizard): add BotsTip component with per-step contextual tips"
```

---

## Task 13: Final Polish + Full Typecheck

**Goal:** Fix scroll, responsive step dots, verify everything compiles.

**Files:**

- Modify: `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`

**Step 1: Add scroll-to-top on step change**

In `handleNext` and `handleBack`, add:

```typescript
document.querySelector("[data-wizard-scroll]")?.scrollTo({ top: 0, behavior: "smooth" });
```

Add `data-wizard-scroll` attribute to the scrollable content div.

**Step 2: Make step dots responsive**

With 9 steps, dots overflow on mobile. On `sm:` and below, show only the current dot + number:

```tsx
<div className="flex justify-center gap-1.5 overflow-x-auto px-8 pt-6 sm:gap-2">
```

**Step 3: Full typecheck**

```bash
cd /home/sxtnl/dev/wt-1 && pnpm turbo typecheck --filter=web
```

Expected: 0 errors in wizard step files.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(wizard): polish — scroll fix, responsive dots, final typecheck"
```

---

## Implementation Order Summary

| Task | Component                        | Depends On | Complexity |
| ---- | -------------------------------- | ---------- | ---------- |
| 1    | Industry Package Data Layer      | —          | Medium     |
| 2    | SetupWizardState + 9-step layout | Task 1     | Medium     |
| 3    | WelcomeStep (Step 0)             | Task 2     | Low        |
| 4    | DocumentDropStep + Edge Function | Task 2     | High       |
| 5    | GovernanceSetupStep mods         | Task 2     | Low        |
| 6    | PayrollSetupStep mods            | Task 2     | Low        |
| 7    | EmploymentSetupStep mods         | Task 2     | Low        |
| 8    | TeamSetupStep mods               | Task 2     | Low        |
| 9    | ShiftTemplateSetupStep mods      | Task 2     | Low        |
| 10   | SeasonSetupStep mods             | Task 2     | Low        |
| 11   | HandbookSetupStep auto-gen       | Tasks 2-10 | Medium     |
| 12   | BotsTip component                | Task 1     | Low        |
| 13   | Final polish + typecheck         | All        | Low        |

**Sequential required:** Tasks 1 → 2 → [3-10 can partially parallelize] → 11 → 12 → 13.

---

## Key Reference Files

| File                                                                       | Purpose                         |
| -------------------------------------------------------------------------- | ------------------------------- |
| `apps/web/src/components/dashboard/WorkspaceSetupWizard.tsx`               | Main wizard orchestrator        |
| `apps/web/src/components/dashboard/wizard-steps/*.tsx`                     | 8 existing step components      |
| `apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts` | Governance templates + filters  |
| `apps/web/src/app/dashboard/_hooks/use-workspace-setup.ts`                 | Completion tracking             |
| `apps/web/src/lib/workspace-context.tsx`                                   | Workspace context               |
| `supabase/functions/gather-workspace-intelligence/index.ts`                | Intelligence pipeline reference |
| `supabase/functions/process-settlement-image/index.ts`                     | OCR/AI pattern reference        |
| `apps/web/src/app/dashboard/_components/document-mode/chapters.ts`         | CHAPTERS constant               |
| `docs/engines/industri-inteligence/hospitalety/`                           | Industry engine docs            |
