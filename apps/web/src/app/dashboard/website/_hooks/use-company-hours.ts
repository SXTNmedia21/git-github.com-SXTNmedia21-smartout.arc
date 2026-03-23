"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { getCompanyHours, updateCompanyHours, type DayHours } from "../_actions/bridge-actions";
import { websiteKeys } from "./website-keys";
import { toast } from "sonner";

export function useCompanyHours() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...websiteKeys.all, "company-hours", wsId],
    queryFn: () => getCompanyHours(wsId!),
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });

  const update = useMutation({
    mutationFn: (hours: DayHours[]) => updateCompanyHours(wsId!, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...websiteKeys.all, "company-hours"] });
      toast.success("Åpningstider oppdatert");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { hours: query.data ?? [], isLoading: query.isLoading, update };
}
