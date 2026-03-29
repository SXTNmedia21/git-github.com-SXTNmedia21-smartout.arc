// ============================================
// onboarding-shell.ts
// Builds provisional onboarding shell data for
// the /join -> /onboarding handoff.
// Why: /join collects raw intake, while
// /onboarding owns final workspace truth.
// ============================================

const INDUSTRY_NACE_MAP: Record<string, string> = {
  restaurant: "56.101",
  cafe: "56.102",
  bar: "56.301",
  hotel: "55.101",
  catering: "56.210",
  fast_food: "56.102",
  retail: "47.110",
  other: "",
};

function resolveNaceFromIndustry(industry: string): string {
  return INDUSTRY_NACE_MAP[industry] ?? "";
}

export type SignupSetupData = {
  step1: {
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    industry: string;
    city?: string;
    websiteUrl: string;
  };
  step2: {
    street: string;
    postalCode: string;
    city: string;
    orgNumber: string;
  };
  step3: { aboutUs?: string; ourHistory?: string; ourConcept?: string };
  step4: {
    openingHours: Array<{
      dayOfWeek: number;
      isClosed: boolean;
      openTime?: string;
      closeTime?: string;
    }>;
    phone: string;
    instagram?: string;
    facebook?: string;
  };
  step5: {
    restaurantType?: string;
    cuisineTypes?: string[];
    priceCategory?: string;
    menuDescription?: string;
  };
  step6: { employeeCount?: string; teamInvites?: string[] };
  intelligence?: Record<string, unknown> | null;
};

type OpeningHourRow = SignupSetupData["step4"]["openingHours"][number];

/**
 * Builds the intelligence payload stored on a provisional onboarding workspace.
 * Why: /onboarding resumes from `workspace.intelligence_data`, so /join needs
 * to persist enough context for that flow without claiming runtime ownership.
 *
 * @returns A provisional shell payload for `provision_onboarding_workspace`
 */
export function buildOnboardingShellIntelligence(data: SignupSetupData) {
  return {
    source_url: data.step1.websiteUrl,
    pipeline_completed_at: new Date().toISOString(),
    scraped: {
      companyName: data.step1.companyName,
      email: data.step1.email,
      phone: data.step4.phone,
      summary: data.step3.aboutUs ?? data.step3.ourConcept ?? "",
      openingHours: formatOpeningHours(data.step4.openingHours),
      socialLinks: {
        ...(data.step4.instagram ? { instagram: data.step4.instagram } : {}),
        ...(data.step4.facebook ? { facebook: data.step4.facebook } : {}),
      },
    },
    brreg: {
      legalName: data.step1.companyName,
      orgNumber: data.step2.orgNumber,
      naceCode: resolveNaceFromIndustry(data.step1.industry),
      naceDescription: data.step1.industry,
      address: {
        street: data.step2.street,
        postalCode: data.step2.postalCode,
        city: data.step2.city,
      },
      employeeCount: parseEmployeeCount(data.step6.employeeCount),
    },
    join_intake: {
      ownerProfile: {
        firstName: data.step1.firstName,
        lastName: data.step1.lastName,
      },
      businessNarrative: {
        aboutUs: data.step3.aboutUs ?? "",
        ourHistory: data.step3.ourHistory ?? "",
        ourConcept: data.step3.ourConcept ?? "",
      },
      menu: {
        restaurantType: data.step5.restaurantType ?? "",
        cuisineTypes: data.step5.cuisineTypes ?? [],
        priceCategory: data.step5.priceCategory ?? "",
        menuDescription: data.step5.menuDescription ?? "",
      },
      team: {
        employeeCount: data.step6.employeeCount ?? "",
        teamInvites: data.step6.teamInvites ?? [],
      },
      rawOpeningHours: data.step4.openingHours,
      generatedIntelligence: data.intelligence ?? null,
      fieldSources: {
        aboutUs: data.intelligence ? "user_confirmed" : "user_input",
        ourHistory: data.intelligence ? "user_confirmed" : "user_input",
        ourConcept: data.intelligence ? "user_confirmed" : "user_input",
        restaurantType: data.intelligence ? "ai_generated" : "user_input",
        cuisineTypes: data.intelligence ? "ai_generated" : "user_input",
        priceCategory: data.intelligence ? "ai_generated" : "user_input",
        menuDescription: data.intelligence ? "ai_generated" : "user_input",
        phone: "user_input",
        email: "user_input",
      },
    },
  };
}

/**
 * Builds the authenticated onboarding destination after /join has created a shell.
 * Why: the next step must continue through `/onboarding`, where final runtime
 * truth is established, instead of skipping straight to dashboard surfaces.
 *
 * @returns A relative path for the next onboarding route
 */
export function buildPostSignupRedirectPath(workspaceId: string): string {
  return `/onboarding?ws=${workspaceId}`;
}

/**
 * Formats raw day rows into a compact summary for provisional intelligence.
 * Why: `mergeBusinessData()` expects a string when resuming business context.
 *
 * @returns A human-readable opening-hours summary
 */
function formatOpeningHours(openingHours: OpeningHourRow[]): string {
  return openingHours
    .map((row) => {
      const dayLabel = DAY_LABELS[row.dayOfWeek] ?? `Day ${row.dayOfWeek}`;
      if (row.isClosed) {
        return `${dayLabel}: closed`;
      }

      const start = row.openTime ?? "--:--";
      const end = row.closeTime ?? "--:--";
      return `${dayLabel}: ${start}-${end}`;
    })
    .join(", ");
}

/**
 * Parses employee count into a number when the user provided one.
 * Why: provisional intelligence should keep typed numeric fields numeric where possible.
 *
 * @returns Parsed employee count, or null when unavailable
 */
function parseEmployeeCount(value?: string): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
