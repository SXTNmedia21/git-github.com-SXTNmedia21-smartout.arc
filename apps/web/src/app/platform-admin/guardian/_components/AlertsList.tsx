"use client";

// UI Events:
// - action: acknowledgeSignal(id) — marks alert as acknowledged with optional note
// - action: dismissSignal(id) — dismisses alert completely
// - color-regime: severity-based (critical=red, warning=orange, info=blue)

import { useState } from "react";
import { AlertTriangle, Info, ShieldAlert, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useGuardianSignals,
  useAcknowledgeSignal,
  useDismissSignal,
  type GuardianSignalRow,
} from "../_hooks/useGuardianSignals";

const SEVERITY_STYLES = {
  critical: {
    badge: "border-red-500/20 bg-red-500/10 text-red-400",
    icon: "text-red-400",
    row: "border-l-red-500",
  },
  warning: {
    badge: "border-orange-500/20 bg-orange-500/10 text-orange-400",
    icon: "text-orange-400",
    row: "border-l-orange-500",
  },
  info: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-400",
    icon: "text-blue-400",
    row: "border-l-blue-500",
  },
} as const;

function SeverityIcon({ severity }: { severity: GuardianSignalRow["severity"] }) {
  const style = SEVERITY_STYLES[severity];
  const iconClass = cn("h-4 w-4", style.icon);

  if (severity === "critical") return <ShieldAlert className={iconClass} />;
  if (severity === "warning") return <AlertTriangle className={iconClass} />;
  return <Info className={iconClass} />;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}t`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function AlertRow({ signal }: { signal: GuardianSignalRow }) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");
  const acknowledge = useAcknowledgeSignal();
  const dismiss = useDismissSignal();
  const style = SEVERITY_STYLES[signal.severity];

  function handleAcknowledge() {
    if (showNoteInput && note.trim()) {
      acknowledge.mutate(
        { signalId: signal.id, note: note.trim() },
        {
          onSuccess: () => {
            toast.success("Alert acknowledged");
            setShowNoteInput(false);
            setNote("");
          },
        },
      );
    } else if (!showNoteInput) {
      setShowNoteInput(true);
    } else {
      acknowledge.mutate(
        { signalId: signal.id },
        {
          onSuccess: () => {
            toast.success("Alert acknowledged");
            setShowNoteInput(false);
          },
        },
      );
    }
  }

  function handleDismiss() {
    dismiss.mutate(signal.id, {
      onSuccess: () => toast.success("Alert dismissed"),
    });
  }

  return (
    <div
      className={cn(
        "border-border bg-card group rounded-lg border border-l-2 p-3 transition-colors",
        style.row,
      )}
    >
      <div className="flex items-start gap-3">
        <SeverityIcon severity={signal.severity} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-sm font-semibold">{signal.title}</span>
            <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", style.badge)}>
              {signal.severity}
            </Badge>
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {signal.domain}
            </Badge>
          </div>
          {signal.description && (
            <p className="text-muted-foreground mt-0.5 text-xs">{signal.description}</p>
          )}
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            {signal.entity_label && <span>{signal.entity_label}</span>}
            <span>{timeAgo(signal.created_at)} ago</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleAcknowledge}
            disabled={acknowledge.isPending}
            title="Acknowledge"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleDismiss}
            disabled={dismiss.isPending}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {showNoteInput && (
        <div className="mt-2 flex gap-2 pl-7">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)..."
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAcknowledge();
              if (e.key === "Escape") {
                setShowNoteInput(false);
                setNote("");
              }
            }}
          />
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleAcknowledge}
            disabled={acknowledge.isPending}
          >
            Bekreft
          </Button>
        </div>
      )}
    </div>
  );
}

export function AlertsList() {
  const { data: signals, isLoading } = useGuardianSignals();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted/30 h-16 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!signals || signals.length === 0) {
    return (
      <div className="border-border rounded-lg border p-8 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-5 w-5 text-emerald-500" />
        </div>
        <p className="text-foreground text-sm font-medium">Ingen aktive varsler</p>
        <p className="text-muted-foreground mt-1 text-xs">Alle systemer er friske</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.map((signal) => (
        <AlertRow key={signal.id} signal={signal} />
      ))}
    </div>
  );
}
