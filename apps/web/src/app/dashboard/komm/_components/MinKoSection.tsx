"use client";

/**
 * MinKoSection — "Min kø" sidebar section (ADR-0165).
 *
 * Renders ABOVE the Kanaler channel list in the sidebar when the current
 * user is assignee on any open helpdesk ticket. Each row shows:
 *   - Channel name (the desk, rolled up from context.desk_channel_id)
 *   - Unresolved-ticket count (pluralized)
 *   - Age of the oldest ticket (Geist Mono, color-shift at 5m → amber,
 *     15m → red). prefers-reduced-motion disables the transition.
 *
 * Empty state: render nothing. Do NOT show an empty card — spec says the
 * section only appears when the user actually has work waiting, so the
 * sidebar stays quiet for ICs who aren't reps.
 *
 * Click → hydrates the active channel (same handler shape as ChannelList).
 */

import * as React from "react";
import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { useMinKo, type MinKoEntry } from "../_hooks/useMinKo";

type MinKoSectionProps = {
  profileId: string | null;
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
};

/** Minutes since an ISO timestamp. Clamps negative (clock skew) to 0. */
function minutesSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  const diffMs = Date.now() - then;
  return Math.max(0, Math.floor(diffMs / 60_000));
}

/**
 * Color-shift for the age label.
 *   0–4m   → muted (neutral)
 *   5–14m  → amber (warning)
 *   15m+   → destructive (urgent)
 * Tailwind text-* tokens resolve to warm OKLCH per Nordic Split — no
 * hardcoded hex. Transition is motion-safe only.
 */
function ageClassName(minutes: number): string {
  if (minutes >= 15) return "text-destructive";
  if (minutes >= 5) return "text-amber-600 dark:text-amber-500";
  return "text-muted-foreground";
}

export function MinKoSection({ profileId, activeChannelId, onSelectChannel }: MinKoSectionProps) {
  const { t } = useTranslation("helpdesk");
  const { data: entries } = useMinKo(profileId);

  // Empty state per spec: render nothing at all.
  if (!entries || entries.length === 0) return null;

  return (
    <section aria-label={t("min_ko.heading")} className="border-border/50 border-b">
      <div className="text-muted-foreground flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-medium tracking-wider uppercase">
        <LifeBuoy className="h-3 w-3" aria-hidden="true" />
        {t("min_ko.heading")}
      </div>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <MinKoRow
            key={entry.channel_id}
            entry={entry}
            isActive={entry.channel_id === activeChannelId}
            onClick={() => onSelectChannel(entry.channel_id)}
          />
        ))}
      </ul>
    </section>
  );
}

// ── Internal row ────────────────────────────────────────────────────────

type MinKoRowProps = {
  entry: MinKoEntry;
  isActive: boolean;
  onClick: () => void;
};

function MinKoRow({ entry, isActive, onClick }: MinKoRowProps) {
  const { t } = useTranslation("helpdesk");

  // Re-render every 30s so the age color-shift updates while the user is
  // looking at the sidebar. Interval cleared on unmount to avoid leaks.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const minutes = minutesSince(entry.oldest_started_at);
  const ageClass = ageClassName(minutes);

  const countLabel =
    entry.unresolved_count === 1
      ? t("min_ko.unresolved_one", { count: entry.unresolved_count })
      : t("min_ko.unresolved_other", { count: entry.unresolved_count });

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors motion-reduce:transition-none",
          isActive
            ? "bg-accent border-primary border-l-2"
            : "hover:bg-accent/50 border-l-2 border-transparent",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-sm font-medium">{entry.channel_name}</div>
          <div className="text-muted-foreground text-xs">{countLabel}</div>
        </div>
        <span
          className={cn(
            "font-mono text-xs tabular-nums transition-colors motion-reduce:transition-none",
            ageClass,
          )}
          aria-label={t("min_ko.age_short", { minutes })}
        >
          {t("min_ko.age_short", { minutes })}
        </span>
      </button>
    </li>
  );
}
