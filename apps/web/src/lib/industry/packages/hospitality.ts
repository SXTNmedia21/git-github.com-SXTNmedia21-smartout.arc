import type { IndustryPackage } from "../types";

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
        kveldstillegg: { rate: 56, unit: "kr/t", from_hour: "21:00", to_hour: "06:00" },
        helgetillegg: { rate: 56, unit: "kr/t", days: ["lordag", "sondag"] },
        helligdagstillegg: { rate: 133, unit: "%" },
        overtid_50: { threshold_hours: 9, unit: "t/dag" },
        overtid_100: { threshold_hours: 13, unit: "t/dag" },
      },
      minWagePerHour: 198.5,
    },
    {
      key: "hotelloverenskomsten",
      label: "Hotelloverenskomsten",
      supplements: {
        kveldstillegg: { rate: 56, unit: "kr/t", from_hour: "21:00", to_hour: "06:00" },
        helgetillegg: { rate: 56, unit: "kr/t", days: ["lordag", "sondag"] },
        helligdagstillegg: { rate: 133, unit: "%" },
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
      "Basert pa Riksavtalen er minimumslonn for kokk 198,50 kr/t. Kveldstillegg er 56 kr/t etter kl. 21.",
    employment: "Provetid pa 6 maneder er standard. Dere kan sette kortere, men ikke lenger.",
    team: "Alle nye ansatte starter som trainee. De far automatisk opplaering basert pa stilling og avdeling.",
    "shift-template": "Basert pa apningstidene deres foreslar vi 2 skift per dag for kjokkenet.",
    season:
      "De fleste restauranter kjorer sommersesong mai–september og vintersesong oktober–april.",
    handbook:
      "Vi har laget et utkast basert pa det du har fylt inn. Les gjennom og juster — dette er det ansatte leser forste dag.",
  },
};
