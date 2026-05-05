"use client";

/**
 * DeskCard — Spec §1.4.
 *
 * Two visual states: assigned (lighthouse avatar + rep) and orphan (dashed
 * border + AlertCircle + "Tildel ansvarlig" inline CTA). Click opens the
 * QueueSheet. Hover/focus uses border contrast only — no lift, no scale.
 */

import * as React from "react";
import { AlertCircle, MoreHorizontal, ArrowUpRight } from "lucide-react";
import { LighthouseAvatar } from "@smartout/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@smartout/i18n";
import { cn } from "@/lib/utils";

export type DeskSummary = {
  id: string;
  name: string;
  description: string | null;
  responsible: {
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  open_count: number;
  last_active_at: string | null;
};

export type DeskCardProps = {
  desk: DeskSummary;
  onOpenQueue: (desk: DeskSummary) => void;
  onAssign: (desk: DeskSummary) => void;
  onReassign: (desk: DeskSummary) => void;
  onArchive: (desk: DeskSummary) => void;
  /** Whether the current viewer has admin privileges — gates the dropdown. */
  canManage: boolean;
};

function formatRelative(iso: string | null, t: (k: string) => string): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return null;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "nå nettopp";
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  return `${d} d siden`;
}

export function DeskCard({
  desk,
  onOpenQueue,
  onAssign,
  onReassign,
  onArchive,
  canManage,
}: DeskCardProps) {
  const { t } = useTranslation("helpdesk");
  const orphan = !desk.responsible;
  const relLastActive = formatRelative(desk.last_active_at, t);

  const handleCardClick = () => {
    if (orphan) {
      onAssign(desk);
    } else {
      onOpenQueue(desk);
    }
  };

  const ariaLabel = orphan
    ? `${desk.name}, ${t("desk_card.orphan_label")}. ${t("desk_card.orphan_cta")}.`
    : `${desk.name}, ansvarlig ${desk.responsible!.display_name}, ${desk.open_count} åpne saker. ${t(
        "desk_card.open_queue",
      )}.`;

  return (
    <div
      className={cn(
        "bg-card relative rounded-2xl border p-6 transition-colors",
        orphan
          ? "border-border/60 bg-card/60 border-dashed"
          : "border-border/40 hover:border-border/80",
      )}
    >
      <button
        type="button"
        onClick={handleCardClick}
        aria-label={ariaLabel}
        className="focus-visible:ring-ring focus-visible:ring-offset-background absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="sr-only">{ariaLabel}</span>
      </button>

      <div className="pointer-events-none relative flex items-start gap-4">
        {orphan ? (
          <div className="flex h-14 w-14 items-center justify-center" aria-hidden="true">
            <AlertCircle size={40} className="text-muted-foreground" />
          </div>
        ) : (
          <LighthouseAvatar
            avatarUrl={desk.responsible!.avatar_url}
            name={desk.responsible!.display_name}
            size={56}
            haloState={desk.open_count > 0 ? "waiting" : "idle"}
          />
        )}

        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2
              className={cn(
                "font-heading text-2xl",
                orphan ? "text-foreground/70" : "text-foreground",
              )}
            >
              {desk.name}
            </h2>
            {desk.open_count > 0 && !orphan ? (
              <span className="bg-muted/50 text-foreground rounded-full px-2 py-0.5 font-mono text-[11px]">
                {t("desk_card.new_badge", { count: desk.open_count })}
              </span>
            ) : null}
          </div>

          {orphan ? (
            <>
              <p className="text-muted-foreground mt-1 text-sm">{t("desk_card.orphan_label")}</p>
              <div className="pointer-events-auto mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(desk);
                  }}
                >
                  {t("desk_card.orphan_cta")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-foreground mt-1 text-sm">{desk.responsible!.display_name}</p>
              {relLastActive ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t("desk_card.last_active", { rel: relLastActive })}
                </p>
              ) : null}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">
                  {desk.open_count === 0
                    ? "0 åpne saker"
                    : desk.open_count === 1
                      ? t("desk_card.open_count_one", { count: 1 })
                      : t("desk_card.open_count_other", { count: desk.open_count })}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
                  {t("desk_card.open_queue")} <ArrowUpRight size={14} />
                </span>
              </div>
            </>
          )}
        </div>

        {canManage ? (
          <div className="pointer-events-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Flere handlinger"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReassign(desk)}>
                  {orphan ? t("desk_card.orphan_cta") : "Endre ansvarlig"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onArchive(desk)} className="text-muted-foreground">
                  Arkiver skranke
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
    </div>
  );
}
