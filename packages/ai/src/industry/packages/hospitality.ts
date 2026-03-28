/**
 * Hospitality industry package — canonical I1 bootstrap data.
 *
 * Contains seed defaults for the Norwegian hospitality vertical (Riksavtalen).
 * Runtime truth for tariff rates lives in tariff_rate_table after seeding.
 * This file is the hardcoded fallback (tier 3 in the loader fallback chain).
 */

import type { IndustryPackage } from "@smartout/types";

// ========================================
// Cascade seed data — used for bootstrap seeding and hardcoded fallback
// Runtime truth lives in DB tables after seeding
// ========================================

/** Correct Riksavtalen tariff rates (2024 satser) */
export const HOSPITALITY_TARIFF_RATES = [
  { rateType: "kveldstillegg", amount: 28, unit: "kr/t" as const, applies: "21:00-06:00" },
  {
    rateType: "helgetillegg",
    amount: 28,
    unit: "kr/t" as const,
    applies: "Sat 15:00-24:00, Sun all day 45 kr/t",
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

export const hospitalityPackage: IndustryPackage = {
  id: "hospitality",
  label: "Restaurant og servering",

  filterDefaults: {
    food: true,
    alcohol: true,
    overnight: false,
    delivery: true,
  },

  tariffs: [
    {
      key: "riksavtalen",
      label: "Riksavtalen (NHO Reiseliv)",
      supplements: [
        {
          id: "riks-kveld",
          name: "Kveldstillegg",
          rate: 28,
          unit: "kr/t",
          condition_type: "time_range",
          from_hour: "21:00",
          to_hour: "06:00",
        },
        {
          id: "riks-lordag",
          name: "L\u00f8rdagstillegg",
          rate: 28,
          unit: "kr/t",
          condition_type: "days",
          days: ["l\u00f8rdag"],
          description: "Kl. 15:00\u201324:00",
        },
        {
          id: "riks-sondag",
          name: "S\u00f8ndagstillegg",
          rate: 45,
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
      minWagePerHour: 196.04,
    },
    {
      key: "hotelloverenskomsten",
      label: "Hotelloverenskomsten",
      supplements: [
        {
          id: "hotell-kveld",
          name: "Kveldstillegg",
          rate: 28,
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
          rate: 28,
          unit: "kr/t",
          condition_type: "days",
          days: ["l\u00f8rdag"],
          description: "Kl. 15:00\u201324:00",
        },
        {
          id: "hotell-sondag",
          name: "S\u00f8ndagstillegg",
          rate: 45,
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
      minWagePerHour: 196.04,
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
};
