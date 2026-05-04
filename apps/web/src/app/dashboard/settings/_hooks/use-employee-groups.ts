"use client";

// Full CRUD hook set for payroll.employee_group and payroll.employee_group_member.
// Groups are workspace-scoped wage buckets that members (profiles) can belong to.
// Cross-schema FK joins (payroll → public) don't work with Supabase's .select() syntax,
// so member profiles are resolved with a separate public.profile query and merged in memory.

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const employeeGroupSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  description: z.string().nullable(),
  default_hourly_rate: z.coerce.number().min(0),
  salary_code: z.string().nullable(),
  department_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
});

export type EmployeeGroupInput = z.infer<typeof employeeGroupSchema>;

export const WAGE_TYPES = ["hourly", "per_shift", "monthly"] as const;
export type WageType = (typeof WAGE_TYPES)[number];

export const employeeGroupMemberSchema = z.object({
  profile_id: z.string().uuid("Velg en ansatt"),
  employee_group_id: z.string().uuid(),
  hourly_rate: z.coerce.number().nullable(),
  valid_from: z.string().min(1, "Startdato er påkrevd"),
  valid_until: z.string().nullable(),
  wage_type: z.enum(WAGE_TYPES),
});

export type EmployeeGroupMemberInput = z.infer<typeof employeeGroupMemberSchema>;

// ─── Row types ────────────────────────────────────────────────────────────────

export type EmployeeGroupRow = EmployeeGroupInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  // Derived client-side — not a DB column
  member_count?: number;
};

export type EmployeeGroupMemberRow = EmployeeGroupMemberInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// Profile info joined in memory after a separate public.profile fetch.
// display_name is the single name field on public.profile.
export type EmployeeGroupMemberWithProfile = EmployeeGroupMemberRow & {
  profile_display_name: string | null;
};

// Minimal profile shape needed for the "add member" selector.
// public.profile uses display_name (not first_name/last_name).
export type ProfileOption = {
  profile_id: string;
  display_name: string;
};

// ─── Query Keys ───────────────────────────────────────────────────────────────

function groupsKey(workspaceId: string) {
  return ["settings", "employee-groups", workspaceId] as const;
}

function membersKey(workspaceId: string, groupId: string) {
  return ["settings", "employee-group-members", workspaceId, groupId] as const;
}

function profileOptionsKey(workspaceId: string) {
  return ["settings", "profile-options", workspaceId] as const;
}

// ─── Read hooks ───────────────────────────────────────────────────────────────

/**
 * Fetches all employee groups for the workspace, ordered by sort_order.
 * Member counts are resolved by fetching all members once and counting in memory —
 * avoids N+1 queries while keeping the query simple.
 */
