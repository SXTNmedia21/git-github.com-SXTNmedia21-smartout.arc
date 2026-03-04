---
title: Onboarding Redesign Implementation Plan
status: draft
updated: 2026-03-03
created: 2026-03-03
module: onboarding
tags: [onboarding, wizard, redesign, plan]
---

# Onboarding Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current 15-step onboarding wizard with a 5-step dashboard-style flow that pre-fills everything from URL scraping + Brønnøysundregistrene and asks the admin to confirm — not create.

**Architecture:** Keep existing infrastructure (Scrapling, `gather-workspace-intelligence`, `activate-workspace`, `onboarding_session` table). Rewrite the wizard UI from 15 step components to 5. Render inside a dashboard-like shell with step progress sidebar. Keep atomic entity creation at finalization (not progressive). Add industry-based department/position pre-selection and contract template generation.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, shadcn/ui (new-york), Supabase Edge Functions (Deno), Vitest

**Design spec:** See `docs/plans/2026-03-03-onboarding-redesign-spec.md` (the input document).

---

## Existing Code Map

| What                          | Path                                                        | Status                    |
| ----------------------------- | ----------------------------------------------------------- | ------------------------- |
| Current wizard (15 steps)     | `apps/web/src/app/onboarding/`                              | REWRITE                   |
| Step types & constants        | `apps/web/src/app/onboarding/types.ts`                      | REWRITE                   |
| Wizard hook                   | `apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts`  | REWRITE                   |
| Wizard context                | `apps/web/src/app/onboarding/WizardContext.tsx`             | KEEP (update types)       |
| Step progress                 | `apps/web/src/app/onboarding/StepProgress.tsx`              | REWRITE                   |
| 4 drawers                     | `apps/web/src/app/onboarding/drawers/`                      | DELETE (no longer needed) |
| Scrapling service             | `services/scrapling/main.py`                                | KEEP                      |
| gather-workspace-intelligence | `supabase/functions/gather-workspace-intelligence/index.ts` | KEEP                      |
| activate-workspace            | `supabase/functions/activate-workspace/index.ts`            | MODIFY                    |
| onboarding_session table      | DB                                                          | KEEP (reuse columns)      |
| Vitest config                 | `apps/web/vitest.config.ts`                                 | KEEP                      |

---

## New File Structure

```
apps/web/src/app/onboarding/
├── page.tsx                        → Step router (6 steps: auth + 4 setup + done)
├── types.ts                        → New ONBOARDING_STEPS, OnboardingData type
├── WizardContext.tsx                → Updated with new types
├── hooks/
│   └── useOnboardingWizard.ts      → Rewritten for 5-step flow
├── components/
│   ├── OnboardingShell.tsx         → Dashboard-like layout wrapper
│   ├── OnboardingProgress.tsx      → Sidebar step progress
│   └── OnboardingCard.tsx          → Reusable card wrapper
├── steps/
│   ├── AuthStep.tsx                → Sign up (keep existing, minor updates)
│   ├── BusinessInfoStep.tsx        → NEW: URL + org input → review card
│   ├── SeasonStep.tsx              → NEW: simplified season setup
│   ├── DepartmentsStep.tsx         → NEW: pre-selected industry chips
│   ├── ContractStep.tsx            → NEW: template generation + preview
│   └── DoneStep.tsx                → NEW: summary + redirect to dashboard
├── lib/
│   ├── industry-defaults.ts        → NACE → departments/positions mapping
│   ├── data-merger.ts              → Merge scrape + brreg into OnboardingData
│   └── season-suggestions.ts       → AI-free season name/date suggestions
└── __tests__/
    ├── industry-defaults.test.ts   → Tests for NACE mapping
    ├── data-merger.test.ts         → Tests for data merging
    └── season-suggestions.test.ts  → Tests for season suggestions

supabase/functions/
├── lookup-brreg/index.ts           → NEW: Brønnøysund API proxy
└── generate-contract-template/index.ts → NEW: Contract template from company data
```

---

## Phase 1: Data Layer & Utilities

### Task 1: Database Migration — Season Revenue Fields

Add `expected_revenue` and `target_margin` to the `season` table.

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_season_revenue_fields.sql`

**Step 1: Write the migration**

```sql
-- Add optional revenue/margin fields for season budget planning
ALTER TABLE season ADD COLUMN expected_revenue decimal NULL;
ALTER TABLE season ADD COLUMN target_margin decimal NULL;

COMMENT ON COLUMN season.expected_revenue IS 'Expected revenue for this season in workspace currency';
COMMENT ON COLUMN season.target_margin IS 'Target profit margin as percentage (e.g. 15.0 = 15%)';
```

**Step 2: Apply the migration**

Run: `cd /home/sxtnl/dev/smartout.ai && npx supabase migration new add_season_revenue_fields`
Then paste the SQL into the generated file.
Run: `npx supabase db reset` (local) or `npx supabase db push` (remote)

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `database.types.ts` now includes `expected_revenue` and `target_margin` on the `season` type.

**Step 4: Verify the new columns exist in generated types**

Run: `grep -n 'expected_revenue\|target_margin' packages/supabase/src/database.types.ts`
Expected: Both columns appear in the `season` Row/Insert/Update types.

**Step 5: Commit**

```bash
git add supabase/migrations/*_add_season_revenue_fields.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add expected_revenue and target_margin to season table"
```

---

### Task 2: Industry Defaults Mapping

Create a utility that maps industry/NACE codes to default departments and positions. This drives the "confirm, don't create" pattern in Step 4.

**Files:**

- Create: `apps/web/src/app/onboarding/lib/industry-defaults.ts`
- Create: `apps/web/src/app/onboarding/__tests__/industry-defaults.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/app/onboarding/__tests__/industry-defaults.test.ts
import { describe, it, expect } from "vitest";
import {
  getDefaultDepartments,
  getDefaultPositions,
  mapNaceToIndustry,
  type IndustryType,
} from "../lib/industry-defaults";

describe("mapNaceToIndustry", () => {
  it("maps restaurant NACE codes to restaurant", () => {
    expect(mapNaceToIndustry("56.101")).toBe("restaurant");
    expect(mapNaceToIndustry("56.102")).toBe("restaurant");
  });

  it("maps hotel NACE codes to hotel", () => {
    expect(mapNaceToIndustry("55.101")).toBe("hotel");
    expect(mapNaceToIndustry("55.102")).toBe("hotel");
  });

  it("maps bar NACE codes to bar", () => {
    expect(mapNaceToIndustry("56.301")).toBe("bar");
    expect(mapNaceToIndustry("56.309")).toBe("bar");
  });

  it("maps cafe NACE codes to cafe", () => {
    expect(mapNaceToIndustry("56.102")).toBe("restaurant"); // cafes are under restaurant
  });

  it("maps catering NACE codes to catering", () => {
    expect(mapNaceToIndustry("56.210")).toBe("catering");
  });

  it("returns other for unknown NACE codes", () => {
    expect(mapNaceToIndustry("99.999")).toBe("other");
    expect(mapNaceToIndustry("")).toBe("other");
  });

  it("handles NACE codes with and without dots", () => {
    expect(mapNaceToIndustry("56101")).toBe("restaurant");
    expect(mapNaceToIndustry("56.101")).toBe("restaurant");
  });
});

describe("getDefaultDepartments", () => {
  it("returns restaurant defaults", () => {
    const depts = getDefaultDepartments("restaurant");
    const names = depts.map((d) => d.name);
    expect(names).toContain("Kjøkken");
    expect(names).toContain("Sal");
    expect(names).toContain("Bar");
  });

  it("returns hotel defaults", () => {
    const depts = getDefaultDepartments("hotel");
    const names = depts.map((d) => d.name);
    expect(names).toContain("Resepsjon");
    expect(names).toContain("Housekeeping");
    expect(names).toContain("Restaurant");
  });

  it("marks primary departments as selected by default", () => {
    const depts = getDefaultDepartments("restaurant");
    const primary = depts.filter((d) => d.isDefault);
    expect(primary.length).toBeGreaterThanOrEqual(3);
  });

  it("includes secondary suggestions not selected by default", () => {
    const depts = getDefaultDepartments("restaurant");
    const secondary = depts.filter((d) => !d.isDefault);
    expect(secondary.length).toBeGreaterThanOrEqual(1);
  });

  it("returns generic defaults for other", () => {
    const depts = getDefaultDepartments("other");
    expect(depts.length).toBeGreaterThanOrEqual(2);
  });
});

describe("getDefaultPositions", () => {
  it("returns positions for Kjøkken", () => {
    const positions = getDefaultPositions("Kjøkken");
    expect(positions).toContain("Kokk");
    expect(positions).toContain("Sous Chef");
    expect(positions).toContain("Kjøkkenassistent");
  });

  it("returns positions for Sal", () => {
    const positions = getDefaultPositions("Sal");
    expect(positions).toContain("Servitør");
    expect(positions).toContain("Hovmester");
  });

  it("returns positions for Bar", () => {
    const positions = getDefaultPositions("Bar");
    expect(positions).toContain("Bartender");
  });

  it("returns empty array for unknown department", () => {
    const positions = getDefaultPositions("Unknown Dept XYZ");
    expect(positions).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/app/onboarding/__tests__/industry-defaults.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// apps/web/src/app/onboarding/lib/industry-defaults.ts

export type IndustryType = "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other";

export interface DefaultDepartment {
  name: string;
  description: string;
  isDefault: boolean; // true = pre-selected, false = suggestion only
}

/**
 * Maps a Norwegian NACE code (from Brønnøysundregistrene) to our industry enum.
 * Handles codes with or without dots (e.g. "56.101" or "56101").
 */
