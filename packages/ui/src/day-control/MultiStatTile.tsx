import { cn } from "../lib/utils";

export type MultiStat = {
  label: string;
  value: string | number;
  unit?: string;
  tone?: "default" | "muted" | "warning" | "success" | "destructive";
};

const TONE_CLASS: Record<NonNullable<MultiStat["tone"]>, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  warning: "text-[color:var(--warning)]",
  success: "text-[color:var(--success)]",
  destructive: "text-destructive",
};

/**
 * MultiStatTile — single card containing 1–3 numeric stats sharing a label.
 *
 * Pattern: one eyebrow title, columnar stats with monospaced values + small
 * sub-label per column. No `sub`-text, no source footnote.
 */
export function MultiStatTile({
  title,
  stats,
  className,
}: {
  title: string;
  stats: MultiStat[];
  className?: string;
}) {
  const cols =
    stats.length === 3 ? "grid-cols-3" : stats.length === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div
      className={cn(
        "bg-card border-border relative overflow-hidden rounded-[14px] border p-4.5",
        className,
      )}
    >
      <div className="text-muted-foreground mb-3 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase">
        {title}
      </div>
      <div className={cn("grid gap-3", cols)}>
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  "font-mono text-[22px] font-black tracking-[-0.02em] tabular-nums",
                  TONE_CLASS[s.tone ?? "default"],
                )}
              >
                {s.value}
              </span>
              {s.unit ? (
                <span className="text-muted-foreground text-[12px] font-medium">{s.unit}</span>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-0.5 truncate text-[11px]">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
