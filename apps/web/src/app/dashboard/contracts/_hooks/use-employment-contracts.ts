/**
 * TanStack Query hooks for employment contracts.
 *
 * Replaces raw fetch() calls in wizard and page components.
 * All queries are workspace-scoped via DashboardContext.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ContractDraftProposal,
  EmploymentCategory,
} from "@/lib/contracts/resolve-composition";

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
  });
}

// ---------------------------------------------------------------------------
// Compose (preview or persist)
// ---------------------------------------------------------------------------

type ComposeInput = {
  workspace_id: string;
  profile_id: string;
  position_title: string;
  employment_category: EmploymentCategory;
  employment_percentage: number;
  employee_group_id?: string;
  persist: boolean;
};

type ComposeResult = ContractDraftProposal & {
  contract_id?: string;
  persisted?: boolean;
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
      toast.success("Kontrakt sendt");
      void queryClient.invalidateQueries({
        queryKey: contractKeys.detail(variables.contract_id),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
