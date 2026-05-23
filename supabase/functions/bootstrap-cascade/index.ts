/**
 * Bootstrap Cascade Edge Function
 *
 * Seeds cascade data for a new workspace: base hours, department classification,
 * department hours with offsets, framework binding, tariff rates, planning cycle,
 * season budget enrichment, day/hour factors, payroll templates, authority config,
 * profession + profession_training (Step 11, hospitality only).
 *
 * Properties: Idempotent. Resumable. Auditable via workspace_bootstrap_run.
 * Auth: Service-role only (called internally from activate-workspace / finalize-workspace).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyInternalAuth } from "../_shared/internal-auth.ts";

// Department name → type mapping (mirrors hospitality.ts DEPARTMENT_TYPE_MAP)
const DEPARTMENT_TYPE_MAP: Record<string, { type: string; confidence: string }> = {
  kjøkken: { type: "operational", confidence: "high" },
  kjokken: { type: "operational", confidence: "high" },
  kitchen: { type: "operational", confidence: "high" },
  sal: { type: "operational", confidence: "high" },
  floor: { type: "operational", confidence: "high" },
  "front of house": { type: "operational", confidence: "high" },
  service: { type: "operational", confidence: "high" },
  bar: { type: "operational", confidence: "high" },
  "bar ute": { type: "operational", confidence: "high" },
  uteservering: { type: "operational", confidence: "high" },
  oppvask: { type: "operational", confidence: "high" },
  bakeri: { type: "operational", confidence: "high" },
  kafe: { type: "operational", confidence: "high" },
  resepsjon: { type: "operational", confidence: "high" },
  kontor: { type: "administrative", confidence: "high" },
  admin: { type: "administrative", confidence: "high" },
  administrasjon: { type: "administrative", confidence: "high" },
  administration: { type: "administrative", confidence: "high" },
  hr: { type: "administrative", confidence: "high" },
  regnskap: { type: "administrative", confidence: "high" },
  økonomi: { type: "administrative", confidence: "high" },
  ledelse: { type: "administrative", confidence: "high" },
};

// Department offset defaults in minutes
const OFFSET_DEFAULTS: Record<string, { open: number; close: number }> = {
  kjøkken: { open: -120, close: 0 },
  kjokken: { open: -120, close: 0 },
  kitchen: { open: -120, close: 0 },
  sal: { open: -60, close: 0 },
  floor: { open: -60, close: 0 },
  service: { open: -60, close: 0 },
  "front of house": { open: -60, close: 0 },
  bar: { open: 0, close: 0 },
  "bar ute": { open: 240, close: 0 },
  uteservering: { open: 0, close: 0 },
};

// Hospitality default base hours (0=Mon..6=Sun)
const DEFAULT_BASE_HOURS = [
  { dayOfWeek: 0, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 1, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 2, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 3, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 4, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 5, openTime: "11:00", closeTime: "23:00", isClosed: false },
  { dayOfWeek: 6, openTime: "12:00", closeTime: "22:00", isClosed: false },
];

// Administrative default hours
const ADMIN_DEFAULT_HOURS = [
  { dayOfWeek: 0, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 1, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 2, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isClosed: false },
  { dayOfWeek: 5, openTime: null, closeTime: null, isClosed: true },
  { dayOfWeek: 6, openTime: null, closeTime: null, isClosed: true },
];

// Payroll profile templates
const PAYROLL_TEMPLATES = [
  {
    name: "Servitør heltid",
    salaryType: "hourly",
    weeklyHours: 37.5,
    tariffCategory: "ufaglart",
    employmentCategory: "fast",
  },
  {
    name: "Servitør deltid",
    salaryType: "hourly",
    weeklyHours: 20,
    tariffCategory: "ufaglart",
    employmentCategory: "deltid",
  },
  {
    name: "Kokk heltid",
    salaryType: "hourly",
    weeklyHours: 37.5,
    tariffCategory: "faglart",
    employmentCategory: "fast",
  },
  {
    name: "Leder",
    salaryType: "monthly",
    weeklyHours: 37.5,
    tariffCategory: "leder",
    employmentCategory: "fast",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hospitality role-capability profiles (Step 11 — profession_seed).
//
// NOTE: Deno Edge Functions cannot import @smartout/ai (ADR-0084 Deno boundary).
// This data is inlined from packages/ai/src/industry/packages/hospitality.ts
// roleCapabilityProfiles. KEEP IN SYNC with that source when adding/removing
// roles or protocol slug mappings (the TS package is authoritative).
//
// Contract (A5 reader): profession.slug == roleSlug is the join key.
// Protocol slugs must exactly match protocol.name in the governance tables.
// ─────────────────────────────────────────────────────────────────────────────
type RoleCapabilityProfile = {
  roleSlug: string;
  positionSlugs: string[];
  mandatoryProtocolSlugs: string[];
  readySignal: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap gate definitions (Step 12 — seed_bootstrap_gates).
//
// NOTE: Deno boundary (ADR-0084) — cannot import @smartout/ai or @smartout/types.
// Inlined from:
//   packages/ai/src/industry/packages/hospitality.ts → HOSPITALITY_BOOTSTRAP_GATES
//   packages/ai/src/industry/packages/default.ts → DEFAULT_BOOTSTRAP_GATES
// KEEP IN SYNC with those sources. TS packages are authoritative.
//
// ADR-0407 Phase 1 — workspace_bootstrap_gate table seeded here.
// ─────────────────────────────────────────────────────────────────────────────
type BootstrapGateDefinition = {
  gate_slug: string;
  required: boolean;
  suggested_day: number | null;
  depends_on: string[];
  display_label_no: string;
  display_label_en: string;
  description: string;
  capability_slug: string | null;
};

// Inlined from HOSPITALITY_BOOTSTRAP_GATES (hospitality.ts)
const HOSPITALITY_BOOTSTRAP_GATES: BootstrapGateDefinition[] = [
  {
    gate_slug: "departments_exist",
    required: true,
    suggested_day: 1,
    depends_on: [],
    display_label_no: "Avdelinger opprettet",
    display_label_en: "Departments created",
    description: "Minst én avdeling må eksistere for at vakter og protokoller skal fungere.",
    capability_slug: "org",
  },
  {
    gate_slug: "locations_exist",
    required: true,
    suggested_day: 1,
    depends_on: [],
    display_label_no: "Lokasjoner opprettet",
    display_label_en: "Locations created",
    description: "Fysisk(e) lokasjon(er) for vaktplanlegging.",
    capability_slug: "org",
  },
  {
    gate_slug: "operating_hours_set",
    required: true,
    suggested_day: 2,
    depends_on: ["departments_exist"],
    display_label_no: "Åpningstider satt",
    display_label_en: "Operating hours set",
    description: "Åpningstider per avdeling — driver session_hook tidspunkter.",
    capability_slug: "schedule",
  },
  {
    gate_slug: "regulatory_framework_bound",
    required: true,
    suggested_day: 2,
    depends_on: [],
    display_label_no: "Tariff/lov-rammeverk valgt",
    display_label_en: "Regulatory framework bound",
    description:
      "Bind workspace til Riksavtalen (NHO Reiseliv) eller default-norm. Driver §-håndhevelse.",
    capability_slug: "payroll",
  },
  {
    gate_slug: "tariff_binding_decided",
    required: true,
    suggested_day: 2,
    depends_on: ["regulatory_framework_bound"],
    display_label_no: "Tariff-binding bestemt",
    display_label_en: "Tariff binding decided",
    description:
      "workspace_settings.is_tariff_bound må eksplisitt settes (true=bundet, false=fri).",
    capability_slug: "payroll",
  },
  {
    gate_slug: "owner_contract_active",
    required: true,
    suggested_day: 3,
    depends_on: [],
    display_label_no: "Eier-kontrakt aktiv",
    display_label_en: "Owner contract active",
    description:
      "Workspace-eier må ha aktiv employment_contract for at C4-authority skal stemme.",
    capability_slug: "contract",
  },
  {
    gate_slug: "first_season_active",
    required: true,
    suggested_day: 3,
    depends_on: ["departments_exist"],
    display_label_no: "Første sesong aktiv",
    display_label_en: "First season active",
    description: "Aktiv season påkrevd for vaktplanlegging + budsjett.",
    capability_slug: "season",
  },
  {
    gate_slug: "mattilsynet_routines_seeded",
    required: false,
    suggested_day: 4,
    depends_on: ["departments_exist"],
    display_label_no: "Mattilsynet-rutiner aktivert",
    display_label_en: "Food safety routines active",
    description:
      "20 IK-mat rutiner + 8 kontrollister + 4 kunnskapstester. Lovpålagt for matservering.",
    capability_slug: "governance",
  },
  {
    gate_slug: "alcohol_labor_routines_seeded",
    required: false,
    suggested_day: 5,
    depends_on: ["departments_exist"],
    display_label_no: "Alkohol + Aml. §10-rutiner aktivert",
    display_label_en: "Alcohol + labor law routines active",
    description:
      "Alkoholloven + Aml. §10-6 (OT) + §10-11 (natt). Påkrevd ved skjenkebevilling.",
    capability_slug: "governance",
  },
  {
    gate_slug: "first_employees_invited",
    required: false,
    suggested_day: 6,
    depends_on: ["owner_contract_active", "departments_exist"],
    display_label_no: "Første ansatte invitert",
    display_label_en: "First employees invited",
    description: "Inviter minst én ansatt for å aktivere onboarding-flowen.",
    capability_slug: "profile",
  },
  {
    gate_slug: "authority_config_complete",
    required: true,
    suggested_day: 7,
    depends_on: ["owner_contract_active"],
    display_label_no: "C4-authority komplett",
    display_label_en: "C4 authority complete",
    description:
      "Alle gated capabilities har min_role + four-eyes-policy satt for workspace.",
    capability_slug: "governance",
  },
];

// Inlined from DEFAULT_BOOTSTRAP_GATES (default.ts)
const DEFAULT_BOOTSTRAP_GATES: BootstrapGateDefinition[] = [
  {
    gate_slug: "departments_exist",
    required: true,
    suggested_day: 1,
    depends_on: [],
    display_label_no: "Avdelinger opprettet",
    display_label_en: "Departments created",
    description: "Minst én avdeling må eksistere for at vakter og protokoller skal fungere.",
    capability_slug: "org",
  },
  {
    gate_slug: "locations_exist",
    required: true,
    suggested_day: 1,
    depends_on: [],
    display_label_no: "Lokasjoner opprettet",
    display_label_en: "Locations created",
    description: "Fysisk(e) lokasjon(er) for vaktplanlegging.",
    capability_slug: "org",
  },
  {
    gate_slug: "regulatory_framework_bound",
    required: true,
    suggested_day: 2,
    depends_on: [],
    display_label_no: "Regelverk valgt",
    display_label_en: "Regulatory framework bound",
    description:
      "Bind workspace til et rammeverk (f.eks. Funksjonæroverenskomsten). Driver §-håndhevelse.",
    capability_slug: "payroll",
  },
  {
    gate_slug: "owner_contract_active",
    required: true,
    suggested_day: 2,
    depends_on: [],
    display_label_no: "Eier-kontrakt aktiv",
    display_label_en: "Owner contract active",
    description:
      "Workspace-eier må ha aktiv employment_contract for at C4-authority skal stemme.",
    capability_slug: "contract",
  },
  {
    gate_slug: "first_season_active",
    required: true,
    suggested_day: 3,
    depends_on: ["departments_exist"],
    display_label_no: "Første sesong aktiv",
    display_label_en: "First season active",
    description: "Aktiv season påkrevd for vaktplanlegging + budsjett.",
    capability_slug: "season",
  },
  {
    gate_slug: "authority_config_complete",
    required: true,
    suggested_day: 5,
    depends_on: ["owner_contract_active"],
    display_label_no: "C4-authority komplett",
    display_label_en: "C4 authority complete",
    description:
      "Alle gated capabilities har min_role + four-eyes-policy satt for workspace.",
    capability_slug: "governance",
  },
];

const HOSPITALITY_ROLE_CAPABILITY_PROFILES: RoleCapabilityProfile[] = [
  {
    roleSlug: "skiftleder",
    positionSlugs: ["Skiftleder"],
    mandatoryProtocolSlugs: [
      "Apningsrutiner-protokoll",
      "Stengerutiner-protokoll",
      "Brannvern og evakuering-protokoll",
      "Arbeidsmiljo og HMS-protokoll",
      "Handhygiene-protokoll",
    ],
    readySignal: "Can run one full shift cycle without policy-critical misses",
  },
  {
    roleSlug: "servitor",
    positionSlugs: ["Servitør", "Runner", "Vertinne"],
    mandatoryProtocolSlugs: [
      "Allergenhandtering-protokoll",
      "Handhygiene-protokoll",
      "Brannvern og evakuering-protokoll",
    ],
    readySignal: "Completes full service sequence with correct allergen handling",
  },
  {
    roleSlug: "kokk",
    positionSlugs: [
      "Kokk",
      "Sous Chef",
      "Kjøkkenassistent",
      "Kjøkkensjef",
      "Gardemanger",
      "Patissier",
      "Oppvaskhjelp",
    ],
    mandatoryProtocolSlugs: [
      "Temperaturkontroll-protokoll",
      "Allergenhandtering-protokoll",
      "Handhygiene-protokoll",
      "Varemottak og lagring-protokoll",
      "Temperaturovervaking-protokoll",
      "Hygiene og renhold-protokoll",
      "Sporbarhet og avvik-protokoll",
    ],
    readySignal: "Executes prep + service tasks with compliant temperature and hygiene behavior",
  },
  {
    roleSlug: "bartender",
    positionSlugs: ["Bartender", "Barback", "Barsjef"],
    mandatoryProtocolSlugs: [
      "Skjenkekontroll-protokoll",
      "Handhygiene-protokoll",
      "Brannvern og evakuering-protokoll",
    ],
    readySignal: "Handles bar service and age checks without compliance breaches",
  },
  {
    roleSlug: "renhold",
    positionSlugs: ["Renholder", "Renholdsansvarlig"],
    mandatoryProtocolSlugs: [
      "Handhygiene-protokoll",
      "Hygiene og renhold-protokoll",
      "Arbeidsmiljo og HMS-protokoll",
    ],
    readySignal: "Completes hygiene controls with verifiable checklist quality",
  },
];

// Day factor defaults (0=Mon..6=Sun, higher Fri-Sat)
const DAY_FACTOR_DEFAULTS = [
  { weekday: 0, factor: 0.85 },
  { weekday: 1, factor: 0.9 },
  { weekday: 2, factor: 1.0 },
  { weekday: 3, factor: 1.05 },
  { weekday: 4, factor: 1.3 },
  { weekday: 5, factor: 1.4 },
  { weekday: 6, factor: 0.5 },
];

// Hour factor defaults (peak 18-21)
const HOUR_FACTOR_DEFAULTS = Array.from({ length: 24 }, (_, h) => {
  let factor = 0.3;
  if (h >= 7 && h < 10) factor = 0.5;
  if (h >= 10 && h < 12) factor = 0.7;
  if (h >= 12 && h < 14) factor = 1.0;
  if (h >= 14 && h < 17) factor = 0.6;
  if (h >= 17 && h < 18) factor = 0.9;
  if (h >= 18 && h < 21) factor = 1.4;
  if (h >= 21 && h < 23) factor = 0.8;
  if (h >= 23) factor = 0.4;
  return { hour: h, factor };
});

type BootstrapWarning = {
  step: string;
  departmentId?: string;
  departmentName?: string;
  message: string;
};

/** Apply time offset in minutes to a TIME string (HH:MM). Handles overnight wrap. */
function applyOffset(time: string, offsetMin: number): string {
  const [h, m] = time.split(":").map(Number);
  let totalMin = h * 60 + m + offsetMin;
  // Wrap around 24h (can go negative for early opens)
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

/** Lookup department type with case-insensitive + diacritics fallback */
function classifyDepartment(name: string): { type: string; confidence: string } | null {
  const normalized = name.trim().normalize("NFC").toLowerCase();
  if (DEPARTMENT_TYPE_MAP[normalized]) return DEPARTMENT_TYPE_MAP[normalized];
  const withoutDiacritics = normalized.replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
  for (const [key, value] of Object.entries(DEPARTMENT_TYPE_MAP)) {
    if (key === withoutDiacritics) return value;
  }
  return null;
}

/** Get offset defaults for a department name */
function getOffsets(name: string): { open: number; close: number } {
  const normalized = name.trim().normalize("NFC").toLowerCase();
  if (OFFSET_DEFAULTS[normalized]) return OFFSET_DEFAULTS[normalized];
  const withoutDiacritics = normalized.replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a");
  for (const [key, value] of Object.entries(OFFSET_DEFAULTS)) {
    if (key === withoutDiacritics) return value;
  }
  return { open: 0, close: 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ADR-0029: gate all inbound requests — anonymous calls must be rejected.
  // All internal callers (finalize-workspace) send Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>.
  const authResult = verifyInternalAuth(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const { workspaceId, sourcePath } = await req.json();
    if (!workspaceId) throw new Error("Missing workspaceId");
    if (!sourcePath) throw new Error("Missing sourcePath");

    const warnings: BootstrapWarning[] = [];
    let stepsCompleted: string[] = [];
    let frameworkBindingId: string | null = null;

    // Check for existing run (resume support)
    const { data: existingRun } = await adminClient
      .from("workspace_bootstrap_run")
      .select("id, steps_completed, framework_binding_id, status")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let runId: string;

    if (existingRun && (existingRun.status === "partial" || existingRun.status === "running")) {
      // Resume existing run
      runId = existingRun.id;
      stepsCompleted = existingRun.steps_completed ?? [];
      frameworkBindingId = existingRun.framework_binding_id;
      await adminClient
        .from("workspace_bootstrap_run")
        .update({ status: "running", current_step: "resuming" })
        .eq("id", runId);
    } else {
      // Create new run
      const { data: newRun, error: runError } = await adminClient
        .from("workspace_bootstrap_run")
        .insert({
          workspace_id: workspaceId,
          source_path: sourcePath,
          status: "running",
          current_step: "workspace_operating_hours",
        })
        .select("id")
        .single();
      if (runError || !newRun)
        throw new Error(`Failed to create bootstrap run: ${runError?.message}`);
      runId = newRun.id;
    }

    const updateStep = async (step: string) => {
      await adminClient
        .from("workspace_bootstrap_run")
        .update({ current_step: step })
        .eq("id", runId);
    };

    const completeStep = async (step: string) => {
      stepsCompleted.push(step);
      await adminClient
        .from("workspace_bootstrap_run")
        .update({ steps_completed: stepsCompleted, current_step: step })
        .eq("id", runId);
    };

    const isCompleted = (step: string) => stepsCompleted.includes(step);

    // ============================================================
    // Step 1: workspace_operating_hours
    // ============================================================
    if (!isCompleted("workspace_operating_hours")) {
      await updateStep("workspace_operating_hours");

      // Try to copy from company_opening_hours (intake data)
      const { data: intakeHours } = await adminClient
        .from("company_opening_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", workspaceId);

      const hoursSource = intakeHours && intakeHours.length > 0 ? intakeHours : DEFAULT_BASE_HOURS;

      const rows = hoursSource.map((h: Record<string, unknown>) => ({
        workspace_id: workspaceId,
        day_of_week: h.dayOfWeek ?? h.day_of_week,
        open_time: h.openTime ?? h.open_time,
        close_time: h.closeTime ?? h.close_time,
        is_closed: h.isClosed ?? h.is_closed ?? false,
      }));

      await adminClient
        .from("workspace_operating_hours")
        .upsert(rows, { onConflict: "workspace_id,day_of_week" });

      await completeStep("workspace_operating_hours");
    }

    // ============================================================
    // Step 2: department.department_type (HARD DEPENDENCY for Step 3)
    // ============================================================
    if (!isCompleted("department_type")) {
      await updateStep("department_type");

      const { data: departments } = await adminClient
        .from("department")
        .select("department_id, name, department_type")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      if (departments) {
        for (const dept of departments) {
          if (dept.department_type) continue; // Already classified

          const classification = classifyDepartment(dept.name);
          if (classification) {
            await adminClient
              .from("department")
              .update({
                department_type: classification.type,
                classification_source: "industry_package",
                classification_confidence: classification.confidence,
              })
              .eq("department_id", dept.department_id);
          } else {
            // Unknown name → default to operational with low confidence
            await adminClient
              .from("department")
              .update({
                department_type: "operational",
                classification_source: "industry_package",
                classification_confidence: "low",
              })
              .eq("department_id", dept.department_id);

            warnings.push({
              step: "department_type",
              departmentId: dept.department_id,
              departmentName: dept.name,
              message: `Could not classify "${dept.name}" — defaulted to operational (low confidence)`,
            });
          }
        }
      }

      await completeStep("department_type");
    }

    // ============================================================
    // Step 3: department_operating_hours (with offsets)
    // ============================================================
    if (!isCompleted("department_operating_hours")) {
      await updateStep("department_operating_hours");

      // Fetch workspace base hours
      const { data: baseHours } = await adminClient
        .from("workspace_operating_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("workspace_id", workspaceId);

      // Fetch all active departments with their types
      const { data: departments } = await adminClient
        .from("department")
        .select("department_id, name, department_type")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      if (departments && baseHours) {
        for (const dept of departments) {
          const isAdmin = dept.department_type === "administrative";
          const hoursTemplate = isAdmin ? ADMIN_DEFAULT_HOURS : baseHours;
          const offsets = isAdmin ? { open: 0, close: 0 } : getOffsets(dept.name);

          const deptHoursRows = hoursTemplate.map((h: Record<string, unknown>) => {
            const dayOfWeek = h.dayOfWeek ?? h.day_of_week;
            const isClosed = h.isClosed ?? h.is_closed ?? false;
            const rawOpen = h.openTime ?? h.open_time;
            const rawClose = h.closeTime ?? h.close_time;

            const openTime =
              !isClosed && rawOpen ? applyOffset(String(rawOpen), offsets.open) : rawOpen;
            const closeTime =
              !isClosed && rawClose ? applyOffset(String(rawClose), offsets.close) : rawClose;

            return {
              department_id: dept.department_id,
              day_of_week: dayOfWeek,
              open_time: openTime,
              close_time: closeTime,
              is_closed: isClosed,
              open_offset_minutes: isAdmin ? 0 : offsets.open,
              close_offset_minutes: isAdmin ? 0 : offsets.close,
              is_derived: !isAdmin,
              provenance: { source_type: "bootstrap", framework: "hospitality.no.default.v1" },
            };
          });

          // Unique constraint: (department_id, location_id, season_id, day_of_week) NULLS NOT DISTINCT
          // Check existing rows first, then insert missing ones
          const { data: existingHours } = await adminClient
            .from("department_operating_hours")
            .select("day_of_week")
            .eq("department_id", dept.department_id)
            .is("location_id", null)
            .is("season_id", null);

          const existingDays = new Set(
            (existingHours ?? []).map((h: { day_of_week: number }) => h.day_of_week),
          );
          const newRows = deptHoursRows.filter(
            (r: { day_of_week: unknown }) => !existingDays.has(r.day_of_week as number),
          );

          if (newRows.length > 0) {
            await adminClient.from("department_operating_hours").insert(newRows);
          }
        }
      }

      await completeStep("department_operating_hours");
    }

    // ============================================================
    // Step 4: workspace_framework_binding
    // ============================================================
    if (!isCompleted("framework_binding")) {
      await updateStep("framework_binding");

      // Find the hospitality framework
      const { data: framework } = await adminClient
        .from("regulatory_framework")
        .select("framework_id")
        .eq("code", "hospitality.no.default.v1")
        .eq("is_active", true)
        .single();

      if (framework) {
        const { data: binding } = await adminClient
          .from("workspace_framework_binding")
          .upsert(
            {
              workspace_id: workspaceId,
              framework_id: framework.framework_id,
              is_active: true,
            },
            { onConflict: "workspace_id", ignoreDuplicates: true },
          )
          .select("id")
          .single();

        if (binding) {
          frameworkBindingId = binding.id;
        } else {
          // Fetch existing if upsert was a no-op
          const { data: existing } = await adminClient
            .from("workspace_framework_binding")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("is_active", true)
            .single();
          frameworkBindingId = existing?.id ?? null;
        }

        // Update run with framework binding
        await adminClient
          .from("workspace_bootstrap_run")
          .update({ framework_binding_id: frameworkBindingId })
          .eq("id", runId);
      } else {
        warnings.push({
          step: "framework_binding",
          message: "hospitality.no.default.v1 framework not found — K1a seed may not have run",
        });
      }

      await completeStep("framework_binding");
    }

    // ============================================================
    // Step 5: tariff_rate_table (workspace copies from platform)
    // ============================================================
    if (!isCompleted("tariff_rates")) {
      await updateStep("tariff_rates");

      // Fetch platform-level rates (NULL workspace_id)
      const { data: platformRates } = await adminClient
        .from("tariff_rate_table")
        .select("*")
        .is("workspace_id", null);

      if (platformRates && platformRates.length > 0) {
        for (const rate of platformRates) {
          // Copy to workspace scope — exclusion constraint handles duplicates
          const { error: insertError } = await adminClient.from("tariff_rate_table").insert({
            workspace_id: workspaceId,
            rate_type: rate.rate_type,
            source: rate.source,
            effective_from: rate.effective_from,
            effective_until: rate.effective_until,
            seniority_years: rate.seniority_years,
            amount: rate.amount,
            unit: rate.unit,
            metadata: rate.metadata,
            provenance: { ...rate.provenance, copied_from: rate.id },
            seeded_from_framework_binding_id: frameworkBindingId,
            seeded_at: new Date().toISOString(),
          });

          // Ignore exclusion constraint violations (idempotent)
          if (insertError && !insertError.message.includes("excl_tariff_no_overlap")) {
            console.error("Tariff insert error:", insertError);
          }
        }
      }

      await completeStep("tariff_rates");
    }

    // ============================================================
    // Step 6: planning_cycle (4-week default)
    // ============================================================
    if (!isCompleted("planning_cycle")) {
      await updateStep("planning_cycle");

      // Check if a planning cycle already exists
      const { data: existingCycle } = await adminClient
        .from("planning_cycle")
        .select("planning_cycle_id")
        .eq("workspace_id", workspaceId)
        .limit(1)
        .single();

      if (!existingCycle) {
        const now = new Date();
        const startDate = now.toISOString().split("T")[0];
        const endDate = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

        await adminClient.from("planning_cycle").insert({
          workspace_id: workspaceId,
          name: "Standard 4-ukers syklus",
          start_date: startDate,
          end_date: endDate,
          status: "active",
        });
      }

      await completeStep("planning_cycle");
    }

    // ============================================================
    // Step 7: season_budget enrichment
    // ============================================================
    if (!isCompleted("season_budget")) {
      await updateStep("season_budget");

      // Find active season's budget
      const { data: activeSeason } = await adminClient
        .from("season")
        .select("season_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (activeSeason) {
        const { data: budget } = await adminClient
          .from("season_budget")
          .select("season_budget_id, total_target_revenue, target_labor_percentage")
          .eq("season_id", activeSeason.season_id)
          .single();

        if (budget) {
          // Only update if fields are at defaults (0 or 0.30)
          const needsEnrichment =
            budget.total_target_revenue === 0 || budget.target_labor_percentage === 0.3;

          if (needsEnrichment) {
            // Check workspace intelligence data for scraped/intake data
            const { data: workspace } = await adminClient
              .from("workspace")
              .select("intelligence_data")
              .eq("workspace_id", workspaceId)
              .single();

            const intel = workspace?.intelligence_data as Record<string, unknown> | null;
            const expectedRevenue = intel?.expectedRevenue as number | null;
            const targetMargin = intel?.targetMargin as number | null;

            const updates: Record<string, unknown> = {};
            if (expectedRevenue && budget.total_target_revenue === 0) {
              updates.total_target_revenue = expectedRevenue;
            }
            if (targetMargin) {
              updates.target_margin = targetMargin;
            }

            if (Object.keys(updates).length > 0) {
              await adminClient
                .from("season_budget")
                .update(updates)
                .eq("season_budget_id", budget.season_budget_id);
            }
          }
        }
      }

      await completeStep("season_budget");
    }

    // ============================================================
    // Step 8: day_factor + hour_factor
    // ============================================================
    if (!isCompleted("day_hour_factors")) {
      await updateStep("day_hour_factors");

      // Find active season's budget for FK
      const { data: activeSeason } = await adminClient
        .from("season")
        .select("season_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (activeSeason) {
        const { data: budget } = await adminClient
          .from("season_budget")
          .select("season_budget_id")
          .eq("season_id", activeSeason.season_id)
          .single();

        if (budget) {
          // Check existing day factors
          const { data: existingDayFactors } = await adminClient
            .from("day_factor")
            .select("day_factor_id")
            .eq("season_budget_id", budget.season_budget_id)
            .limit(1);

          if (!existingDayFactors || existingDayFactors.length === 0) {
            const dayRows = DAY_FACTOR_DEFAULTS.map((d) => ({
              season_budget_id: budget.season_budget_id,
              workspace_id: workspaceId,
              weekday: d.weekday,
              factor: d.factor,
            }));
            await adminClient.from("day_factor").insert(dayRows);
          }

          // Check existing hour factors
          const { data: existingHourFactors } = await adminClient
            .from("hour_factor")
            .select("hour_factor_id")
            .eq("season_budget_id", budget.season_budget_id)
            .limit(1);

          if (!existingHourFactors || existingHourFactors.length === 0) {
            const hourRows = HOUR_FACTOR_DEFAULTS.map((h) => ({
              season_budget_id: budget.season_budget_id,
              workspace_id: workspaceId,
              hour: h.hour,
              factor: h.factor,
            }));
            await adminClient.from("hour_factor").insert(hourRows);
          }
        }
      }

      await completeStep("day_hour_factors");
    }

    // ============================================================
    // Step 9: payroll_profile_template
    // ============================================================
    if (!isCompleted("payroll_templates")) {
      await updateStep("payroll_templates");

      for (const template of PAYROLL_TEMPLATES) {
        await adminClient.from("payroll_profile_template").upsert(
          {
            workspace_id: workspaceId,
            name: template.name,
            salary_type: template.salaryType,
            agreed_weekly_hours: template.weeklyHours,
            tariff_category: template.tariffCategory,
            employment_category: template.employmentCategory,
            is_system_template: true,
            is_locked: false,
            seed_source: "hospitality.no.default.v1",
            seed_version: "1",
            seeded_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,name" },
        );
      }

      await completeStep("payroll_templates");
    }

    // ============================================================
    // Step 10: engine_authority_config
    // ============================================================
    if (!isCompleted("authority_config")) {
      await updateStep("authority_config");

      // Check if already exists
      const { data: existingAuth } = await adminClient
        .from("engine_authority_config")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(1);

      if (!existingAuth || existingAuth.length === 0) {
        // Fetch any admin user for the updated_by FK
        const { data: adminProfile } = await adminClient
          .from("profile")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .in("role", ["admin", "owner"])
          .limit(1)
          .single();

        if (adminProfile) {
          const capabilities = [
            "schedule_management",
            "shift_assignment",
            "absence_management",
            "employee_onboarding",
            "compliance_check",
            "report_generation",
            "notification_dispatch",
            "deviation_handling",
            "session_management",
            // ADR-0407 Phase 1 — bootstrap gate capability slugs
            "list_bootstrap_gates",
            "close_bootstrap_gate",
            "skip_bootstrap_gate",
          ];

          const configRows = capabilities.map((cap) => ({
            workspace_id: workspaceId,
            capability: cap,
            level: "suggest",
            updated_by: adminProfile.user_id,
          }));

          // Insert one by one to handle conflicts gracefully
          for (const row of configRows) {
            const { error } = await adminClient
              .from("engine_authority_config")
              .upsert(row, { onConflict: "workspace_id,capability", ignoreDuplicates: true });
            if (error) console.error("Authority config insert error:", error);
          }
        } else {
          warnings.push({
            step: "authority_config",
            message: "No admin profile found — skipped engine_authority_config seeding",
          });
        }
      }

      await completeStep("authority_config");
    }

    // ============================================================
    // Step 11: profession_seed (hospitality only)
    //
    // Upserts profession rows and wires profession_training mappings
    // for each roleCapabilityProfile in the hospitality package.
    //
    // Industry gate: only runs when the hospitality framework binding
    // exists for this workspace (hospitality.no.default.v1), which is
    // the same condition the rest of this function assumes.  Non-hospitality
    // workspaces will never have this binding → step is skipped cleanly.
    //
    // Best-effort: protocol slugs that have no matching protocol row are
    // silently skipped.  Full mappings light up once governance protocols
    // are seeded (ADR-0379b).  The RPC returns a summary count.
    // ============================================================
    if (!isCompleted("profession_seed")) {
      await updateStep("profession_seed");

      // Industry gate: hospitality framework binding presence
      const { data: hospitalityBinding } = await adminClient
        .from("workspace_framework_binding")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (hospitalityBinding) {
        const { data: seedResult, error: seedError } = await adminClient.rpc(
          "fn_seed_profession_training",
          {
            p_workspace_id: workspaceId,
            p_profiles: HOSPITALITY_ROLE_CAPABILITY_PROFILES as unknown as Record<string, unknown>[],
          },
        );

        if (seedError) {
          console.error("profession_seed RPC error:", seedError);
          warnings.push({
            step: "profession_seed",
            message: `fn_seed_profession_training failed: ${seedError.message}`,
          });
        } else {
          console.log("profession_seed result:", JSON.stringify(seedResult));
        }
      } else {
        // Non-hospitality workspace — skip cleanly, no warning needed
        console.log("profession_seed: no hospitality framework binding — skipping");
      }

      await completeStep("profession_seed");
    }

    // ============================================================
    // Step 12: seed_bootstrap_gates (ADR-0407 Phase 1)
    //
    // Seeds workspace_bootstrap_gate rows from the K1a industry-package gate
    // definitions. Idempotent via ON CONFLICT (workspace_id, gate_slug) DO NOTHING.
    //
    // Industry detection: uses the same hospitality framework binding check as
    // Step 11 (profession_seed). Hospitality → 11 gates. Default → 6 gates.
    //
    // Auto-close gates where the workspace already satisfies the condition:
    //   departments_exist: if ≥1 active department row → closed via 'auto'
    //   locations_exist:   if ≥1 active location row → closed via 'auto'
    //   operating_hours_set: if department_operating_hours rows exist → closed via 'auto'
    //   regulatory_framework_bound: if active workspace_framework_binding → closed via 'auto'
    //   mattilsynet_routines_seeded: if mattilsynet template applied → closed via 'auto'
    //   alcohol_labor_routines_seeded: if alcohol-labor template applied → closed via 'auto'
    // ============================================================
    if (!isCompleted("seed_bootstrap_gates")) {
      await updateStep("seed_bootstrap_gates");

      try {
        // Determine industry: hospitality gate check (same pattern as Step 11)
        const { data: hospitalityBinding } = await adminClient
          .from("workspace_framework_binding")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .limit(1)
          .single();

        const isHospitality = !!hospitalityBinding;
        const gateDefinitions = isHospitality
          ? HOSPITALITY_BOOTSTRAP_GATES
          : DEFAULT_BOOTSTRAP_GATES;
        const industrySource = isHospitality ? "hospitality" : "default";

        // Determine which gates to auto-close based on existing data

        // Check department existence
        const { count: deptCount } = await adminClient
          .from("department")
          .select("department_id", { count: "exact" })
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);

        const hasDepartments = (deptCount ?? 0) >= 1;

        // Check location existence
        const { count: locCount } = await adminClient
          .from("location")
          .select("location_id", { count: "exact" })
          .eq("workspace_id", workspaceId);

        const hasLocations = (locCount ?? 0) >= 1;

        // Check operating hours
        const { count: hoursCount } = await adminClient
          .from("department_operating_hours")
          .select("id", { count: "exact" })
          .eq("workspace_id", workspaceId);

        const hasOperatingHours = (hoursCount ?? 0) >= 1;

        // Framework binding already checked (hospitalityBinding above)
        const hasFrameworkBinding = isHospitality;

        // Auto-close conditions per gate_slug
        const autoCloseMap: Record<string, boolean> = {
          departments_exist: hasDepartments,
          locations_exist: hasLocations,
          operating_hours_set: hasOperatingHours && hasDepartments,
          regulatory_framework_bound: hasFrameworkBinding,
          // Mattilsynet and alcohol routines — if templates were applied in prior steps,
          // Step 11's completion implies these template files ran. Detect via routine count:
          // mattilsynet.sql seeds ~20 routines; alcohol-labor.sql seeds ~36 routines.
          // We conservatively don't auto-close these — admin confirms explicitly.
          mattilsynet_routines_seeded: false,
          alcohol_labor_routines_seeded: false,
          // People/season/authority gates — not auto-detectable without deeper inspection.
          // These remain open for Botsson to guide the admin.
          owner_contract_active: false,
          first_season_active: false,
          first_employees_invited: false,
          authority_config_complete: false,
          tariff_binding_decided: false,
        };

        // Upsert gate rows (idempotent: ON CONFLICT DO NOTHING for status!=closed)
        for (const gate of gateDefinitions) {
          const shouldAutoClose = autoCloseMap[gate.gate_slug] ?? false;

          const { error: insertError } = await adminClient
            .from("workspace_bootstrap_gate")
            .insert({
              workspace_id: workspaceId,
              gate_slug: gate.gate_slug,
              status: shouldAutoClose ? "closed" : gate.depends_on.length > 0 ? "blocked" : "open",
              industry_source: industrySource,
              display_label_no: gate.display_label_no,
              display_label_en: gate.display_label_en,
              description: gate.description,
              required: gate.required,
              depends_on: gate.depends_on,
              capability_slug: gate.capability_slug ?? null,
              suggested_day: gate.suggested_day ?? null,
              closed_at: shouldAutoClose ? new Date().toISOString() : null,
              closed_via: shouldAutoClose ? "auto" : null,
              metadata: { seeded_by: "bootstrap-cascade", step: 12 },
            })
            .on("conflict", ["workspace_id", "gate_slug"])
            .ignore();

          if (insertError) {
            // Non-fatal: gate may already exist from a prior idempotent run
            console.warn(
              `seed_bootstrap_gates: insert warning for ${gate.gate_slug}:`,
              insertError.message,
            );
          }
        }

        console.log(
          `seed_bootstrap_gates: seeded ${gateDefinitions.length} gates (${industrySource}), ` +
            `${Object.values(autoCloseMap).filter(Boolean).length} auto-closed`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push({ step: "seed_bootstrap_gates", message: `seed failed: ${msg}` });
        console.error("seed_bootstrap_gates error:", msg);
      }

      await completeStep("seed_bootstrap_gates");
    }

    // ============================================================
    // Completion criteria check
    // ============================================================
    await updateStep("completion_check");

    const checks = await Promise.all([
      // 1. workspace_operating_hours has 7 days
      adminClient
        .from("workspace_operating_hours")
        .select("id", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .then((r) => ({ check: "workspace_hours_7_days", passed: (r.count ?? 0) === 7 })),
      // 2. All active departments have department_type
      adminClient
        .from("department")
        .select("department_id", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .is("department_type", null)
        .then((r) => ({ check: "all_depts_typed", passed: (r.count ?? 0) === 0 })),
      // 4. framework binding exists
      adminClient
        .from("workspace_framework_binding")
        .select("id", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .then((r) => ({ check: "framework_binding", passed: (r.count ?? 0) >= 1 })),
      // 5. workspace tariff rates exist
      adminClient
        .from("tariff_rate_table")
        .select("id", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .then((r) => ({ check: "tariff_rates", passed: (r.count ?? 0) >= 1 })),
      // 8. payroll templates seeded
      adminClient
        .from("payroll_profile_template")
        .select("id", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("is_system_template", true)
        .then((r) => ({ check: "payroll_templates", passed: (r.count ?? 0) >= 1 })),
    ]);

    const failedChecks = checks.filter((c) => !c.passed);
    for (const fc of failedChecks) {
      warnings.push({ step: "completion_check", message: `Failed: ${fc.check}` });
    }

    const finalStatus = failedChecks.length > 0 ? "partial" : "completed";

    await adminClient
      .from("workspace_bootstrap_run")
      .update({
        status: finalStatus,
        current_step: null,
        warnings: warnings.length > 0 ? warnings : [],
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: finalStatus === "completed",
        status: finalStatus,
        runId,
        stepsCompleted,
        warnings,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Bootstrap cascade error:", message);

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
