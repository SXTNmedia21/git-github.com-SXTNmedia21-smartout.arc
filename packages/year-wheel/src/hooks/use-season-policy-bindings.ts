/**
 * useSeasonPolicyBindings — Per-season policy activation toggle.
 *
 * Fetches all workspace policies with their binding state for a given
 * season. The toggle mutation upserts a season_policy_binding row.
 * Used by SeasonProceduresTab to let managers decide which HMS policies
 * are active during a specific season.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";

import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import { yearWheelKeys } from "../query-keys";
import { toast } from "sonner";

type PolicyWithBinding = {
  policy_id: string;
  name: string;
  description: string | null;
  policy_type: string;
  policy_scope: string;
  enforcement_status: string;
  is_active_global: boolean;
  is_bound_to_season: boolean;
  binding_notes: string | null;
  season_policy_binding_id: string | null;
};

export function useSeasonPolicyBindings(
  seasonId: string | null,
  workspaceId: string | null,
  profileId: string | null,
) {
  const { t } = useTranslation("dashboard");

  const wsId = workspaceId;

  const supabase = createClient();
  const queryClient = useQueryClient();

  const queryKey = yearWheelKeys.seasonPolicyBindings(wsId ?? "none", seasonId ?? "none");

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<PolicyWithBinding[]> => {
      const [policiesResult, bindingsResult] = await Promise.all([
        supabase
          .from("policy")
          .select(
            "policy_id, name, description, policy_type, policy_scope, enforcement_status, is_active",
          )
          .eq("workspace_id", wsId!)
          .order("name", { ascending: true }),
        supabase
          .from("season_policy_binding")
          .select("season_policy_binding_id, policy_id, is_active, notes")
          .eq("workspace_id", wsId!)
          .eq("season_id", seasonId!),
      ]);

      if (policiesResult.error) throw new Error(policiesResult.error.message);
      if (bindingsResult.error) throw new Error(bindingsResult.error.message);

      const bindingMap = new Map((bindingsResult.data ?? []).map((b) => [b.policy_id, b]));

      return (policiesResult.data ?? []).map((p) => {
        const binding = bindingMap.get(p.policy_id);
        return {
          policy_id: p.policy_id,
          name: p.name,
          description: p.description,
          policy_type: p.policy_type,
          policy_scope: p.policy_scope,
          enforcement_status: p.enforcement_status,
          is_active_global: p.is_active,
          is_bound_to_season: binding?.is_active ?? false,
          binding_notes: binding?.notes ?? null,
          season_policy_binding_id: binding?.season_policy_binding_id ?? null,
        };
      });
    },
    enabled: !!wsId && !!seasonId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const toggleBinding = useMutation({
    mutationFn: async ({
      policyId,
      isActive,
    }: {
      policyId: string;
      isActive: boolean;
    }): Promise<void> => {
      const { error } = await supabase.from("season_policy_binding").upsert(
        {
          workspace_id: wsId!,
          season_id: seasonId!,
          policy_id: policyId,
          is_active: isActive,
          activated_by: profileId ?? null,
        },
        { onConflict: "season_id,policy_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { policyId, isActive }) => {
      void emit({
        event: "season_policy_binding updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season_policy_binding",
            entity_id: `${seasonId}-${policyId}`,
          },
          data: { policy_id: policyId, is_active: isActive },
        },
      });
      invalidate();
      toast.success(
        isActive
          ? t("yearWheel.toast_binding_activated")
          : t("yearWheel.toast_binding_deactivated"),
      );
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_binding_error", { error: error.message }));
    },
  });

  return {
    policies: query.data ?? [],
    isLoading: query.isLoading,
    toggleBinding,
  };
}