export function mapNaceToIndustry(naceCode: string): IndustryType {
  const normalized = naceCode.replace(/\./g, "");

  // 56.1xx — Restaurants and cafes
  if (normalized.startsWith("561")) return "restaurant";
  // 55.1xx — Hotels and accommodation
  if (normalized.startsWith("551")) return "hotel";
  // 56.3xx — Bars and pubs
  if (normalized.startsWith("563")) return "bar";
  // 56.21x — Catering
  if (normalized.startsWith("5621")) return "catering";
  // 55.2xx — Holiday accommodation (treat as hotel)
  if (normalized.startsWith("552")) return "hotel";
  // 56.29x — Other food service (treat as catering)
  if (normalized.startsWith("5629")) return "catering";

  return "other";
}

const DEPARTMENT_DEFAULTS: Record<IndustryType, DefaultDepartment[]> = {
  restaurant: [
    { name: "Kjøkken", description: "Mat- og produksjonsavdeling", isDefault: true },
    { name: "Sal", description: "Servering og gjestekontakt", isDefault: true },
    { name: "Bar", description: "Drikke og cocktails", isDefault: true },
    { name: "Ledelse", description: "Drift og administrasjon", isDefault: false },
    { name: "Event", description: "Selskaper og arrangementer", isDefault: false },
  ],
  hotel: [
    { name: "Resepsjon", description: "Innsjekk, utsjekk og gjestekontakt", isDefault: true },
    { name: "Housekeeping", description: "Rengjøring og romplassering", isDefault: true },
    { name: "Restaurant", description: "Mat og servering", isDefault: true },
    { name: "Bar", description: "Drikke og cocktails", isDefault: true },
    { name: "Konferanse", description: "Møte- og konferanseavdeling", isDefault: false },
    { name: "Ledelse", description: "Drift og administrasjon", isDefault: false },
  ],
  cafe: [
    { name: "Kjøkken", description: "Mat- og bakeavdeling", isDefault: true },
    { name: "Disk", description: "Servering og kasse", isDefault: true },
    { name: "Ledelse", description: "Drift og administrasjon", isDefault: false },
  ],
  bar: [
    { name: "Bar", description: "Drikke og cocktails", isDefault: true },
    { name: "Kjøkken", description: "Mat og snacks", isDefault: true },
    { name: "Dør", description: "Inngang og sikkerhet", isDefault: false },
    { name: "Ledelse", description: "Drift og administrasjon", isDefault: false },
  ],
  catering: [
    { name: "Kjøkken", description: "Mat- og produksjonsavdeling", isDefault: true },
    { name: "Service", description: "Servering på event", isDefault: true },
    { name: "Logistikk", description: "Transport og oppsett", isDefault: true },
    { name: "Ledelse", description: "Drift og administrasjon", isDefault: false },
  ],
  other: [
    { name: "Drift", description: "Daglig operasjon", isDefault: true },
    { name: "Ledelse", description: "Administrasjon", isDefault: true },
  ],
};

/**
 * Returns default departments for a given industry.
 * Each department has `isDefault: true` if it should be pre-selected.
 */
export function getDefaultDepartments(industry: IndustryType): DefaultDepartment[] {
  return DEPARTMENT_DEFAULTS[industry] ?? DEPARTMENT_DEFAULTS.other;
}

const POSITION_DEFAULTS: Record<string, string[]> = {
  Kjøkken: ["Kokk", "Sous Chef", "Kjøkkenassistent"],
  Sal: ["Servitør", "Hovmester"],
  Bar: ["Bartender", "Barback"],
  Ledelse: ["Daglig leder", "Skiftleder"],
  Event: ["Eventkoordinator"],
  Housekeeping: ["Renholder"],
  Resepsjon: ["Resepsjonist", "Nattevakt"],
  Restaurant: ["Kokk", "Servitør", "Hovmester"],
  Konferanse: ["Konferansevert"],
  Disk: ["Barista", "Kasserer"],
  Dør: ["Dørvert"],
  Service: ["Servitør", "Hovmester"],
  Logistikk: ["Sjåfør", "Oppsettsmedarbeider"],
  Drift: ["Medarbeider"],
};

/**
 * Returns default position titles for a department name.
 * Returns empty array for unknown departments.
 */
