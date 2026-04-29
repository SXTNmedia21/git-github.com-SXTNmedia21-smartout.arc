/**
 * TanStack Query hooks for employment contracts.
 *
 * Replaces raw fetch() calls in wizard and page components.
 * All queries are workspace-scoped via DashboardContext.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { ContractDraftProposal, EmploymentCategory } from "@smartout/utils";

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export const contractKeys = {
  all: (workspaceId: string) => ["employment-contracts", workspaceId] as const,
  detail: (id: string) => ["employment-contract", id] as const,
};

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

type EmploymentContractRow = {
  contract_id: string;
  profile_id: string;
  status: string;
  position_title: string | null;
  employment_category: string | null;
  employment_percentage: number | null;
  hourly_rate: number | null;
  monthly_salary: number | null;
  created_at: string;
  profile: { display_name: string } | null;
};

export function useEmploymentContracts(workspaceId: string | undefined) {
  return useQuery({
    queryKey: contractKeys.all(workspaceId ?? ""),
    queryFn: async (): Promise<EmploymentContractRow[]> => {
      const res = await fetch(`/api/employment-contracts/list?workspace_id=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch contracts");
      const json = (await res.json()) as { data: EmploymentContractRow[] };
      return json.data;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Compose (preview or persist)
// ---------------------------------------------------------------------------

type ComposeInput = {
  workspace_id: string;
  /** Subject employee being contracted — sent to the API for contract generation. */
  profile_id: string;
  /**
   * Admin performing the action — used as `actor_id` in telemetry.
   * Required: resolved from DashboardContext at the call site (not the subject
   * employee). TypeScript will reject any call site that omits this field so
   * the actor never silently falls back to the subject's profile_id.
   */
  actor_profile_id: string;
  position_title: string;
  employment_category: EmploymentCategory;
  employment_percentage: number;
  employee_group_id?: string;
  persist: boolean;
};

type ComposeResult = ContractDraftProposal & {
  contract_id?: string;
  persisted?: boolean;
  resolved_template?: {
    template_id: string;
    template_name: string;
    source: "workspace_group" | "workspace_category" | "system";
    employee_group_name?: string;
  } | null;
};

export function useComposeContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ComposeInput): Promise<ComposeResult> => {
      const res = await fetch("/api/employment-contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Composition failed");
      }
      return res.json() as Promise<ComposeResult>;
    },
    onSuccess: (data, variables) => {
      // actor_id must be the ADMIN performing the action, not the subject
      // employee (profile_id). Call sites resolve this from DashboardContext
      // and pass it as actor_profile_id.
      void emit({
        event: "contracts.compose.submitted",
        workspace_id: nonEmpty(variables.workspace_id, "workspace_id"),
        actor_id: nonEmpty(variables.actor_profile_id, "actor_id"),
        properties: {
          entity: {
            entity_type: "employment_contract",
            entity_id: data.contract_id ?? "",
            entity_label: variables.position_title,
          },
          data: {
            template_id: "",
            profile_id: variables.profile_id,
            framework_id: "",
            override_count: 0,
            blocker_count: 0,
          },
        },
      });
      if (data.persisted) {
        void queryClient.invalidateQueries({
          queryKey: contractKeys.all(variables.workspace_id),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

type SendInput = {
  contract_id: string;
  idempotency_key?: string;
};

type SendResult = {
  sent: boolean;
  status: string;
  contract_id: string;
  signing_contract_id?: string;
  pii_complete?: boolean;
};

export function useSendContract() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("contracts");

  return useMutation({
    mutationFn: async (input: SendInput): Promise<SendResult> => {
      const res = await fetch(`/api/employment-contracts/${input.contract_id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: input.idempotency_key,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Send failed");
      }
      return res.json() as Promise<SendResult>;
    },
    onSuccess: (_data, variables) => {
      // Telemetry for "contract sent" is emitted by the server route with
      // correct workspace_id and actor data — do not duplicate here.
      toast.success(t("toast.contract_sent"));
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contract_id),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
