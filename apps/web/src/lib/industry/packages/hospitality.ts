import type { IndustryPackage } from "../types";

// ========================================
// Cascade seed data — used ONLY for bootstrap seeding
// Runtime truth lives in DB tables after seeding
// ========================================

/** Correct Riksavtalen tariff rates (NOT the old wrong values) */
export const HOSPITALITY_TARIFF_RATES = [
  { rateType: "kveldstillegg", amount: 15.65, unit: "kr/t" as const, applies: "21:00-06:00" },
  {
    rateType: "helgetillegg",
    amount: 29.74,
    unit: "kr/t" as const,
    applies: "Sat 15:00 - Sun 24:00",
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

/** Department name → type mapping with confidence for bootstrap classification */
export const DEPARTMENT_TYPE_MAP: Record<
  string,
  { type: "operational" | "administrative"; confidence: "high" | "medium" | "low" }
> = {
  // Operational (high confidence)
  Kjøkken: { type: "operational", confidence: "high" },
  Kjokken: { type: "operational", confidence: "high" },
  Kitchen: { type: "operational", confidence: "high" },
  Sal: { type: "operational", confidence: "high" },
  Floor: { type: "operational", confidence: "high" },
  "Front of House": { type: "operational", confidence: "high" },
  Service: { type: "operational", confidence: "high" },
  Bar: { type: "operational", confidence: "high" },
  "Bar ute": { type: "operational", confidence: "high" },
  Uteservering: { type: "operational", confidence: "high" },
  Oppvask: { type: "operational", confidence: "high" },
  Bakeri: { type: "operational", confidence: "high" },
  Kafe: { type: "operational", confidence: "high" },
  Resepsjon: { type: "operational", confidence: "high" },
  // Administrative (high confidence)
  Kontor: { type: "administrative", confidence: "high" },
  Admin: { type: "administrative", confidence: "high" },
  Administrasjon: { type: "administrative", confidence: "high" },
  Administration: { type: "administrative", confidence: "high" },
  HR: { type: "administrative", confidence: "high" },
  Regnskap: { type: "administrative", confidence: "high" },
  Økonomi: { type: "administrative", confidence: "high" },
  Ledelse: { type: "administrative", confidence: "high" },
};

/** Normalize department name for lookup: trim, lowercase, NFC normalize */
export function lookupDepartmentType(
  name: string,
): { type: "operational" | "administrative"; confidence: "high" | "medium" | "low" } | null {
  const normalized = name.trim().normalize("NFC");
  // Direct lookup first
  if (DEPARTMENT_TYPE_MAP[normalized]) return DEPARTMENT_TYPE_MAP[normalized];
  // Case-insensitive match
  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(DEPARTMENT_TYPE_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  // Try without ø/o substitution
  const withoutDiacritics = lower.replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
  for (const [key, value] of Object.entries(DEPARTMENT_TYPE_MAP)) {
    const keyNorm = key.toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
    if (keyNorm === withoutDiacritics) return value;
  }
  return null;
}

/** Department offset defaults in minutes (from workspace base hours) */
export const DEPARTMENT_OFFSET_DEFAULTS: Record<
  string,
  { openOffset: number; closeOffset: number }
> = {
  Kjøkken: { openOffset: -120, closeOffset: 0 },
  Kjokken: { openOffset: -120, closeOffset: 0 },
  Kitchen: { openOffset: -120, closeOffset: 0 },
  Sal: { openOffset: -60, closeOffset: 0 },
  Floor: { openOffset: -60, closeOffset: 0 },
  Service: { openOffset: -60, closeOffset: 0 },
  "Front of House": { openOffset: -60, closeOffset: 0 },
  Bar: { openOffset: 0, closeOffset: 0 },
  "Bar ute": { openOffset: 240, closeOffset: 0 },
  Uteservering: { openOffset: 0, closeOffset: 0 },
};

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
      supplements: {
        kveldstillegg: { rate: 15.65, unit: "kr/t", from_hour: "21:00", to_hour: "06:00" },
        helgetillegg: { rate: 29.74, unit: "kr/t", days: ["lordag", "sondag"] },
        helligdagstillegg: { rate: 100, unit: "%" },
        overtid_50: { threshold_hours: 9, unit: "t/dag" },
        overtid_100: { threshold_hours: 13, unit: "t/dag" },
      },
      minWagePerHour: 198.5,
    },
    {
      key: "hotelloverenskomsten",
      label: "Hotelloverenskomsten",
      supplements: {
        kveldstillegg: { rate: 15.65, unit: "kr/t", from_hour: "21:00", to_hour: "06:00" },
        helgetillegg: { rate: 29.74, unit: "kr/t", days: ["lordag", "sondag"] },
        helligdagstillegg: { rate: 100, unit: "%" },
        overtid_50: { threshold_hours: 9, unit: "t/dag" },
        overtid_100: { threshold_hours: 13, unit: "t/dag" },
      },
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
    payroll:
      "Basert pa Riksavtalen er minimumslonn for kokk 198,50 kr/t. Kveldstillegg er 15,65 kr/t etter kl. 21.",
    employment: "Provetid pa 6 maneder er standard. Dere kan sette kortere, men ikke lenger.",
    team: "Alle nye ansatte starter som trainee. De far automatisk opplaering basert pa stilling og avdeling.",
    "shift-template": "Basert pa apningstidene deres foreslar vi 2 skift per dag for kjokkenet.",
    season:
      "De fleste restauranter kjorer sommersesong mai–september og vintersesong oktober–april.",
    handbook:
      "Vi har laget et utkast basert pa det du har fylt inn. Les gjennom og juster — dette er det ansatte leser forste dag.",
  },
};
