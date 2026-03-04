// ============================================
// report-data.ts
// Demo data + chart constants for the reports module.
// TODO: Replace each section with real Supabase queries
// via TanStack Query hooks (see _hooks/ for pattern).
// ============================================

// ── Chart Color Palette ─────────────────────────────────────────────────

export const CHART_COLORS = {
  primary: "#f97316",
  blue: "#3b82f6",
  emerald: "#22c55e",
  amber: "#f59e0b",
  purple: "#a855f7",
  rose: "#f43f5e",
  cyan: "#06b6d4",
} as const;

export const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.blue,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.purple,
  CHART_COLORS.rose,
  CHART_COLORS.cyan,
];

// ── Chart Theme Helpers ─────────────────────────────────────────────────

export function chartTheme(isDark: boolean) {
  return {
    axis: isDark ? "#52525b" : "#a1a1aa",
    grid: isDark ? "#27272a" : "#f4f4f5",
    tooltipBg: isDark ? "#18181b" : "#ffffff",
    tooltipBorder: isDark ? "#3f3f46" : "#e4e4e7",
    tooltipText: isDark ? "#e4e4e7" : "#18181b",
    cardBg: isDark ? "bg-[#0c0c0e]" : "bg-white",
    cardBorder: isDark ? "border-zinc-800" : "border-zinc-200",
  };
}

// ── Overview KPIs ───────────────────────────────────────────────────────

export const OVERVIEW_KPIS = [
  {
    label: "Ansatte",
    value: 47,
    change: "+3 denne mnd",
    direction: "up" as const,
    colorKey: "purple" as const,
  },
  {
    label: "Beredskap",
    value: "73%",
    change: "+5pp siste 30d",
    direction: "up" as const,
    colorKey: "emerald" as const,
  },
  {
    label: "Vaktdekning",
    value: "89%",
    change: "-2pp denne uken",
    direction: "down" as const,
    colorKey: "blue" as const,
  },
  {
    label: "Opplaering",
    value: "61%",
    change: "+8pp siste 30d",
    direction: "up" as const,
    colorKey: "orange" as const,
  },
];

// ── 7-Day Trend ─────────────────────────────────────────────────────────

export const TREND_7D = [
  { day: "Man", beredskap: 68, dekning: 85, opplaering: 55 },
  { day: "Tir", beredskap: 70, dekning: 88, opplaering: 58 },
  { day: "Ons", beredskap: 72, dekning: 82, opplaering: 60 },
  { day: "Tor", beredskap: 69, dekning: 90, opplaering: 59 },
  { day: "Fre", beredskap: 74, dekning: 92, opplaering: 62 },
  { day: "Lor", beredskap: 71, dekning: 87, opplaering: 61 },
  { day: "Son", beredskap: 73, dekning: 89, opplaering: 63 },
];

// ── Department Stats ────────────────────────────────────────────────────

export const DEPARTMENT_STATS = [
  {
    name: "Kjokken",
    employees: 18,
    coverage: 92,
    readiness: 78,
    training: 55,
    color: CHART_COLORS.primary,
  },
  {
    name: "Sal",
    employees: 22,
    coverage: 85,
    readiness: 70,
    training: 68,
    color: CHART_COLORS.blue,
  },
  {
    name: "Bar",
    employees: 7,
    coverage: 95,
    readiness: 65,
    training: 72,
    color: CHART_COLORS.emerald,
  },
];

// ── People: Role Distribution ───────────────────────────────────────────

export const ROLE_DISTRIBUTION = [
  { name: "Servitor", count: 15 },
  { name: "Kokk", count: 12 },
  { name: "Bartender", count: 5 },
  { name: "Hovmester", count: 3 },
  { name: "Avdelingsleder", count: 4 },
  { name: "Renholder", count: 3 },
  { name: "Laerling", count: 5 },
];

// ── People: Status Breakdown ────────────────────────────────────────────

export const STATUS_BREAKDOWN = [
  { name: "Aktiv", count: 35, color: CHART_COLORS.emerald },
  { name: "Trainee", count: 8, color: CHART_COLORS.amber },
  { name: "Inaktiv", count: 3, color: CHART_COLORS.rose },
  { name: "Offboarding", count: 1, color: "#71717a" },
];

// ── People: Tenure Distribution ─────────────────────────────────────────

export const TENURE_DISTRIBUTION = [
  { range: "0-3 mnd", count: 8 },
  { range: "3-6 mnd", count: 6 },
  { range: "6-12 mnd", count: 12 },
  { range: "1-2 ar", count: 14 },
  { range: "2+ ar", count: 7 },
];

