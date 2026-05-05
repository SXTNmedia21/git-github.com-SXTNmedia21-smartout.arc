// packages/ai/src/capabilities/onboarding/tools.ts
//
// Onboarding capability — 9 tool SKELETONS (ADR-0275 R4 corrected table).
//
// Bodies are NOT implemented yet. T1.6 (new tools) + T1.7 (bridge reuse) + T1.8
// (add_key_fact alias) are separate dispatches, blocked on cascade-developer
// pre-flight verification (I1 bootstrap + D1 cascade write pattern confirmation).
//
// Tool inventory:
//   update_business     — workspace business metadata (name, domain, industry). confirm.
//   update_season       — wizard season bootstrap (season name + revenue target). confirm.
//   add_departments     — D1 department creation. confirm (cascade D1 = high-impact).
//   add_locations       — D1 location creation. confirm.
//   add_zones           — D1 zone creation. confirm.
//   add_procedures      — governance procedure creation. suggest (review-required).
//   scrape_website      — proxy to scrapling /extract. read_only.
//   search_company      — BRIDGE: proxies to business_intelligence.search_brreg. read_only.
//   identify_company    — BRIDGE: proxies to business_intelligence.lookup_brreg. read_only.
//
// NOTE: add_key_fact is NOT here — it is an alias resolved server-side to
// memory.save_memory. No separate tool registration needed (T1.8 separate dispatch).
//
// Gate pattern:
//   - Mutation tools (update_business, update_season, add_departments, add_locations,
//     add_zones, add_procedures): MUST call callGateAction() + emit() in T1.6.
//   - Read-only tools (scrape_website, search_company, identify_company): no gate_action
//     needed — these are read/proxy-only.
//
// TODO(T1.6): implement bodies. Use callGateAction + emit + cascade_gate_write
//             where D1 dimension writes (departments, locations, zones). See
//             shift-lifecycle/tools.ts + season/tools for gate pattern.
// TODO(T1.7): implement search_company + identify_company bridge bodies.
//             Phantom-trace first — verify business_intelligence.search_brreg +
//             .lookup_brreg actually delegate to scrapling (T1.6 R4 §8-9 verification).
//
// Cross-cutting laws enforced at body time (T1.6+):
//   - Law 1: every query scoped by ctx.workspaceId
//   - Law 2: every mutation calls callGateAction (ADR-0099)
//   - Law 4: every mutation emits via @smartout/telemetry (ADR-0134)
//   - Law 3: channel guard for PII-carrying mutations (ADR-0078)
//
// ADR-0275 R4 corrected tool table — this file implements the "new" rows
// (#2 update_business, #4 add_departments, #5 add_locations, #6 add_zones)
// plus the "new" scaffolds (#3 update_season, #7 scrape_website) and
// bridges (#8 search_company, #9 identify_company).

import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────
// 1. update_business
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.6): implement body. Use callGateAction("onboarding.update_business")
//             + emit("onboarding.update_business.completed") + workspace UPDATE.
//             PII-free: name/domain/industry are not PII. Voice-OK.

