"use client";

/**
 * OverrideDrawer — Pipeline override action drawer.
 *
 * Per ADR-0240, override is dispatched through Botsson chat (NOT a direct
 * mutation API). The drawer collects reason text (≥20 chars per ADR-0328) and
 * fires a `botsson:open-with-prompt` window event that opens the chat surface
 * with a prefilled prompt invoking `override_swap_pipeline` or
 * `override_marketplace_pipeline`.
 */

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineItem } from "./pipeline-list-client";

type OverrideDrawerProps = {
  open: boolean;
  pipeline: PipelineItem | null;
  onClose: () => void;
};

const MIN_CHARS = 20;
const MAX_CHARS = 500;

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
    case "complete":
      return "Fullført";
    default:
      return status;
  }
}

export function OverrideDrawer({ open, pipeline, onClose }: OverrideDrawerProps) {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const charCount = reason.trim().length;
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS;
  const showError = reason.length > 0 && charCount < MIN_CHARS;
  const showOverLimit = charCount > MAX_CHARS;

  const handleDispatch = useCallback(() => {
    if (!pipeline || !isValid) return;
    const prompt = `Override pipeline ${pipeline.pipeline_instance_id} (${blueprintLabel(pipeline.blueprint_id)}). Begrunnelse: ${reason.trim()}`;
    // ADR-0240: dispatch via Botsson chat, never direct mutation API.
    window.dispatchEvent(new CustomEvent("botsson:open-with-prompt", { detail: { prompt } }));
    void queryClient.invalidateQueries({ queryKey: ["admin-pipeline"] });
    onClose();
  }, [pipeline, reason, isValid, queryClient, onClose]);

  function handleOpenChange(o: boolean) {
    if (!o) {
      onClose();
      setTimeout(() => setReason(""), 300);
    }
  }

  const relativeTime = pipeline?.started_at
    ? formatDistanceToNow(new Date(pipeline.started_at), { addSuffix: true, locale: nb })
    : "";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-[480px]",
          "bg-background/95 border-border border-l backdrop-blur-xl",
        )}
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="font-heading text-foreground text-xl">
            Override pipeline
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            Skriv en begrunnelse og send til Botsson for behandling
          </SheetDescription>
        </SheetHeader>

        {pipeline && (
          <div className="flex flex-col gap-6 px-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", ...motionTokens.spring }}
              className={cn(
                "border-border rounded-xl border",
                "bg-muted/40 p-4 backdrop-blur-xl",
                "flex flex-col gap-3",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-sm font-medium">
                  {blueprintLabel(pipeline.blueprint_id)}
                </span>
                <Badge variant={statusVariant(pipeline.status)}>
                  {statusLabel(pipeline.status)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {pipeline.current_step !== null && (
                  <>
                    <span className="text-muted-foreground">Steg</span>
                    <span className="text-foreground truncate font-mono">
                      {pipeline.current_step}
                    </span>
                  </>
                )}
                {pipeline.entity_id && (
                  <>
                    <span className="text-muted-foreground">Enhet</span>
                    <span className="text-foreground truncate font-mono">{pipeline.entity_id}</span>
                  </>
                )}
                {pipeline.actor_profile_id && (
                  <>
                    <span className="text-muted-foreground">Aktør</span>
                    <span className="text-foreground truncate font-mono">
                      {pipeline.actor_profile_id}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">Startet</span>
                <span className="text-foreground">{relativeTime}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", ...motionTokens.spring, delay: 0.05 }}
              className="flex flex-col gap-2"
            >
              <label htmlFor="override-reason" className="text-foreground text-sm font-medium">
                Begrunnelse
              </label>
              <Textarea
                id="override-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Beskriv hvorfor denne pipelinen skal overstyres..."
                className={cn(
                  "min-h-[120px] resize-none",
                  "bg-background/60 backdrop-blur-sm",
                  showError || showOverLimit
                    ? "border-destructive focus-visible:ring-destructive"
                    : "",
                )}
                maxLength={MAX_CHARS + 50}
              />
              <div className="flex items-center justify-between">
                {showError ? (
                  <p className="text-destructive flex items-center gap-1 text-xs" role="alert">
                    <AlertCircle className="h-3 w-3" />
                    Begrunnelse må være minst {MIN_CHARS} tegn
                  </p>
                ) : showOverLimit ? (
                  <p className="text-destructive flex items-center gap-1 text-xs" role="alert">
                    <AlertCircle className="h-3 w-3" />
                    Maks {MAX_CHARS} tegn tillatt
                  </p>
                ) : (
                  <span />
                )}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    showOverLimit ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {charCount}/{MAX_CHARS}
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", ...motionTokens.spring, delay: 0.1 }}
            >
              <Button
                onClick={handleDispatch}
                disabled={!isValid}
                className="w-full gap-2"
                type="button"
              >
                <MessageSquare className="h-4 w-4" />
                Send override
              </Button>
              <p className="text-muted-foreground mt-2 text-center text-xs">
                Åpner Botsson-chat med forhåndsutfylt melding
              </p>
            </motion.div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
