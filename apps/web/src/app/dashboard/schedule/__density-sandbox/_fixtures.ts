// _fixtures.ts
// Why: static fixture data for the density sandbox — no Supabase, no Server Actions.
// Covers all edge cases the density tiers must handle:
//   - single-shift day
//   - double-shift day (two shifts, same employee, same day — no row-height blowup test)
//   - conflict day (overlapping start/end times — hasConflict: true on both shifts)
//   - night shift (cross-midnight 22:00–02:00)
//   - empty cells
//
// indicator keys are the valid values from SHIFT_INDICATOR_STYLES in
// draggable-card-views.tsx: "blue" | "emerald" | "purple" | "orange"

export type ShiftFixture = {
  id: string;
  role: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  status: "draft" | "published" | "active" | "completed";
  indicator: "blue" | "emerald" | "purple" | "orange";
  zone?: string;
  hasConflict?: boolean;
};

export type DayFixture = {
  /** ISO date string */
  date: string;
  /** Norwegian day label */
  dayLabel: string;
  shifts: ShiftFixture[];
};

export type EmployeeFixture = {
  id: string;
  name: string;
  /** Short 2-letter initials for Pulse mini-card */
  initials: string;
  days: DayFixture[];
};

// 7 days starting Monday 2026-05-18
const MON: DayFixture = { date: "2026-05-18", dayLabel: "Man 18", shifts: [] };
const TUE: DayFixture = { date: "2026-05-19", dayLabel: "Tir 19", shifts: [] };
const WED: DayFixture = { date: "2026-05-20", dayLabel: "Ons 20", shifts: [] };
const THU: DayFixture = { date: "2026-05-21", dayLabel: "Tor 21", shifts: [] };
const FRI: DayFixture = { date: "2026-05-22", dayLabel: "Fre 22", shifts: [] };
const SAT: DayFixture = { date: "2026-05-23", dayLabel: "Lør 23", shifts: [] };
const SUN: DayFixture = { date: "2026-05-24", dayLabel: "Søn 24", shifts: [] };

export const FIXTURE_DAY_LABELS: string[] = [
  MON.dayLabel,
  TUE.dayLabel,
  WED.dayLabel,
  THU.dayLabel,
  FRI.dayLabel,
  SAT.dayLabel,
  SUN.dayLabel,
];

