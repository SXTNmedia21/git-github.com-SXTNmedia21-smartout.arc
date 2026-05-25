// packages/ai/src/capabilities/schedule/oslo-time.ts
//
// Europe/Oslo timezone utilities for the schedule capability.
//
// Why this file exists (D2 root-cause):
//   Shifts are stored as TIMESTAMPTZ in Postgres. The raw UTC ISO strings
//   that come back from Supabase are correct wire values, but:
//     1. `new Date().setHours(0,0,0,0)` computes "today" in the SERVER's
//        local timezone (UTC on Vercel/Droplet). A shift at 22:00 Oslo on
//        Friday = 20:00 UTC Friday, but past 01:00 Oslo Saturday (23:00
//        UTC Friday) the server still thinks it is "Friday" until 00:00
//        UTC Saturday = 02:00 Oslo Saturday (summer). Emma said "Fredag"
//        when it was already Lørdag. Conversely: at 00:30 Oslo Saturday
//        (= 22:30 UTC Friday), a "today" query returned Friday shifts.
//     2. Raw UTC ISO strings sent to the LLM force the model to do the
//        UTC→Europe/Oslo conversion in its head, and it frequently picks
//        the wrong weekday across the 22:00–02:00 Oslo window.
//
//   The fix: compute day boundaries in Europe/Oslo, and pre-format human-
//   readable weekday + local time in Norwegian so the LLM never has to
//   perform tz arithmetic.
//
// All functions here are pure and deterministic — exported for unit tests
// that pin a `now` instant to probe DST and day-boundary edges.

const OSLO_TZ = "Europe/Oslo";

// Canonical Norwegian day/month labels. Intl.DateTimeFormat with
// nb-NO gives us the right words; we just ask for them with the
// timezone pinned.
const OSLO_DAY_FMT = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO_TZ,
  weekday: "long",
});

