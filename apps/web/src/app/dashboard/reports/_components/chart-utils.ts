// Chart color palette and theme helpers shared across report sections.

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
