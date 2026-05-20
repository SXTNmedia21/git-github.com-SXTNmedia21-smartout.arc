/**
 * apps/web/src/lib/onboarding/tariff-state.ts
 *
 * Local state shape for the TariffSection onboarding wizard step.
 *
 * The TariffSection asks: is the workspace bound to NHO Reiseliv tariff?
 * If yes → user picks union + law_version → POST /api/payroll/tariff/setup.
 * If no  → mark is_tariff_bound: false, BFF call skipped.
 *
 * Phase 7g: union_id values are now UnionId enum strings
 * ("taro-79" | "taro-226" | "non-bound") per the updated BFF contract
 * (setupTariffRequestSchema.union_id = z.enum([...])).
 * No UUID → taro-ID translation layer required.
 */
import type { UnionId } from "@smartout/types";

// ─── Static union options ─────────────────────────────────────────────────────
// Two unions currently covered by Smartout's Riksavtalen engine (ADR-0355).
// Phase 7g: id field is now UnionId ("taro-79" | "taro-226") — not a UUID.

export interface TariffUnionOption {
  /** UnionId enum value per SetupTariffRequest.union_id (Phase 7g: changed from UUID) */
  id: UnionId;
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
 * Phase 7g: id values changed from UUIDs to enum strings matching the
 * workspace_union_binding.union_id CHECK constraint (ADR-0355).
 * Fellesforbundet (taro-79) covers most Riksavtalen workspaces in NHO Reiseliv.
 * Parat (taro-226) covers hotel and conference sector under Parat overenskomst.
 */
export const TARIFF_UNION_OPTIONS: TariffUnionOption[] = [
  {
    id: "taro-79",
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
    id: "taro-226",
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
  union_id: UnionId;
  law_version: string;
}

/** Full tariff section state — embedded in OnboardingConfirmState.tariff */
export interface TariffSectionState {
  /** null = not decided yet, true = member (Ja), false = not member (Nei) */
  isMember: boolean | null;
  /** Selected UnionId enum value (from TARIFF_UNION_OPTIONS) */
  selectedUnionId: UnionId | null;
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
