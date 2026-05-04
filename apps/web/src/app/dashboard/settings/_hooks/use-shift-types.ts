"use client";

// Full CRUD hook for payroll.shift_type.
// Shift types define how a shift is categorised for payroll — they carry
// a color (used as a visual stripe in the schedule and settings UI), an
// optional salary code link, a rate adjustment strategy, and a set of
// feature flags that control how payroll calculations handle the shift.
//
// All mutations emit telemetry and invalidate the shared query key so
// every consumer (card grid, schedule picker) stays in sync with DB state.

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schema ─────────────────────────────────────────────────────────────────

export const RATE_ADJUSTMENT_TYPES = ["none", "replace", "add", "percentage"] as const;

export type RateAdjustmentType = (typeof RATE_ADJUSTMENT_TYPES)[number];

export const RATE_ADJUSTMENT_LABELS: Record<RateAdjustmentType, string> = {
  none: "Ingen justering",
  replace: "Erstatt timesats",
  add: "Legg til per time",
  percentage: "Prosenttillegg",
};

export const shiftTypeSchema = z.object({
  name: z.string().min(1, "Navn er påkrevd"),
  // No .default() here — defaults live in useForm's defaultValues so that
  // the inferred type stays non-optional and matches react-hook-form's Resolver.
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Ugyldig farge (bruk hex, f.eks. #6B7280)"),
  salary_code: z.string().nullable(),
  rate_adjustment_type: z.enum(RATE_ADJUSTMENT_TYPES),
  rate_adjustment_value: z.coerce.number().min(0),
  count_in_payroll: z.boolean(),
  allow_supplements: z.boolean(),
  allow_breaks: z.boolean(),
  allow_meal_deduction: z.boolean(),
  affects_salaried: z.boolean(),
  allow_conflicting_shifts: z.boolean(),
  include_in_schedule_print: z.boolean(),
  overwrite_on_template: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
});

export type ShiftTypeInput = z.infer<typeof shiftTypeSchema>;

// ─── Full row type (matches payroll.shift_type) ──────────────────────────────

export type ShiftTypeRow = ShiftTypeInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

function shiftTypesKey(workspaceId: string) {
  return ["settings", "shift-types", workspaceId] as const;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetches all shift types for the current workspace, ordered by sort_order
 * then name. Returns both active and inactive so the admin grid shows everything.
 */
export function useShiftTypes() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: shiftTypesKey(wsId ?? "none"),
    queryFn: async (): Promise<ShiftTypeRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("shift_type")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as ShiftTypeRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Inserts a new shift type for the current workspace. */
export function useCreateShiftType() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: ShiftTypeInput) => {
      const { error } = await supabase
        .schema("payroll")
        .from("shift_type")
        .insert({
          workspace_id: wsId!,
          ...values,
          salary_code: values.salary_code || null,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "shift_type created",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            name: variables.name,
            rate_adjustment_type: variables.rate_adjustment_type,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: shiftTypesKey(wsId!) });
      toast.success("Vakttype opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

/** Updates an existing shift type by ID. */
export function useUpdateShiftType() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ShiftTypeInput }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("shift_type")
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
        event: "shift_type updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            shift_type_id: id,
            name: values.name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: shiftTypesKey(wsId!) });
      toast.success("Vakttype oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a shift type by ID. Only safe when not referenced by existing shifts. */
export function useDeleteShiftType() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("shift_type")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, name };
    },
    onSuccess: (_data, { id, name }) => {
      void emit({
        event: "shift_type deleted",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            shift_type_id: id,
            name,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: shiftTypesKey(wsId!) });
      toast.success("Vakttype slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}