export function useEmployeeGroups() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: groupsKey(wsId ?? "none"),
    queryFn: async (): Promise<EmployeeGroupRow[]> => {
      const [groupsResult, membersResult] = await Promise.all([
        supabase
          .schema("payroll")
          .from("employee_group")
          .select("*")
          .eq("workspace_id", wsId!)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .schema("payroll")
          .from("employee_group_member")
          .select("employee_group_id")
          .eq("workspace_id", wsId!),
      ]);

      if (groupsResult.error) throw new Error(groupsResult.error.message);
      if (membersResult.error) throw new Error(membersResult.error.message);

      // Count members per group in memory
      const countByGroupId = (membersResult.data ?? []).reduce<Record<string, number>>(
        (acc, row) => {
          const id = row.employee_group_id as string;
          acc[id] = (acc[id] ?? 0) + 1;
          return acc;
        },
        {},
      );

      return (groupsResult.data ?? []).map((g) => ({
        ...(g as EmployeeGroupRow),
        member_count: countByGroupId[g.id] ?? 0,
      }));
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetches members of a specific group, with first/last name resolved via a
 * separate public.profile query. Cross-schema FK joins are not supported by
 * Supabase's JS client .select() syntax.
 */
export function useEmployeeGroupMembers(groupId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: membersKey(wsId ?? "none", groupId ?? "none"),
    queryFn: async (): Promise<EmployeeGroupMemberWithProfile[]> => {
      const { data: members, error: membersError } = await supabase
        .schema("payroll")
        .from("employee_group_member")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("employee_group_id", groupId!)
        .order("created_at", { ascending: true });

      if (membersError) throw new Error(membersError.message);
      if (!members || members.length === 0) return [];

      const profileIds = [...new Set(members.map((m) => m.profile_id as string))];

      const { data: profiles, error: profilesError } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .in("profile_id", profileIds);

      if (profilesError) throw new Error(profilesError.message);

      const profileMap = (profiles ?? []).reduce<Record<string, ProfileOption>>((acc, p) => {
        acc[p.profile_id] = p as ProfileOption;
        return acc;
      }, {});

      return members.map((m) => {
        const profile = profileMap[m.profile_id as string];
        return {
          ...(m as EmployeeGroupMemberRow),
          profile_display_name: profile?.display_name ?? null,
        };
      });
    },
    enabled: !!wsId && !!groupId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetches all active profiles in the workspace for use in the "add member" selector.
 */
export function useWorkspaceProfiles() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: profileOptionsKey(wsId ?? "none"),
    queryFn: async (): Promise<ProfileOption[]> => {
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name")
        .eq("workspace_id", wsId!)
        .order("display_name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as ProfileOption[];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Group mutation hooks ─────────────────────────────────────────────────────

export function useCreateEmployeeGroup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: EmployeeGroupInput) => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("employee_group")
        .insert({
          workspace_id: wsId!,
          ...values,
          description: values.description || null,
          salary_code: values.salary_code || null,
          department_id: values.department_id || null,
        })
        .select("id, name")
        .single();

      if (error) throw new Error(error.message);
      return data as { id: string; name: string };
    },
    onSuccess: (data, _variables) => {
      void emit({
        event: "employee_group created",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            employee_group_id: data.id,
            name: data.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: groupsKey(wsId!) });
      toast.success("Lønnsgruppe opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

export function useUpdateEmployeeGroup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: EmployeeGroupInput }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("employee_group")
        .update({
          ...values,
          description: values.description || null,
          salary_code: values.salary_code || null,
          department_id: values.department_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name: values.name };
    },
    onSuccess: (data) => {
      void emit({
        event: "employee_group updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            employee_group_id: data.id,
            name: data.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: groupsKey(wsId!) });
      toast.success("Lønnsgruppe oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

export function useDeleteEmployeeGroup() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("employee_group")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name };
    },
    onSuccess: (data) => {
      void emit({
        event: "employee_group deleted",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            employee_group_id: data.id,
            name: data.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: groupsKey(wsId!) });
      toast.success("Lønnsgruppe slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}

// ─── Member mutation hooks ────────────────────────────────────────────────────

export function useAddGroupMember() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: EmployeeGroupMemberInput) => {
      const { error } = await supabase
        .schema("payroll")
        .from("employee_group_member")
        .insert({
          workspace_id: wsId!,
          ...values,
          // NULL means "use the group's default_hourly_rate"
          hourly_rate: values.hourly_rate ?? null,
          valid_until: values.valid_until || null,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "group_member added",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            employee_group_id: variables.employee_group_id,
            profile_id: variables.profile_id,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: membersKey(wsId!, variables.employee_group_id),
      });
      // Member count on the group card changes too
      void queryClient.invalidateQueries({ queryKey: groupsKey(wsId!) });
      toast.success("Ansatt lagt til i gruppen");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke legge til: ${error.message}`);
    },
  });
}

export function useUpdateGroupMember() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Omit<EmployeeGroupMemberInput, "profile_id" | "employee_group_id"> & {
        profile_id: string;
        employee_group_id: string;
      };
    }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("employee_group_member")
        .update({
          hourly_rate: values.hourly_rate ?? null,
          valid_from: values.valid_from,
          valid_until: values.valid_until || null,
          wage_type: values.wage_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { values };
    },
    onSuccess: (data) => {
      void emit({
        event: "group_member updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            employee_group_id: data.values.employee_group_id,
            profile_id: data.values.profile_id,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: membersKey(wsId!, data.values.employee_group_id),
      });
      toast.success("Lønnsinfo oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

export function useRemoveGroupMember() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      groupId,
      membProfileId,
    }: {
      id: string;
      groupId: string;
      membProfileId: string;
    }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("employee_group_member")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { groupId, membProfileId };
    },
    onSuccess: (data) => {
      void emit({
        event: "group_member removed",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            employee_group_id: data.groupId,
            profile_id: data.membProfileId,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: membersKey(wsId!, data.groupId),
      });
      void queryClient.invalidateQueries({ queryKey: groupsKey(wsId!) });
      toast.success("Ansatt fjernet fra gruppen");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke fjerne: ${error.message}`);
    },
  });
}
