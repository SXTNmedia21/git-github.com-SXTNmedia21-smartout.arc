"use client";

/**
 * TicketHeader — redesigned to Nordic Split prototype fidelity.
 *
 * Pixel source: docs/design/smartout-design-helpdesk/project/prototype/web-helpdesk.jsx:142-186
 *
 * Glassy header bar with:
 *  - Back chevron (link to /dashboard/komm)
 *  - 52px pulsing status Orb (from @/components/helpdesk-orb)
 *  - Status label + " · #channel · åpnet X min siden" context line
 *  - Instrument Serif 24px title (ticket summary)
 *  - Linn → Sofia (deg) avatar flow with 18px LighthouseAvatars
 *  - [Tildel på nytt] outline + [Løs sak] primary action buttons
 *
 * Behavior preserved verbatim: same props, same click handlers, same
 * resolved-at badge pattern. Only layout/classes change.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Orb, LighthouseAvatar, StatusLabel } from "@/components/helpdesk-orb";
import type { OrbStatus } from "@/components/helpdesk-orb";
import { useTranslation } from "@smartout/i18n";

export type TicketHeaderProfile = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
};

export type TicketHeaderProps = {
  status: OrbStatus;
  summary: string;
  requester: TicketHeaderProfile | null;
  assignee: TicketHeaderProfile | null;
  resolvedAtIso: string | null;
  channelName?: string | null;
  openedAtIso?: string | null;
  onResolveClick: () => void;
};

function formatResolvedTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatRelativeAgo(iso: string | null | undefined, locale: "nb" | "en"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000));
  if (mins < 1) return locale === "nb" ? "nå" : "now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return locale === "nb" ? `${hours} t` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return locale === "nb" ? `${days} d` : `${days}d`;
}

export function TicketHeader({
  status,
  summary,
  requester,
  assignee,
  resolvedAtIso,
  channelName,
  openedAtIso,
  onResolveClick,
}: TicketHeaderProps) {
  const { t, locale } = useTranslation("helpdesk");
  const langMode: "nb" | "en" = locale === "en" ? "en" : "nb";
  const ago = formatRelativeAgo(openedAtIso, langMode);
  const ctx = [
    channelName ? `#${channelName.replace(/^#/, "")}` : null,
    ago ? t("ticket_header.opened_ago", { ago }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <header
      role="region"
      aria-label="Saksinformasjon"
      className="bg-background/70 border-border flex items-center gap-4 border-b px-7 py-[18px] backdrop-blur-xl"
    >
      <Link
        href="/dashboard/komm"
        aria-label={t("ticket_header.back")}
        className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
      >
        <ChevronLeft size={18} />
      </Link>

      <div className="relative">
        <Orb size={52} status={status} pulse={status === "waiting"} />
        {status === "complete" ? (
          <Check
            size={20}
            className="text-foreground/85 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
            strokeWidth={2.25}
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <StatusLabel status={status} />
          {ctx ? (
            <>
              <span className="text-muted-foreground font-mono text-[11px]">·</span>
              <span className="text-muted-foreground font-mono text-[11px]">{ctx}</span>
            </>
          ) : null}
        </div>

        <h1
          className="font-heading text-foreground truncate text-2xl leading-[1.15]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {summary}
        </h1>

        <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[13px]">
          {requester ? (
            <>
              <LighthouseAvatar
                name={requester.display_name}
                src={requester.avatar_url ?? undefined}
                size={18}
                halo="idle"
              />
              <span>{requester.display_name.split(/\s+/)[0]}</span>
            </>
          ) : null}
          {requester && assignee ? (
            <ArrowRight size={12} className="opacity-50" aria-hidden="true" />
          ) : null}
          {assignee ? (
            <>
              <LighthouseAvatar
                name={assignee.display_name}
                src={assignee.avatar_url ?? undefined}
                size={18}
                halo={status === "complete" ? "idle" : "active"}
              />
              <span>
                {assignee.display_name.split(/\s+/)[0]} {t("ticket_header.you_suffix")}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status === "complete" ? (
          <span
            className="bg-muted/60 text-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px]"
            aria-label={t("ticket_header.resolved_at", { time: formatResolvedTime(resolvedAtIso) })}
          >
            <Check size={12} strokeWidth={2.25} aria-hidden="true" />
            {t("ticket_header.resolved_at", { time: formatResolvedTime(resolvedAtIso) })}
          </span>
        ) : (
          <>
            {/* Reassign affordance deferred to Phase 2 per ADR-0161 + JOURNEY-helpdesk-web.md */}
            <Button
              onClick={onResolveClick}
              size="sm"
              className="gap-1.5"
              aria-label={`Løs saken: ${summary}`}
            >
              <Check size={14} strokeWidth={2.25} aria-hidden="true" />
              {t("ticket_action.resolve")}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
