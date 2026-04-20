"use client";

/**
 * TanStack Query mutations for governance CRUD operations.
 * Handles create/update for policies, protocols, procedures, knowledge tests, and confirmations.
 * Every mutation calls emit() from @smartout/telemetry on success.
 * Connected to: PolicyForm, ProtocolForm, ProcedureBuilder, KnowledgeTestBuilder, ConfirmationForm
 */

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { dashboardKeys } from "@/app/dashboard/_hooks/dashboard-keys";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type PolicyInput = {
  name: string;
  statement: string;
  description?: string;
  policy_type: "operational" | "haccp" | "hr" | "safety" | "access" | "payroll" | "custom";
  policy_scope: "workspace" | "department" | "team" | "location";
  enforcement_status?: "aspirational" | "enforced";
};

type ProtocolInput = {
  name: string;
  description?: string;
  policy_id: string;
  owner_profile_id: string;
  version?: string;
};

type ProcedureInput = {
  name: string;
  description?: string;
  protocol_id: string;
  procedure_type?: "safety" | "custom" | "onboarding" | "standard" | "maintenance";
  sort_order?: number;
  steps: Array<{
    title: string;
    description: string;
    step_order: number;
    is_required?: boolean;
    estimated_minutes?: number;
  }>;
};

type KnowledgeTestInput = {
  name: string;
  description?: string;
  protocol_id: string;
  pass_threshold: number;
  max_attempts?: number;
  questions: Array<{
    id: string;
    text: string;
    options: Array<{ id: string; text: string }>;
    correctOptionId: string;
  }>;
};

type ConfirmationInput = {
  name: string;
  confirmation_text: string;
  protocol_id: string;
  requires_signature?: boolean;
};

// ══════════════════════════════════════════════════════════════
// Policy CRUD
// ══════════════════════════════════════════════════════════════

export function useCreatePolicy() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: PolicyInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("policy")
        .insert({
          ...input,
          workspace_id: workspace.workspace_id,
          created_by: profileId!,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "policy created" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-policy-created",
          context: data.policy_id,
        },
      });
      toast.success("Policy opprettet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette policy");
    },
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async ({ id, ...input }: PolicyInput & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("policy")
        .update(input)
        .eq("policy_id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "policy updated" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-policy-updated",
          context: data.policy_id,
        },
      });
      toast.success("Policy oppdatert");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke oppdatere policy");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Protocol CRUD
// ══════════════════════════════════════════════════════════════

export function useCreateProtocol() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: ProtocolInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .insert({
          ...input,
          workspace_id: workspace.workspace_id,
          created_by: profileId!,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "protocol created" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-protocol-created",
          context: data.protocol_id,
        },
      });
      toast.success("Protokoll opprettet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette protokoll");
    },
  });
}

export function useUpdateProtocol() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async ({ id, ...input }: ProtocolInput & { id: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .update(input)
        .eq("protocol_id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "protocol updated" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-protocol-updated",
          context: data.protocol_id,
        },
      });
      toast.success("Protokoll oppdatert");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke oppdatere protokoll");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Procedure CRUD (with steps)
// ══════════════════════════════════════════════════════════════

export function useCreateProcedure() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: ProcedureInput) => {
      const supabase = createClient();
      const { steps, ...procedureData } = input;

      // Create procedure. Note: procedure has NO workspace_id column
      // (00003_governance_tables.sql:61-73). Tenancy is inherited via
      // protocol_id FK → protocol.workspace_id. Same bug class as the
      // knowledge_test fix earlier today (2026-04-17 Tier 2 v1.5 council,
      // Agent Coordinator code-trace finding #6).
      const { data: proc, error: procError } = await supabase
        .from("procedure")
        .insert({ ...procedureData })
        .select()
        .single();

      if (procError) throw procError;

      // Create steps
      if (steps.length > 0) {
        const { error: stepsError } = await supabase.from("procedure_step").insert(
          steps.map((s) => ({
            ...s,
            procedure_id: proc.procedure_id,
          })),
        );

        if (stepsError) throw stepsError;
      }

      return proc;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "procedure created" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-procedure-created",
          context: data.procedure_id,
        },
      });
      toast.success("Prosedyre opprettet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette prosedyre");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Knowledge Test CRUD
// ══════════════════════════════════════════════════════════════

export function useCreateKnowledgeTest() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: KnowledgeTestInput) => {
      const supabase = createClient();
      // knowledge_test has NO workspace_id column (verified via
      // 00003_governance_tables.sql:163-176). Tenancy is inherited via
      // protocol_id FK → protocol.workspace_id. Previously the insert
      // included workspace_id, which Supabase silently dropped in some
      // environments and rejected in others. Caught by Agent Coordinator
      // code-trace in the 2026-04-17 Tier 2 v1.5 council review.
      const { data, error } = await supabase
        .from("knowledge_test")
        .insert({
          ...input,
          questions: input.questions as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "knowledge_test created" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-knowledge-test-created",
          context: data.knowledge_test_id,
        },
      });
      toast.success("Kunnskapstest opprettet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette kunnskapstest");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Confirmation CRUD
// ══════════════════════════════════════════════════════════════

export function useCreateConfirmation() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: ConfirmationInput) => {
      const supabase = createClient();
      // confirmation has NO workspace_id column
      // (00003_governance_tables.sql:179-190). Tenancy via protocol_id FK →
      // protocol.workspace_id. Same bug class as knowledge_test + procedure.
      const { data, error } = await supabase
        .from("confirmation")
        .insert({ ...input })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      // TODO(plan-phase-2): event pending — no "confirmation created" event registered yet
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "governance-confirmation-created",
          context: data.confirmation_id,
        },
      });
      toast.success("Bekreftelse opprettet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
    },

    onError: () => {
      toast.error("Kunne ikke opprette bekreftelse");
    },
  });
}
