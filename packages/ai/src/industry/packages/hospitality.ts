/**
 * Hospitality industry package — canonical I1 bootstrap data.
 *
 * Contains seed defaults for the Norwegian hospitality vertical (Riksavtalen).
 * Runtime truth for tariff rates lives in tariff_rate_table after seeding.
 * This file is the hardcoded fallback (tier 3 in the loader fallback chain).
 *
 * Workspace policy defaults (payroll.workspace_settings) — added Phase 1 (T0.1).
 * These 19 fields are applied by the I1 bootstrap when creating a new workspace.
 * They mirror the columns added in migration <ts>_payroll_phase1_workspace_policies.sql.
 * Source authority: docs/modules/payroll/SORTIE-PHASE-1.md §3.
 */

import type {
  BootstrapGateDefinition,
  Domain,
  IndustryPackage,
  RoleCapabilityProfile,
} from "@smartout/types";

// ========================================
// Cascade seed data — used for bootstrap seeding and hardcoded fallback
// Runtime truth lives in DB tables after seeding
// ========================================

/**
 * Payroll workspace_settings defaults for the hospitality vertical.
 *
 * These 19 fields correspond exactly to the columns added by migration
 * <ts>_payroll_phase1_workspace_policies.sql. Defaults are defensive:
 * no rounding, no forced OT pre-approval, Riksavtalen-safe stacking policy.
 *
 * Source authority: SORTIE-PHASE-1.md §3.
 */
export const HOSPITALITY_PAYROLL_WORKSPACE_SETTINGS_DEFAULTS = {
  // Time-banks
  toil_default_max_banked_hours: 80,
  wellness_days_per_year_default: 0,

  // Dynamic supplements
  supplement_stacking_policy: "category_exclusive" as const,

  // Delt vakt (O12)
  split_shift_threshold_minutes: 0,
  split_shift_allowance_amount: 0,

  // OT authorization — soft warn, never block punch-out (Aml. §10-6 forbids blocking)
  overtime_requires_pre_approval: false,
  overtime_warn_threshold_minutes: 30,

  // Time rounding — 0 = no rounding (Aml. §10-7 actual time recording)
  punch_rounding_minutes: 0,
  punch_rounding_direction: "toward_employee" as const,
  punch_rounding_snap_window_minutes: 10,

  // Punch buffers
  punch_window_early_minutes: 15,
  punch_window_late_minutes: 30,
  punch_grace_after_scheduled_minutes: 60,

  // Forced break reminder — 5 hours (Aml. §10-9 mandates break after 5.5h)
  forced_break_reminder_minutes: 300,

  // Period approval — four-eyes OFF by default
  requires_four_eyes_for_period_approval: false,

  // Manager edit policy — require reason and notify employee
  manager_punch_edit_requires_reason: true,
  manager_punch_edit_notifies_employee: true,

  // Employee dispute policy
  employee_can_dispute_punch: true,
  employee_dispute_window_days: 7,

  // Tariff binding — false by default; admin opts in per workspace
  is_tariff_bound: false,
} as const;

// Source: Riksavtalen 2025-mellomoppgjør (effective 2025-04-01). When 2026-oppgjør lands,
// update both constants AND seed migration; tariff_rate_table is runtime source of truth —
// these constants are onboarding-UI suggestions only.
/** Riksavtalen tariff rates (2025-mellomoppgjør, effective 2025-04-01) */
export const HOSPITALITY_TARIFF_RATES = [
  { rateType: "kveldstillegg", amount: 16.01, unit: "kr/t" as const, applies: "21:00-06:00" },
  {
    rateType: "helgetillegg",
    amount: 30.42,
    unit: "kr/t" as const,
    applies: "Sat 14:00 - Sun 24:00",
  },
  {
    rateType: "helligdagstillegg",
    amount: 100,
    unit: "percent" as const,
    applies: "Public holidays",
  },
  {
    rateType: "overtidstillegg_50",
    amount: 50,
    unit: "percent" as const,
    applies: "First 2h overtime",
  },
  {
    rateType: "overtidstillegg_100",
    amount: 100,
    unit: "percent" as const,
    applies: "Overtime beyond 2h",
  },
] as const;

