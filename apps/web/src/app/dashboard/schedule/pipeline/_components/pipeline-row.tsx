"use client";

import { motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronRight, FileSearch, GitBranch, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineItem } from "./pipeline-list-client";

type PipelineRowProps = {
  item: PipelineItem;
  onClick: () => void;
  onAuditClick: () => void;
};

function blueprintLabel(blueprintId: string): string {
  if (blueprintId === "shift_swap_lifecycle") return "Vaktbytte";
  if (blueprintId === "marketplace_lifecycle") return "Vakttilbud";
  return blueprintId;
}

function statusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "failed":
    case "rejected":
      return "destructive";
    case "complete":
    case "cancelled":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "failed":
      return "Feilet";
    case "rejected":
      return "Avvist";
    case "cancelled":
      return "Kansellert";
    case "pending":
      return "Ventende";
    case "active":
      return "Aktiv";
    case "waiting":
      return "Venter";
    case "complete":
      return "Fullført";
    case "escalated":
      return "Eskalert";
    case "blocked":
      return "Blokkert";
    default:
      return status;
  }
}

export function PipelineRow({ item, onClick, onAuditClick }: PipelineRowProps) {
  const relativeTime = formatDistanceToNow(new Date(item.started_at), {
    addSuffix: true,
    locale: nb,
  });

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.998 }}
      transition={{ type: "spring", ...motionTokens.springSnappy }}
      className={cn(
        "border-border w-full rounded-xl border",
        "bg-background/80 backdrop-blur-xl",
        "flex items-stretch",
        "hover:border-foreground/20 hover:bg-background/90 transition-colors",
      )}
    >
      <button
        onClick={onClick}
        type="button"
        className={cn(
          "flex flex-1 items-center gap-4 px-5 py-4 text-left",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <GitBranch className="text-muted-foreground h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-sm font-medium">
              {blueprintLabel(item.blueprint_id)}
            </span>
            <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
            {item.current_step !== null && (
              <span className="text-muted-foreground font-mono text-xs">
                Steg {item.current_step}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3">
            {item.entity_id && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Package className="h-3 w-3" />
                <span className="max-w-[180px] truncate font-mono">{item.entity_id}</span>
              </span>
            )}
            {item.actor_profile_id && (
              <span className="text-muted-foreground max-w-[140px] truncate font-mono text-xs">
                {item.actor_profile_id.slice(0, 8)}…
              </span>
            )}
            <span className="text-muted-foreground ml-auto text-xs">{relativeTime}</span>
          </div>
        </div>

        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAuditClick();
        }}
        className={cn(
          "border-border flex items-center justify-center border-l px-4",
          "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          "focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
        )}
        aria-label="Vis hendelseslogg"
      >
        <FileSearch className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
