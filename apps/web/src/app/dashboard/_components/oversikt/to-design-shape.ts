/**
 * to-design-shape.ts — Adapter: maps real hook/fetch rows into the exact object
 * shapes the design's oversikt.jsx expects.
 *
 * The JSX is NOT changed. All field defaulting lives HERE and ONLY here.
 * Every backend gap is documented inline with a GAP comment.
 *
 * Gaps (fields with no backend source in the current seed, defaulted below):
 *   - ACTIONS.who.i / .c — avatar initials + color from schedule_shift + profile;
 *     real mapping requires a join not currently present in the cockpit hooks.
 *     Defaulted: initials="??" color="#7a756e".
 *   - ACTIONS.ic — icon slug per action kind; no DB column; defaulted per kind.
 *   - ACTIONS.deadline — derived from session_task.due_at or deviation.created_at;
 *     full resolution needs the overdue-task hook. Defaulted: null.
 *   - ACTIONS.primary — "primary" CTA styling for the most urgent action.
 *     Defaulted: first crit item gets primary=true.
 *   - ROSTER.dep — department slug from schedule_shift.department_id join;
 *     full join not in useShiftDayStats; defaulted "sal".
 *   - ROSTER.s / ROSTER.e — shift start/end hour from schedule_shift.start_time/end_time;
 *     useShiftDayStats does not return these. Defaulted: s=9, e=17.
 *   - ROSTER.status — "on"|"soon"|"gap": "on" when punch_in present, "soon" otherwise.
 *   - DAY_S, DAY_E, NOW — day start/end/current hour; sourced from department_operating_hours
 *     (session planned_open/planned_close not yet fetched). Defaulted: DAY_S=8, DAY_E=23,
 *     NOW derived from current time at render (server time).
 *   - FEED items — built from CockpitEventEnvelope (activity_trail rows) normalized
 *     by useCockpitFirstScreen.  `who` and `text` are mapped from actor_label + description;
 *     `c` (color) defaults to var(--muted) — per-actor color requires profile join.
 *   - RECEIPTS — read-receipt tracking lives in announcement_meta.read_at per recipient;
 *     no hook exposes this yet. Defaulted to empty array (empty-state rendered).
 *   - PULSE tile values — assembled from useShiftDayStats + useCockpitFirstScreen.
 *     operationalQueue covers "must resolve".
 *     pendingApprovals: wired — usePendingApprovals (department_session pending_signoff count).
 *     unread: wired — useUnreadCounts total (channel + direct messages).
 *     coverage: GAP — no coverage-% hook available yet; renders honest empty tile.
 *   - BRIEF acts (b1–b3) — static text from design; no dynamic source yet.
 *   - workspace_budget (budget_tile_trap): useDayBudget returns null when 0-seeded.
 *     oversikt.budget_empty_state_shown is emitted from the client when budget is null.
 *     Budget KPI tiles are NOT shown in the pulse bar until F0.4 seeds the table.
 */

import type { CockpitFirstScreenReadModel } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import type { ShiftDayStats } from "@/app/dashboard/_hooks/use-shift-day-stats";
import type { DayEvent } from "@/app/dashboard/_hooks/use-day-timeline-events";
import type { DayBudget } from "@/app/dashboard/_hooks/use-day-budget";

// ---------------------------------------------------------------------------
// Design shapes — exact objects oversikt.jsx reads
// ---------------------------------------------------------------------------

export interface DesignAction {
  id: string;
  kind: "Avvik" | "Godkjenning" | "Levering";
  sev: "crit" | "warn" | "info";
  ic: string;
  title: string;
  meta: string;
  deadline: string | null;
  who: { i: string; c: string } | null;
  cta: string;
  primary: boolean;
  toast: string;
}

export interface DesignRosterEntry {
  i: string | null; // initials or null for gap
  nm: string;
  rl: string;
  c: string;
  dep: string; // dept slug — GAP: defaulted "sal"
  s: number; // start hour — GAP: defaulted from shift row or 9
  e: number; // end hour   — GAP: defaulted from shift row or 17
  status: "on" | "soon" | "gap";
}

export interface DesignFeedItem {
  c: string; // color (CSS var or hex)
  who: string;
  text: string;
  t: string; // time label
}

export interface DesignReceiptEntry {
  i: string;
  nm: string;
  c: string;
  read: boolean;
}

export interface DesignPulse {
  onShift: string;
  onShiftUnit: string;
  onShiftSub: string;
  mustResolve: number;
  mustResolveSub: string;
  pendingApprovals: number;
  pendingApprovalsSub: string;
  unread: number;
  unreadSub: string;
  coveragePct: number | null;
  coverageSub: string;
}

