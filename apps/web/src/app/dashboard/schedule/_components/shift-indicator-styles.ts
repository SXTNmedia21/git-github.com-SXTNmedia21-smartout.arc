// shift-indicator-styles.ts
// Why: extracted from draggable-card-views.tsx to break circular import with
// density-strip.tsx. draggable-card-views.tsx imports DensityStrip; DensityStrip
// imports SHIFT_INDICATOR_STYLES — keeping the map in draggable-card-views.tsx
// created a TDZ ReferenceError at module evaluation under Turbopack.

export type ShiftIndicator = "blue" | "emerald" | "purple" | "orange";

export const SHIFT_INDICATOR_STYLES: Record<ShiftIndicator, string> = {
  blue: "bg-blue-400/40",
  emerald: "bg-emerald-400/40",
  purple: "bg-purple-400/40",
  orange: "bg-orange-400/40",
};