export function getDefaultPositions(departmentName: string): string[] {
  return POSITION_DEFAULTS[departmentName] ?? [];
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/app/onboarding/__tests__/industry-defaults.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/lib/industry-defaults.ts apps/web/src/app/onboarding/__tests__/industry-defaults.test.ts
git commit -m "feat(onboarding): add industry defaults mapping (NACE → departments/positions)"
```

---

### Task 3: Season Suggestion Utility

Create a utility that generates smart season name and date suggestions based on current date and industry.

**Files:**

- Create: `apps/web/src/app/onboarding/lib/season-suggestions.ts`
- Create: `apps/web/src/app/onboarding/__tests__/season-suggestions.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/app/onboarding/__tests__/season-suggestions.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { suggestSeason, type SeasonSuggestion } from "../lib/season-suggestions";

describe("suggestSeason", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("suggests Vår for March", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15"));
    const suggestion = suggestSeason();
    expect(suggestion.name).toBe("Vår 2026");
    expect(suggestion.startDate).toBe("2026-03-01");
    expect(suggestion.endDate).toBe("2026-05-31");
    vi.useRealTimers();
  });

  it("suggests Sommer for June", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01"));
    const suggestion = suggestSeason();
    expect(suggestion.name).toBe("Sommer 2026");
    expect(suggestion.startDate).toBe("2026-06-01");
    expect(suggestion.endDate).toBe("2026-08-31");
    vi.useRealTimers();
  });

  it("suggests Høst for September", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15"));
    const suggestion = suggestSeason();
    expect(suggestion.name).toBe("Høst 2026");
    expect(suggestion.startDate).toBe("2026-09-01");
    expect(suggestion.endDate).toBe("2026-11-30");
    vi.useRealTimers();
  });

  it("suggests Vinter for December", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01"));
    const suggestion = suggestSeason();
    expect(suggestion.name).toBe("Vinter 2026");
    expect(suggestion.startDate).toBe("2026-12-01");
    expect(suggestion.endDate).toBe("2027-02-28");
    vi.useRealTimers();
  });

  it("suggests Vinter for January (wraps year)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-15"));
    const suggestion = suggestSeason();
    expect(suggestion.name).toBe("Vinter 2027");
    expect(suggestion.startDate).toBe("2026-12-01");
    expect(suggestion.endDate).toBe("2027-02-28");
    vi.useRealTimers();
  });

  it("returns correct shape", () => {
    const suggestion = suggestSeason();
    expect(suggestion).toHaveProperty("name");
    expect(suggestion).toHaveProperty("startDate");
    expect(suggestion).toHaveProperty("endDate");
    expect(typeof suggestion.name).toBe("string");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/app/onboarding/__tests__/season-suggestions.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// apps/web/src/app/onboarding/lib/season-suggestions.ts

export interface SeasonSuggestion {
  name: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
}

/**
 * Suggests a season name and date range based on the current date.
 * Uses Norwegian season names and meteorological seasons.
 *
 * Vår: March–May, Sommer: June–August, Høst: Sept–Nov, Vinter: Dec–Feb
 */
export function suggestSeason(now: Date = new Date()): SeasonSuggestion {
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();

  // Vinter: Dec (11), Jan (0), Feb (1)
  if (month <= 1 || month === 11) {
    const winterYear = month === 11 ? year : year;
    const startYear = month === 11 ? year : year - 1;
    return {
      name: `Vinter ${winterYear}`,
      startDate: `${startYear}-12-01`,
      endDate: `${startYear + 1}-02-28`,
    };
  }

  // Vår: March (2), April (3), May (4)
  if (month >= 2 && month <= 4) {
    return {
      name: `Vår ${year}`,
      startDate: `${year}-03-01`,
      endDate: `${year}-05-31`,
    };
  }

  // Sommer: June (5), July (6), August (7)
  if (month >= 5 && month <= 7) {
    return {
      name: `Sommer ${year}`,
      startDate: `${year}-06-01`,
      endDate: `${year}-08-31`,
    };
  }

  // Høst: September (8), October (9), November (10)
  return {
    name: `Høst ${year}`,
    startDate: `${year}-09-01`,
    endDate: `${year}-11-30`,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/app/onboarding/__tests__/season-suggestions.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/lib/season-suggestions.ts apps/web/src/app/onboarding/__tests__/season-suggestions.test.ts
git commit -m "feat(onboarding): add season suggestion utility with Norwegian season names"
```

---

### Task 4: Data Merger Utility

Create a utility that merges scraped website data + Brønnøysund data into a unified `OnboardingData` object. Brreg is authoritative for legal fields; scraped data fills the rest.

**Files:**

- Create: `apps/web/src/app/onboarding/lib/data-merger.ts`
- Create: `apps/web/src/app/onboarding/__tests__/data-merger.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/app/onboarding/__tests__/data-merger.test.ts
import { describe, it, expect } from "vitest";
import {
  mergeBusinessData,
  type BrregData,
  type ScrapedData,
  type MergedBusinessData,
} from "../lib/data-merger";

const mockBrreg: BrregData = {
  navn: "Brødernas Sundet AS",
  organisasjonsnummer: "123456789",
  forretningsadresse: {
    adresse: ["Strandgata 12"],
    postnummer: "3126",
    poststed: "Tønsberg",
    land: "Norge",
  },
  antallAnsatte: 15,
  naeringskode1: {
    kode: "56.101",
    beskrivelse: "Drift av restauranter og kafeer",
  },
};

const mockScraped: ScrapedData = {
  companyName: "Brodernas Sundet",
  email: "post@brodernas.no",
  phone: "+47 33 31 00 00",
  summary: "Norsk-svensk gastropub med fokus på lokale råvarer.",
  locations: [{ name: "Hovedsal", type: "Indoor" }],
  departments: [{ name: "Kjøkken" }],
  images: [{ src: "https://brodernas.no/logo.png", alt: "Logo" }],
  socialLinks: { instagram: "https://instagram.com/brodernas" },
};

describe("mergeBusinessData", () => {
  it("prefers Brreg name over scraped name", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.name).toBe("Brødernas Sundet AS");
  });

  it("uses Brreg address", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.address).toContain("Strandgata 12");
    expect(result.postalCode).toBe("3126");
    expect(result.city).toBe("Tønsberg");
  });

  it("uses scraped data for contact info", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.email).toBe("post@brodernas.no");
    expect(result.phone).toBe("+47 33 31 00 00");
  });

  it("maps NACE code to industry", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.industry).toBe("restaurant");
  });

  it("uses Brreg org number", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.orgNumber).toBe("123456789");
  });

  it("includes scraped summary", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.summary).toBe("Norsk-svensk gastropub med fokus på lokale råvarer.");
  });

  it("extracts logo from images", () => {
    const result = mergeBusinessData(mockScraped, mockBrreg);
    expect(result.logoUrl).toBe("https://brodernas.no/logo.png");
  });

  it("works with scraped data only (no Brreg)", () => {
    const result = mergeBusinessData(mockScraped, null);
    expect(result.name).toBe("Brodernas Sundet");
    expect(result.industry).toBe("other");
    expect(result.orgNumber).toBe("");
  });

  it("works with Brreg data only (no scraping)", () => {
    const result = mergeBusinessData(null, mockBrreg);
    expect(result.name).toBe("Brødernas Sundet AS");
    expect(result.email).toBe("");
    expect(result.phone).toBe("");
    expect(result.industry).toBe("restaurant");
  });

  it("returns empty data when both are null", () => {
    const result = mergeBusinessData(null, null);
    expect(result.name).toBe("");
    expect(result.industry).toBe("other");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/app/onboarding/__tests__/data-merger.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// apps/web/src/app/onboarding/lib/data-merger.ts
import { mapNaceToIndustry, type IndustryType } from "./industry-defaults";

export interface BrregData {
  navn: string;
  organisasjonsnummer: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    land?: string;
  };
  antallAnsatte?: number;
  naeringskode1?: {
    kode: string;
    beskrivelse: string;
  };
  vedtektsfestetFormaal?: string[];
  aktivitet?: string[];
}

export interface ScrapedData {
  companyName?: string;
  email?: string;
  phone?: string;
  summary?: string;
  locations?: Array<{ name: string; type?: string }>;
  departments?: Array<{ name: string }>;
  images?: Array<{ src: string; alt: string }>;
  socialLinks?: Record<string, string>;
  reservationUrl?: string | null;
  menus?: Array<{ href: string; text: string }>;
  pageDictionary?: Record<string, string>;
}

export interface MergedBusinessData {
  name: string;
  legalName: string;
  orgNumber: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  industry: IndustryType;
  naceCode: string;
  naceDescription: string;
  employeeCount: number;
  summary: string;
  logoUrl: string;
  website: string;
  socialLinks: Record<string, string>;
}

/**
 * Merges scraped website data + Brønnøysundregistrene data.
 * Brreg is authoritative for legal fields (name, address, org number).
 * Scraped data fills contact info, descriptions, and media.
 */
export function mergeBusinessData(
  scraped: ScrapedData | null,
  brreg: BrregData | null,
): MergedBusinessData {
  const addr = brreg?.forretningsadresse;
  const addressLine = addr?.adresse?.[0] ?? "";
  const naceCode = brreg?.naeringskode1?.kode ?? "";

  // Find logo from images (first image with "logo" in alt or src)
  const logoImage = scraped?.images?.find(
    (img) => img.alt?.toLowerCase().includes("logo") || img.src?.toLowerCase().includes("logo"),
  );

  return {
    name: brreg?.navn ?? scraped?.companyName ?? "",
    legalName: brreg?.navn ?? "",
    orgNumber: brreg?.organisasjonsnummer ?? "",
    address: addressLine,
    postalCode: addr?.postnummer ?? "",
    city: addr?.poststed ?? "",
    country: addr?.land ?? "Norge",
    email: scraped?.email ?? "",
    phone: scraped?.phone ?? "",
    industry: naceCode ? mapNaceToIndustry(naceCode) : "other",
    naceCode,
    naceDescription: brreg?.naeringskode1?.beskrivelse ?? "",
    employeeCount: brreg?.antallAnsatte ?? 0,
    summary: scraped?.summary ?? "",
    logoUrl: logoImage?.src ?? "",
    website: "",
    socialLinks: scraped?.socialLinks ?? {},
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/app/onboarding/__tests__/data-merger.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/web/src/app/onboarding/lib/data-merger.ts apps/web/src/app/onboarding/__tests__/data-merger.test.ts
git commit -m "feat(onboarding): add data merger utility (scrape + brreg → unified business data)"
```

---

### Task 5: Brønnøysund Lookup Edge Function

Move Brreg lookup from client-side (`OrgVerificationStep.tsx`) to a Supabase Edge Function. This handles CORS, adds CEO lookup, and gives us a single server-side integration point.

**Files:**

- Create: `supabase/functions/lookup-brreg/index.ts`

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/lookup-brreg/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BrregResponse {
  navn: string;
  organisasjonsnummer: string;
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    land?: string;
  };
  antallAnsatte?: number;
  naeringskode1?: {
    kode: string;
    beskrivelse: string;
  };
  vedtektsfestetFormaal?: string[];
  aktivitet?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orgNumber } = await req.json();
    if (!orgNumber) {
      return new Response(JSON.stringify({ error: "orgNumber is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const cleanOrg = orgNumber.replace(/\D/g, "");
    if (cleanOrg.length !== 9) {
      return new Response(JSON.stringify({ error: "Organisasjonsnummer must be 9 digits" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch company data
    const companyRes = await fetch(
      `https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}`,
    );
    if (!companyRes.ok) {
      return new Response(JSON.stringify({ error: "Fant ikke firma i Brønnøysundregistrene" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const companyData: BrregResponse = await companyRes.json();

    // Fetch CEO (daglig leder) from roles endpoint
    let ceoName = "";
    try {
      const rolesRes = await fetch(
        `https://data.brreg.no/enhetsregisteret/api/enheter/${cleanOrg}/roller`,
      );
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        const ceoRole = rolesData.rollegrupper?.find(
          (rg: { type: { kode: string } }) => rg.type.kode === "DAGL",
        );
        if (ceoRole?.roller?.[0]?.person) {
          const person = ceoRole.roller[0].person;
          const parts = [
            person.navn?.fornavn,
            person.navn?.mellomnavn,
            person.navn?.etternavn,
          ].filter(Boolean);
          ceoName = parts.join(" ");
        }
      }
    } catch {
      // CEO lookup is optional — continue without it
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: companyData,
        ceoName: ceoName || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
```

**Step 2: Test locally**

Run: `npx supabase functions serve lookup-brreg --no-verify-jwt`
Then in another terminal:

```bash
curl -X POST http://localhost:54321/functions/v1/lookup-brreg \
  -H "Content-Type: application/json" \
  -d '{"orgNumber": "920426530"}'
```

Expected: JSON response with company data and CEO name.

**Step 3: Commit**

```bash
git add supabase/functions/lookup-brreg/index.ts
git commit -m "feat(edge-fn): add lookup-brreg Edge Function for Brønnøysund API proxy"
```

---

## Phase 2: Onboarding Types & Hook

### Task 6: New Onboarding Types

Replace the current 15-step type system with a 5-step system and simplified data model.

**Files:**

- Modify: `apps/web/src/app/onboarding/types.ts`

**Step 1: Rewrite types.ts**

Keep the file at the same path. Replace contents entirely:

```typescript
// apps/web/src/app/onboarding/types.ts
/**
 * Onboarding types — simplified 5-step flow.
 * Replaces the old 15-step wizard. Steps:
 *   auth → business_info → season → departments → contract → done
 */

import type { IndustryType, DefaultDepartment } from "./lib/industry-defaults";
import type { MergedBusinessData } from "./lib/data-merger";

/** All wizard steps in order. */
export const ONBOARDING_STEPS = [
  "auth",
  "business_info",
  "season",
  "departments",
  "contract",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Maps step names to integer index for DB storage in onboarding_session.current_step. */
export const STEP_INDEX: Record<OnboardingStep, number> = Object.fromEntries(
  ONBOARDING_STEPS.map((step, i) => [step, i]),
) as Record<OnboardingStep, number>;

/** Reverse mapping: integer → step name for session resume. */
export function stepFromIndex(index: number): OnboardingStep {
  return ONBOARDING_STEPS[index] ?? "auth";
}

/** Labels for the progress sidebar (Norwegian). */
export const STEP_LABELS: Record<OnboardingStep, string> = {
  auth: "Registrering",
  business_info: "Bedriftsinformasjon",
  season: "Sesong",
  departments: "Avdelinger",
  contract: "Kontrakt",
  done: "Ferdig",
};

/** Onboarding data accumulated across steps. */
export interface OnboardingData {
  // Business info (from scrape + brreg)
  business: MergedBusinessData | null;
  sourceUrl: string;
  orgNumber: string;

  // Season
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  expectedRevenue: string;
  targetMargin: string;

  // Departments (selected from defaults + custom)
  selectedDepartments: SelectedDepartment[];

  // Contract
  contractTemplateGenerated: boolean;
}

export interface SelectedDepartment {
  name: string;
  description: string;
  positions: string[];
}

/** Default empty onboarding data. */
export const EMPTY_ONBOARDING_DATA: OnboardingData = {
  business: null,
  sourceUrl: "",
  orgNumber: "",
  seasonName: "",
  seasonStartDate: "",
  seasonEndDate: "",
  expectedRevenue: "",
  targetMargin: "",
  selectedDepartments: [],
  contractTemplateGenerated: false,
};

/** Context provided by useOnboardingWizard to all step components. */
export interface OnboardingContext {
  step: OnboardingStep;
  goTo: (step: OnboardingStep) => void;
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;

  // Auth
  isAuthenticated: boolean;
  userId: string | null;

  // Session
  sessionId: string | null;
  error: string | null;
  setError: (error: string | null) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Finalization
  finalize: () => Promise<void>;
  activatedWorkspaceSlug: string | null;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty src/app/onboarding/types.ts 2>&1 | head -20`

Note: The old step components will have type errors — that's expected. We're rewriting them in Phase 4.

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/types.ts
git commit -m "refactor(onboarding): replace 15-step type system with 5-step OnboardingData model"
```

---

### Task 7: Rewrite useOnboardingWizard Hook

Rewrite the hook for the new 5-step flow. Keep progressive save to `onboarding_session` but simplify the data shape.

**Files:**

- Modify: `apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts`

**Step 1: Rewrite the hook**

```typescript
// apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import type { OnboardingStep, OnboardingContext, OnboardingData } from "../types";
import { EMPTY_ONBOARDING_DATA, STEP_INDEX, stepFromIndex } from "../types";

const SAVE_DEBOUNCE_MS = 500;

export function useOnboardingWizard(): OnboardingContext {
  const supabase = createClient();

  // Core state
  const [step, setStep] = useState<OnboardingStep>("auth");
  const [data, setData] = useState<OnboardingData>(EMPTY_ONBOARDING_DATA);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Activation result
  const [activatedWorkspaceSlug, setActivatedWorkspaceSlug] = useState<string | null>(null);

  // Refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasResumed = useRef(false);

  // -- Auth check --
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
        setUserId(user.id);
      }
    }
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // -- Resume incomplete session --
  useEffect(() => {
    if (!isAuthenticated || !userId || hasResumed.current) return;
    hasResumed.current = true;

    async function resume() {
      const { data: session } = await supabase
        .from("onboarding_session")
        .select("id, current_step, scraped_data, brreg_data, confirmed_departments, source_url")
        .eq("user_id", userId!)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) return;

      setSessionId(session.id);

      // Restore step — new steps use indices 0-5
      const restoredStep = stepFromIndex(session.current_step ?? 0);
      // Don't resume to "done" — that's post-finalization
      const safeStep = restoredStep === "done" ? "business_info" : restoredStep;
      setStep(safeStep);

      // Restore data from JSONB columns
      const scraped = session.scraped_data as Record<string, unknown> | null;
      const brreg = session.brreg_data as Record<string, unknown> | null;
      const depts = session.confirmed_departments as Array<{
        name: string;
        description?: string;
        positions?: string[];
      }> | null;

      setData((prev) => ({
        ...prev,
        sourceUrl: (session.source_url as string) ?? "",
        ...(depts
          ? {
              selectedDepartments: depts.map((d) => ({
                name: d.name,
                description: d.description ?? "",
                positions: d.positions ?? [],
              })),
            }
          : {}),
      }));
    }

    resume();
  }, [isAuthenticated, userId]);

  // -- Save to onboarding_session --
  const save = useCallback(
    async (nextStep: OnboardingStep) => {
      if (!isAuthenticated || !userId) return;

      const now = new Date().toISOString();
      const payload = {
        user_id: userId,
        current_step: STEP_INDEX[nextStep],
        confirmed_departments: data.selectedDepartments as unknown as Json,
        source_url: data.sourceUrl || null,
        updated_at: now,
      };

      if (sessionId) {
        await supabase.from("onboarding_session").update(payload).eq("id", sessionId);
      } else {
        const { data: newSession } = await supabase
          .from("onboarding_session")
          .insert({ ...payload, started_at: now })
          .select("id")
          .single();
        if (newSession) setSessionId(newSession.id);
      }
    },
    [isAuthenticated, userId, sessionId, data, supabase],
  );

  // -- Step navigation with auto-save --
  const goTo = useCallback(
    (nextStep: OnboardingStep) => {
      setStep(nextStep);
      setError(null);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        save(nextStep);
      }, SAVE_DEBOUNCE_MS);
    },
    [save],
  );

  // -- Update data --
  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  // -- Finalize: convert OnboardingData → WorkspaceData and call activate-workspace --
  const finalize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const business = data.business;
      // Build the WorkspaceData payload that activate_workspace_v3 expects
      const workspaceData = {
        name: business?.name ?? "",
        website: business?.website ?? data.sourceUrl ?? "",
        email: business?.email ?? "",
        phone: business?.phone ?? "",
        address: business
          ? `${business.address}, ${business.postalCode} ${business.city}`.trim()
          : "",
        ceo: "",
        employeeCount: business?.employeeCount?.toString() ?? "",
        industry: business?.industry ?? "other",
        concept: "",
        summary: business?.summary ?? "",
        slogan: "",
        locations: [],
        departments: data.selectedDepartments.map((d) => ({
          name: d.name,
          description: d.description,
          isSeasonActive: true,
        })),
        multiDepartmentTeams: [],
        procedures: [],
        policies: [],
        pageDictionary: {},
        images: [],
        menus: [],
        socialLinks: business?.socialLinks ?? {},
        reservationUrl: null,
        brandColor: "#3B82F6",
        communicationTone: "Professional & Formal",
        seasonName: data.seasonName || "Standard drift",
        seasonStartDate: data.seasonStartDate,
        seasonEndDate: data.seasonEndDate,
        seasonType: "default",
        // New fields (will be handled by updated RPC)
        orgNumber: data.orgNumber || business?.orgNumber || "",
        expectedRevenue: data.expectedRevenue || null,
        targetMargin: data.targetMargin || null,
      };

      const { data: result, error: invokeError } = await supabase.functions.invoke(
        "activate-workspace",
        { body: { workspaceData } },
      );

      if (invokeError) {
        let message = "Failed to activate workspace";
        try {
          const ctx = (invokeError as unknown as { context: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          }
        } catch {
          if (invokeError.message) message = invokeError.message;
        }
        throw new Error(message);
      }

      const workspaceId = result?.workspaceId;
      if (!workspaceId) throw new Error("No workspace ID returned");

      // Fetch the workspace slug for redirect
      const { data: ws } = await supabase
        .from("workspace")
        .select("slug")
        .eq("workspace_id", workspaceId)
        .single();

      setActivatedWorkspaceSlug(ws?.slug ?? null);

      // Mark session completed
      if (sessionId) {
        await supabase
          .from("onboarding_session")
          .update({
            workspace_id: workspaceId,
            completed_at: new Date().toISOString(),
            current_step: STEP_INDEX["done"],
          })
          .eq("id", sessionId);
      }

      setStep("done");
    } catch (err: unknown) {
      console.error("Finalization error:", err);
      setError(
        err instanceof Error ? err.message : "En feil oppstod under oppsett av arbeidsplassen.",
      );
      setStep("contract"); // Return to last real step
    } finally {
      setIsLoading(false);
    }
  }, [data, sessionId, supabase]);

  const context = useMemo<OnboardingContext>(
    () => ({
      step,
      goTo,
      data,
      updateData,
      isAuthenticated,
      userId,
      sessionId,
      error,
      setError,
      isLoading,
      setIsLoading,
      finalize,
      activatedWorkspaceSlug,
    }),
    [
      step,
      goTo,
      data,
      updateData,
      isAuthenticated,
      userId,
      sessionId,
      error,
      isLoading,
      finalize,
      activatedWorkspaceSlug,
    ],
  );

  return context;
}
```

**Step 2: Update WizardContext.tsx to use new types**

Read the existing `WizardContext.tsx` and update it to export `useWizard` with the new `OnboardingContext` type. The context provider pattern stays the same — just the type changes.

```typescript
// apps/web/src/app/onboarding/WizardContext.tsx
"use client";

import { createContext, useContext } from "react";
import type { OnboardingContext } from "./types";

const WizardCtx = createContext<OnboardingContext | null>(null);

export function WizardProvider({
  value,
  children,
}: {
  value: OnboardingContext;
  children: React.ReactNode;
}) {
  return <WizardCtx.Provider value={value}>{children}</WizardCtx.Provider>;
}

export function useWizard(): OnboardingContext {
  const ctx = useContext(WizardCtx);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
}
```

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/hooks/useOnboardingWizard.ts apps/web/src/app/onboarding/WizardContext.tsx
git commit -m "refactor(onboarding): rewrite wizard hook and context for 5-step flow"
```

---

## Phase 3: Layout & Shell

### Task 8: Onboarding Shell Component

Create a dashboard-like layout wrapper for the onboarding. Uses the same visual language as `DashboardShell` but with a simplified sidebar showing progress steps.

**Files:**

- Create: `apps/web/src/app/onboarding/components/OnboardingShell.tsx`
- Create: `apps/web/src/app/onboarding/components/OnboardingProgress.tsx`
- Create: `apps/web/src/app/onboarding/components/OnboardingCard.tsx`

**Step 1: Create OnboardingProgress (sidebar step indicator)**

```typescript
// apps/web/src/app/onboarding/components/OnboardingProgress.tsx
"use client";

import { Check } from "lucide-react";
import { ONBOARDING_STEPS, STEP_LABELS, STEP_INDEX, type OnboardingStep } from "../types";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
}

/** Steps visible in the sidebar (exclude auth and done). */
const VISIBLE_STEPS: OnboardingStep[] = ["business_info", "season", "departments", "contract"];

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  const currentIndex = STEP_INDEX[currentStep];

  return (
    <nav className="flex flex-col gap-1">
      {VISIBLE_STEPS.map((step) => {
        const stepIndex = STEP_INDEX[step];
        const isActive = step === currentStep;
        const isCompleted = currentIndex > stepIndex;
        const stepNumber = VISIBLE_STEPS.indexOf(step) + 1;

        return (
          <div
            key={step}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : isCompleted
                  ? "text-muted-foreground"
                  : "text-muted-foreground/50"
            }`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isCompleted
                  ? "bg-primary text-primary-foreground"
                  : isActive
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground/50"
              }`}
            >
              {isCompleted ? <Check size={14} /> : stepNumber}
            </div>
            <span>{STEP_LABELS[step]}</span>
          </div>
        );
      })}
    </nav>
  );
}
```

**Step 2: Create OnboardingCard (reusable card wrapper)**

```typescript
// apps/web/src/app/onboarding/components/OnboardingCard.tsx
"use client";