/** Payroll profile templates for bootstrap seeding */
export const PAYROLL_PROFILE_TEMPLATES = [
  {
    name: "Servitør heltid",
    salaryType: "hourly" as const,
    weeklyHours: 37.5,
    tariffCategory: "ufaglart",
    employmentCategory: "fast",
  },
  {
    name: "Servitør deltid",
    salaryType: "hourly" as const,
    weeklyHours: 20,
    tariffCategory: "ufaglart",
    employmentCategory: "deltid",
  },
  {
    name: "Kokk heltid",
    salaryType: "hourly" as const,
    weeklyHours: 37.5,
    tariffCategory: "faglart",
    employmentCategory: "fast",
  },
  {
    name: "Leder",
    salaryType: "monthly" as const,
    weeklyHours: 37.5,
    tariffCategory: "leder",
    employmentCategory: "fast",
  },
] as const;

/** Administrative department default hours (09:00-17:00 Mon-Fri, closed Sat-Sun) */
export const ADMINISTRATIVE_DEFAULT_HOURS = [
  { dayOfWeek: 0, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 5, openTime: null, closeTime: null, isClosed: true },
  { dayOfWeek: 6, openTime: null, closeTime: null, isClosed: true },
] as const;

/**
 * Hospitality domain taxonomy — Phase 2 helpdesk classifier routing.
 *
 * These eleven domains reflect how hospitality teams actually separate
 * employee questions in day-to-day operations (lønn vs. vaktbytte vs.
 * allergi vs. HMS). The Botsson classifier (Phase 2 proper, not this
 * sub-sortie) will consume this list as the candidate set when routing
 * a free-text question to a helpdesk channel.
 *
 * Voice-policy defaults follow ADR-0078 and ADR-0163:
 *   - `payroll` and `hr_personal` carry direct PII (lønnsopplysninger,
 *     sykemelding, personnummer, kontonummer) and are voice-forbidden
 *     by default.
 *   - `hms_safety` is also voice-forbidden by default because sick-leave
 *     reporting (sykemelding = helseopplysning) falls in this bucket.
 *     Admins can override per channel via `channel_ai_policy` if they
 *     want voice access to non-PII safety topics (fire, evacuation).
 *   - `other` is voice-forbidden by default as a conservative fallback
 *     when the classifier cannot confidently match a specific domain.
 *
 * Keywords are Norwegian seed terms for the classifier prompt and for
 * future workspace-specific fine-tuning (K1b layer per cascade model).
 * They are NOT exhaustive — the classifier is an LLM, not a regex —
 * but serve as an interpretability anchor and a cold-start fallback.
 *
 * See:
 *   - docs/decisions/0165-progressive-channel-discriminator.md
 *   - docs/decisions/0078-engine-process-channel-restriction.md
 *   - docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md
 *   - docs/learnings/0086-channel-ai-policy-half-wired.md
 *   - docs/superpowers/specs/2026-04-20-progressive-channel-design.md
 */
