"use client";

/**
 * PipelineLockBadge — inline lock indicator for shift cells.
 *
 * Renders nothing when the shift has no pipeline_lock_state_id. Otherwise
 * shows a small amber Lock icon with a tooltip describing the blueprint.
 *
 * Designed to slot next to the other status icons inside `MalEmployeeTag`
 * so the badge follows the shift wherever it renders in the grid.
 */

import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShiftPipeline, resolvePipelineLabel } from "../_hooks/use-shift-pipeline";

type PipelineLockBadgeProps = {
  shiftId: string;
};

export function PipelineLockBadge({ shiftId }: PipelineLockBadgeProps) {
  const { data } = useShiftPipeline(shiftId);
  if (!data?.pipeline) return null;

  const label = resolvePipelineLabel(data.pipeline.blueprint_id);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center" aria-label={label}>
          <Lock
            className="h-3 w-3 opacity-70 transition-opacity hover:opacity-100"
            style={{ color: "#f59e0b" }}
          />
          <span className="sr-only">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-48 text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
