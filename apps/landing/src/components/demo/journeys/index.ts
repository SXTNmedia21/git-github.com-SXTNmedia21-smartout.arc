// ============================================
// index.ts
// Journey registry — exports all 6 journey configs as
// an array and a lookup map for route-based access.
// Connected to: app/demo/page.tsx (hub), app/demo/[journey]/page.tsx (shell)
// ============================================

import type { JourneyConfig } from "./types";
import { journey1PunchIn } from "./journey-1-punch-in";
import { journey2ScheduleAi } from "./journey-2-schedule-ai";
import { journey3Quiz } from "./journey-3-quiz";
import { journey4Deviation } from "./journey-4-deviation";
import { journey5Haccp } from "./journey-5-haccp";
import { journey6Onboarding } from "./journey-6-onboarding";

/** All journeys in display order for the hub page */
export const journeys: JourneyConfig[] = [
  journey1PunchIn,
  journey2ScheduleAi,
  journey3Quiz,
  journey4Deviation,
  journey5Haccp,
  journey6Onboarding,
];

/** Lookup map: journey ID → config. Used by the [journey] route. */
export const journeyMap = new Map<string, JourneyConfig>(journeys.map((j) => [j.id, j]));
