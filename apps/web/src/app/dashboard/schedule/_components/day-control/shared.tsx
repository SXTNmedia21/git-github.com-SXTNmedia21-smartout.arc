// ============================================
// day-control/shared.tsx
// Shared helpers, small components, and types for the Day Control Center.
// ============================================

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

// ── Date formatting ──────────────────────────────────────────

const DAY_NAMES_FULL = ["Sondag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lordag"];
const MONTH_NAMES = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

export function formatDateLabel(dateId: string | null): string {
  if (!dateId) return "";
  const date = new Date(dateId + "T00:00:00");
  const dayName = DAY_NAMES_FULL[date.getDay()] ?? "";
  return `${dayName} ${date.getDate()}. ${MONTH_NAMES[date.getMonth()] ?? ""}`.toUpperCase();
}

// ── Currency ─────────────────────────────────────────────────

export function formatNok(amount: number): string {
  return `${amount.toLocaleString("nb-NO")} kr`;
}

// ── Hours ────────────────────────────────────────────────────

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

// ── Time parsing ─────────────────────────────────────────────

export function timeToHour(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
}

// ── Task status cycling ──────────────────────────────────────

import type { TaskStatus } from "../schedule-types";

export function nextTaskStatus(current: TaskStatus): TaskStatus {
  switch (current) {
    case "pending":
      return "in_progress";
    case "in_progress":
      return "completed";
    case "completed":
      return "pending";
    default:
      return "pending";
  }
}

// ── Section Header ───────────────────────────────────────────

export function SectionHeader({ label, children }: { label: string; children?: React.ReactNode }) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3
        className={`text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-muted-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </h3>
      {children}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  editing,
  editValue,
  onEditChange,
}: {
  label: string;
  value: string;
  editing?: boolean;
  editValue?: number;
  onEditChange?: (v: string) => void;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`rounded-xl border p-3 ${isDark ? "border-border bg-muted/30" : "border-border bg-card"}`}
    >
      <span className="text-muted-foreground block text-[9px] font-bold tracking-widest uppercase">
        {label}
      </span>
      {editing && onEditChange ? (
        <input
          type="number"
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          className="border-input mt-1 w-full rounded border bg-transparent px-1 py-0.5 text-sm font-black"
        />
      ) : (
        <div className="text-foreground mt-1 text-base leading-tight font-black">{value}</div>
      )}
    </div>
  );
}

// ── Tab Button ───────────────────────────────────────────────

export function TabButton({
  active,
  label,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[10px] font-bold whitespace-nowrap transition-colors ${active ? "border-accent text-accent" : "text-muted-foreground hover:text-foreground/70 border-transparent"}`}
    >
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span
          className={`ml-0.5 min-w-[16px] rounded-full px-1 py-px text-center text-[8px] leading-tight font-black ${active ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Message Card ─────────────────────────────────────────────

import { AlertCircle, Eye, Trash2 } from "lucide-react";

export function MessageCard({
  title,
  audience,
  author,
  time,
  content,
  alert,
  onDelete,
}: {
  title: string;
  audience: string;
  author: string;
  time: string;
  content: string;
  alert?: boolean;
  onDelete?: () => void;
}) {
  const { isDark } = useContext(DashboardContext);
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${alert ? "border-destructive/30 bg-destructive/10" : isDark ? "border-border bg-muted/30" : "border-border bg-card"}`}
    >
      <div className="mb-2 flex items-start justify-between">
        <h5
          className={`flex items-center gap-1.5 text-xs font-black ${alert ? "text-destructive" : "text-foreground"}`}
        >
          {alert ? <AlertCircle className="h-3.5 w-3.5" /> : null} {title}
        </h5>
        <div className="flex items-center gap-2">
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase">
            {time}
          </span>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mb-3 text-xs leading-relaxed">{content}</p>
      <div className="text-muted-foreground flex items-center justify-between text-[10px] font-bold">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> Synlig for: {audience}
        </span>
        <span className="italic">Av: {author}</span>
      </div>
    </div>
  );
}
