"use client";

/**
 * MaintenanceProcedureForm — Admin UI for viewing maintenance-type procedures
 * (cleaning checklists). Shows existing procedures as cards with checkpoint
 * counts and session hook badges. Includes an empty state when no procedures exist.
 *
 * This is the read/overview side. Editing procedures and managing hooks is done
 * through the SessionHookConfig component embedded in each procedure card.
 */

import { useState } from "react";
import { ClipboardCheck, ChevronDown, Trash2, MapPin, Clock, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useMaintenanceProcedures,
  useDeleteSessionHook,
  type MaintenanceProcedure,
} from "../_hooks/use-maintenance-procedures";
import { SessionHookConfig } from "./SessionHookConfig";
import { useTranslation } from "@smartout/i18n";

/** Maps hook_type to i18n key for display */
const HOOK_TYPE_LABELS: Record<string, string> = {
  pre_open: "cleaning.hookPreOpen",
  close: "cleaning.hookClose",
};

export function MaintenanceProcedureForm() {
  const { t } = useTranslation("cleaning");
  const { data: procedures, isLoading } = useMaintenanceProcedures();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-muted-foreground p-6 text-sm">{t("cleaning.pending")}...</div>;
  }

  if (!procedures || procedures.length === 0) {
    return <EmptyChecklistState label={t("cleaning.noChecklists")} />;
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        <ClipboardCheck className="text-muted-foreground h-4 w-4" />
        <h2 className="text-foreground text-sm font-semibold">{t("cleaning.title")}</h2>
        <Badge variant="outline" className="text-[10px]">
          {procedures.length}
        </Badge>
      </div>

      {procedures.map((procedure) => (
        <ProcedureCard
          key={procedure.procedure_id}
          procedure={procedure}
          isExpanded={expandedId === procedure.procedure_id}
          onToggle={() =>
            setExpandedId(expandedId === procedure.procedure_id ? null : procedure.procedure_id)
          }
        />
      ))}
    </div>
  );
}

/** Individual procedure card with expandable details */
function ProcedureCard({
  procedure,
  isExpanded,
  onToggle,
}: {
  procedure: MaintenanceProcedure;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("cleaning");
  const deleteHook = useDeleteSessionHook();

  const requiredCount = procedure.steps.filter((s) => s.is_required).length;
  const totalSteps = procedure.steps.length;
  const sortedSteps = [...procedure.steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div
      className={`border-border bg-card overflow-hidden rounded-xl border transition-all duration-300 ${
        isExpanded ? "shadow-lg" : "hover:shadow-md"
      }`}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-accent/50 flex w-full items-center gap-4 p-4 text-left transition-colors"
      >
        <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2">
          <ClipboardCheck className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-foreground truncate text-sm font-semibold">{procedure.name}</h3>
            <Badge
              variant={procedure.is_active ? "default" : "outline"}
              className="shrink-0 text-[10px]"
            >
              {procedure.is_active ? t("cleaning.active") : t("cleaning.inactive")}
            </Badge>
          </div>

          {/* Checkpoint count and hook badges */}
          <div className="mt-1 flex items-center gap-3">
            <span className="text-muted-foreground text-xs">
              {t("cleaning.progress", {
                done: requiredCount,
                total: totalSteps,
              })}{" "}
              ({t("cleaning.checkpoint").toLowerCase()})
            </span>

            {procedure.hooks.map((hook) => (
              <Badge
                key={hook.id}
                variant="outline"
                className="text-muted-foreground gap-1 text-[10px]"
              >
                <Clock className="h-3 w-3" />
                {t(HOOK_TYPE_LABELS[hook.hook_type] ?? hook.hook_type)}
              </Badge>
            ))}
          </div>
        </div>

        <ChevronDown
          className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded content: steps list + hook config */}
      <div
        className={`overflow-hidden border-t transition-all duration-300 ease-out ${
          isExpanded
            ? "border-border max-h-[800px] opacity-100"
            : "max-h-0 border-transparent opacity-0"
        }`}
      >
        {isExpanded && (
          <div className="space-y-4 p-4">
            {/* Description */}
            {procedure.description && (
              <p className="text-muted-foreground text-sm">{procedure.description}</p>
            )}

            {/* Steps list */}
            <div className="space-y-1">
              <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                {t("cleaning.checkpoints")}
              </h4>

              {sortedSteps.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                  {t("cleaning.noCheckpoints")}
                </p>
              ) : (
                <ol className="space-y-2">
                  {sortedSteps.map((step) => (
                    <li key={step.step_id} className="flex items-start gap-3">
                      <span className="bg-muted text-muted-foreground mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {step.step_order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground text-sm font-medium">{step.title}</span>
                          {step.is_required && (
                            <Badge
                              variant="outline"
                              className="text-destructive border-destructive/20 text-[9px]"
                            >
                              {t("cleaning.complianceRequired")}
                            </Badge>
                          )}
                        </div>
                        {step.description && (
                          <p className="text-muted-foreground mt-0.5 text-xs">{step.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Existing hooks */}
            {procedure.hooks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-foreground text-xs font-semibold tracking-wider uppercase">
                  {t("cleaning.linkToDepartment")}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {procedure.hooks.map((hook) => (
                    <Badge key={hook.id} variant="outline" className="gap-1.5 py-1">
                      <MapPin className="h-3 w-3" />
                      {t(HOOK_TYPE_LABELS[hook.hook_type] ?? hook.hook_type)}
                      <button
                        type="button"
                        onClick={() => deleteHook.mutate(hook.id)}
                        className="hover:text-destructive ml-1 transition-colors"
                        aria-label={t("cleaning.delete")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add new hook */}
            <SessionHookConfig procedureId={procedure.procedure_id} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Empty state with dashed border ghost card (Nordic Split pattern) */
function EmptyChecklistState({ label }: { label: string }) {
  const { t } = useTranslation("cleaning");

  return (
    <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12">
      <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <ClipboardCheck className="text-muted-foreground h-8 w-8" />
      </div>
      <h2 className="text-foreground mb-2 text-xl font-bold">{label}</h2>
      <p className="text-muted-foreground max-w-sm text-center text-sm">
        {t("cleaning.emptyStateDescription")}
      </p>
    </div>
  );
}
