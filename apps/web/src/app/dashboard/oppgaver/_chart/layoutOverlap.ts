/**
 * layoutOverlap — column-assignment for overlapping tasks on a single lane.
 *
 * Port of design source: docs/domains/day-session/day-planner/project/timeline-chart.jsx
 * (layoutOverlap function, ~lines 104-131). Pure deterministic function.
 *
 * Sort: by start ascending; ties broken by end descending (longer first wins
 * column 0). For each task, walk existing columns left-to-right and place in
 * the first column whose current `endMin` is <= the task's `start`. If none
 * fits, allocate a new column at the right.
 *
 * Output: per-task `col` index plus `totalCols` count for grid sizing.
 *
 * NOT a design token — pure geometry. Inline `hmToMin` here (Task 3.2 dedups
 * into shared timeMath helper).
 */

export type LayoutInput = { id: string; start: string; end: string };
export type LayoutItem = { task: LayoutInput; col: number };
export type LayoutResult = { items: LayoutItem[]; totalCols: number };

function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function layoutOverlap(tasks: ReadonlyArray<LayoutInput>): LayoutResult {
  const sorted = [...tasks].sort((a, b) => {
    const d = hmToMin(a.start) - hmToMin(b.start);
    if (d !== 0) return d;
    return hmToMin(b.end) - hmToMin(a.end);
  });
  const cols: { endMin: number }[] = [];
  const items: LayoutItem[] = [];
  for (const t of sorted) {
    const ts = hmToMin(t.start);
    const te = hmToMin(t.end);
    let placed = false;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i]!.endMin <= ts) {
        cols[i] = { endMin: te };
        items.push({ task: t, col: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      cols.push({ endMin: te });
      items.push({ task: t, col: cols.length - 1 });
    }
  }
  return { items, totalCols: Math.max(1, cols.length) };
}
