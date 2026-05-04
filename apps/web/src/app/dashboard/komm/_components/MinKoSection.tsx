"use client";

/**
 * MinKoSection — "Min kø" sidebar section (ADR-0165).
 *
 * Renders ABOVE the Kanaler channel list in the sidebar when the current
 * user is assignee on any open helpdesk ticket. Each row shows:
 *   - Channel name (the desk, rolled up from context.desk_channel_id)
 *   - Unresolved-ticket count (pluralized)
 *   - Age of the oldest ticket (Geist Mono, muted foreground — no escalation
 *     color in Phase 1. Spec §1.4 + §4.6: never red, never alarm color.)
 *
 * Empty state: render nothing. Do NOT show an empty card — spec says the
 * section only appears when the user actually has work waiting, so the
 * sidebar stays quiet for ICs who aren't reps.
 *
 * Click → hydrates the active channel (same handler shape as ChannelList).
 */

import { LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { Pill } from "@/components/helpdesk-orb";
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

  const minutes = minutesSince(entry.oldest_started_at);

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
          className="text-muted-foreground font-mono text-xs tabular-nums"
          aria-label={t("min_ko.age_short", { minutes })}
        >
          {t("min_ko.age_short", { minutes })}
        </span>
        {entry.has_breach ? (
          <Pill tone="muted" className="text-muted-foreground" data-testid="overdue-badge">
            Forfalt
          </Pill>
        ) : null}
      </button>
    </li>
  );
}
