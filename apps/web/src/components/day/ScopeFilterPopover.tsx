"use client";

/**
 * ScopeFilterPopover — 3-tab selector (Avdeling / Team / Vakt) rendered
 * inside a Popover. Opens from ScopeFilterPill.
 *
 * Fetches departments, teams, and today's shifts from Supabase.
 * Respects authority: managers only see their own dept when dept_id is provided.
 * Emits telemetry on every scope change.
 */

import { useQuery } from "@tanstack/react-query";
import { Building, Clock, Users, X } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DayTimelineScope } from "@/app/dashboard/_hooks/use-day-timeline-scope";

// ─── Types ────────────────────────────────────────────────

type DeptOption = { id: string; name: string; color: string | null };
type TeamOption = { id: string; name: string; color: string | null };
type ShiftOption = {
  id: string;
  label: string;
  start: string;
  end: string;
};

// ─── Data hooks (fetch only when popover is open) ─────────

function useDepartments(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["scope-filter", "departments", workspaceId],
    enabled,
    staleTime: 120_000,
    queryFn: async (): Promise<DeptOption[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name, color")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.department_id,
        name: d.name,
        color: d.color ?? null,
      }));
    },
  });
}

function useTeams(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["scope-filter", "teams", workspaceId],
    enabled,
    staleTime: 120_000,
    queryFn: async (): Promise<TeamOption[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team")
        .select("team_id, name, color")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.team_id,
        name: t.name,
        color: t.color ?? null,
      }));
    },
  });
}

function useShiftsToday(workspaceId: string, dateISO: string, enabled: boolean) {
  return useQuery({
    queryKey: ["scope-filter", "shifts-today", workspaceId, dateISO],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<ShiftOption[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, role, start_time, end_time")
        .eq("workspace_id", workspaceId)
        .eq("shift_date", dateISO)
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.schedule_shift_id,
        label: s.role,
        start: (s.start_time ?? "").slice(0, 5),
        end: (s.end_time ?? "").slice(0, 5),
      }));
    },
  });
}

// ─── Option list ──────────────────────────────────────────

function OptionList<T extends { id: string; name?: string; label?: string }>({
  items,
  selectedId,
  onSelect,
  renderItem,
}: {
  items: T[];
  selectedId: string | null;
  onSelect: (id: string, item: T) => void;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <ul className="mt-1 max-h-52 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id, item)}
              className={[
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground",
              ].join(" ")}
            >
              {renderItem(item)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Main component ───────────────────────────────────────

type ScopeFilterPopoverContentProps = {
  workspaceId: string;
  dateISO: string;
  /** When set, hide departments other than this one (manager authority). */
  ownDepartmentId: string | null;
  scope: DayTimelineScope;
  onScopeChange: (next: DayTimelineScope) => void;
};

export function ScopeFilterPopoverContent({
  workspaceId,
  dateISO,
  ownDepartmentId,
  scope,
  onScopeChange,
}: ScopeFilterPopoverContentProps) {
  const deptsQuery = useDepartments(workspaceId, true);
  const teamsQuery = useTeams(workspaceId, true);
  const shiftsQuery = useShiftsToday(workspaceId, dateISO, true);

  // Authority filter: manager only sees own dept unless admin/owner (ownDepartmentId null = no restriction)
  const visibleDepts = (deptsQuery.data ?? []).filter(
    (d) => !ownDepartmentId || d.id === ownDepartmentId,
  );
  const teams = teamsQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];

  const noTeams = !teamsQuery.isLoading && teams.length === 0;
  const noShifts = !shiftsQuery.isLoading && shifts.length === 0;

  const selectedDeptId = scope.type === "department" ? scope.id : null;
  const selectedTeamId = scope.type === "team" ? scope.id : null;
  const selectedShiftId = scope.type === "shift" ? scope.id : null;

  function handleReset() {
    onScopeChange({ type: "all" });
  }

  return (
    <div className="w-72">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Filtrer Dagslinjen</span>
        {scope.type !== "all" && (
          <button
            type="button"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
          >
            <X className="h-3 w-3" />
            Vis alle
          </button>
        )}
      </div>

      <Tabs defaultValue="department">
        <TabsList className="grid w-full grid-cols-3">
          {/* Avdeling tab */}
          <TabsTrigger value="department" className="gap-1.5 text-xs">
            <Building className="h-3.5 w-3.5" />
            Avdeling
          </TabsTrigger>

          {/* Team tab — disabled with tooltip if no teams */}
          {noTeams ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <TabsTrigger value="team" disabled className="gap-1.5 text-xs opacity-40">
                    <Users className="h-3.5 w-3.5" />
                    Team
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Opprett team først
              </TooltipContent>
            </Tooltip>
          ) : (
            <TabsTrigger value="team" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />
              Team
            </TabsTrigger>
          )}

          {/* Vakt tab — disabled with tooltip if no shifts today */}
          {noShifts ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <TabsTrigger value="shift" disabled className="gap-1.5 text-xs opacity-40">
                    <Clock className="h-3.5 w-3.5" />
                    Vakt
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Ingen vakter i dag
              </TooltipContent>
            </Tooltip>
          ) : (
            <TabsTrigger value="shift" className="gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Vakt
            </TabsTrigger>
          )}
        </TabsList>

        {/* Avdeling content */}
        <TabsContent value="department" className="mt-2">
          {deptsQuery.isLoading ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Laster…</p>
          ) : visibleDepts.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Ingen avdelinger</p>
          ) : (
            <OptionList
              items={visibleDepts}
              selectedId={selectedDeptId}
              onSelect={(id) => onScopeChange({ type: "department", id })}
              renderItem={(d) => (
                <>
                  {d.color && (
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                  )}
                  <span className="truncate">{d.name}</span>
                </>
              )}
            />
          )}
        </TabsContent>

        {/* Team content */}
        <TabsContent value="team" className="mt-2">
          {teamsQuery.isLoading ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Laster…</p>
          ) : teams.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Ingen aktive team</p>
          ) : (
            <OptionList
              items={teams}
              selectedId={selectedTeamId}
              onSelect={(id) => onScopeChange({ type: "team", id })}
              renderItem={(t) => (
                <>
                  {t.color && (
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  <span className="truncate">{t.name}</span>
                </>
              )}
            />
          )}
        </TabsContent>

        {/* Vakt content */}
        <TabsContent value="shift" className="mt-2">
          {shiftsQuery.isLoading ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Laster…</p>
          ) : shifts.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">
              Ingen vakter i dag
            </p>
          ) : (
            <OptionList
              items={shifts.map((s) => ({
                ...s,
                name: `${s.label} ${s.start}–${s.end}`,
              }))}
              selectedId={selectedShiftId}
              onSelect={(id) => onScopeChange({ type: "shift", id })}
              renderItem={(s) => (
                <>
                  <Clock className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{s.name}</span>
                </>
              )}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