export interface DesignOversikt {
  actions: DesignAction[];
  roster: DesignRosterEntry[];
  feed: DesignFeedItem[];
  receipts: DesignReceiptEntry[];
  pulse: DesignPulse;
  /** Budget is null when workspace_budget is 0-seeded (F0.4 trap). */
  budget: DayBudget | null;
  /** Greeting name derived from profile.display_name first token. */
  greetingName: string;
  /** e.g. "Torsdag · 30. mai 2026 · 08:14" */
  dateLabel: string;
  /** Staff status summary e.g. "4 av 5" */
  staffSummary: string;
  /** Number of staffing gaps (gap roster entries). */
  gapCount: number;
  /** Number of items that must be resolved before 12:00 (crit actions). */
  resolveCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEPT_SLUG: Record<string, string> = {
  kjokken: "kjokken",
  sal: "sal",
  bar: "bar",
  event: "event",
  lager: "lager",
  admin: "sal",
};

function deptSlug(name: string): string {
  const lower = name.toLowerCase().replace(/ø/g, "o").replace(/å/g, "a").replace(/æ/g, "ae");
  for (const key of Object.keys(DEPT_SLUG)) {
    if (lower.includes(key)) return DEPT_SLUG[key] ?? "sal";
  }
  return "sal"; // GAP: fallback
}

function timeToHour(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):/);
  return m ? parseInt(m[1] ?? "0", 10) : null;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const TONE_COLOR: Record<string, string> = {
  destructive: "var(--error)",
  warning: "var(--warning)",
  success: "var(--success)",
  info: "var(--info)",
  muted: "var(--muted)",
};

function feedColor(tone: string | undefined): string {
  return TONE_COLOR[tone ?? "muted"] ?? "var(--muted)";
}

function formatTimeLabel(isoOrLabel: string | null | undefined, now: Date): string {
  if (!isoOrLabel) return "—";
  const d = new Date(isoOrLabel);
  if (Number.isNaN(d.getTime())) return isoOrLabel;
  const diffMs = now.getTime() - d.getTime();
  const diffHr = diffMs / 3600000;
  if (diffHr < 1) return `${Math.round(diffMs / 60000)} min siden`;
  if (diffHr < 24) return d.toTimeString().slice(0, 5);
  return "i går";
}

