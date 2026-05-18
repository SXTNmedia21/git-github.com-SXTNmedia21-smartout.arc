"use client";

/**
 * ScopeFilterPopover — two exports:
 *
 * 1. ScopeFilterPopoverContent (legacy single-select, tabbed) — used by ScopeFilterPill.
 *    Fetches departments, teams, and today's shifts from Supabase.
 *    Respects authority: managers only see their own dept when dept_id is provided.
 *
 * 2. ScopeFilterPopover (multi-select, OR-within / AND-between dimensions) — ADR-0367 W7-W9.
 *    Accepts pre-fetched option lists; caller manages state.
 */

import { useQuery } from "@tanstack/react-query";
import { Building, Clock, Filter, MapPin, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@smartout/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DayTimelineScope } from "@/app/dashboard/_hooks/use-day-timeline-scope";

// ─── Types ────────────────────────────────────────────────

type DeptOption = { id: string; name: string; color: string | null };
type TeamOption = { id: string; name: string; color: string | null };
type LocationOption = { id: string; name: string };
type ShiftOption = {
  id: string;
  label: string;
  start: string;
  end: string;
};

// ─── Data hooks (fetch only when popover is open) ─────────

export function useDepartments(workspaceId: string, enabled: boolean) {
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

export function useTeams(workspaceId: string, enabled: boolean) {
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

export function useLocations(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["scope-filter", "locations", workspaceId],
    enabled,
    staleTime: 120_000,
    queryFn: async (): Promise<LocationOption[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("location")
        .select("location_id, name")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((l) => ({
        id: l.location_id,
        name: l.name,
      }));
    },
  });
}

export function useShiftsToday(workspaceId: string, dateISO: string, enabled: boolean) {
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
  const locationsQuery = useLocations(workspaceId, true);
  const shiftsQuery = useShiftsToday(workspaceId, dateISO, true);

  // Authority filter: manager only sees own dept unless admin/owner (ownDepartmentId null = no restriction)
  const visibleDepts = (deptsQuery.data ?? []).filter(
    (d) => !ownDepartmentId || d.id === ownDepartmentId,
  );
  const teams = teamsQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];

  const noTeams = !teamsQuery.isLoading && teams.length === 0;
  const noLocations = !locationsQuery.isLoading && locations.length === 0;
  const noShifts = !shiftsQuery.isLoading && shifts.length === 0;

  const selectedDeptId = scope.type === "department" ? scope.id : null;
  const selectedTeamId = scope.type === "team" ? scope.id : null;
  const selectedLocationId = scope.type === "location" ? scope.id : null;
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
        <TabsList className="grid w-full grid-cols-4">
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

          {/* Lokasjon tab — disabled with tooltip if no locations */}
          {noLocations ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <TabsTrigger value="location" disabled className="gap-1.5 text-xs opacity-40">
                    <MapPin className="h-3.5 w-3.5" />
                    Lok
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Ingen lokasjoner
              </TooltipContent>
            </Tooltip>
          ) : (
            <TabsTrigger value="location" className="gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Lok
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

        {/* Lokasjon content */}
        <TabsContent value="location" className="mt-2">
          {locationsQuery.isLoading ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Laster…</p>
          ) : locations.length === 0 ? (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">Ingen lokasjoner</p>
          ) : (
            <OptionList
              items={locations}
              selectedId={selectedLocationId}
              onSelect={(id) => onScopeChange({ type: "location", id })}
              renderItem={(l) => (
                <>
                  <MapPin className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{l.name}</span>
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

// ─── Multi-select ScopeFilterPopover (ADR-0367 W7-W9) ────────────────────────
//
// New component: OR-within-dimension, AND-between-dimensions filter.
// Accepts pre-fetched option lists so the popover renders without internal
// data fetching — caller controls data loading strategy.

export type ScopeSelection = {
  departmentIds: string[];
  locationIds: string[];
  shiftIds: string[];
};

type MultiSelectOption = { id: string; name: string };

type ScopeFilterPopoverProps = {
  selection: ScopeSelection;
  onChange: (next: ScopeSelection) => void;
  departments: MultiSelectOption[];
  locations: MultiSelectOption[];
  shifts: MultiSelectOption[];
};

export function ScopeFilterPopover({
  selection,
  onChange,
  departments,
  locations,
  shifts,
}: ScopeFilterPopoverProps) {
  const toggle = (key: keyof ScopeSelection, id: string) => {
    const current = selection[key];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ ...selection, [key]: next });
  };

  const totalSelected =
    selection.departmentIds.length +
    selection.locationIds.length +
    selection.shiftIds.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="scope-filter-trigger">
          <Filter className="mr-2 h-4 w-4" />
          Filter
          {totalSelected > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {totalSelected}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-border bg-background/95 backdrop-blur-xl"
        data-testid="scope-filter-popover"
      >
        <section className="space-y-3">
          <ScopeFilterDim
            title="Avdeling"
            options={departments}
            selected={selection.departmentIds}
            onToggle={(id) => toggle("departmentIds", id)}
            testid="dim-department"
          />
          <ScopeFilterDim
            title="Område"
            options={locations}
            selected={selection.locationIds}
            onToggle={(id) => toggle("locationIds", id)}
            testid="dim-location"
          />
          <ScopeFilterDim
            title="Vakt"
            options={shifts}
            selected={selection.shiftIds}
            onToggle={(id) => toggle("shiftIds", id)}
            testid="dim-shift"
          />
        </section>
        {totalSelected > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full"
            data-testid="scope-filter-clear"
            onClick={() =>
              onChange({ departmentIds: [], locationIds: [], shiftIds: [] })
            }
          >
            Nullstill
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ScopeFilterDim({
  title,
  options,
  selected,
  onToggle,
  testid,
}: {
  title: string;
  options: MultiSelectOption[];
  selected: string[];
  onToggle: (id: string) => void;
  testid: string;
}) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={testid}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {options.map((o) => (
          <li key={o.id} className="flex items-center gap-2">
            <Checkbox
              id={`${testid}-${o.id}`}
              checked={selected.includes(o.id)}
              onCheckedChange={() => onToggle(o.id)}
            />
            <label
              htmlFor={`${testid}-${o.id}`}
              className="text-sm text-foreground"
            >
              {o.name}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
