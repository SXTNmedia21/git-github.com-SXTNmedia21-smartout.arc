"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { sendBroadcastAction } from "@/app/dashboard/_actions/send-broadcast-action";
import { BroadcastComposer } from "../widgets";
import type { BroadcastType } from "../widgets";

export function BroadcastTab({
  sessionId,
  departmentId,
}: {
  sessionId?: string;
  departmentId?: string;
}) {
  const [busy, startTransition] = useTransition();
  const [recentBroadcasts, setRecentBroadcasts] = useState<
    Array<{ id: string; type: BroadcastType; title: string; body: string; time: string }>
  >([]);

  function handleSend({ type, text }: { type: BroadcastType; text: string }) {
    const title = text.slice(0, 80);
    startTransition(async () => {
      const res = await sendBroadcastAction({
        type,
        title,
        body: text,
        sessionId,
        departmentId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Melding sendt til news-kanal");
      setRecentBroadcasts((prev) => [
        {
          id: res.messageId,
          type,
          title,
          body: text,
          time: new Date().toTimeString().slice(0, 5),
        },
        ...prev,
      ]);
    });
  }

  return (
    <div className="grid gap-4">
      <BroadcastComposer onSubmit={handleSend} busy={busy} />

      {recentBroadcasts.length > 0 ? (
        <div className="grid gap-2.5">
          {recentBroadcasts.map((b) => {
            const borderColor =
              b.type === "alert"
                ? "border-l-[color:var(--warning)]"
                : b.type === "reminder"
                  ? "border-l-muted-foreground"
                  : "border-l-[color:var(--info)]";
            const labelText =
              b.type === "alert" ? "Alert" : b.type === "reminder" ? "Påminnelse" : "Melding";
            return (
              <div
                key={b.id}
                className={`bg-card border-border rounded-[12px] border border-l-[3px] p-3.5 ${borderColor}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-[9px] font-bold tracking-[0.16em] uppercase">
                    {labelText}
                  </span>
                  <span className="text-muted-foreground font-mono text-[11px]">{b.time}</span>
                </div>
                <div className="text-[14px] font-semibold">{b.title}</div>
                <div className="text-muted-foreground mt-0.5 text-[13px]">{b.body}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border-border text-muted-foreground rounded-[14px] border p-4 text-[12px]">
          Ingen meldinger sendt fra denne sesjonen ennå. Feed fra eksisterende news-kanal leses inn{" "}
          <code className="text-foreground font-mono">PR 4</code>.
        </div>
      )}
    </div>
  );
}
