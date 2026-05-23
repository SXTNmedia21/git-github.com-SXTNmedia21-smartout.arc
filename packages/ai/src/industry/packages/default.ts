import type { BootstrapGateDefinition, IndustryPackage } from "@smartout/types";

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap gates — default/generic industry (6 gates, no hospitality-specific
// Mattilsynet or alcohol gates). Seeded by bootstrap-cascade EF Step 12.
// ADR-0407 Phase 1.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_BOOTSTRAP_GATES: BootstrapGateDefinition[] = [
  {
    gate_slug: "departments_exist",
    required: true,
    suggested_day: 1,
    depends_on: [],
    display_label_no: "Avdelinger opprettet",
    display_label_en: "Departments created",
    description: "Minst én avdeling må eksistere for at vakter og protokoller skal fungere.",
    capability_slug: "org",
  },
  {
    gate_slug: "locations_exist",
    required: true,
    suggested_day: 1,
    depends_on: [],
    display_label_no: "Lokasjoner opprettet",
    display_label_en: "Locations created",
    description: "Fysisk(e) lokasjon(er) for vaktplanlegging.",
    capability_slug: "org",
  },
  {
    gate_slug: "regulatory_framework_bound",
    required: true,
    suggested_day: 2,
    depends_on: [],
    display_label_no: "Regelverk valgt",
    display_label_en: "Regulatory framework bound",
    description:
      "Bind workspace til et rammeverk (f.eks. Funksjonæroverenskomsten). Driver §-håndhevelse.",
    capability_slug: "payroll",
  },
  {
    gate_slug: "owner_contract_active",
    required: true,
    suggested_day: 2,
    depends_on: [],
    display_label_no: "Eier-kontrakt aktiv",
    display_label_en: "Owner contract active",
    description: "Workspace-eier må ha aktiv employment_contract for at C4-authority skal stemme.",
    capability_slug: "contract",
  },
  {
    gate_slug: "first_season_active",
    required: true,
    suggested_day: 3,
    depends_on: ["departments_exist"],
    display_label_no: "Første sesong aktiv",
    display_label_en: "First season active",
    description: "Aktiv season påkrevd for vaktplanlegging + budsjett.",
    capability_slug: "season",
  },
  {
    gate_slug: "authority_config_complete",
    required: true,
    suggested_day: 5,
    depends_on: ["owner_contract_active"],
    display_label_no: "C4-authority komplett",
    display_label_en: "C4 authority complete",
    description: "Alle gated capabilities har min_role + four-eyes-policy satt for workspace.",
    capability_slug: "governance",
  },
];

/**
 * Returns bootstrap gate definitions for the default/generic industry.
 * Called by bootstrap-cascade EF Step 12 to seed workspace_bootstrap_gate rows.
 */
export function getBootstrapGates(): BootstrapGateDefinition[] {
  return DEFAULT_BOOTSTRAP_GATES;
}

export const defaultPackage: IndustryPackage = {
  id: "default",
  label: "Standard",

  filterDefaults: {
    food: false,
    alcohol: false,
    overnight: false,
    delivery: false,
  },

  tariffs: [],
  defaultTariffKey: "ingen",

  shiftTemplates: [
    { name: "Morgenvakt", department: "Generell", startTime: "08:00", endTime: "16:00" },
    { name: "Kveldsvakt", department: "Generell", startTime: "16:00", endTime: "00:00" },
  ],

  seasonTemplates: [
    {
      name: "Arsesong",
      startMonth: 1,
      endMonth: 12,
      description: "Hele aret — standard sesong",
    },
  ],

  employmentDefaults: {
    probationMonths: 6,
    vacationDays: 25,
    extraVacationDays: false,
    otpPct: 2,
    employerTaxPct: 14.1,
  },

  botsson: {},

  // No domain taxonomy defined for generic industries — the Phase 2
  // helpdesk classifier treats an empty list as "no domain routing
  // configured" and falls back to a single generic bucket.
  domains: [],
};