const OSLO_DATE_FMT = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const OSLO_TIME_FMT = new Intl.DateTimeFormat("nb-NO", {
  timeZone: OSLO_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Extract the Y/M/D/H/M/S components of `instant` as seen in Europe/Oslo.
// This is the primitive the day-boundary math is built on — we never
// rely on `Date.prototype.getHours()` because that reads SERVER local time.
function osloParts(instant: Date): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
} {
  // "en-GB" gives day/month/year ordering with numeric parts we can read
  // off by type — avoids locale-specific month-name parsing.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    // Intl returns "24" at midnight under some engines — normalise.
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

// Returns the UTC instant (as ISO string) that corresponds to 00:00:00
// Europe/Oslo of the calendar day containing `instant`.
//
// Implementation uses a two-step correction to handle DST:
//   1. Take the Oslo Y/M/D of the instant.
//   2. Guess "midnight Oslo" by building that Y/M/D at 00:00 UTC
//      and computing the Oslo offset of that guess.
//   3. Apply the offset.
//   4. Re-check: formatting the corrected instant back to Oslo must
//      yield H=0,M=0,S=0. If DST "sprang forward" across midnight (rare,
//      last Sun March — Oslo shifts 02:00 → 03:00, so midnight is
//      unaffected in practice) this converges in one pass.
export function startOfOsloDay(instant: Date): Date {
  const { year, month, day } = osloParts(instant);

  // Guess: the instant whose UTC components match Oslo Y/M/D 00:00.
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // What time is `guess` in Oslo?
  const guessOslo = osloParts(guess);

  // Offset in minutes between "what we wanted (00:00 Oslo)" and
  // "what guess maps to in Oslo".
  const offsetMinutes = guessOslo.hour * 60 + guessOslo.minute + guessOslo.second / 60;

  // Subtract the offset to land at 00:00 Oslo.
  const corrected = new Date(guess.getTime() - offsetMinutes * 60_000);

  return corrected;
}

// End of the Oslo calendar day containing `instant` — 23:59:59.999 Oslo
// expressed as a UTC Date.
export function endOfOsloDay(instant: Date): Date {
  const start = startOfOsloDay(instant);
  // Add 24 hours in wall-clock terms by going to the NEXT Oslo day's
  // start and subtracting 1ms. This handles DST (23h or 25h day)
  // correctly because startOfOsloDay is the anchor, not +86400000.
  //
  // We shift by 26h (safely past the longest DST day of 25h) then
  // normalise back to that day's start.
  const nextDayInstant = new Date(start.getTime() + 26 * 3600_000);
  const nextStart = startOfOsloDay(nextDayInstant);
  return new Date(nextStart.getTime() - 1);
}

// The Norwegian weekday for an instant, as Emma would say it.
// Lowercase ("fredag", "lørdag") — matches how employees speak.
export function osloWeekday(instant: Date): string {
  return OSLO_DAY_FMT.format(instant).toLowerCase();
}

// "YYYY-MM-DD" in Oslo — handy for day grouping and user-facing dates.
// Format order is DD.MM.YYYY from nb-NO; we normalise to ISO-style.
export function osloDateISO(instant: Date): string {
  const parts = OSLO_DATE_FMT.formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

// "HH:MM" in Oslo — 24-hour clock, Norwegian convention.
export function osloClock(instant: Date): string {
  // nb-NO uses "HH:MM" but older Intl engines may emit "HH.MM" (legacy).
  // Use formatToParts so we are engine-agnostic.
  const parts = OSLO_TIME_FMT.formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  return `${lookup.hour}:${lookup.minute}`;
}

// Enrich a raw DB shift row with Oslo-localized fields the LLM can quote
// verbatim, so it never has to perform UTC→Oslo arithmetic itself.
//
// Takes whatever row shape the capability returns (`start_time`,
// `end_time` as ISO UTC strings) and adds `local` alongside the raw data.
// The raw strings stay so downstream consumers that want UTC still get it.
export function enrichShiftRowWithOsloTime<
  T extends { start_time?: string | null; end_time?: string | null },
>(row: T): T & { local: ShiftLocalTime } {
  const start = row.start_time ? new Date(row.start_time) : null;
  const end = row.end_time ? new Date(row.end_time) : null;

  return {
    ...row,
    local: {
      start_weekday: start ? osloWeekday(start) : null,
      start_date: start ? osloDateISO(start) : null,
      start_time: start ? osloClock(start) : null,
      end_weekday: end ? osloWeekday(end) : null,
      end_date: end ? osloDateISO(end) : null,
      end_time: end ? osloClock(end) : null,
      tz: OSLO_TZ,
    },
  };
}

// Return the Norwegian lowercase weekday for a DATE-only string (YYYY-MM-DD).
//
// WHY a dedicated helper (G10 / 2026-05-25):
//   `new Date("2026-06-23")` parses as UTC midnight (Mon 00:00 UTC).
//   In Europe/Oslo that instant is Mon 02:00 CEST — still Monday — but
//   callers were constructing `new Date("2026-06-23T00:00:00+02:00")` which
//   hard-codes the CEST (+02:00) offset. In winter (CET = +01:00) that is
//   wrong by one hour and across the DST boundary the computed weekday is
//   off-by-one.
//
//   Safe anchor: noon UTC (12:00Z) is always within the same Oslo calendar
//   day as the date string — Oslo UTC offsets are +01:00 or +02:00, so
//   noon UTC maps to 13:00 or 14:00 Oslo, never crossing midnight.
//   We then delegate to osloWeekday() which uses Intl with timeZone pinned.
export function osloWeekdayFromDateStr(dateStr: string): string {
  // Noon UTC is safely inside the Oslo calendar day for any dateStr.
  return osloWeekday(new Date(`${dateStr}T12:00:00Z`));
}

export type ShiftLocalTime = {
  start_weekday: string | null;
  start_date: string | null;
  start_time: string | null;
  end_weekday: string | null;
  end_date: string | null;
  end_time: string | null;
  tz: string;
};