export const FIXTURE_EMPLOYEES: EmployeeFixture[] = [
  // ── Employee 1: Sous Chef ───────────────────────────────────────────────────
  {
    id: "emp-1",
    name: "Maren Dahl",
    initials: "MD",
    days: [
      // Mon — single shift
      {
        ...MON,
        shifts: [
          {
            id: "s-1-1",
            role: "Sous Chef",
            startTime: "10:00",
            endTime: "22:00",
            status: "published",
            indicator: "blue",
            zone: "Kjøkken",
          },
        ],
      },
      // Tue — empty
      { ...TUE },
      // Wed — empty
      { ...WED },
      // Thu — empty
      { ...THU },
      // Fri — empty
      { ...FRI },
      // Sat — single shift
      {
        ...SAT,
        shifts: [
          {
            id: "s-1-6",
            role: "Sous Chef",
            startTime: "11:00",
            endTime: "22:00",
            status: "active",
            indicator: "blue",
            zone: "Kjøkken",
          },
        ],
      },
      // Sun — empty
      { ...SUN },
    ],
  },

  // ── Employee 2: Server ──────────────────────────────────────────────────────
  {
    id: "emp-2",
    name: "Ole Bakken",
    initials: "OB",
    days: [
      // Mon — empty
      { ...MON },
      // Tue — single shift (non-round endTime for formatTimeShort test)
      {
        ...TUE,
        shifts: [
          {
            id: "s-2-2",
            role: "Server",
            startTime: "16:00",
            endTime: "23:00",
            status: "published",
            indicator: "emerald",
            zone: "Sal",
          },
        ],
      },
      // Wed — empty
      { ...WED },
      // Thu — empty
      { ...THU },
      // Fri — single shift with non-round startTime
      {
        ...FRI,
        shifts: [
          {
            id: "s-2-5",
            role: "Server",
            startTime: "16:30",
            endTime: "23:00",
            status: "draft",
            indicator: "emerald",
          },
        ],
      },
      // Sat — empty
      { ...SAT },
      // Sun — empty
      { ...SUN },
    ],
  },

  // ── Employee 3: Kokk — double-shift Wednesday ───────────────────────────────
  {
    id: "emp-3",
    name: "Ingrid Sørlie",
    initials: "IS",
    days: [
      // Mon — empty
      { ...MON },
      // Tue — empty
      { ...TUE },
      // Wed — DOUBLE SHIFT: morning + evening, no conflict (non-overlapping times)
      {
        ...WED,
        shifts: [
          {
            id: "s-3-3a",
            role: "Kokk",
            startTime: "07:00",
            endTime: "15:00",
            status: "completed",
            indicator: "orange",
            zone: "Kjøkken",
          },
          {
            id: "s-3-3b",
            role: "Kokk",
            startTime: "16:00",
            endTime: "23:00",
            status: "published",
            indicator: "purple",
            zone: "Kjøkken",
          },
        ],
      },
      // Thu — empty
      { ...THU },
      // Fri — empty
      { ...FRI },
      // Sat — single
      {
        ...SAT,
        shifts: [
          {
            id: "s-3-6",
            role: "Kokk",
            startTime: "10:00",
            endTime: "18:00",
            status: "published",
            indicator: "orange",
          },
        ],
      },
      // Sun — empty
      { ...SUN },
    ],
  },

  // ── Employee 4: Servitør — conflict Thursday ────────────────────────────────
  {
    id: "emp-4",
    name: "Håkon Lie",
    initials: "HL",
    days: [
      // Mon — single
      {
        ...MON,
        shifts: [
          {
            id: "s-4-1",
            role: "Servitør",
            startTime: "12:00",
            endTime: "20:00",
            status: "published",
            indicator: "purple",
            zone: "Bar",
          },
        ],
      },
      // Tue — empty
      { ...TUE },
      // Wed — empty
      { ...WED },
      // Thu — CONFLICT: overlapping shifts (10–18 AND 14–22), hasConflict: true on both
      {
        ...THU,
        shifts: [
          {
            id: "s-4-4a",
            role: "Servitør",
            startTime: "10:00",
            endTime: "18:00",
            status: "published",
            indicator: "purple",
            zone: "Sal",
            hasConflict: true,
          },
          {
            id: "s-4-4b",
            role: "Vakthavende",
            startTime: "14:00",
            endTime: "22:00",
            status: "draft",
            indicator: "orange",
            zone: "Bar",
            hasConflict: true,
          },
        ],
      },
      // Fri — empty
      { ...FRI },
      // Sat — empty
      { ...SAT },
      // Sun — single
      {
        ...SUN,
        shifts: [
          {
            id: "s-4-7",
            role: "Servitør",
            startTime: "14:00",
            endTime: "22:00",
            status: "published",
            indicator: "purple",
          },
        ],
      },
    ],
  },

  // ── Employee 5: Bartender — night shift Friday ──────────────────────────────
  {
    id: "emp-5",
    name: "Silje Vang",
    initials: "SV",
    days: [
      // Mon — empty
      { ...MON },
      // Tue — evening shift
      {
        ...TUE,
        shifts: [
          {
            id: "s-5-2",
            role: "Bartender",
            startTime: "18:00",
            endTime: "02:00",
            status: "published",
            indicator: "blue",
            zone: "Bar",
          },
        ],
      },
      // Wed — empty
      { ...WED },
      // Thu — empty
      { ...THU },
      // Fri — NIGHT SHIFT: 22:00–02:00 (cross-midnight, V1 no special marker)
      {
        ...FRI,
        shifts: [
          {
            id: "s-5-5",
            role: "Bartender",
            startTime: "22:00",
            endTime: "02:00",
            status: "active",
            indicator: "blue",
            zone: "Bar",
          },
        ],
      },
      // Sat — empty
      { ...SAT },
      // Sun — empty
      { ...SUN },
    ],
  },
];
