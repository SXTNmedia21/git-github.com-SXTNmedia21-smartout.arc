// apps/web/src/app/dashboard/year-wheel/_components/canvas/lane-pack.ts
//
// Pure lane-packing helper for the year-wheel timeline canvas.
// Given seasons with start/end dates, assigns each one to a numbered "lane"
// such that overlapping seasons never share a lane. Lanes are reused as soon
// as an earlier season on that lane has ended, so the result is a compact
// greedy packing from the top (lane 0) downward.
//
// Seasons whose dates are null are skipped — the timeline cannot render them.
// Dates are compared lexicographically which is correct for ISO-8601 strings.

export type LaneableSeason = {
  season_id: string;
  start_date: string | null;
  end_date: string | null;
};

export type LanedSeason<T extends LaneableSeason> = T & { lane: number };

export function assignLanes<T extends LaneableSeason>(seasons: T[]): LanedSeason<T>[] {
  const withDates = seasons.filter(
    (s): s is T & { start_date: string; end_date: string } =>
      s.start_date != null && s.end_date != null,
  );
  const sorted = [...withDates].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const laneEnds: string[] = [];

  return sorted.map((season) => {
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i]! < season.start_date) {
        laneEnds[i] = season.end_date;
        return { ...season, lane: i };
      }
    }
    laneEnds.push(season.end_date);
    return { ...season, lane: laneEnds.length - 1 };
  });
}
