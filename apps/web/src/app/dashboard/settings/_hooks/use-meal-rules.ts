"use client";

// Full CRUD hook for payroll.meal_rule.
// Meal rules control how food deductions or employer contributions are applied
// during payroll calculation — e.g. "deduct kr 45 after shifts of 5+ hours."
//
// Each mutation emits telemetry and invalidates the shared query key so the
// table in MealRulesSettings always reflects current DB state.

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schema ─────────────────────────────────────────────────────────────────

export const MEAL_TYPES = ["deduction", "contribution"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const mealRuleSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  meal_type: z.enum(MEAL_TYPES),
  salary_code: z.string().nullable(),
  amount: z.coerce.number().min(0, "Beløp må være 0 eller høyere"),
  min_shift_hours: z.coerce.number().min(0, "Minimum vakttimer må være 0 eller høyere"),
  department_ids: z.array(z.string().uuid()),
  employee_group_ids: z.array(z.string().uuid()),
  shift_type_ids: z.array(z.string().uuid()),
  is_active: z.boolean(),
});

export type MealRuleInput = z.infer<typeof mealRuleSchema>;

// ─── Full row type (matches payroll.meal_rule) ────────────────────────────────

export type MealRuleRow = MealRuleInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// ─── Query key ───────────────────────────────────────────────────────────────

function mealRulesKey(workspaceId: string) {
  return ["settings", "meal-rules", workspaceId] as const;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetches all meal rules (active and inactive) for the current workspace,
 * ordered alphabetically by name.
 */
export function useMealRules() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: mealRulesKey(wsId ?? "none"),
    queryFn: async (): Promise<MealRuleRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("meal_rule")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as MealRuleRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Inserts a new meal rule for the current workspace. */
export function useCreateMealRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: MealRuleInput) => {
      const { error } = await supabase
        .schema("payroll")
        .from("meal_rule")
        .insert({
          workspace_id: wsId!,
          ...values,
          salary_code: values.salary_code || null,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "meal_rule created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            // id not available at this point; name + type give enough context
            meal_rule_id: "",
            name: variables.name,
            meal_type: variables.meal_type,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: mealRulesKey(wsId!) });
      toast.success("Måltidsregel opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

/** Updates an existing meal rule by ID. */
export function useUpdateMealRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: MealRuleInput }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("meal_rule")
        .update({
          ...values,
          salary_code: values.salary_code || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { id, values }) => {
      void emit({
        event: "meal_rule updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            meal_rule_id: id,
            name: values.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: mealRulesKey(wsId!) });
      toast.success("Måltidsregel oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a meal rule by ID. */
export function useDeleteMealRule() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("meal_rule")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name };
    },
    onSuccess: (_data, { id, name }) => {
      void emit({
        event: "meal_rule deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            meal_rule_id: id,
            name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: mealRulesKey(wsId!) });
      toast.success("Måltidsregel slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}