export const HOSPITALITY_DOMAINS: Domain[] = [
  {
    id: "payroll",
    label: "Lønn og tillegg",
    description: "Spørsmål om lønnslipp, feriepenger, skatt, tariff og tillegg.",
    default_voice_allowed: false,
    keywords: [
      "lønn",
      "lønnslipp",
      "feriepenger",
      "skatt",
      "skattetrekk",
      "tillegg",
      "overtid",
      "tariff",
      "kontonummer",
      "personnummer",
    ],
  },
  {
    id: "scheduling",
    label: "Vakter og tilgjengelighet",
    description: "Vaktbytte, ønsker om fri, ferie og tilgjengelighet.",
    default_voice_allowed: true,
    keywords: [
      "vakt",
      "vaktbytte",
      "bytte",
      "tilgjengelighet",
      "fri",
      "ferie",
      "turnus",
      "skift",
      "helg",
      "overtid",
    ],
  },
  {
    id: "food_safety",
    label: "Mattrygghet og hygiene",
    description: "Allergier, HACCP, hygienerutiner og temperaturkontroll.",
    default_voice_allowed: true,
    keywords: [
      "allergi",
      "allergener",
      "hygiene",
      "haccp",
      "mattilsynet",
      "temperatur",
      "kjøleskap",
      "internkontroll",
      "rengjøring",
      "glutenfri",
    ],
  },
  {
    id: "bar_operations",
    label: "Bar og alkohol",
    description: "Drinkoppskrifter, vinliste, alkoholpolicy og bar-utstyr.",
    default_voice_allowed: true,
    keywords: [
      "drink",
      "cocktail",
      "vin",
      "vinliste",
      "øl",
      "alkohol",
      "skjenkebevilling",
      "bar",
      "espressomaskin",
      "kasse",
    ],
  },
  {
    id: "kitchen_operations",
    label: "Kjøkken og produksjon",
    description: "Retter, oppskrifter, mengder, innkjøp og kjøkkenrutiner.",
    default_voice_allowed: true,
    keywords: [
      "oppskrift",
      "rett",
      "meny",
      "mengde",
      "porsjon",
      "innkjøp",
      "leverandør",
      "kjøkken",
      "prep",
      "lager",
    ],
  },
  {
    id: "service_standards",
    label: "Service og gjesteopplevelse",
    description: "Gjesterespons, klagehåndtering og serviceprotokoller.",
    default_voice_allowed: true,
    keywords: [
      "gjest",
      "klage",
      "service",
      "bordservering",
      "tips",
      "drikkepenger",
      "reservasjon",
      "bordplan",
      "upsell",
      "feedback",
    ],
  },
  {
    id: "hms_safety",
    label: "HMS og sikkerhet",
    description: "Skade, brann, evakuering og sykemelding. Inneholder helseopplysninger.",
    default_voice_allowed: false,
    keywords: [
      "skade",
      "ulykke",
      "brann",
      "evakuering",
      "sykemelding",
      "sykmelding",
      "syk",
      "hms",
      "verneombud",
      "førstehjelp",
    ],
  },
  {
    id: "hr_personal",
    label: "HR og personlige forhold",
    description: "Permisjon, konflikt, personlige dokumenter og arbeidsforhold.",
    default_voice_allowed: false,
    keywords: [
      "permisjon",
      "foreldrepermisjon",
      "konflikt",
      "varsling",
      "oppsigelse",
      "kontrakt",
      "arbeidsavtale",
      "personlig",
      "attest",
      "dokument",
    ],
  },
  {
    id: "training",
    label: "Opplæring og sertifisering",
    description: "Kurs, opplæringsløp, sertifikater og readiness-status.",
    default_voice_allowed: true,
    keywords: [
      "kurs",
      "opplæring",
      "sertifikat",
      "trainee",
      "readiness",
      "policy",
      "protokoll",
      "prosedyre",
      "test",
      "bestått",
    ],
  },
  {
    id: "equipment",
    label: "Utstyr og vedlikehold",
    description: "Utstyrsfeil, vedlikehold, reservasjon og bestilling av deler.",
    default_voice_allowed: true,
    keywords: [
      "utstyr",
      "maskin",
      "feil",
      "vedlikehold",
      "reservedeler",
      "reparasjon",
      "oppvaskmaskin",
      "ovn",
      "komfyr",
      "kasse",
    ],
  },
  {
    id: "other",
    label: "Annet",
    description: "Fallback-domene når ingen av de spesifikke domenene passer trygt.",
    default_voice_allowed: false,
    keywords: [],
  },
];