interface OnboardingCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function OnboardingCard({ title, description, children }: OnboardingCardProps) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
```

**Step 3: Create OnboardingShell (layout wrapper)**

```typescript
// apps/web/src/app/onboarding/components/OnboardingShell.tsx
"use client";

import { OnboardingProgress } from "./OnboardingProgress";
import type { OnboardingStep } from "../types";

interface OnboardingShellProps {
  currentStep: OnboardingStep;
  children: React.ReactNode;
}

export function OnboardingShell({ currentStep, children }: OnboardingShellProps) {
  // Auth and done steps render without the sidebar
  const showSidebar = currentStep !== "auth" && currentStep !== "done";

  if (!showSidebar) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-6 lg:block">
        <div className="mb-8">
          <h2 className="text-lg font-bold text-foreground">Oppsett</h2>
          <p className="mt-1 text-xs text-muted-foreground">Sett opp arbeidsplassen din</p>
        </div>
        <OnboardingProgress currentStep={currentStep} />
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col">
        {/* Mobile progress (top bar) */}
        <div className="border-b border-border bg-card px-4 py-3 lg:hidden">
          <OnboardingProgress currentStep={currentStep} />
        </div>

        <div className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/web/src/app/onboarding/components/
git commit -m "feat(onboarding): add dashboard-style shell, progress sidebar, and card components"
```

---

## Phase 4: Step Components

### Task 9: AuthStep (Sign Up)

Adapt the existing AuthStep for the new flow. Minimal changes — just update the routing (goes to `business_info` instead of `org_verification`).

**Files:**

- Modify: `apps/web/src/app/onboarding/steps/AuthStep.tsx`

**Step 1: Update AuthStep**

Read the existing `AuthStep.tsx` and update it to:

1. Import from the new types
2. Route to `business_info` on success instead of `org_verification`
3. Check if already authenticated → skip to `business_info`

The auth UI itself stays the same (email+password form, sign up logic).

Key change in the auth success handler:

```typescript
// Old: wizard.goTo("org_verification")
// New: wizard.goTo("business_info")
```

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit src/app/onboarding/steps/AuthStep.tsx 2>&1 | head -10`

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/steps/AuthStep.tsx
git commit -m "refactor(onboarding): update AuthStep routing for 5-step flow"
```

---

### Task 10: BusinessInfoStep

The core step. Combines URL input + Brreg lookup + data review into one card. Uses `gather-workspace-intelligence` for scraping and `lookup-brreg` for Brønnøysund data.

**Files:**

- Create: `apps/web/src/app/onboarding/steps/BusinessInfoStep.tsx`

**Step 1: Write the component**

```typescript
// apps/web/src/app/onboarding/steps/BusinessInfoStep.tsx
"use client";

import { useState } from "react";
import { Globe, Building2, Loader2, Pencil, ArrowRight, Check } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useWizard } from "../WizardContext";
import { OnboardingCard } from "../components/OnboardingCard";
import { mergeBusinessData, type ScrapedData, type BrregData } from "../lib/data-merger";
import type { MergedBusinessData } from "../lib/data-merger";

