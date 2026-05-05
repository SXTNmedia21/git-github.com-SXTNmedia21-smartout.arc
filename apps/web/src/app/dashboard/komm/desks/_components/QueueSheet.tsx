"use client";

/**
 * QueueSheet — Spec §1.5.
 *
 * Right-side Sheet showing up to 10 most recent open tickets for the
 * clicked desk. Row click navigates to /dashboard/komm/chat?thread={channelId}
 * (the existing Komm surface — ticket conversation fork lives inside
 * KanalerClient via the query-thread branch).
 */

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LighthouseAvatar } from "@smartout/ui";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import Link from "next/link";

export type QueueTicketRow = {
  ticket_id: string;
  channel_id: string;
  summary: string;
  opened_at: string;
  requester: {
    profile_id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type DeskQueueContext = {
  desk_channel_id: string;
  desk_name: string;
  responsible_name: string;
  responsible_avatar_url: string | null;
  open_count: number;
};

export type QueueSheetProps = {
  desk: DeskQueueContext | null;
  onOpenChange: (open: boolean) => void;
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "nå";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

function useDeskQueue(deskChannelId: string | null) {
  return useQuery({
    queryKey: ["helpdesk", "desk-queue", deskChannelId],
    enabled: Boolean(deskChannelId),
    staleTime: 15_000,
    queryFn: async (): Promise<QueueTicketRow[]> => {
      if (!deskChannelId) return [];
      const supabase = createClient();
      // engine_state rows for helpdesk_query_lifecycle where context contains
      // this desk. `.contains` on jsonb works against a partial shape.
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, entity_id, context, started_at")
        .eq("process_id", "helpdesk_query_lifecycle")
        .in("status", ["waiting", "active"])
        .contains("context", { desk_channel_id: deskChannelId })
        .order("started_at", { ascending: false })
        .limit(10);

      if (error || !data) return [];

      const requesterIds = Array.from(
        new Set(
          data
            .map(
              (row) =>
                (row.context as { requester_profile_id?: string } | null)?.requester_profile_id,
            )
            .filter((v): v is string => typeof v === "string"),
        ),
      );
      const { data: profiles } = requesterIds.length
        ? await supabase
            .from("profile")
            .select("profile_id, display_name, avatar_url")
            .in("profile_id", requesterIds)
        : { data: [] };
      const byId = new Map((profiles ?? []).map((p) => [p.profile_id, p]));

      return data.map((row) => {
        const ctx =
          (row.context as {
            summary?: string;
            requester_profile_id?: string;
          } | null) ?? {};
        const requesterId = ctx.requester_profile_id;
        const profile = requesterId ? byId.get(requesterId) : undefined;
        return {
          ticket_id: row.id,
          channel_id: row.entity_id ?? "",
          summary: ctx.summary ?? "Uten tittel",
          opened_at: row.started_at,
          requester: profile
            ? {
                profile_id: profile.profile_id,
                display_name: profile.display_name ?? "ukjent",
                avatar_url: profile.avatar_url,
              }
            : null,
        };
      });
    },
  });
}

export function QueueSheet({ desk, onOpenChange }: QueueSheetProps) {
  const { t } = useTranslation("helpdesk");
  const { data: tickets, isLoading } = useDeskQueue(desk?.desk_channel_id ?? null);

  return (
    <Sheet open={Boolean(desk)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-background/85 border-border/60 w-[420px] border-l backdrop-blur-xl sm:w-[420px] sm:max-w-[420px]"
      >
        {desk ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <LighthouseAvatar
                  avatarUrl={desk.responsible_avatar_url}
                  name={desk.responsible_name}
                  size={40}
                  haloState={desk.open_count > 0 ? "waiting" : "idle"}
                />
                <div>
                  <SheetTitle className="font-heading text-foreground text-xl leading-tight">
                    {desk.desk_name}
                  </SheetTitle>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {desk.responsible_name} ·{" "}
                    {desk.open_count === 0
                      ? "0 åpne saker"
                      : desk.open_count === 1
                        ? t("desk_card.open_count_one", { count: 1 })
                        : t("desk_card.open_count_other", { count: desk.open_count })}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-1">
              {isLoading ? (
                <p className="text-muted-foreground px-1 text-sm">Henter kø…</p>
              ) : tickets && tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <Link
                    key={ticket.ticket_id}
                    href={`/dashboard/komm/thread/${ticket.channel_id}`}
                    onClick={() => onOpenChange(false)}
                    className="group hover:bg-muted/40 flex items-start gap-3 rounded-xl p-3 transition-colors"
                  >
                    {ticket.requester ? (
                      <LighthouseAvatar
                        avatarUrl={ticket.requester.avatar_url}
                        name={ticket.requester.display_name}
                        size={28}
                        haloState="idle"
                      />
                    ) : (
                      <div className="bg-muted h-10 w-10 rounded-full" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm">
                        {ticket.requester?.display_name ?? "ukjent"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{ticket.summary}</p>
                    </div>
                    <span className="text-muted-foreground mt-1 font-mono text-[10px]">
                      {relative(ticket.opened_at)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground px-1 text-sm">Ingen åpne saker i køen.</p>
              )}
            </div>

            <div className="mt-6">
              <Button
                asChild
                variant="ghost"
                className="text-muted-foreground inline-flex items-center gap-1"
              >
                <Link href={`/dashboard/komm/chat?desk=${desk.desk_channel_id}`}>
                  {t("desk_queue_sheet.view_all")} <ArrowUpRight size={14} />
                </Link>
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
