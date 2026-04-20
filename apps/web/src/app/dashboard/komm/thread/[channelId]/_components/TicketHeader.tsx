"use client";

/**
 * TicketHeader — Spec §2.1.
 *
 * Replaces the default ChannelHeader when the resolved channel is a
 * query_thread. Back button routes to /dashboard/komm. Status orb drives
 * state visualization (waiting pulses, active static, complete static
 * with check overlay). Reassign dropdown is Phase 2 (hidden in Phase 1 —
 * see Spec §2.1 right cluster notes).
 */

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsibilityOrb, LighthouseAvatar, StatusLabel, type TicketStatus } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";

export type TicketHeaderProfile = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type TicketHeaderProps = {
  status: TicketStatus;
  summary: string;
  requester: TicketHeaderProfile | null;
  assignee: TicketHeaderProfile | null;
  resolvedAtIso: string | null;
  onResolveClick: () => void;
};

function formatResolvedTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function TicketHeader({
  status,
  summary,
  requester,
  assignee,
  resolvedAtIso,
  onResolveClick,
}: TicketHeaderProps) {
  const { t } = useTranslation("helpdesk");
  const statusLabelText: Record<TicketStatus, string> = {
    waiting: t("ticket_status.waiting"),
    active: t("ticket_status.active"),
    complete: t("ticket_status.complete"),
  };

  return (
    <header
      role="region"
      aria-label="Saksinformasjon"
      className="bg-background/70 border-border/40 relative flex h-20 items-center gap-4 border-b px-6 backdrop-blur-md"
    >
      <Link
        href="/dashboard/komm"
        aria-label={t("ticket_header.back")}
        className="hover:bg-muted/50 -ml-2 inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors"
      >
        <ChevronLeft size={20} />
      </Link>

      <div className="relative">
        <ResponsibilityOrb status={status} size={48} decorative />
        {status === "complete" ? (
          <Check
            size={24}
            className="text-foreground/80 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <StatusLabel
          status={status}
          labels={{
            waiting: t("ticket_status.waiting_upper"),
            active: t("ticket_status.active_upper"),
            complete: t("ticket_status.complete_upper"),
          }}
        />
        <h1 className="font-heading text-foreground truncate text-2xl leading-tight">{summary}</h1>
        <div className="mt-1 flex items-center gap-1.5">
          {requester ? (
            <LighthouseAvatar
              avatarUrl={requester.avatar_url}
              name={requester.display_name}
              size={20}
              haloState="idle"
            />
          ) : null}
          {requester && assignee ? (
            <span className="text-muted-foreground text-xs">
              {requester.display_name}
              <span className="mx-1.5">→</span>
            </span>
          ) : null}
          {assignee ? (
            <>
              {/*
                Pulse-budget dedupe: the 48px status orb already pulses on
                waiting tickets. Keeping the 20px assignee halo calm avoids
                two pulsing elements co-located in the same header band
                (Nordic Split: max 3 pulses per viewport).
              */}
              <LighthouseAvatar
                avatarUrl={assignee.avatar_url}
                name={assignee.display_name}
                size={20}
                haloState={status === "complete" ? "idle" : "active"}
              />
              <span className="text-muted-foreground text-xs">{assignee.display_name}</span>
            </>
          ) : null}
          {!requester && !assignee ? (
            <span className="sr-only">{statusLabelText[status]}</span>
          ) : null}
        </div>
      </div>

      {status === "complete" ? (
        <span
          className="bg-muted/50 text-foreground rounded-full px-2 py-0.5 font-mono text-[11px]"
          aria-label={t("ticket_header.resolved_at", { time: formatResolvedTime(resolvedAtIso) })}
        >
          <Check size={12} className="mr-1 inline-block" aria-hidden="true" />
          {t("ticket_header.resolved_at", { time: formatResolvedTime(resolvedAtIso) })}
        </span>
      ) : (
        <Button onClick={onResolveClick} aria-label={`Løs saken: ${summary}`}>
          {t("ticket_action.resolve")}
        </Button>
      )}
    </header>
  );
}