type InputMode = "url" | "org";

export function BusinessInfoStep() {
  const wizard = useWizard();
  const supabase = createClient();

  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [urlInput, setUrlInput] = useState(wizard.data.sourceUrl || "");
  const [orgInput, setOrgInput] = useState(wizard.data.orgNumber || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields for review card
  const [editableData, setEditableData] = useState<MergedBusinessData | null>(
    wizard.data.business,
  );

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchError("");

    try {
      let scraped: ScrapedData | null = null;
      let brreg: BrregData | null = null;

      // Scrape website if URL provided
      if (urlInput.trim()) {
        const { data, error } = await supabase.functions.invoke(
          "gather-workspace-intelligence",
          { body: { url: urlInput.trim(), orgNumber: orgInput.replace(/\D/g, "") || undefined } },
        );
        if (error) throw new Error("Kunne ikke hente informasjon fra nettstedet.");
        scraped = data?.scrapedData ?? null;
        brreg = data?.brregData ?? null;
      }

      // If org number provided but no brreg data yet, look it up directly
      const cleanOrg = orgInput.replace(/\D/g, "");
      if (cleanOrg.length === 9 && !brreg) {
        const { data, error } = await supabase.functions.invoke("lookup-brreg", {
          body: { orgNumber: cleanOrg },
        });
        if (!error && data?.data) {
          brreg = data.data;
        }
      }

      if (!scraped && !brreg) {
        throw new Error("Fant ingen informasjon. Sjekk URL-en eller organisasjonsnummeret.");
      }

      const merged = mergeBusinessData(scraped, brreg);
      setEditableData(merged);

      wizard.updateData({
        business: merged,
        sourceUrl: urlInput.trim(),
        orgNumber: cleanOrg || merged.orgNumber,
      });
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "En feil oppstod.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (editableData) {
      wizard.updateData({ business: editableData });
    }
    wizard.goTo("season");
  };

  const handleSkip = () => {
    wizard.goTo("season");
  };

  // Input view (URL or org number entry)
  if (!editableData) {
    return (
      <OnboardingCard
        title="Fortell oss om bedriften din"
        description="Vi henter informasjon automatisk fra nettsiden din eller Brønnøysundregistrene."
      >
        {/* Tab toggle */}
        <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setInputMode("url")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              inputMode === "url"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Nettside
          </button>
          <button
            onClick={() => setInputMode("org")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              inputMode === "org"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Org.nr
          </button>
        </div>

        {inputMode === "url" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Globe size={16} className="shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">https://</span>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value.replace(/^https?:\/\//i, ""))}
                placeholder="din-nettside.no"
                className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Org.nr (valgfritt)
              </label>
              <input
                type="text"
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                placeholder="123 456 789"
                maxLength={11}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
              <Building2 size={16} className="shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                placeholder="Organisasjonsnummer (9 siffer)"
                maxLength={11}
                className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Nettside (valgfritt)
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value.replace(/^https?:\/\//i, ""))}
                placeholder="din-nettside.no"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              />
            </div>
          </div>
        )}

        {searchError && (
          <p className="mt-3 text-sm text-destructive">{searchError}</p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            onClick={handleSkip}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Hopp over
          </button>
          <button
            onClick={handleSearch}
            disabled={isSearching || (!urlInput.trim() && orgInput.replace(/\D/g, "").length < 9)}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSearching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Søker...
              </>
            ) : (
              <>
                Søk <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </OnboardingCard>
    );
  }

  // Review view (data found)
  return (
    <OnboardingCard
      title="Vi fant bedriften din"
      description="Kontroller at informasjonen stemmer."
    >
      {isEditing ? (
        <EditableBusinessFields
          data={editableData}
          onChange={setEditableData}
          onDone={() => setIsEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <BusinessField label="Bedriftsnavn" value={editableData.name} />
          <BusinessField
            label="Adresse"
            value={`${editableData.address}, ${editableData.postalCode} ${editableData.city}`}
          />
          {editableData.phone && <BusinessField label="Telefon" value={editableData.phone} />}
          {editableData.email && <BusinessField label="E-post" value={editableData.email} />}
          {editableData.naceDescription && (
            <BusinessField label="Bransje" value={editableData.naceDescription} />
          )}
          {editableData.summary && (
            <BusinessField label="Beskrivelse" value={editableData.summary} />
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil size={14} /> Rediger
          </button>
        )}
        <button
          onClick={handleConfirm}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Check size={16} /> Ser riktig ut
        </button>
      </div>
    </OnboardingCard>
  );
}

// --- Sub-components ---

function BusinessField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function EditableBusinessFields({
  data,
  onChange,
  onDone,
}: {
  data: MergedBusinessData;
  onChange: (data: MergedBusinessData) => void;
  onDone: () => void;
}) {
  const update = (field: keyof MergedBusinessData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <EditField label="Bedriftsnavn" value={data.name} onChange={(v) => update("name", v)} />
      <EditField label="Adresse" value={data.address} onChange={(v) => update("address", v)} />
      <div className="grid grid-cols-2 gap-3">
        <EditField
          label="Postnummer"
          value={data.postalCode}
          onChange={(v) => update("postalCode", v)}
        />
        <EditField label="Sted" value={data.city} onChange={(v) => update("city", v)} />
      </div>
      <EditField label="Telefon" value={data.phone} onChange={(v) => update("phone", v)} />
      <EditField label="E-post" value={data.email} onChange={(v) => update("email", v)} />
      <EditField
        label="Beskrivelse"
        value={data.summary}
        onChange={(v) => update("summary", v)}
        multiline
      />
      <button
        onClick={onDone}
        className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
      >
        <Check size={14} /> Ferdig med redigering
      </button>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const className =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className={className} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </div>
  );
}
```

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit src/app/onboarding/steps/BusinessInfoStep.tsx 2>&1 | head -10`

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/steps/BusinessInfoStep.tsx
git commit -m "feat(onboarding): add BusinessInfoStep with URL/org search, data review, and inline editing"
```

---

### Task 11: SeasonStep

Simplified season setup — pre-filled from date/industry, optional revenue/margin fields.

**Files:**

- Create: `apps/web/src/app/onboarding/steps/SeasonStep.tsx`

**Step 1: Write the component**

```typescript
// apps/web/src/app/onboarding/steps/SeasonStep.tsx
"use client";

import { useEffect } from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useWizard } from "../WizardContext";
import { OnboardingCard } from "../components/OnboardingCard";
import { suggestSeason } from "../lib/season-suggestions";

export function SeasonStep() {
  const wizard = useWizard();

  // Pre-fill season suggestion on mount (only if empty)
  useEffect(() => {
    if (!wizard.data.seasonName) {
      const suggestion = suggestSeason();
      wizard.updateData({
        seasonName: suggestion.name,
        seasonStartDate: suggestion.startDate,
        seasonEndDate: suggestion.endDate,
      });
    }
  }, []);

  const handleNext = () => {
    wizard.goTo("departments");
  };

  const handleSkip = () => {
    // Clear season data — activate_workspace_v3 will create "Standard drift" default
    wizard.updateData({
      seasonName: "",
      seasonStartDate: "",
      seasonEndDate: "",
      expectedRevenue: "",
      targetMargin: "",
    });
    wizard.goTo("departments");
  };

  return (
    <OnboardingCard
      title="Sett opp din første sesong"
      description="Smartout bruker sesonger for å organisere drift, mål og bemanning i perioder."
    >
      <div className="space-y-5">
        {/* Season name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Sesongnavn</label>
          <input
            type="text"
            value={wizard.data.seasonName}
            onChange={(e) => wizard.updateData({ seasonName: e.target.value })}
            placeholder="f.eks. Vår 2026"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Foreslått basert på dagens dato
          </p>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Startdato</label>
            <input
              type="date"
              value={wizard.data.seasonStartDate}
              onChange={(e) => wizard.updateData({ seasonStartDate: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Sluttdato</label>
            <input
              type="date"
              value={wizard.data.seasonEndDate}
              onChange={(e) => wizard.updateData({ seasonEndDate: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Revenue + Margin (optional) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Forventet omsetning
              <span className="ml-1 text-xs font-normal text-muted-foreground">(valgfritt)</span>
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-3">
              <span className="text-sm text-muted-foreground">kr</span>
              <input
                type="number"
                value={wizard.data.expectedRevenue}
                onChange={(e) => wizard.updateData({ expectedRevenue: e.target.value })}
                placeholder="0"
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Ønsket bunnlinje
              <span className="ml-1 text-xs font-normal text-muted-foreground">(valgfritt)</span>
            </label>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-3">
              <input
                type="number"
                value={wizard.data.targetMargin}
                onChange={(e) => wizard.updateData({ targetMargin: e.target.value })}
                placeholder="0"
                className="flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          onClick={() => wizard.goTo("business_info")}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> Tilbake
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Hopp over
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Neste <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </OnboardingCard>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/onboarding/steps/SeasonStep.tsx
git commit -m "feat(onboarding): add SeasonStep with pre-filled dates and optional revenue/margin"
```

---

### Task 12: DepartmentsStep (Pre-Selected Chips)

Simplified department selection. Pre-selects defaults based on industry, shows as toggle chips.

**Files:**

- Create: `apps/web/src/app/onboarding/steps/DepartmentsStep.tsx` (new file — old one will be removed)

Note: This replaces the old `DepartmentsStep.tsx`. Rename the old one first:

```bash
mv apps/web/src/app/onboarding/steps/DepartmentsStep.tsx apps/web/src/app/onboarding/steps/DepartmentsStep.old.tsx
```

**Step 1: Write the component**

```typescript
// apps/web/src/app/onboarding/steps/DepartmentsStep.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, X } from "lucide-react";
import { useWizard } from "../WizardContext";
import { OnboardingCard } from "../components/OnboardingCard";
import {
  getDefaultDepartments,
  getDefaultPositions,
  type IndustryType,
  type DefaultDepartment,
} from "../lib/industry-defaults";
import type { SelectedDepartment } from "../types";

export function DepartmentsStep() {
  const wizard = useWizard();
  const industry: IndustryType = wizard.data.business?.industry ?? "other";
  const defaults = getDefaultDepartments(industry);

  const [customDeptName, setCustomDeptName] = useState("");

  // Pre-select default departments on mount if none selected yet
  useEffect(() => {
    if (wizard.data.selectedDepartments.length === 0) {
      const preSelected = defaults
        .filter((d) => d.isDefault)
        .map((d) => ({
          name: d.name,
          description: d.description,
          positions: getDefaultPositions(d.name),
        }));
      wizard.updateData({ selectedDepartments: preSelected });
    }
  }, []);

  const isSelected = (name: string) =>
    wizard.data.selectedDepartments.some((d) => d.name === name);

  const toggleDepartment = (dept: DefaultDepartment) => {
    if (isSelected(dept.name)) {
      wizard.updateData({
        selectedDepartments: wizard.data.selectedDepartments.filter(
          (d) => d.name !== dept.name,
        ),
      });
    } else {
      wizard.updateData({
        selectedDepartments: [
          ...wizard.data.selectedDepartments,
          {
            name: dept.name,
            description: dept.description,
            positions: getDefaultPositions(dept.name),
          },
        ],
      });
    }
  };

  const addCustomDepartment = () => {
    const name = customDeptName.trim();
    if (!name || isSelected(name)) return;
    wizard.updateData({
      selectedDepartments: [
        ...wizard.data.selectedDepartments,
        { name, description: "", positions: [] },
      ],
    });
    setCustomDeptName("");
  };

  const removeCustomDepartment = (name: string) => {
    wizard.updateData({
      selectedDepartments: wizard.data.selectedDepartments.filter(
        (d) => d.name !== name,
      ),
    });
  };

  const handleNext = () => {
    wizard.goTo("contract");
  };

  // Split defaults into primary (pre-selected) and secondary (suggestions)
  const primaryDefaults = defaults.filter((d) => d.isDefault);
  const secondaryDefaults = defaults.filter((d) => !d.isDefault);

  // Custom departments that aren't in the defaults
  const customDepts = wizard.data.selectedDepartments.filter(
    (d) => !defaults.some((def) => def.name === d.name),
  );

  return (
    <OnboardingCard
      title="Avdelinger"
      description={
        industry !== "other"
          ? `Basert på at dere er en ${industry} foreslår vi disse avdelingene.`
          : "Velg avdelingene som passer for din bedrift."
      }
    >
      {/* Primary department chips */}
      <div className="flex flex-wrap gap-2">
        {primaryDefaults.map((dept) => (
          <DepartmentChip
            key={dept.name}
            name={dept.name}
            isSelected={isSelected(dept.name)}
            onClick={() => toggleDepartment(dept)}
          />
        ))}
        {/* Custom departments */}
        {customDepts.map((dept) => (
          <DepartmentChip
            key={dept.name}
            name={dept.name}
            isSelected={true}
            onClick={() => removeCustomDepartment(dept.name)}
            removable
          />
        ))}
      </div>

      {/* Secondary suggestions */}
      {secondaryDefaults.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
            Andre forslag
          </p>
          <div className="flex flex-wrap gap-2">
            {secondaryDefaults
              .filter((d) => !isSelected(d.name))
              .map((dept) => (
                <button
                  key={dept.name}
                  onClick={() => toggleDepartment(dept)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  <Plus size={12} /> {dept.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Add custom */}
      <div className="mt-5">
        <div className="flex gap-2">
          <input
            type="text"
            value={customDeptName}
            onChange={(e) => setCustomDeptName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomDepartment()}
            placeholder="Legg til egen avdeling..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
          />
          <button
            onClick={addCustomDepartment}
            disabled={!customDeptName.trim()}
            className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Selected count */}
      <p className="mt-4 text-xs text-muted-foreground">
        {wizard.data.selectedDepartments.length} avdeling
        {wizard.data.selectedDepartments.length !== 1 ? "er" : ""} valgt
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          onClick={() => wizard.goTo("season")}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> Tilbake
        </button>
        <button
          onClick={handleNext}
          disabled={wizard.data.selectedDepartments.length === 0}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Bekreft avdelinger <ArrowRight size={16} />
        </button>
      </div>
    </OnboardingCard>
  );
}

function DepartmentChip({
  name,
  isSelected,
  onClick,
  removable,
}: {
  name: string;
  isSelected: boolean;
  onClick: () => void;
  removable?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        isSelected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {name}
      {removable && isSelected && <X size={12} className="ml-1" />}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/onboarding/steps/DepartmentsStep.tsx
git commit -m "feat(onboarding): add DepartmentsStep with industry-based pre-selection and toggle chips"
```

---

### Task 13: ContractStep

Final setup step — generates a contract template and shows a summary. This calls finalize when confirmed.

**Files:**

- Create: `apps/web/src/app/onboarding/steps/ContractStep.tsx`

**Step 1: Write the component**

```typescript
// apps/web/src/app/onboarding/steps/ContractStep.tsx
"use client";

import { ArrowLeft, FileText, Loader2, Check, ChevronRight } from "lucide-react";
import { useWizard } from "../WizardContext";
import { OnboardingCard } from "../components/OnboardingCard";

export function ContractStep() {
  const wizard = useWizard();
  const businessName = wizard.data.business?.name ?? "din bedrift";

  const handleFinalize = async () => {
    await wizard.finalize();
  };

  return (
    <OnboardingCard
      title="Kontraktmal"
      description="Vi har laget en kontraktmal basert på norsk lov og din bedrift."
    >
      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Arbeidskontrakt — {businessName}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Arbeidsmiljøloven §14-5/14-6
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                <Check size={10} /> Norsk lovverk
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                Merge fields: navn, stilling, lønn
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Du kan tilpasse kontraktmalen når som helst i innstillingene.
        Klar for digital signering via DocuSeal.
      </p>

      {wizard.error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {wizard.error}
        </div>
      )}

      {/* Summary of what will be created */}
      <div className="mt-6 rounded-lg border border-border p-4">
        <h4 className="mb-3 text-xs font-bold text-muted-foreground uppercase">
          Oppsummering
        </h4>
        <dl className="space-y-2 text-sm">
          {wizard.data.business?.name && (
            <SummaryRow label="Bedrift" value={wizard.data.business.name} />
          )}
          {wizard.data.seasonName && (
            <SummaryRow label="Sesong" value={wizard.data.seasonName} />
          )}
          <SummaryRow
            label="Avdelinger"
            value={
              wizard.data.selectedDepartments.map((d) => d.name).join(", ") || "Ingen"
            }
          />
          <SummaryRow
            label="Stillinger"
            value={`${wizard.data.selectedDepartments.reduce(
              (sum, d) => sum + d.positions.length,
              0,
            )} opprettet`}
          />
        </dl>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
        <button
          onClick={() => wizard.goTo("departments")}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> Tilbake
        </button>
        <button
          onClick={handleFinalize}
          disabled={wizard.isLoading}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {wizard.isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Setter opp...
            </>
          ) : (
            <>
              Fullfør oppsett <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </OnboardingCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/onboarding/steps/ContractStep.tsx
git commit -m "feat(onboarding): add ContractStep with template preview and setup summary"
```

---

### Task 14: DoneStep (Post-Onboarding Landing)

Shows what was created and provides next-step guidance. Redirects to the workspace dashboard.

**Files:**

- Create: `apps/web/src/app/onboarding/steps/DoneStep.tsx` (new — replaces old)

**Step 1: Write the component**

```typescript
// apps/web/src/app/onboarding/steps/DoneStep.tsx
"use client";

import { useRouter } from "next/navigation";
import { Check, ArrowRight, Users, Calendar, ClipboardCheck } from "lucide-react";
import { useWizard } from "../WizardContext";

export function DoneStep() {
  const wizard = useWizard();
  const router = useRouter();
  const businessName = wizard.data.business?.name ?? "arbeidsplassen";

  const handleGoToDashboard = () => {
    if (wizard.activatedWorkspaceSlug) {
      // Redirect to workspace dashboard via subdomain
      const dashboardUrl =
        process.env.NODE_ENV === "development"
          ? `http://${wizard.activatedWorkspaceSlug}.localhost:3050/dashboard`
          : `https://${wizard.activatedWorkspaceSlug}.smartout.ai/dashboard`;
      window.location.href = dashboardUrl;
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg text-center">
      {/* Success icon */}
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
        <Check size={32} className="text-green-500" />
      </div>

      <h1 className="mb-2 text-2xl font-bold text-foreground">
        {businessName} er klar!
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Alt er satt opp. Her er en oversikt over det vi opprettet.
      </p>

      {/* Summary */}
      <div className="mb-8 rounded-xl border border-border bg-card p-6 text-left">
        <dl className="space-y-3 text-sm">
          {wizard.data.seasonName && (
            <SummaryItem label="Sesong" value={`${wizard.data.seasonName} (aktiv)`} />
          )}
          <SummaryItem
            label="Avdelinger"
            value={wizard.data.selectedDepartments.map((d) => d.name).join(", ")}
          />
          <SummaryItem
            label="Stillinger"
            value={`${wizard.data.selectedDepartments.reduce(
              (sum, d) => sum + d.positions.length,
              0,
            )} opprettet`}
          />
          <SummaryItem label="Kontraktmal" value="Klar" />
        </dl>
      </div>

      {/* Next steps */}
      <div className="mb-8 space-y-3 text-left">
        <p className="text-xs font-bold text-muted-foreground uppercase">Neste steg</p>
        <NextStepItem icon={Users} label="Inviter ansatte" />
        <NextStepItem icon={Calendar} label="Sett opp vaktplan" />
        <NextStepItem icon={ClipboardCheck} label="Konfigurer rutiner" />
      </div>

      <button
        onClick={handleGoToDashboard}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Gå til dashboard <ArrowRight size={16} />
      </button>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function NextStepItem({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <Icon size={16} className="text-muted-foreground" />
      <span className="text-sm text-foreground">{label}</span>
      <ArrowRight size={14} className="ml-auto text-muted-foreground" />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/app/onboarding/steps/DoneStep.tsx
git commit -m "feat(onboarding): add DoneStep with setup summary and dashboard redirect"
```

---

### Task 15: Main Page — Step Router

Rewrite `page.tsx` to render the new 5-step flow inside the OnboardingShell.

**Files:**

- Modify: `apps/web/src/app/onboarding/page.tsx`

**Step 1: Rewrite page.tsx**

```typescript
// apps/web/src/app/onboarding/page.tsx
"use client";

import { useOnboardingWizard } from "./hooks/useOnboardingWizard";
import { WizardProvider } from "./WizardContext";
import { OnboardingShell } from "./components/OnboardingShell";
import { AuthStep } from "./steps/AuthStep";
import { BusinessInfoStep } from "./steps/BusinessInfoStep";
import { SeasonStep } from "./steps/SeasonStep";
import { DepartmentsStep } from "./steps/DepartmentsStep";
import { ContractStep } from "./steps/ContractStep";
import { DoneStep } from "./steps/DoneStep";
import type { OnboardingStep } from "./types";

const STEP_COMPONENTS: Record<OnboardingStep, React.ComponentType> = {
  auth: AuthStep,
  business_info: BusinessInfoStep,
  season: SeasonStep,
  departments: DepartmentsStep,
  contract: ContractStep,
  done: DoneStep,
};

export default function OnboardingPage() {
  const wizard = useOnboardingWizard();
  const StepComponent = STEP_COMPONENTS[wizard.step];

  return (
    <WizardProvider value={wizard}>
      <OnboardingShell currentStep={wizard.step}>
        <StepComponent />
      </OnboardingShell>
    </WizardProvider>
  );
}
```

**Step 2: Verify the page compiles**

Run: `cd apps/web && npx tsc --noEmit src/app/onboarding/page.tsx 2>&1 | head -20`

**Step 3: Commit**

```bash
git add apps/web/src/app/onboarding/page.tsx
git commit -m "refactor(onboarding): rewrite page.tsx as 5-step router with OnboardingShell"
```

---

## Phase 5: Cleanup & Integration

### Task 16: Remove Old Step Components

Delete the step components that are no longer used. Keep old files as `.old.tsx` during development, delete them after confirmation.

**Files to delete (old steps no longer in the flow):**

- `apps/web/src/app/onboarding/steps/InitStep.tsx`
- `apps/web/src/app/onboarding/steps/CrawlStep.tsx`
- `apps/web/src/app/onboarding/steps/OrgVerificationStep.tsx`
- `apps/web/src/app/onboarding/steps/BrandingStep.tsx`
- `apps/web/src/app/onboarding/steps/SeasonEducationStep.tsx`
- `apps/web/src/app/onboarding/steps/SeasonIdentityStep.tsx`
- `apps/web/src/app/onboarding/steps/TeamsStep.tsx`
- `apps/web/src/app/onboarding/steps/LocationsStep.tsx`
- `apps/web/src/app/onboarding/steps/ProceduresStep.tsx`
- `apps/web/src/app/onboarding/steps/BattlefieldReviewStep.tsx`
- `apps/web/src/app/onboarding/steps/FinalizeStep.tsx`
- `apps/web/src/app/onboarding/steps/InviteStep.tsx`
- `apps/web/src/app/onboarding/steps/DepartmentsStep.old.tsx` (if created in Task 12)
- `apps/web/src/app/onboarding/StepProgress.tsx`
- `apps/web/src/app/onboarding/drawers/DepartmentDrawer.tsx`
- `apps/web/src/app/onboarding/drawers/LocationDrawer.tsx`
- `apps/web/src/app/onboarding/drawers/TeamDrawer.tsx`
- `apps/web/src/app/onboarding/drawers/ProcedureDrawer.tsx`

**Step 1: Delete old files**

```bash
rm apps/web/src/app/onboarding/steps/InitStep.tsx
rm apps/web/src/app/onboarding/steps/CrawlStep.tsx
rm apps/web/src/app/onboarding/steps/OrgVerificationStep.tsx
rm apps/web/src/app/onboarding/steps/BrandingStep.tsx
rm apps/web/src/app/onboarding/steps/SeasonEducationStep.tsx
rm apps/web/src/app/onboarding/steps/SeasonIdentityStep.tsx
rm apps/web/src/app/onboarding/steps/TeamsStep.tsx
rm apps/web/src/app/onboarding/steps/LocationsStep.tsx
rm apps/web/src/app/onboarding/steps/ProceduresStep.tsx
rm apps/web/src/app/onboarding/steps/BattlefieldReviewStep.tsx
rm apps/web/src/app/onboarding/steps/FinalizeStep.tsx
rm apps/web/src/app/onboarding/steps/InviteStep.tsx
rm -f apps/web/src/app/onboarding/steps/DepartmentsStep.old.tsx
rm apps/web/src/app/onboarding/StepProgress.tsx
rm -r apps/web/src/app/onboarding/drawers/
```

**Step 2: Verify no import errors**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -30`
Fix any remaining imports referencing deleted files.

**Step 3: Commit**

```bash
git add -u apps/web/src/app/onboarding/
git commit -m "refactor(onboarding): remove old 15-step wizard components and drawers"
```

---

### Task 17: Update activate-workspace for New Data Shape

The `activate_workspace_v3` RPC needs to handle the new fields: `orgNumber`, `expectedRevenue`, `targetMargin`. The Edge Function wrapper is thin — the changes are in the RPC.

**Files:**

- Modify: `supabase/functions/activate-workspace/index.ts` (pass through new fields)
- Create: `supabase/migrations/YYYYMMDDHHMMSS_update_activate_workspace_v3.sql` (update RPC)

**Step 1: Check the current activate_workspace_v3 RPC**

Read the RPC definition in the migrations folder:

```bash
grep -r "activate_workspace_v3" supabase/migrations/ --include="*.sql" -l
```

Then read the file to understand the current parameters and what to add.

**Step 2: Create migration to update the RPC**

The RPC needs to:

1. Accept `orgNumber` from `p_data` and write to `company.org_number`
2. Pass `expectedRevenue` and `targetMargin` to the season INSERT
3. Write `company.nace_code`, `company.nace_description`, `company.industry` from the data

Write a migration that `CREATE OR REPLACE FUNCTION activate_workspace_v3` with the additional field handling.

**Step 3: Apply and regenerate types**

```bash
npx supabase db reset
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

**Step 4: Commit**

```bash
git add supabase/migrations/*_update_activate_workspace_v3.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): update activate_workspace_v3 RPC to handle org number, revenue, and margin"
```

---

### Task 18: Typecheck & Polish

Full typecheck, fix any remaining issues, test the flow end-to-end.

**Step 1: Run full typecheck**

Run: `cd /home/sxtnl/dev/smartout.ai && pnpm turbo typecheck`
Expected: 0 errors.
If errors: fix them. Common issues will be old imports or missing type updates.

**Step 2: Run unit tests**

Run: `cd apps/web && pnpm vitest run`
Expected: All tests pass (industry-defaults, season-suggestions, data-merger, plus existing subdomain test).

**Step 3: Run lint**

Run: `pnpm lint`
Fix any lint issues.

**Step 4: Manual smoke test**

Start the dev server:

```bash
pnpm --filter web dev
```

Navigate to `http://localhost:3050/onboarding` and verify:

1. Auth step renders
2. After auth, business info step shows with URL/org tabs
3. Season step pre-fills dates
4. Departments step shows industry-based chips
5. Contract step shows summary
6. Finalize → Done step with redirect

**Step 5: Commit**

```bash
git add -A
git commit -m "chore(onboarding): fix typecheck and lint issues after redesign"
```

---

## Task Dependency Graph

```
Task 1 (DB migration) ─────────────┐
Task 2 (industry defaults) ────────┤
Task 3 (season suggestions) ───────┤
Task 4 (data merger) ──────────────┤
Task 5 (Brreg Edge Function) ──────┤
                                    ▼
                          Task 6 (types) ──────┐
                          Task 7 (hook) ───────┤
                                               ▼
                                    Task 8 (shell + layout) ──┐
                                                              ▼
                                              Task 9  (AuthStep)
                                              Task 10 (BusinessInfoStep)
                                              Task 11 (SeasonStep)
                                              Task 12 (DepartmentsStep)
                                              Task 13 (ContractStep)
                                              Task 14 (DoneStep)
                                              Task 15 (page.tsx router)
                                                              │
                                                              ▼
                                              Task 16 (delete old steps)
                                              Task 17 (update activate_workspace_v3)
                                              Task 18 (typecheck + polish)
```

**Tasks 1-5 can run in parallel** (no interdependencies).
**Tasks 6-7** depend on Task 2 (industry-defaults) and Task 4 (data-merger) for type imports.
**Task 8** depends on Task 6 (new types).
**Tasks 9-15** depend on Tasks 6-8.
**Tasks 16-18** depend on Tasks 9-15.

---

## Open Questions for Pontus (before execution)

1. **Scroll-based vs. step-based?** This plan uses step-based for V1. Confirm OK?
2. **Contract step — keep or defer?** Step 5 generates a contract template before any employees exist. Is this useful, or should we move it to when the admin first invites someone? If deferred, we go from 5 steps to 4.
3. **Mr. Botsson toggle?** Should there be a "Vil du ha hjelp av Mr. Botsson?" toggle in the UI? Not included in this plan — can be a follow-up.
4. **Invitation step removed?** The old wizard had an invite step. This plan removes it from onboarding (invitation happens from the dashboard). Confirm OK?
5. **Auth step location?** Currently renders at `/onboarding`. Should it stay there, or should signup happen on the landing page before entering `/onboarding`?