export const updateBusiness = defineTool({
  name: "update_business",
  description:
    "Update workspace business metadata: name, display name, domain, industry type, " +
    "concept description, cuisine types, price category, and about-us text. " +
    "Use during /onboarding-flow when the user provides details about their business. " +
    'Examples: "vi heter Strøm Mat & Bar", "vi driver en restaurant", "vi har norsk kjøkken". ' +
    "Requires confirm authority. gate_action: onboarding.update_business.",
  schema: z.object({
    name: z.string().optional().describe("Legal name of the business"),
    display_name: z.string().optional().describe("Display / trade name"),
    domain: z.string().url().optional().describe("Website URL"),
    industry: z.string().optional().describe("Industry type, e.g. 'restaurant', 'bar', 'hotel'"),
    concept_description: z.string().optional().describe("Short description of the concept"),
    cuisine_types: z
      .array(z.string())
      .optional()
      .describe("Cuisine types, e.g. ['norsk', 'scandinavisk']"),
    price_category: z
      .enum(["budget", "mid", "premium", "luxury"])
      .optional()
      .describe("Price tier"),
    about_us: z.string().optional().describe("About us text for the workspace"),
    org_number: z.string().optional().describe("Norwegian org-number (9 digits)"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.6): implement body. Use callGateAction + emit + workspace UPDATE.
    return "Not implemented yet — body lands in T1.6.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 2. update_season
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.6): implement body. Reuse season.create or season.set_revenue
//             under the hood (phantom-trace first to confirm season capability
//             delegation shape). Call callGateAction("onboarding.update_season")
//             + emit("onboarding.update_season.completed").

export const updateSeason = defineTool({
  name: "update_season",
  description:
    "Bootstrap a wizard-context season: create or update the initial planning cycle " +
    "with a name, start/end date, and optional revenue target. " +
    "Use during /onboarding-flow when the user describes their season structure. " +
    'Examples: "vi har sommersesong og vintersesong", "sesong starter 1. juni". ' +
    "Requires confirm authority. gate_action: onboarding.update_season.",
  schema: z.object({
    name: z.string().describe("Season name, e.g. 'Sommersesong 2026'"),
    start_date: z.string().describe("ISO 8601 date string, e.g. '2026-06-01'"),
    end_date: z.string().describe("ISO 8601 date string, e.g. '2026-08-31'"),
    revenue_target_nok: z.number().optional().describe("Revenue target in NOK for this season"),
    notes: z.string().optional().describe("Additional notes or playbook context"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.6): implement body. Phantom-trace season.create/set_revenue first.
    return "Not implemented yet — body lands in T1.6.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 3. add_departments
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.6): implement body. D1 = high-impact cascade write.
//             Call callGateAction("onboarding.add_departments") + emit.
//             Use cascade_gate_write for D1 INSERT (ADR-0099 + B1 dual-gate rule:
//             cascade_gate_write for cascade-engine data writes, gate_action for
//             capability authority). Blocked on cascade-developer pre-flight.

export const addDepartments = defineTool({
  name: "add_departments",
  description:
    "Create one or more departments (D1 Cascade Dimension) in the workspace. " +
    "Use during /onboarding-flow when the user lists their departments. " +
    'Examples: "vi har avdelinger kjøkken og bar", "legg til avdeling: kjøkken". ' +
    "Each department must have a unique name within the workspace. " +
    "Requires confirm authority (D1 high-impact). gate_action: onboarding.add_departments. " +
    "NOTE: body implementation blocked on cascade-developer I1 bootstrap verification (T1.6).",
  schema: z.object({
    departments: z
      .array(
        z.object({
          name: z.string().describe("Department name, e.g. 'Kjøkken'"),
          description: z.string().optional().describe("Optional description"),
        }),
      )
      .min(1)
      .describe("List of departments to create"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.6): implement body. D1 write — requires I1 bootstrap verification.
    // Use callGateAction("onboarding.add_departments") + cascade_gate_write + emit.
    return "Not implemented yet — body lands in T1.6 after cascade-developer pre-flight.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 4. add_locations
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.6): implement body. D1 = high-impact cascade write.
//             Same pattern as add_departments.

export const addLocations = defineTool({
  name: "add_locations",
  description:
    "Create one or more locations (D1 Cascade Dimension) in the workspace. " +
    "Use during /onboarding-flow when the user lists multiple physical locations. " +
    'Examples: "legg til lokasjon Trondheim", "vi har to lokasjoner: Oslo og Bergen". ' +
    "Requires confirm authority (D1 high-impact). gate_action: onboarding.add_locations. " +
    "NOTE: body implementation blocked on cascade-developer I1 bootstrap verification (T1.6).",
  schema: z.object({
    locations: z
      .array(
        z.object({
          name: z.string().describe("Location name, e.g. 'Trondheim'"),
          address: z.string().optional().describe("Street address"),
          city: z.string().optional().describe("City"),
          country_code: z
            .string()
            .length(2)
            .optional()
            .default("NO")
            .describe("ISO 3166-1 alpha-2, defaults to NO"),
        }),
      )
      .min(1)
      .describe("List of locations to create"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.6): implement body. D1 write — requires I1 bootstrap verification.
    return "Not implemented yet — body lands in T1.6 after cascade-developer pre-flight.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 5. add_zones
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.6): implement body. D1 = high-impact cascade write (zone = sub-unit of location).
//             Same gate pattern as add_departments/add_locations.

export const addZones = defineTool({
  name: "add_zones",
  description:
    "Create one or more zones (sub-units of a location, D1 Cascade Dimension). " +
    "Use during /onboarding-flow when the user describes physical zones within a location. " +
    'Examples: "vi har utendørs og innendørs", "legg til sone: terrasse". ' +
    "Requires a location_id (or location_name) to attach zones to. " +
    "Requires confirm authority (D1 high-impact). gate_action: onboarding.add_zones. " +
    "NOTE: body implementation blocked on cascade-developer I1 bootstrap verification (T1.6).",
  schema: z.object({
    location_id: z.string().uuid().optional().describe("UUID of the parent location"),
    location_name: z
      .string()
      .optional()
      .describe("Name of the parent location (fuzzy-matched if location_id not provided)"),
    zones: z
      .array(
        z.object({
          name: z.string().describe("Zone name, e.g. 'Terrasse'"),
          capacity: z.number().int().optional().describe("Max covers / capacity"),
          description: z.string().optional().describe("Optional description"),
        }),
      )
      .min(1)
      .describe("List of zones to create"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.6): implement body. D1 write — requires I1 bootstrap verification.
    return "Not implemented yet — body lands in T1.6 after cascade-developer pre-flight.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 6. add_procedures
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.6): implement body. Delegate to governance capability's procedure-
//             creation surface (phantom-trace first — ADR-0240 cross-namespace
//             write rule requires delegation, not direct INSERT).
//             Suggest authority (review-required).

export const addProcedures = defineTool({
  name: "add_procedures",
  description:
    "Add one or more procedures to the workspace (governance layer). " +
    "Use during /onboarding-flow when the user describes key work procedures. " +
    'Examples: "legg til prosedyre: åpningsrutine", "vi trenger en HMS-prosedyre". ' +
    "Each procedure gets a title, optional description, and department assignment. " +
    "Requires suggest authority (review-required). gate_action: onboarding.add_procedures. " +
    "NOTE: body delegates to governance capability — phantom-trace required before T1.6 (ADR-0240).",
  schema: z.object({
    procedures: z
      .array(
        z.object({
          title: z.string().describe("Procedure title, e.g. 'Åpningsrutine kjøkken'"),
          description: z.string().optional().describe("Short description"),
          department_name: z
            .string()
            .optional()
            .describe("Department this procedure belongs to (fuzzy-matched)"),
          category: z
            .enum(["routine", "protocol", "control_list", "runbook"])
            .optional()
            .describe("Procedure category"),
        }),
      )
      .min(1)
      .describe("List of procedures to create"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.6): implement body. Delegate to governance capability.
    // Phantom-trace governance/tools.ts to confirm delegation shape (ADR-0240).
    return "Not implemented yet — body lands in T1.6 after governance delegation phantom-trace.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 7. scrape_website
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.7): implement body. BRIDGE to business_intelligence.scrape_website.
//             Phantom-trace first — verify business_intelligence.scrapeWebsiteTool
//             can be called directly (same ctx pattern) or must go via agent/BFF.
//             Read-only: no gate_action. emit on call for audit.

export const scrapeWebsite = defineTool({
  name: "scrape_website",
  description:
    "Scrape and parse content from a business website for onboarding pre-fill. " +
    "Use during /onboarding-flow when the user provides a website URL for auto-fill. " +
    "Returns extracted: about-us, concept, menu hints, contact info. " +
    'Examples: "hent data fra nettsiden vår", "www.restaurant-trondheim.no". ' +
    "Read-only (no mutations). Proxies to scrapling /extract. " +
    "NOTE: body bridges to business_intelligence.scrape_website — phantom-trace in T1.7.",
  schema: z.object({
    url: z.string().url().describe("Website URL to scrape"),
    mode: z
      .enum(["extract", "raw"])
      .optional()
      .default("extract")
      .describe("'extract' for structured text (default), 'raw' for HTML"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.7): implement bridge body. Phantom-trace business_intelligence
    // capability delegation shape before implementing.
    return "Not implemented yet — body lands in T1.7.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 8. search_company (BRIDGE)
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.7): implement body. BRIDGE to business_intelligence.search_brreg.
//             Phantom-trace required (ADR-0240 cross-namespace rule).
//             Read-only: no gate_action needed.

export const searchCompany = defineTool({
  name: "search_company",
  description:
    "Search Brønnøysundregisteret (BRREG) for a Norwegian company by name. " +
    "Use during /onboarding-flow when the user provides a company name for lookup. " +
    "Returns candidates with org-number, name, address, and match-score. " +
    'Examples: "søk etter Strøm Mat & Bar", "finn bedriften vår i BRREG". ' +
    "Always the first step when onboarding a new workspace from company info. " +
    "Read-only. Bridges to business_intelligence.search_brreg. " +
    "NOTE: phantom-trace required before T1.7 to verify delegation contract (ADR-0240).",
  schema: z.object({
    query: z.string().describe("Company name or partial name to search for"),
    city: z.string().optional().describe("City name to narrow the search"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.7): implement bridge body. Phantom-trace business_intelligence
    // capability search_brreg delegation shape before implementing.
    return "Not implemented yet — body lands in T1.7.";
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 9. identify_company (BRIDGE)
// ─────────────────────────────────────────────────────────────────────────
// TODO(T1.7): implement body. BRIDGE to business_intelligence.lookup_brreg.
//             Phantom-trace required (ADR-0240 cross-namespace rule).
//             Read-only: no gate_action needed.

export const identifyCompany = defineTool({
  name: "identify_company",
  description:
    "Look up confirmed company details from BRREG by org-number. " +
    "Use during /onboarding-flow after the user has confirmed which company from search_company results. " +
    "Returns: official name, address, NACE codes, general manager, registration date. " +
    'Examples: "hent detaljer for org.nr 912345678", etter at brukeren har bekreftet bedrift. ' +
    "Read-only. Bridges to business_intelligence.lookup_brreg. " +
    "Never call without explicit org-number confirmed by user. " +
    "NOTE: phantom-trace required before T1.7 to verify delegation contract (ADR-0240).",
  schema: z.object({
    org_number: z
      .string()
      .regex(/^\d{9}$/, "Must be exactly 9 digits")
      .describe("Norwegian org-number, exactly 9 digits"),
  }),
  execute: async (_params, _ctx: AgentToolContext) => {
    // TODO(T1.7): implement bridge body. Phantom-trace business_intelligence
    // capability lookup_brreg delegation shape before implementing.
    return "Not implemented yet — body lands in T1.7.";
  },
});