/** Hospitality default base hours (11:00-23:00 Mon-Sat, 12:00-22:00 Sun) */
export const HOSPITALITY_DEFAULT_HOURS = [
  { dayOfWeek: 0, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 1, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 2, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 3, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 4, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 5, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 6, openTime: "12:00", closeTime: "22:00", isClosed: false },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap gates — K1a source of truth for workspace_bootstrap_gate seeds
// Seeded by bootstrap-cascade EF Step 12 (ADR-0407, Phase 1).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hospitality bootstrap gates — 11 gates covering week-1 setup.
 *
 * Industry-specific gates (Mattilsynet food safety, alcohol + labor law)
 * are marked required=false — they are recommended but admin can skip
 * with a reason if the venue doesn't serve food/alcohol.
 *
 * Day 1: structural foundation (departments + locations)
 * Day 2: framework + tariff + operating hours
 * Day 3: people + season (owner contract, first season)
 * Day 4: food safety routines (Mattilsynet, lovpålagt for matservering)
 * Day 5: alcohol + labor law routines
 * Day 6: first employees invited
 * Day 7: C4-authority finalized
 */
export const HOSPITALITY_BOOTSTRAP_GATES: BootstrapGateDefinition[] = [
  // Day 1 — critical structural foundation
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
  // Day 2 — structural rules
  {
    gate_slug: "operating_hours_set",
    required: true,
    suggested_day: 2,
    depends_on: ["departments_exist"],
    display_label_no: "Åpningstider satt",
    display_label_en: "Operating hours set",
    description: "Åpningstider per avdeling — driver session_hook tidspunkter.",
    capability_slug: "schedule",
  },
  {
    gate_slug: "regulatory_framework_bound",
    required: true,
    suggested_day: 2,
    depends_on: [],
    display_label_no: "Tariff/lov-rammeverk valgt",
    display_label_en: "Regulatory framework bound",
    description:
      "Bind workspace til Riksavtalen (NHO Reiseliv) eller default-norm. Driver §-håndhevelse.",
    capability_slug: "payroll",
  },
  {
    gate_slug: "tariff_binding_decided",
    required: true,
    suggested_day: 2,
    depends_on: ["regulatory_framework_bound"],
    display_label_no: "Tariff-binding bestemt",
    display_label_en: "Tariff binding decided",
    description:
      "workspace_settings.is_tariff_bound må eksplisitt settes (true=bundet, false=fri).",
    capability_slug: "payroll",
  },
  // Day 3 — people and season
  {
    gate_slug: "owner_contract_active",
    required: true,
    suggested_day: 3,
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
  // Day 4 — hospitality-specific: Mattilsynet (food safety routines)
  {
    gate_slug: "mattilsynet_routines_seeded",
    required: false,
    suggested_day: 4,
    depends_on: ["departments_exist"],
    display_label_no: "Mattilsynet-rutiner aktivert",
    display_label_en: "Food safety routines active",
    description:
      "20 IK-mat rutiner + 8 kontrollister + 4 kunnskapstester. Lovpålagt for matservering.",
    capability_slug: "governance",
  },
  // Day 5 — hospitality-specific: alcohol + labor law
  {
    gate_slug: "alcohol_labor_routines_seeded",
    required: false,
    suggested_day: 5,
    depends_on: ["departments_exist"],
    display_label_no: "Alkohol + Aml. §10-rutiner aktivert",
    display_label_en: "Alcohol + labor law routines active",
    description: "Alkoholloven + Aml. §10-6 (OT) + §10-11 (natt). Påkrevd ved skjenkebevilling.",
    capability_slug: "governance",
  },
  // Day 6 — onboarding
  {
    gate_slug: "first_employees_invited",
    required: false,
    suggested_day: 6,
    depends_on: ["owner_contract_active", "departments_exist"],
    display_label_no: "Første ansatte invitert",
    display_label_en: "First employees invited",
    description: "Inviter minst én ansatt for å aktivere onboarding-flowen.",
    capability_slug: "profile",
  },
  // Day 7 — finalize C4
  {
    gate_slug: "authority_config_complete",
    required: true,
    suggested_day: 7,
    depends_on: ["owner_contract_active"],
    display_label_no: "C4-authority komplett",
    display_label_en: "C4 authority complete",
    description: "Alle gated capabilities har min_role + four-eyes-policy satt for workspace.",
    capability_slug: "governance",
  },
];

/**
 * Returns bootstrap gate definitions for the hospitality industry.
 * Called by bootstrap-cascade EF Step 12 to seed workspace_bootstrap_gate rows.
 */
export function getBootstrapGates(): BootstrapGateDefinition[] {
  return HOSPITALITY_BOOTSTRAP_GATES;
}

export const hospitalityPackage: IndustryPackage = {
  id: "hospitality",
  label: "Restaurant og servering",

  filterDefaults: {
    food: true,
    alcohol: true,
    overnight: false,
    delivery: true,
  },

  // Source: Riksavtalen 2025-mellomoppgj\u00f8r (effective 2025-04-01). When 2026-oppgj\u00f8r lands,
  // update both tariffs[] AND HOSPITALITY_TARIFF_RATES above; tariff_rate_table is runtime
  // source of truth \u2014 these constants are onboarding-UI suggestions only.
  tariffs: [
    {
      key: "riksavtalen",
      label: "Riksavtalen (NHO Reiseliv)",
      supplements: [
        {
          id: "riks-kveld",
          name: "Kveldstillegg",
          rate: 16.01,
          unit: "kr/t",
          condition_type: "time_range",
          from_hour: "21:00",
          to_hour: "06:00",
        },
        {
          id: "riks-lordag",
          name: "L\u00f8rdagstillegg",
          rate: 30.42,
          unit: "kr/t",
          condition_type: "days",
          days: ["l\u00f8rdag"],
          description: "Kl. 14:00\u201324:00",
        },
        {
          id: "riks-sondag",
          name: "S\u00f8ndagstillegg",
          rate: 30.42,
          unit: "kr/t",
          condition_type: "days",
          days: ["s\u00f8ndag"],
          description: "Hele dagen",
        },
        {
          id: "riks-helligdag",
          name: "Helligdagstillegg",
          rate: 100,
          unit: "%",
          condition_type: "always",
          description: "Fra kl. 18:00 kvelden f\u00f8r til kl. 06:00 dagen etter",
        },
        {
          id: "riks-overtid50",
          name: "Overtid 50%",
          rate: 50,
          unit: "%",
          condition_type: "after_hours",
          after_hours: 2,
          description: "F\u00f8rste 2 timer overtid per dag",
        },
        {
          id: "riks-overtid100",
          name: "Overtid 100%",
          rate: 100,
          unit: "%",
          condition_type: "after_hours",
          after_hours: 2,
          description: "Etter 2 timer overtid, alt p\u00e5 s\u00f8n-/helligdager",
        },
        {
          id: "riks-delt",
          name: "Delt dagsverk",
          rate: 1,
          unit: "kr/t",
          condition_type: "always",
          description: "1 times ekstra ved opphold > 2 timer mellom vakter",
        },
        {
          id: "riks-kost",
          name: "Kostgodtgj\u00f8relse",
          rate: 95,
          unit: "kr/t",
          condition_type: "always",
          description: "Per m\u00e5ltid n\u00e5r mat ikke tilbys",
        },
      ],
      minWagePerHour: 198.5,
    },
    {
      key: "hotelloverenskomsten",
      label: "Hotelloverenskomsten",
      supplements: [
        {
          id: "hotell-kveld",
          name: "Kveldstillegg",
          rate: 15.65,
          unit: "kr/t",
          condition_type: "time_range",
          from_hour: "21:00",
          to_hour: "00:00",
        },
        {
          id: "hotell-natt",
          name: "Nattillegg",
          rate: 55,
          unit: "kr/t",
          condition_type: "time_range",
          from_hour: "00:00",
          to_hour: "06:00",
        },
        {
          id: "hotell-lordag",
          name: "L\u00f8rdagstillegg",
          rate: 29.74,
          unit: "kr/t",
          condition_type: "days",
          days: ["l\u00f8rdag"],
          description: "Kl. 15:00\u201324:00",
        },
        {
          id: "hotell-sondag",
          name: "S\u00f8ndagstillegg",
          rate: 29.74,
          unit: "kr/t",
          condition_type: "days",
          days: ["s\u00f8ndag"],
          description: "Hele dagen",
        },
        {
          id: "hotell-helligdag",
          name: "Helligdagstillegg",
          rate: 100,
          unit: "%",
          condition_type: "always",
          description: "Fra kl. 18:00 kvelden f\u00f8r til kl. 06:00 dagen etter",
        },
        {
          id: "hotell-overtid50",
          name: "Overtid 50%",
          rate: 50,
          unit: "%",
          condition_type: "after_hours",
          after_hours: 2,
          description: "F\u00f8rste 2 timer overtid per dag",
        },
        {
          id: "hotell-overtid100",
          name: "Overtid 100%",
          rate: 100,
          unit: "%",
          condition_type: "after_hours",
          after_hours: 2,
          description: "Etter 2 timer overtid, alt p\u00e5 s\u00f8n-/helligdager",
        },
        {
          id: "hotell-delt",
          name: "Delt dagsverk",
          rate: 1,
          unit: "kr/t",
          condition_type: "always",
          description: "1 times ekstra ved opphold > 2 timer",
        },
        {
          id: "hotell-kost",
          name: "Kostgodtgj\u00f8relse",
          rate: 95,
          unit: "kr/t",
          condition_type: "always",
          description: "Per m\u00e5ltid n\u00e5r mat ikke tilbys",
        },
        {
          id: "hotell-rom",
          name: "Romtillegg",
          rate: 0,
          unit: "kr/t",
          condition_type: "always",
          description: "Per rom utover norm (fastsettes lokalt)",
        },
      ],
      minWagePerHour: 198.5,
    },
  ],
  defaultTariffKey: "riksavtalen",

  shiftTemplates: [
    { name: "Morgenvakt", department: "Kjokken", startTime: "07:00", endTime: "15:00" },
    { name: "Kveldsvakt", department: "Kjokken", startTime: "15:00", endTime: "23:00" },
    { name: "Morgenvakt", department: "Service", startTime: "09:00", endTime: "15:00" },
    { name: "Kveldsvakt", department: "Service", startTime: "15:00", endTime: "23:00" },
    { name: "Kveldsvakt", department: "Bar", startTime: "16:00", endTime: "01:00" },
  ],

  seasonTemplates: [
    {
      name: "Sommersesong",
      startMonth: 5,
      endMonth: 9,
      description: "Mai til september — hoyaktivitet med uteservering og turisme",
    },
    {
      name: "Vintersesong",
      startMonth: 10,
      endMonth: 4,
      description: "Oktober til april — roligere periode med julebord-topp i november/desember",
    },
    {
      name: "Julesessong",
      startMonth: 11,
      endMonth: 12,
      description: "November til desember — julebord og hoytid",
    },
  ],

  employmentDefaults: {
    probationMonths: 6,
    vacationDays: 25,
    extraVacationDays: false,
    otpPct: 2,
    employerTaxPct: 14.1,
  },

  botsson: {
    welcome:
      "Vi har hentet informasjon fra Bronnysund, Google og nettsiden din. Se over at alt stemmer.",
    "document-drop":
      "Last opp det dere har — vi finner ut hva som er rutiner, vaktlister, lonnssatser og kontrakter.",
    governance:
      "Basert pa at dere handterer mat, anbefaler vi Mattrygghet, Hygiene og Allergenhandtering. Disse er pakrevd av Mattilsynet.",
    payroll: "Velg tariffavtale og legg til tillegg som gjelder for din virksomhet.",
    employment: "Provetid pa 6 maneder er standard. Dere kan sette kortere, men ikke lenger.",
    team: "Alle nye ansatte starter som trainee. De far automatisk opplaering basert pa stilling og avdeling.",
    "shift-template": "Basert pa apningstidene deres foreslar vi 2 skift per dag for kjokkenet.",
    season:
      "De fleste restauranter kjorer sommersesong mai–september og vintersesong oktober–april.",
    handbook:
      "Vi har laget et utkast basert pa det du har fylt inn. Les gjennom og juster — dette er det ansatte leser forste dag.",
  },

  domains: HOSPITALITY_DOMAINS,

  /**
   * Role-capability profiles for the restaurant vertical.
   *
   * Authored from restaurant-role-capability-baseline.md (ADR-0379a, A2).
   * Protocol slugs match exact protocol.name values in governance templates.
   * Used at I1 bootstrap to seed the initial readiness gate configuration.
   * Additive — no runtime DB-load path (council: bootstrap-only, no K1a read).
   */
  roleCapabilityProfiles: [
    {
      roleSlug: "skiftleder",
      positionSlugs: ["Skiftleder"],
      mandatoryProtocolSlugs: [
        "Apningsrutiner-protokoll", // governance.sql:325
        "Stengerutiner-protokoll", // governance.sql:326
        "Brannvern og evakuering-protokoll", // governance.sql:328
        "Arbeidsmiljo og HMS-protokoll", // governance.sql:331
        "Handhygiene-protokoll", // governance.sql:327
      ],
      readySignal: "Can run one full shift cycle without policy-critical misses",
    },
    {
      roleSlug: "servitor",
      positionSlugs: ["Servitør", "Runner", "Vertinne"],
      mandatoryProtocolSlugs: [
        "Allergenhandtering-protokoll", // governance.sql:324
        "Handhygiene-protokoll", // governance.sql:327
        "Brannvern og evakuering-protokoll", // governance.sql:328
        // NOTE: "service-safety" gap intentionally deferred — no matching protocol
        // in current templates. Flagged for council (baseline §5: UNRESOLVED).
      ],
      readySignal: "Completes full service sequence with correct allergen handling",
    },
    {
      roleSlug: "kokk",
      positionSlugs: [
        "Kokk",
        "Sous Chef",
        "Kjøkkenassistent",
        "Kjøkkensjef",
        "Gardemanger",
        "Patissier",
        "Oppvaskhjelp",
      ],
      mandatoryProtocolSlugs: [
        "Temperaturkontroll-protokoll", // governance.sql:323
        "Allergenhandtering-protokoll", // governance.sql:324
        "Handhygiene-protokoll", // governance.sql:327
        "Varemottak og lagring-protokoll", // governance.sql:330
        "Temperaturovervaking-protokoll", // mattilsynet.sql:289
        "Hygiene og renhold-protokoll", // mattilsynet.sql:293
        "Sporbarhet og avvik-protokoll", // mattilsynet.sql:301
      ],
      readySignal: "Executes prep + service tasks with compliant temperature and hygiene behavior",
    },
    {
      roleSlug: "bartender",
      positionSlugs: ["Bartender", "Barback", "Barsjef"],
      mandatoryProtocolSlugs: [
        "Skjenkekontroll-protokoll", // governance.sql:332
        "Handhygiene-protokoll", // governance.sql:327
        "Brannvern og evakuering-protokoll", // governance.sql:328
      ],
      readySignal: "Handles bar service and age checks without compliance breaches",
    },
    {
      roleSlug: "renhold",
      positionSlugs: ["Renholder", "Renholdsansvarlig"],
      mandatoryProtocolSlugs: [
        "Handhygiene-protokoll", // governance.sql:327
        "Hygiene og renhold-protokoll", // mattilsynet.sql:293
        "Arbeidsmiljo og HMS-protokoll", // governance.sql:331
      ],
      readySignal: "Completes hygiene controls with verifiable checklist quality",
    },
  ] satisfies RoleCapabilityProfile[],
};
