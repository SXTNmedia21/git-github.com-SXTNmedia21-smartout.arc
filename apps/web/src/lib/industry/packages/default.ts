import type { IndustryPackage } from "../types";

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
};
