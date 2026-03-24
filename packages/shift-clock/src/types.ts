/**
 * types.ts — Core domain types for the shift clock feature.
 * Shared between web and mobile — no platform-specific imports allowed.
 */

export type ShiftClockPhase = "idle" | "clocked_in" | "on_break" | "summary";

export type GPSSnapshot = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
};

export type GPSConfig = {
  required: boolean;
  radiusMeters: number;
  referenceLat: number | null;
  referenceLng: number | null;
};

export type BreakClassification = {
  isPaid: boolean;
  ruleId: string | null;
  ruleName: string | null;
};

export type BreakEntry = {
  start: string;
  end: string | null;
  startLocation: GPSSnapshot | null;
  endLocation: GPSSnapshot | null;
};

export type ShiftClockState = {
  phase: ShiftClockPhase;
  shiftId: string | null;
  timeEntryId: string | null;
  punchInTime: string | null;
  punchOutTime: string | null;
  currentBreak: BreakEntry | null;
  breaks: BreakEntry[];
  gpsConfig: GPSConfig | null;
};

export type SupplementOption = {
  id: string;
  name: string;
  description: string;
  salaryCode: string;
  amount: number;
  rateType: "per_hour" | "per_shift";
  commentRequired: boolean;
};

export type SupplementClaim = {
  supplementRuleId: string;
  shiftId: string;
  comment: string;
  timestamp: string;
};

export type PunchResult = {
  allowed: boolean;
  warnings: ComplianceWarning[];
  blockReason: string | null;
};

export type ComplianceWarning = {
  code: string;
  message: string;
  severity: "warning" | "block";
};
