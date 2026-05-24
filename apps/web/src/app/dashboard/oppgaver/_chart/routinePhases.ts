/**
 * routinePhases — Service-phase bands for the Manager Timeline.
 *
 * Mirrors the ROUTINE constant in
 * docs/domains/day-session/day-planner/project/timeline-data.js (8 entries).
 *
 * `kind` maps to `@smartout/design-tokens` `phase` export keys:
 *   "prep"     → phase.phasePrep
 *   "service"  → phase.phaseService
 *   "winddown" → phase.phaseWindDown
 *
 * Bridge / late / close phases share the nearest semantic kind —
 * RoutineStrips applies reduced opacity so they read as lower-intensity.
 */

export type PhaseKind = "prep" | "service" | "winddown";

export interface RoutinePhase {
  id: string;
  name: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  kind: PhaseKind;
}

export const routinePhases: RoutinePhase[] = [
  {
    id: "r1",
    name: "Rigg & prep",
    start: "06:00",
    end: "07:30",
    kind: "prep",
  },
  {
    id: "r2",
    name: "Frokostservice",
    start: "07:30",
    end: "11:00",
    kind: "service",
  },
  {
    id: "r3",
    name: "Bytteomgang",
    start: "11:00",
    end: "11:30",
    kind: "prep",
  },
  {
    id: "r4",
    name: "Lunsj",
    start: "11:30",
    end: "14:30",
    kind: "service",
  },
  {
    id: "r5",
    name: "Mellomrom · prep middag",
    start: "14:30",
    end: "17:00",
    kind: "prep",
  },
  {
    id: "r6",
    name: "Middagsservice",
    start: "17:00",
    end: "22:30",
    kind: "service",
  },
  {
    id: "r7",
    name: "Bar & kveld",
    start: "22:30",
    end: "01:30",
    kind: "winddown",
  },
  {
    id: "r8",
    name: "Stengt · oppvask",
    start: "01:30",
    end: "02:00",
    kind: "winddown",
  },
];
