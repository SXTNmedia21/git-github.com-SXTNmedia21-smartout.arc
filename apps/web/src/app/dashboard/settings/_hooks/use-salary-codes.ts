"use client";

// Full CRUD hook for payroll.salary_code.
// All four mutations (create, update, delete) emit telemetry and
// invalidate the same query key so the table always reflects DB state.
//
// The useSalaryCodes() export in use-payroll-settings.ts fetches only
// id/code/name/category for dropdown use. This hook fetches the full
// row shape needed by the admin DataTable + Sheet editor.

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

// ─── Schema ─────────────────────────────────────────────────────────────────

export const SALARY_CODE_CATEGORIES = [
  "worked_hours",
  "supplement",
  "overtime",
  "absence",
  "deduction",
  "monthly_salary",
] as const;

export type SalaryCodeCategory = (typeof SALARY_CODE_CATEGORIES)[number];

export const salaryCodeSchema = z.object({
  code: z.string().min(1, "Kode er påkrevd"),
  name: z.string().min(1, "Navn er påkrevd"),
  description: z.string().nullable(),
  external_code: z.string().nullable(),
  category: z.enum(SALARY_CODE_CATEGORIES),
  a_melding_code: z.string().nullable(),
  is_active: z.boolean(),
});

export type SalaryCodeInput = z.infer<typeof salaryCodeSchema>;

// ─── Full row type (matches payroll.salary_code) ─────────────────────────────

export type SalaryCodeRow = SalaryCodeInput & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// ─── Query Keys ──────────────────────────────────────────────────────────────

function salaryCodesKey(workspaceId: string) {
  return ["settings", "salary-codes-full", workspaceId] as const;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetches ALL salary codes (active and inactive) for the current workspace,
 * ordered by code. Used by the admin DataTable — not for dropdown population
 * (use useSalaryCodes() from use-payroll-settings.ts for that).
 */
export function useSalaryCodes() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: salaryCodesKey(wsId ?? "none"),
    queryFn: async (): Promise<SalaryCodeRow[]> => {
      const { data, error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SalaryCodeRow[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Inserts a new salary code for the current workspace. */
export function useCreateSalaryCode() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: SalaryCodeInput) => {
      const { error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .insert({
          workspace_id: wsId!,
          ...values,
          // Coerce empty strings to null for optional text columns
          description: values.description || null,
          external_code: values.external_code || null,
          a_melding_code: values.a_melding_code || null,
        });

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "salary_code created",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            code: variables.code,
            category: variables.category,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: salaryCodesKey(wsId!) });
      // Also bust the dropdown query used by the payroll settings form
      void queryClient.invalidateQueries({
        queryKey: ["settings", "salary-codes", wsId!],
      });
      toast.success("Lønnsart opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });
}

/** Updates an existing salary code by ID. */
export function useUpdateSalaryCode() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: SalaryCodeInput }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .update({
          ...values,
          description: values.description || null,
          external_code: values.external_code || null,
          a_melding_code: values.a_melding_code || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, { id, values }) => {
      void emit({
        event: "salary_code updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            salary_code_id: id,
            code: values.code,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: salaryCodesKey(wsId!) });
      void queryClient.invalidateQueries({
        queryKey: ["settings", "salary-codes", wsId!],
      });
      toast.success("Lønnsart oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });
}

/** Hard-deletes a salary code by ID. Only safe when not referenced by any shifts. */
export function useDeleteSalaryCode() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, code }: { id: string; code: string }) => {
      const { error } = await supabase
        .schema("payroll")
        .from("salary_code")
        .delete()
        .eq("id", id)
        .eq("workspace_id", wsId!);

      if (error) throw new Error(error.message);
      return { id, code };
    },
    onSuccess: (_data, { id, code }) => {
      void emit({
        event: "salary_code deleted",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            salary_code_id: id,
            code,
          },
        },
      });
      void queryClient.invalidateQueries({ queryKey: salaryCodesKey(wsId!) });
      void queryClient.invalidateQueries({
        queryKey: ["settings", "salary-codes", wsId!],
      });
      toast.success("Lønnsart slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });
}
