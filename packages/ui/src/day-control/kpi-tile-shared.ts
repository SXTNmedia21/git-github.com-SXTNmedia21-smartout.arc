// Shared KpiTile metadata consumed by BOTH KpiTile.tsx (web) and
// KpiTile.native.tsx. Pure TS — no DOM, no RN. ADR-0158 §Concrete plan
// step 3: "Logic primitives in shared files".

import type { DayKpi } from "./types";

/** Suffix appended to `tile.sub` to surface the data source tier. */
export const SOURCE_SUFFIX: Record<NonNullable<DayKpi["source"]>, string> = {
  live: "",
  snapshot: " · snapshot",
  "post-reconciliation": " · etter oppgjør",
};

/**
 * Map `deltaDir` to a glyph consumed by both platforms. Keeps the visual
 * vocabulary identical — web reads this in JSX text nodes, native in
 * RN `<Text>` children.
 */
export function deltaGlyph(dir: DayKpi["deltaDir"]): string {
  if (dir === "up") return "↗";
  if (dir === "down") return "↘";
  return "·";
}

/** Tone mapping — semantic key, resolved per-platform to concrete colour. */
export function deltaTone(dir: DayKpi["deltaDir"]): "success" | "warning" | "muted" {
  if (dir === "up") return "success";
  if (dir === "down") return "warning";
  return "muted";
}
