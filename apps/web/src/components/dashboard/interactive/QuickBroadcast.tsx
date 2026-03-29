"use client";

// QuickBroadcast — inline message composer for sending operational announcements
// to recipient groups (on duty, incoming today, worked yesterday).
// Allows selecting multiple groups simultaneously with deduplication before send.

import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useBroadcastRecipients,
  useSendBroadcast,
} from "@/app/dashboard/_hooks";

// Ambient spring — Nordic Split spec
const AMBIENT_SPRING = {
  type: "spring" as const,
  stiffness: 40,
  damping: 22,
  mass: 2.2,
};

type RecipientGroup = "on_duty" | "incoming" | "yesterday";

type GroupToggleProps = {
  group: RecipientGroup;
  label: string;
  count: number | undefined;
  isSelected: boolean;
  onToggle: () => void;
};

/** Pill toggle button for a single recipient group with badge count. */
function GroupToggle({ label, count, isSelected, onToggle }: GroupToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        isSelected
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border bg-muted text-muted-foreground hover:text-foreground"
      }`}
      aria-pressed={isSelected}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
            isSelected ? "bg-primary/20" : "bg-border"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type QuickBroadcastProps = {
  profileId: string;
};

/**
 * QuickBroadcast — sends a broadcast message to selected recipient groups.
 *
 * Why: Managers often need to push a quick announcement to everyone currently
 * working or arriving soon, without navigating to the full messaging module.
 */
export function QuickBroadcast({ profileId }: QuickBroadcastProps) {
  const { t } = useTranslation("dashboard");
  const [selected, setSelected] = useState<Set<RecipientGroup>>(new Set());
  const [message, setMessage] = useState("");

  const onDuty = useBroadcastRecipients("on_duty");
  const incoming = useBroadcastRecipients("incoming");
  const yesterday = useBroadcastRecipients("yesterday");

  const sendBroadcast = useSendBroadcast();

  const groups: { group: RecipientGroup; label: string; count: number | undefined }[] = [
    {
      group: "on_duty",
      label: t("interactive.broadcast_on_duty"),
      count: onDuty.data?.length,
    },
    {
      group: "incoming",
      label: t("interactive.broadcast_incoming"),
      count: incoming.data?.length,
    },
    {
      group: "yesterday",
      label: t("interactive.broadcast_yesterday"),
      count: yesterday.data?.length,
    },
  ];

  function toggleGroup(group: RecipientGroup) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  function collectRecipientIds(): string[] {
    const recipientMap = {
      on_duty: onDuty.data ?? [],
      incoming: incoming.data ?? [],
      yesterday: yesterday.data ?? [],
    };

    // Deduplicate by profile_id across all selected groups
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const group of selected) {
      for (const r of recipientMap[group]) {
        if (!seen.has(r.profile_id)) {
          seen.add(r.profile_id);
          ids.push(r.profile_id);
        }
      }
    }
    return ids;
  }

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed || selected.size === 0) return;

    const recipientIds = collectRecipientIds();
    sendBroadcast.mutate(
      { content: trimmed, recipientIds, profileId },
      {
        onSuccess: () => {
          toast.success(t("interactive.broadcast_sent", { count: recipientIds.length }));
          setMessage("");
          setSelected(new Set());
        },
      },
    );
  }

  const canSend = message.trim().length > 0 && selected.size > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, transition: AMBIENT_SPRING }}
      className="bg-card border-border rounded-xl border p-4"
    >
      {/* Recipient group toggles */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {t("interactive.broadcast_to")}
        </span>
        {groups.map(({ group, label, count }) => (
          <GroupToggle
            key={group}
            group={group}
            label={label}
            count={count}
            isSelected={selected.has(group)}
            onToggle={() => toggleGroup(group)}
          />
        ))}
      </div>

      {/* Message input + send button */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) handleSend();
          }}
          placeholder={t("interactive.broadcast_placeholder")}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          disabled={sendBroadcast.isPending}
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!canSend || sendBroadcast.isPending}
          className="flex items-center gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{t("interactive.broadcast_send")}</span>
        </Button>
      </div>
    </motion.div>
  );
}