function norwegianDateLabel(d: Date): string {
  const DAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
  const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  const dayName = DAYS[d.getDay()] ?? "";
  const month = MONTHS[d.getMonth()] ?? "";
  const hhmm = d.toTimeString().slice(0, 5);
  return `${dayName} · ${d.getDate()}. ${month} ${d.getFullYear()} · ${hhmm}`;
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

export function toDesignOversikt(
  cockpit: CockpitFirstScreenReadModel,
  shiftStats: ShiftDayStats | null,
  feedEvents: DayEvent[],
  budget: DayBudget | null,
  greetingName: string,
  now: Date,
  /** Wired: count from usePendingApprovals (department_session rows with status=pending_signoff). */
  pendingApprovalsCount?: number,
  /** Wired: total unread notification/channel count from useUnreadCounts. */
  unreadCount?: number,
): DesignOversikt {
  // ── ACTIONS ────────────────────────────────────────────────────────────────
  // Sourced from cockpit.operationalQueue. Each OperationalRisk → one DesignAction.
  // GAP: OperationalRisk shape does not carry enough per-item detail (title, meta,
  // deadline, who) to fully render the design. We map what we have and default the rest.
  const actions: DesignAction[] = cockpit.operationalQueue.map((risk, idx) => {
    const isCrit = risk.severity === "critical";

    // Derive kind from the risk's identity field.
    // GAP: risk.id is our best discriminator; no explicit kind column.
    let kind: DesignAction["kind"] = "Avvik";
    if (risk.id.includes("approval") || risk.blockingDeviations === 0) kind = "Godkjenning";

    const ic = kind === "Avvik" ? "thermometer" : kind === "Godkjenning" ? "checkdoc" : "clock";
    const cta = kind === "Avvik" ? "Løs nå" : kind === "Godkjenning" ? "Godkjenn" : "Klargjør";
    const sev: DesignAction["sev"] = isCrit
      ? "crit"
      : risk.severity === "warning"
        ? "warn"
        : "info";

    // GAP: title and meta not available on OperationalRisk — defaulting.
    const title =
      risk.overdueTasks > 0
        ? `${risk.overdueTasks} forsinket${risk.overdueTasks > 1 ? "e" : ""} oppgave${risk.overdueTasks > 1 ? "r" : ""}`
        : risk.blockingDeviations > 0
          ? `${risk.blockingDeviations} åpent avvik — krever oppfølging`
          : `${risk.upcomingTasks} oppgave${risk.upcomingTasks !== 1 ? "r" : ""} kommende`;

    const meta =
      risk.overdueTasks > 0
        ? "Forsinket · sjekk Oppgaver"
        : risk.blockingDeviations > 0
          ? "Avvik · sjekk HMS"
          : "Snart · sjekk Oppgaver";

    return {
      id: risk.id,
      kind,
      sev,
      ic,
      title,
      meta,
      deadline: null, // GAP: no due_at on OperationalRisk
      who: null, // GAP: no assignee on OperationalRisk
      cta,
      primary: idx === 0 && isCrit, // first crit item gets primary styling
      toast: `${kind}: åpnet`, // GAP: no per-item toast text from backend
    };
  });

  // ── ROSTER ─────────────────────────────────────────────────────────────────
  // Sourced from cockpit.onDutyEntries (LiveShiftEntry). Each entry → one roster row.
  // staffing gaps appear as gap entries in staffingQueue.
  const rosterEntries: DesignRosterEntry[] = cockpit.onDutyEntries.map((entry) => {
    const hasPunchedIn = entry.status === "clocked_in" || entry.status === "on_break";
    const isSoon = entry.status === "waiting";
    const name = entry.employeeName; // LiveShiftEntry uses employeeName, not name
    return {
      i: entry.initials || initials(name),
      nm: name,
      rl: entry.role,
      c: "#7a756e", // GAP: profile color not in LiveShiftEntry
      dep: "sal", // GAP: no department field on LiveShiftEntry
      s: timeToHour(entry.startTime) ?? 9, // startTime is HH:MM or undefined
      e: 17, // GAP: endTime not on LiveShiftEntry
      status: hasPunchedIn ? "on" : isSoon ? "soon" : "on",
    };
  });

  // Append gap entries from staffing queue (uncovered shifts)
  for (const risk of cockpit.staffingQueue) {
    for (let i = 0; i < risk.uncoveredShifts; i++) {
      rosterEntries.push({
        i: null,
        nm: "Ukjent rolle", // GAP: gap role not described in StaffingRisk
        rl: "Mangler bemanning",
        c: "#7a756e",
        dep: "sal", // GAP: no dept on StaffingRisk
        s: 9,
        e: 17,
        status: "gap",
      });
    }
  }

  // ── FEED ───────────────────────────────────────────────────────────────────
  // Sourced from feedEvents (DayEvent[]) — sorted chronologically by hook.
  const feed: DesignFeedItem[] = feedEvents.slice(0, 5).map((ev) => ({
    c: feedColor(ev.tone),
    who: ev.actor ?? ev.title.slice(0, 20),
    text: ` ${ev.title}`,
    t: formatTimeLabel(ev.iso, now),
  }));

  // ── RECEIPTS ───────────────────────────────────────────────────────────────
  // GAP: No read-receipt hook on oversikt surface yet. Returns empty array.
  // oversikt.budget_empty_state_shown is emitted client-side when budget is null.
  const receipts: DesignReceiptEntry[] = [];

  // ── PULSE ──────────────────────────────────────────────────────────────────
  const total = shiftStats?.total ?? cockpit.onDutyEntries.length;
  const onShiftCount =
    shiftStats?.onShift ??
    cockpit.onDutyEntries.filter((e) => e.status === "clocked_in" || e.status === "on_break")
      .length;
  const mustResolve = cockpit.operationalQueue.reduce(
    (s, r) =>
      s +
      (r.overdueTasks > 0 ? r.overdueTasks : r.blockingDeviations > 0 ? r.blockingDeviations : 0),
    0,
  );
  const gapCount = cockpit.staffingQueue.reduce((s, r) => s + r.uncoveredShifts, 0);

  const pulse: DesignPulse = {
    onShift: String(onShiftCount),
    onShiftUnit: `/ ${total}`,
    onShiftSub: shiftStats?.coming ? `${shiftStats.coming} møter senere` : "ingen kommende",
    mustResolve,
    mustResolveSub: mustResolve > 0 ? "sjekk Oppgaver" : "alt under kontroll",
    pendingApprovals: pendingApprovalsCount ?? 0, // Wired: usePendingApprovals count
    pendingApprovalsSub: "sjekk Avstemming",
    unread: unreadCount ?? 0, // Wired: useUnreadCounts total
    unreadSub: "sjekk Kommunikasjon",
    coveragePct: null, // GAP: coverage % not available from current hooks
    coverageSub: "sjekk Vaktplan",
  };

  // ── METADATA ───────────────────────────────────────────────────────────────
  const firstName = greetingName.split(" ")[0] ?? greetingName;
  const dateLabel = norwegianDateLabel(now);
  const staffSummary = `${onShiftCount} av ${total}`;
  const resolveCount = cockpit.operationalQueue.filter((r) => r.severity === "critical").length;

  return {
    actions,
    roster: rosterEntries,
    feed,
    receipts,
    pulse,
    budget,
    greetingName: firstName,
    dateLabel,
    staffSummary,
    gapCount,
    resolveCount,
  };
}
