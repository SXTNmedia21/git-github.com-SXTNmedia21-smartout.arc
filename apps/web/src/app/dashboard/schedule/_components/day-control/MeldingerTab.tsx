// ============================================
// day-control/MeldingerTab.tsx
// Dagsinfo / Messages tab — post and manage day notices.
// ============================================
"use client";

import { useContext, useState } from "react";
import { Eye, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { DayMessage } from "../schedule-types";
import {
  useDayMessages,
  useCreateDayMessage,
  useDeleteDayMessage,
} from "../../_hooks/use-day-content";
import { useWeekRange } from "../../_hooks/use-week-range";
import { MessageCard } from "./shared";

export function MeldingerTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayMessagesData = [] as DayMessage[] } = useDayMessages(weekStart, weekEnd);
  const createDayMessage = useCreateDayMessage(weekStart);
  const deleteDayMessage = useDeleteDayMessage(weekStart);

  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<"all" | "leaders" | string>("all");
  const [visibility, setVisibility] = useState<"all_day" | "until_16" | "permanent">("all_day");

  const messages = dateId ? dayMessagesData.filter((m: DayMessage) => m.dateId === dateId) : [];

  function handlePublish() {
    if (!dateId) return;
    if (!content.trim()) {
      toast.error("Skriv en beskjed forst");
      return;
    }

    createDayMessage.mutate({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dateId,
      title: content.trim().slice(0, 50),
      content: content.trim(),
      audience,
      visibility,
      author: "Du",
      isAlert: false,
    });

    toast.success("Oppslag publisert");
    setContent("");
  }

  function audienceLabel(value: string): string {
    switch (value) {
      case "all":
        return "Alle";
      case "leaders":
        return "Kun Ledere";
      default:
        return value;
    }
  }

  function visibilityLabel(value: string): string {
    switch (value) {
      case "all_day":
        return "Hele dagen";
      case "until_16":
        return "Frem til 16:00";
      case "permanent":
        return "Permanent oppslag";
      default:
        return value;
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-200">
      {/* New message form */}
      <div
        className={`rounded-2xl border p-4 ${isDark ? "border-border bg-muted/30" : "border-border bg-card shadow-sm"}`}
      >
        <h4 className="text-foreground mb-2 text-xs font-bold">Nytt oppslag</h4>
        <textarea
          placeholder="Skriv beskjed til ansatte her..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="border-input focus-visible:ring-ring mb-3 block h-24 w-full resize-none rounded-xl border bg-transparent p-3 text-xs focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        />
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="focus-within:ring-ring/20 flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1">
              <Eye className="text-muted-foreground h-3.5 w-3.5" />
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="text-foreground/80 cursor-pointer bg-transparent text-[11px] font-bold outline-none"
              >
                <option value="all">Alle Pa Vakt</option>
                <option value="leaders">Kun Ledere</option>
                <option value="Servering">Servering (Team)</option>
              </select>
            </div>
            <div className="bg-border hidden h-4 w-px md:block" />
            <div className="focus-within:ring-ring/20 flex items-center gap-1.5 rounded-lg p-1.5 focus-within:ring-1">
              <Clock className="text-muted-foreground h-3.5 w-3.5" />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                className="text-foreground/80 cursor-pointer bg-transparent text-[11px] font-bold outline-none"
              >
                <option value="all_day">Hele dagen</option>
                <option value="until_16">Frem til 16:00</option>
                <option value="permanent">Permanent oppslag</option>
              </select>
            </div>
          </div>
          <button
            onClick={handlePublish}
            className="border-info/30 bg-info/20 text-info hover:bg-info/30 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-bold transition-colors"
          >
            <Plus className="h-3 w-3" /> Publiser
          </button>
        </div>
      </div>

      {/* Active messages */}
      <div className="space-y-3">
        <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Aktive Oppslag ({messages.length})
        </h4>
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            Ingen oppslag for denne dagen
          </p>
        ) : (
          messages.map((msg: DayMessage) => (
            <MessageCard
              key={msg.id}
              title={msg.title}
              audience={audienceLabel(msg.audience)}
              author={msg.author}
              time={visibilityLabel(msg.visibility)}
              content={msg.content}
              alert={msg.isAlert}
              onDelete={() => {
                deleteDayMessage.mutate(msg.id);
                toast("Oppslag slettet");
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
