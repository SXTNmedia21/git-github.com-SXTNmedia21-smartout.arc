"use client";

/**
 * AggregatedDayLineList — no-scope overview of all day lines for a date.
 *
 * Renders an expandable accordion list of day_line rows (all locations/departments
 * combined). Each row shows location name, department name, and planned open/close
 * window. Phase D will inject a preview of the next 3 session tasks per line.
 *
 * Used when no scope filter is active (ScopeSelection all-empty) so the user
 * gets a workspace-wide overview before drilling into a specific dimension.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useDayLines } from "./_hooks/use-day-lines";

type Props = {
  workspaceId: string;
  date: string;
};

export function AggregatedDayLineList({ workspaceId, date }: Props) {
  const { data, isLoading } = useDayLines({ workspaceId, date });

  if (isLoading) {
    return <Skeleton className="h-48" data-testid="aggregated-day-line-skeleton" />;
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" data-testid="aggregated-day-line-empty">
        Ingen dagslinjer.
      </p>
    );
  }

  return (
    <Accordion type="multiple" data-testid="aggregated-day-line-list">
      {data.map((line) => (
        <AccordionItem key={line.day_line_id} value={line.day_line_id}>
          <AccordionTrigger data-testid={`agg-trigger-${line.day_line_id}`}>
            <span className="flex w-full items-center justify-between pr-2">
              <span className="text-foreground font-medium">{line.location_name}</span>
              <span className="text-muted-foreground text-xs">
                {line.department_name} &middot; {line.planned_open.slice(0, 5)}–
                {line.planned_close.slice(0, 5)}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {/* Phase D: inject next-3 session task preview here */}
            <p className="text-muted-foreground text-sm">
              Forhåndsvisning av neste 3 oppgaver kommer her (Phase D).
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
