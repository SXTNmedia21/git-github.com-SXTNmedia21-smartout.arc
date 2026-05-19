"use client";

/**
 * AuditDrawer — Pipeline audit trail viewer.
 *
 * Reads `GET /api/admin/pipeline/[id]` and renders the chronological merge of
 * gate_evaluation + activity_trail rows. Each event shows actor, channel,
 * gate_evaluation_id (per ADR-0204 correlation chain), and reason.
 *
 * Override events are styled with a governance accent (purple) — no Nordic
 * Split `--governance` token exists yet, so the purple fallback is local.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { format, formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  Info,
  MessageSquare,
  Shield,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AuditDrawerProps = {
  pipelineId: string | null;
  open: boolean;
  onClose: () => void;
};

type AuditEntry = {
  occurred_at: string;
  event_name: string;
  stage: string | null;
  actor_profile_id: string | null;
  channel: string | null;
  gate_evaluation_id: string | null;
  payload: Record<string, unknown>;
};

type PipelineInstance = {
  pipeline_instance_id: string;
  blueprint_id: string;
  status: string;
  current_step: number | null;
  entity_id: string | null;
  entity_type: string | null;
  started_at: string;
  completed_at: string | null;
  context: Record<string, unknown>;
};

type DetailResponse = {
  pipeline_instance: PipelineInstance;
  audit_chain: AuditEntry[];
};

async function fetchPipelineDetail(id: string): Promise<DetailResponse> {
  const res = await fetch(`/api/admin/pipeline/${id}`);
  if (!res.ok) throw new Error(`detail fetch failed: ${res.status}`);
  return (await res.json()) as DetailResponse;
}

function stageLabel(stage: string | null, eventName: string): string {
  const key = stage ?? eventName;
  if (key.includes("stage_proposed")) return "Foreslått";
  if (key.includes("stage_consented")) return "Samtykket";
  if (key.includes("stage_approved")) return "Godkjent";
  if (key.includes("stage_rejected")) return "Avvist";
  if (key.includes("stage_cancelled")) return "Avbrutt";
  if (key.includes("stage_overridden")) return "Overstyrt";
  if (key.startsWith("gate.")) return "Gate-evaluering";
  return eventName;
}

function stageIcon(stage: string | null, eventName: string) {
  const key = stage ?? eventName;
  if (key.includes("stage_overridden")) return Shield;
  if (key.includes("stage_approved")) return CheckCircle;
  if (key.includes("stage_rejected")) return XCircle;
  if (key.includes("stage_cancelled")) return Ban;
  if (key.includes("stage_proposed")) return Clock;
  if (key.includes("stage_consented")) return ChevronRight;
  return Info;
}

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

function extractReason(payload: Record<string, unknown>): string | null {
  const candidate =
    payload.override_reason ?? payload.rejection_reason ?? payload.reason ?? payload.cancel_reason;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(id);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={cn(
        "border-border bg-muted/40 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "font-mono text-[10px] transition-colors",
        "hover:border-foreground/30 hover:bg-muted/70",
      )}
    >
      <span className="max-w-[120px] truncate">{id}</span>
      <Copy className="h-3 w-3" />
      <span className="sr-only">{copied ? "Kopiert" : "Kopier"}</span>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border-border bg-muted/40 h-20 animate-pulse rounded-xl border"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="border-destructive/30 bg-destructive/10 text-destructive mx-4 flex items-center gap-2 rounded-xl border p-4 text-sm">
      <AlertTriangle className="h-4 w-4" />
      Kunne ikke laste hendelseslogg
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border bg-muted/30 mx-4 rounded-xl border border-dashed p-8 text-center">
      <p className="text-muted-foreground text-sm">Ingen aktivitet ennå</p>
    </div>
  );
}

export function AuditDrawer({ pipelineId, open, onClose }: AuditDrawerProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-pipeline", pipelineId, "detail"],
    queryFn: () => fetchPipelineDetail(pipelineId as string),
    enabled: Boolean(pipelineId) && open,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  function handleOpenChange(o: boolean) {
    if (!o) onClose();
  }

  const instance = data?.pipeline_instance;
  const chain = data?.audit_chain ?? [];
  const isTerminal = instance
    ? ["complete", "failed", "cancelled"].includes(instance.status)
    : false;
  const hasTerminalEvent = chain.some((e) =>
    /stage_approved|stage_rejected|stage_cancelled|stage_overridden/.test(e.stage ?? e.event_name),
  );
  const showPlatformBanner = isTerminal && !hasTerminalEvent;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-[600px]",
          "bg-background/95 border-border border-l backdrop-blur-xl",
          "overflow-y-auto",
        )}
      >
        <SheetHeader className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="font-heading text-foreground text-xl">Hendelseslogg</SheetTitle>
            {instance && <Badge variant={statusVariant(instance.status)}>{instance.status}</Badge>}
          </div>
          {instance && (
            <SheetDescription className="text-muted-foreground flex flex-col gap-0.5 text-xs">
              <span>
                {blueprintLabel(instance.blueprint_id)} ·{" "}
                <span className="font-mono">{instance.pipeline_instance_id}</span>
              </span>
              <span>
                Startet {format(new Date(instance.started_at), "d. MMM yyyy HH:mm", { locale: nb })}
                {instance.completed_at && (
                  <>
                    {" · Avsluttet "}
                    {format(new Date(instance.completed_at), "d. MMM yyyy HH:mm", {
                      locale: nb,
                    })}
                  </>
                )}
              </span>
              {instance.entity_id && (
                <span className="font-mono">
                  {instance.entity_type ?? "entity"}:{instance.entity_id}
                </span>
              )}
            </SheetDescription>
          )}
        </SheetHeader>

        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <ErrorState />
        ) : chain.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3 px-4">
            {showPlatformBanner && (
              <div className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs">
                Plattform-handlinger vises ikke i listen
              </div>
            )}
            {chain.map((event, idx) => {
              const Icon = stageIcon(event.stage, event.event_name);
              const isOverride = (event.stage ?? event.event_name).includes("stage_overridden");
              const label = stageLabel(event.stage, event.event_name);
              const reason = extractReason(event.payload);
              const relativeTime = formatDistanceToNow(new Date(event.occurred_at), {
                addSuffix: true,
                locale: nb,
              });

              return (
                <motion.div
                  key={`${event.occurred_at}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    ...motionTokens.spring,
                    delay: idx * 0.04,
                  }}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border p-4",
                    isOverride
                      ? "border-purple-500/30 bg-purple-500/10"
                      : "border-border bg-background/60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        isOverride ? "bg-purple-500/20" : "bg-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isOverride ? "text-purple-400" : "text-muted-foreground",
                        )}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isOverride ? "text-purple-300" : "text-foreground",
                          )}
                        >
                          {label}
                        </span>
                        {isOverride && (
                          <Badge variant="outline" className="border-purple-500/40 text-purple-300">
                            Admin
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {event.actor_profile_id && (
                          <span className="text-muted-foreground max-w-[180px] truncate font-mono text-[11px]">
                            {event.actor_profile_id}
                          </span>
                        )}
                        {event.channel && (
                          <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                            <MessageSquare className="h-3 w-3" />
                            {event.channel}
                          </span>
                        )}
                        <span className="text-muted-foreground ml-auto text-[11px]">
                          {relativeTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {reason && (
                    <p className="border-border/60 text-foreground/90 ml-10 border-l-2 pl-3 text-xs">
                      {reason}
                    </p>
                  )}

                  {event.gate_evaluation_id && (
                    <div className="ml-10 flex items-center gap-2">
                      <span className="text-muted-foreground text-[10px]">gate_evaluation_id</span>
                      <CopyableId id={event.gate_evaluation_id} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