// ── Staffing: Weekly Coverage ───────────────────────────────────────────

export const WEEKLY_COVERAGE = [
  { day: "Man", needed: 12, assigned: 11, coverage: 92 },
  { day: "Tir", needed: 10, assigned: 9, coverage: 90 },
  { day: "Ons", needed: 11, assigned: 10, coverage: 91 },
  { day: "Tor", needed: 14, assigned: 12, coverage: 86 },
  { day: "Fre", needed: 18, assigned: 17, coverage: 94 },
  { day: "Lor", needed: 20, assigned: 18, coverage: 90 },
  { day: "Son", needed: 15, assigned: 12, coverage: 80 },
];

// ── Staffing: Shift Type Distribution ───────────────────────────────────

export const SHIFT_TYPES = [
  { type: "Morgen (07-15)", count: 35, color: CHART_COLORS.amber },
  { type: "Dag (10-18)", count: 28, color: CHART_COLORS.blue },
  { type: "Kveld (16-24)", count: 42, color: CHART_COLORS.purple },
  { type: "Delt (11-14, 18-22)", count: 12, color: CHART_COLORS.primary },
];

// ── Staffing: Labor Hours Trend ─────────────────────────────────────────

export const LABOR_HOURS_4W = [
  { week: "Uke 8", planned: 620, actual: 595, budget: 600 },
  { week: "Uke 9", planned: 640, actual: 650, budget: 600 },
  { week: "Uke 10", planned: 610, actual: 605, budget: 600 },
  { week: "Uke 11", planned: 660, actual: 640, budget: 600 },
];

// ── Training: Protocol Compliance ───────────────────────────────────────

export const PROTOCOL_COMPLIANCE = [
  { name: "Matservering", compliance: 67, assigned: 12, completed: 8, critical: false },
  { name: "Brannvern", compliance: 100, assigned: 18, completed: 18, critical: false },
  { name: "Kassasystem", compliance: 38, assigned: 8, completed: 3, critical: true },
  { name: "Allergener", compliance: 93, assigned: 15, completed: 14, critical: false },
  { name: "Arbeidsmiljo", compliance: 75, assigned: 20, completed: 15, critical: false },
  { name: "Hygiene (HACCP)", compliance: 85, assigned: 22, completed: 19, critical: false },
  { name: "Vinpakke", compliance: 50, assigned: 6, completed: 3, critical: false },
];

// ── Training: Completion Trend (30 days) ────────────────────────────────

export const TRAINING_TREND_30D = [
  { date: "Uke 8", completed: 12, started: 18, expired: 2 },
  { date: "Uke 9", completed: 8, started: 14, expired: 1 },
  { date: "Uke 10", completed: 15, started: 20, expired: 3 },
  { date: "Uke 11", completed: 11, started: 16, expired: 0 },
];

// ── Training: Overdue Assignments ───────────────────────────────────────

export const OVERDUE_ASSIGNMENTS = [
  { employee: "Kari Olsen", protocol: "Kassasystem", daysOverdue: 14, department: "Sal" },
  { employee: "Erik Bakke", protocol: "Kassasystem", daysOverdue: 10, department: "Bar" },
  { employee: "Lise Hansen", protocol: "Matservering", daysOverdue: 7, department: "Kjokken" },
  { employee: "Ahmed Ali", protocol: "Vinpakke", daysOverdue: 5, department: "Sal" },
  { employee: "Sofia Berg", protocol: "Kassasystem", daysOverdue: 3, department: "Sal" },
];

// ── Staffing: Unfilled Shifts ───────────────────────────────────────────

export const UNFILLED_SHIFTS = [
  { date: "Sondag 09.03", shift: "Kveld", department: "Sal", needed: 3 },
  { date: "Lordag 08.03", shift: "Kveld", department: "Bar", needed: 1 },
  { date: "Torsdag 06.03", shift: "Morgen", department: "Kjokken", needed: 2 },
  { date: "Fredag 07.03", shift: "Kveld", department: "Sal", needed: 1 },
];

// ── Highlights ──────────────────────────────────────────────────────────

export const TOP_INSIGHTS = [
  { label: "Hoyest beredskap", value: "Bar", detail: "95% dekning" },
  { label: "Lavest opplaering", value: "Kjokken", detail: "55% fullfort" },
  { label: "Flest ansatte", value: "Sal", detail: "22 medarbeidere" },
  { label: "Kritisk protokoll", value: "Kassasystem", detail: "38% fullfort" },
];
