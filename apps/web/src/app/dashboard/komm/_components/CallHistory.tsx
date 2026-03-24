"use client";

import { useCallHistory } from "../_hooks/use-call-history";
import { Phone, Clock, Users } from "lucide-react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  channelId: string;
};

export function CallHistory({ channelId }: Props) {
  const { data: history, isLoading } = useCallHistory(channelId);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center p-6 text-sm">
        Laster samtalehistorikk...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 p-6">
        <Phone className="h-8 w-8 opacity-40" />
        <p className="text-sm">Ingen tidligere samtaler</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {history.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
            <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{formatTime(entry.startedAt)}</p>
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(entry.durationSeconds)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {entry.totalParticipants}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
