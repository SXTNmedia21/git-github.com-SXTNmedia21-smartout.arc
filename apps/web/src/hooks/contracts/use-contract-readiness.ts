"use client";

/**
 * useContractReadiness — pre-flight check for ContractDispatchDrawer.
 *
 * Why: Send-route returns 422 when no draft + required fields exist
 * (apps/web/src/app/api/contracts/send/route.ts:188). Show that state
 * BEFORE the user clicks Send so they can fill out missing data on the
 * people-page Ansettelse section, or hand off to the employee.
 *
 * Checks:
 *   - draft row exists (status in [draft, pending_data]) for profile_id
 *   - position_title, employment_form, employment_category, start_date populated
 *   - end_date when employment_form ∈ {temporary, apprentice, practice}
 *   - remuneration_type + matching salary field
 *     (CHECK constraint employment_contract_salary_matches_type)
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type ContractMissingField = {
  id: string;
  label: string;
};

export type ContractReadiness = {
  hasDraft: boolean;
  ready: boolean;
  missing: ContractMissingField[];
  draftId: string | null;
};

const TEMPORARY_FORMS = new Set(["temporary", "apprentice", "practice"]);
const VALID_CATEGORIES = new Set(["fast", "deltid", "tilkalling"]);

const NO_DRAFT: ContractReadiness = {
  hasDraft: false,
  ready: false,
  draftId: null,
  missing: [
    {
      id: "ansettelse",
      label: "Ansettelse-seksjon ikke utfylt",
    },
  ],
};

export function useContractReadiness(profileId: string | null, workspaceId: string | null) {
  return useQuery<ContractReadiness>({
    queryKey: ["contract-readiness", workspaceId ?? "", profileId ?? ""],
    enabled: !!profileId && !!workspaceId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("employment_contract")
        .select(
          "contract_id, position_title, employment_form, employment_category, start_date, end_date, remuneration_type, monthly_salary, hourly_rate, minimum_guaranteed_amount",
        )
        .eq("workspace_id", workspaceId!)
        .eq("profile_id", profileId!)
        .in("status", ["draft", "pending_data"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return NO_DRAFT;

      const missing: ContractMissingField[] = [];

      if (!data.position_title || !String(data.position_title).trim()) {
        missing.push({ id: "position_title", label: "Stillingstittel" });
      }
      if (!data.employment_form) {
        missing.push({ id: "employment_form", label: "Ansettelsesform" });
      }
      if (!data.employment_category || !VALID_CATEGORIES.has(String(data.employment_category))) {
        missing.push({ id: "employment_category", label: "Kategori (fast/deltid/tilkalling)" });
      }
      if (!data.start_date) {
        missing.push({ id: "start_date", label: "Startdato" });
      }
      if (
        data.employment_form &&
        TEMPORARY_FORMS.has(String(data.employment_form)) &&
        !data.end_date
      ) {
        missing.push({ id: "end_date", label: "Sluttdato (kreves for midlertidig ansettelse)" });
      }

      const remType = data.remuneration_type;
      const hasMonthly = data.monthly_salary != null;
      const hasHourly = data.hourly_rate != null;
      const hasMinGuaranteed = data.minimum_guaranteed_amount != null;

      if (!remType) {
        missing.push({ id: "remuneration_type", label: "Avlønningstype" });
      } else if (remType === "monthlyWage" && !hasMonthly) {
        missing.push({ id: "monthly_salary", label: "Månedslønn" });
      } else if (remType === "hourlyWage" && !hasHourly) {
        missing.push({ id: "hourly_rate", label: "Timelønn" });
      } else if (remType === "commissionOnly" && !hasMonthly && !hasHourly && !hasMinGuaranteed) {
        missing.push({
          id: "commission_floor",
          label: "Provisjon krever månedslønn, timelønn eller minstebeløp",
        });
      }

      return {
        hasDraft: true,
        ready: missing.length === 0,
        missing,
        draftId: data.contract_id,
      };
    },
  });
}
