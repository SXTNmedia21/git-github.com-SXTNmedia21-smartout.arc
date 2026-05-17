/**
 * apps/web/src/lib/onboarding/tariff-state.ts
 *
 * Local state shape for the TariffSection onboarding wizard step.
 *
 * The TariffSection asks: is the workspace bound to NHO Reiseliv tariff?
 * If yes → user picks union + law_version → POST /api/payroll/tariff/setup.
 * If no  → mark is_tariff_bound: false, BFF call skipped.
 *
 * union_id values are UUIDs per SetupTariffRequest (payroll-tariff-bff-contract.ts).
 * The BFF translates these to internal taro-* identifiers before calling capability tools.
 * NOTE: These UUIDs must match the lookup table seeded by the BFF (T1 track).
 * Until T1 ships, the BFF route /api/payroll/tariff/setup is not live —
 * the component will receive a network error which it renders as a Norwegian message.
 *
 * Contract gap (non-blocking): setupTariffRequestSchema.union_id = z.string().uuid()
 * but tariff-tools.ts setupWorkspaceTariffSchema.union_id = z.enum(["taro-79","taro-226","non-bound"]).
 * The BFF (T1) owns the UUID→taro-ID translation. This file follows the BFF contract only.
 */

// ─── Static union options ─────────────────────────────────────────────────────
// Two unions currently covered by Smartout's Riksavtalen engine (ADR-0355).
// UUIDs are stable identifiers from the platform union lookup table (K1a).
// Source: taro-79 = Fellesforbundet, taro-226 = Parat.

export interface TariffUnionOption {
  /** UUID per SetupTariffRequest.union_id */
  id: string;
  /** Display name in Norwegian */
  label: string;
  /** Short description shown under the label */
  description: string;
  /** Available law versions for this union, newest first */
  lawVersions: TariffLawVersionOption[];
}

export interface TariffLawVersionOption {
  value: string;
  label: string;
  /** ISO YYYY-MM-DD official effective date (Aml. §14-6) */
  officialEffectiveDate: string;
}

/**
 * Static union list for V1 onboarding.
 *
 * These UUIDs must match the platform K1a union lookup table seeded by migrations.
 * Fellesforbundet (taro-79) covers most Riksavtalen workspaces in NHO Reiseliv.
 * Parat (taro-226) covers hotel and conference sector under Parat overenskomst.
 */
export const TARIFF_UNION_OPTIONS: TariffUnionOption[] = [
  {
    id: "00000000-7900-0000-0000-000000000079",
    label: "Fellesforbundet",
    description: "Riksavtalen — vanligste for restaurant, bar og catering",
    lawVersions: [
      {
        value: "2025",
        label: "2025-satser (gjelder fra 1. april 2025)",
        officialEffectiveDate: "2025-04-01",
      },
      {
        value: "2024",
        label: "2024-satser (gjelder fra 1. april 2024)",
        officialEffectiveDate: "2024-04-01",
      },
    ],
  },
  {
    id: "00000000-2260-0000-0000-000000000226",
    label: "Parat",
    description: "Parat overenskomst — hotell og konferansesektoren",
    lawVersions: [
      {
        value: "2025",
        label: "2025-satser (gjelder fra 1. april 2025)",
        officialEffectiveDate: "2025-04-01",
      },
      {
        value: "2024",
        label: "2024-satser (gjelder fra 1. april 2024)",
        officialEffectiveDate: "2024-04-01",
      },
    ],
  },
];

// ─── Section state ─────────────────────────────────────────────────────────────

/** Submission result stored in wizard state after a successful BFF call */
export interface TariffBindingResult {
  workspace_union_binding_id: string;
  effective_from: string;
  union_id: string;
  law_version: string;
}

/** Full tariff section state — embedded in OnboardingConfirmState.tariff */
export interface TariffSectionState {
  /** null = not decided yet, true = member (Ja), false = not member (Nei) */
  isMember: boolean | null;
  /** Selected union UUID (from TARIFF_UNION_OPTIONS) */
  selectedUnionId: string | null;
  /** Selected law_version string e.g. "2025" */
  selectedLawVersion: string | null;
  /** Step status — idle before any attempt */
  status: "idle" | "submitting" | "success" | "error";
  /** Norwegian error message to display */
  errorMessage: string | null;
  /** Populated on success from BFF response */
  result: TariffBindingResult | null;
}

export const defaultTariffSectionState: TariffSectionState = {
  isMember: null,
  selectedUnionId: null,
  selectedLawVersion: null,
  status: "idle",
  errorMessage: null,
  result: null,
};

// ─── Error code → Norwegian messages (ADR-0152) ───────────────────────────────

/**
 * Map BFF error codes to readable Norwegian messages.
 * MISSING_PROFILE_CONTEXT and TARIFF_ALREADY_BOUND are explicitly required (scope doc).
 */
export function tariffErrorToNorwegian(code: string): string {
  switch (code) {
    case "MISSING_PROFILE_CONTEXT":
      return "Vi fant ikke profil-informasjonen din. Logg inn på nytt og prøv igjen.";
    case "TARIFF_ALREADY_BOUND":
      return "Arbeidsplassen er allerede koblet til en tariff. Gå til Innstillinger → Tariff for å endre.";
    case "INVALID_WORKSPACE":
      return "Ugyldig arbeidsplass. Last siden på nytt og prøv igjen.";
    case "AMENDMENT_BLOCKED":
      return "Tariffendringen ble blokkert av systemet. Kontakt støtte.";
    case "UNAUTHORIZED":
      return "Du har ikke rettigheter til å sette opp tariff. Kontakt administrator.";
    case "RATE_LIMITED":
      return "For mange forsøk. Vent litt og prøv igjen.";
    case "BFF_INTERNAL_ERROR":
    default:
      return "Noe gikk galt på serveren. Prøv igjen eller kontakt støtte.";
  }
}
