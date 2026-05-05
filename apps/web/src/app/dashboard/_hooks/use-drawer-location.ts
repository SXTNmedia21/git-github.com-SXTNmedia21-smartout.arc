"use client";

/**
 * Hook for LocationRichCard: fetches location details, departments at this
 * location, employee count across those departments, and today's active
 * shift count at this location.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

export function useDrawerLocation(locationId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: ["dashboard", "entity-drawer", "location", wsId ?? "none", locationId] as const,
    queryFn: async () => {
      const now = new Date().toISOString();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const [locationRes, departmentsRes, shiftsRes] = await Promise.all([
        supabase
          .from("location")
          .select(
            "location_id, name, description, address, latitude, longitude, location_type, capacity, is_active, created_at",
          )
          .eq("location_id", locationId)
          .single(),

        supabase
          .from("profile")
          .select("profile_id, department_id")
          .eq("workspace_id", wsId!)
          .eq("location_id", locationId)
          .eq("is_active", true),

        supabase
          .from("schedule_shift")
          .select("shift_id", { count: "exact", head: true })
          .eq("location_id", locationId)
          .gte("start_at", now)
          .lte("start_at", endOfDay.toISOString()),
      ]);

      if (locationRes.error) throw locationRes.error;

      // Collect unique department IDs from profiles at this location
      const profileData = departmentsRes.data ?? [];
      const uniqueDeptIds = [
        ...new Set(profileData.map((p) => p.department_id).filter(Boolean)),
      ] as string[];

      let departments: Array<{
        department_id: string;
        name: string;
        is_active: boolean;
        color: string | null;
      }> = [];
      if (uniqueDeptIds.length > 0) {
        const { data: deptData } = await supabase
          .from("department")
          .select("department_id, name, is_active, color")
          .in("department_id", uniqueDeptIds)
          .order("name");
        departments = deptData ?? [];
      }

      return {
        location: locationRes.data,
        departments,
        departmentCount: departments.length,
        employeeCount: profileData.length,
        activeShiftsToday: shiftsRes.count ?? 0,
      };
    },
    enabled: !!wsId && !!locationId,
    staleTime: 30_000,
  });
}

export type DrawerLocationData = ReturnType<typeof useDrawerLocation>["data"];
