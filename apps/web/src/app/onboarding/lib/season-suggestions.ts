import type { SeasonData } from "../types";

const SEASONS = [
  { name: "Vinter", startMonth: 0, endMonth: 1 },
  { name: "Vår", startMonth: 2, endMonth: 4 },
  { name: "Sommer", startMonth: 5, endMonth: 7 },
  { name: "Høst", startMonth: 8, endMonth: 10 },
  { name: "Vinter", startMonth: 11, endMonth: 11 },
] as const;

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function suggestSeason(now: Date = new Date()): SeasonData {
  const month = now.getMonth();
  const year = now.getFullYear();

  const season = SEASONS.find((s) => month >= s.startMonth && month <= s.endMonth) ?? SEASONS[0];

  const startYear = year;
  const endYear = season.name === "Vinter" && month === 11 ? year + 1 : year;
  const endMonth = season.name === "Vinter" && month === 11 ? 1 : season.endMonth;
  const startMonth = season.startMonth;

  const lastDay = getLastDayOfMonth(endYear, endMonth);

  return {
    name: `${season.name} ${year}`,
    startDate: `${startYear}-${pad(startMonth + 1)}-01`,
    endDate: `${endYear}-${pad(endMonth + 1)}-${pad(lastDay)}`,
    expectedRevenue: null,
    targetMargin: null,
  };
}
