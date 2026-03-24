/**
 * points-calculator.ts — Gamification points for shift clock actions.
 * Awards or deducts points based on punch timing relative to shift start.
 * Supports season multipliers and workspace boosters for seasonal campaigns.
 */

type PointBonus = { label: string; points: number };
type PointsResult = { base: number; bonuses: PointBonus[]; total: number };
type PointsOptions = { seasonMultiplier?: number; workspaceBooster?: number };

const BASE_POINTS = 2;
const ON_TIME_BONUS = 3;
const EARLY_BONUS = 2;
const LATE_PENALTY = -2;
const VERY_LATE_PENALTY = -3;

// Employee must punch at least 5 minutes early to earn the early bonus.
const EARLY_THRESHOLD_MS = 5 * 60 * 1000;
// Punching more than 15 minutes late incurs an additional penalty on top of the late penalty.
const VERY_LATE_THRESHOLD_MS = 15 * 60 * 1000;

export function calculatePunchPoints(
  punchTime: Date,
  shiftStart: Date,
  options: PointsOptions = {},
): PointsResult {
  const { seasonMultiplier = 1, workspaceBooster = 1 } = options;
  const diffMs = punchTime.getTime() - shiftStart.getTime();
  const bonuses: PointBonus[] = [];

  if (diffMs <= 0) {
    // Punched on time or early.
    bonuses.push({ label: "on_time", points: ON_TIME_BONUS });
    if (diffMs <= -EARLY_THRESHOLD_MS) {
      bonuses.push({ label: "early", points: EARLY_BONUS });
    }
  } else {
    // Punched late.
    bonuses.push({ label: "late", points: LATE_PENALTY });
    if (diffMs > VERY_LATE_THRESHOLD_MS) {
      bonuses.push({ label: "very_late", points: VERY_LATE_PENALTY });
    }
  }

  const subtotal = BASE_POINTS + bonuses.reduce((sum, b) => sum + b.points, 0);
  return {
    base: BASE_POINTS,
    bonuses,
    total: Math.round(subtotal * seasonMultiplier * workspaceBooster),
  };
}
