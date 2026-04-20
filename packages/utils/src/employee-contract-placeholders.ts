// packages/utils/src/employee-contract-placeholders.ts
import type { SupabaseClient } from "@supabase/supabase-js";

type EmployeePlaceholderMap = Record<string, string>;

/**
 * Builds a flat key->value map of employee placeholders for contract templates.
 * Sources: profile, employment_contract, department, workspace, company.
 * Called at dashboard API layer with user JWT for RLS scoping.
 */
export async function buildEmployeePlaceholderMap(
  supabase: SupabaseClient,
  profileId: string,
  workspaceId: string,
): Promise<EmployeePlaceholderMap> {
  const [profileResult, contractResult, workspaceResult] = await Promise.all([
    supabase
      .from("profile")
      .select(
        "display_name, personal_number, address_line_1, postal_code, city, department:department_id(name)",
      )
      .eq("profile_id", profileId)
      .single(),
    supabase
      .from("employment_contract")
      .select(
        "position_title, start_date, end_date, monthly_salary, hourly_rate, employment_percentage, agreed_weekly_hours",
      )
      .eq("profile_id", profileId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("workspace")
      .select("name, address_line_1, postal_code, city, company:company_id(name, org_number)")
      .eq("workspace_id", workspaceId)
      .single(),
  ]);

  const profile = profileResult.data;
  const contract = contractResult.data;
  const workspace = workspaceResult.data;
  // Supabase returns joined relations as arrays; take the first element.
  const companyRaw = Array.isArray(workspace?.company) ? workspace.company[0] : workspace?.company;
  const company = companyRaw as { name: string; org_number: string } | null | undefined;
  const departmentRaw = Array.isArray(profile?.department)
    ? profile.department[0]
    : profile?.department;
  const department = departmentRaw as { name: string } | null | undefined;

  const addressParts = [profile?.address_line_1, profile?.postal_code, profile?.city].filter(
    Boolean,
  );
  const employerAddress = [
    workspace?.address_line_1,
    workspace?.postal_code,
    workspace?.city,
  ].filter(Boolean);

  const map: EmployeePlaceholderMap = {
    ansatt_navn: profile?.display_name ?? "",
    ansatt_personnummer: profile?.personal_number ?? "",
    ansatt_adresse: addressParts.join(", "),
    ansatt_epost: "", // resolved separately from user_identity if needed
    stilling: contract?.position_title ?? "",
    avdeling: department?.name ?? "",
    startdato: contract?.start_date ?? "",
    sluttdato: contract?.end_date ?? "",
    maanedslonn: contract?.monthly_salary?.toString() ?? "",
    timelonn: contract?.hourly_rate?.toString() ?? "",
    stillingsprosent: contract?.employment_percentage?.toString() ?? "",
    avtalt_timer_uke: contract?.agreed_weekly_hours?.toString() ?? "",
    arbeidsgiver_navn: company?.name ?? "",
    arbeidsgiver_org_nr: company?.org_number ?? "",
    arbeidsgiver_adresse: employerAddress.join(", "),
    arbeidssted: workspace?.name ?? "",
    kontraktdato: new Date().toISOString().split("T")[0] ?? "",
  };

  return map;
}
