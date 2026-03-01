export type OrgTab = "overview" | "departments" | "locations" | "teams";

export type CompanyRow = {
  company_id: string;
  name: string;
  legal_name: string | null;
  org_number: string;
  country: string;
  industry: string;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  billing_email: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  daglig_leder: string | null;
  nace_code: string | null;
  nace_description: string | null;
  is_active: boolean;
};

export type WorkspaceRow = {
  workspace_id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  currency: string;
  language: string;
  country: string;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  brand_color: string | null;
  slogan: string | null;
  active_modules: string[] | null;
  max_profiles: number | null;
  is_active: boolean;
  contract_status: string | null;
};

export type DepartmentRow = {
  department_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export type LocationRow = {
  location_id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  floor: string | null;
  capacity: number | null;
  location_type: string;
  sort_order: number | null;
  is_active: boolean;
};

export type TeamRow = {
  team_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  leader_profile_id: string | null;
  team_type: string;
  department_id: string | null;
  season_id: string | null;
  is_active: boolean;
};

export type PositionRow = {
  position_id: string;
  name: string;
  department_id: string;
  is_active: boolean;
  minimum_role: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
};

export type PolicyRef = {
  policy_id: string;
  policy_scope: string;
  scope_ref_id: string | null;
};

export type SetupCheckItem = {
  key: string;
  label: string;
  done: boolean;
  tab?: OrgTab;
};

export type CountMap = Record<string, number>;

export const LANGUAGE_LABELS: Record<string, string> = {
  no: "Norsk",
  sv: "Svenska",
  en: "English",
  da: "Dansk",
  fi: "Suomi",
};

export const COUNTRY_LABELS: Record<string, string> = {
  NO: "Norge",
  SE: "Sverige",
  DK: "Danmark",
  FI: "Finland",
};

export const INDUSTRY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  hotel: "Hotell",
  cafe: "Kafe",
  bar: "Bar",
  catering: "Catering",
  other: "Annet",
};

export const ICON_PRESETS = [
  { key: "utensils-crossed", label: "Kitchen" },
  { key: "wine", label: "Bar" },
  { key: "coffee", label: "Cafe" },
  { key: "concierge-bell", label: "Reception" },
  { key: "users", label: "Staff" },
  { key: "truck", label: "Delivery" },
  { key: "shield-check", label: "Security" },
  { key: "wrench", label: "Maintenance" },
  { key: "book-open", label: "Training" },
  { key: "music", label: "Entertainment" },
  { key: "sparkles", label: "Housekeeping" },
  { key: "heart-pulse", label: "First Aid" },
] as const;

export const COLOR_PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatOrgNumber(orgNr: string): string {
  const digits = orgNr.replace(/\s/g, "");
  if (digits.length !== 9) return orgNr;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
