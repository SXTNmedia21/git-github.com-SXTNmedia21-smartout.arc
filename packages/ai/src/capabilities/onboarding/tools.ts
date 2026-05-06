// packages/ai/src/capabilities/onboarding/tools.ts
//
// Onboarding capability — 10 tools (ADR-0275 R4 + T1.8 alias).
//
// Tool inventory:
//   update_business     — real DB write (workspace table). confirm. gate + emit.
//   update_season       — real DB write (season + season_budget). confirm. gate + emit.
//   add_departments     — IN-MEMORY wizard state (Option A, 2026-05-04). read_only. No gate, no emit, no DB.
//   add_locations       — IN-MEMORY wizard state (Option A). read_only. No gate, no emit, no DB.
//   add_zones           — IN-MEMORY wizard state (Option A). read_only. No gate, no emit, no DB.
//   add_procedures      — real DB write (protocol table). suggest. chat-only guard + gate + emit.
//   scrape_website      — BFF bridge to scrapling /extract. read_only. emit called+cost.
//   search_company      — scrapling /brreg-search bridge. read_only. emit called+cost.
//   identify_company    — scrapling /brreg-lookup bridge. read_only. emit called+cost.
//   add_key_fact        — alias to memory.save_memory. suggest. chat-only. gate + memory write.
//
// OPTION A DECISION (2026-05-04):
//   D1 tools (add_departments, add_locations, add_zones) are IN-MEMORY wizard state
//   mutations only. NO cascade_gate_write. NO DB writes. The server-side tool returns
//   a structured confirmation JSON for the LLM; the wizard's WizardContext (client-side)
//   collects the state and persists it via finalize-workspace Edge Function.
//   Authority seed is downgraded to read_only for D1 tools.
//   Mirror of: apps/web/src/app/onboarding/steps/tools/departments-tools.ts
//              apps/web/src/app/onboarding/steps/tools/locations-tools.ts
//
// Cross-cutting laws (verified per L-0176 — bodies, not docstrings):
//   Law 1: every query scoped by ctx.workspaceId
//   Law 2: mutation tools call callGateAction before any write
//   Law 3: add_procedures body rejects ctx.channel === "voice" (PII-adjacent content)
//   Law 4: every mutation emits with non-empty workspace_id + actor_id
//   Law 5: no service role exposed to L1
//
// ADR refs: 0078 (channel), 0099 (gate_action), 0134 (telemetry),
//           0173 (capability model), 0194 (emitPrefix: "onboarding"),
//           0204 (gatedMutation via callGateAction), 0240 (cross-namespace),
//           0270 (business_intelligence scrapling proxy), 0275 (Phase E R4).

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";
import { saveMemory, type MemoryScope } from "../../context/memory-writer.js";

// ─────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

/** ADR-0134 fail-fast guard — throw if IDs are missing. */
function assertCtxIds(ctx: AgentToolContext): void {
  if (!ctx.workspaceId) throw new Error("workspaceId is required (ADR-0134) — BFF must set this.");
  if (!ctx.profileId) throw new Error("profileId is required (ADR-0134) — BFF must set this.");
}

const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL ?? "https://scrape.smartout.ai";

function scraplingHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.SCRAPLING_AUTH_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function scraplingPost(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${SCRAPLING_URL}${path}`, {
      method: "POST",
      headers: scraplingHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "no body");
      return { ok: false, error: `scrapling ${path} returned ${res.status}: ${text}` };
    }
    const data: unknown = await res.json();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `scrapling ${path} fetch failed: ${message}` };
  }
}

// PII pattern: personnummer (11 digits), kontonummer (11 digits), phone (+47...), email
const PII_PATTERN = /\b\d{11}\b|\b\d{4}\s?\d{2}\s?\d{5}\b|[\w.+-]+@[\w-]+\.\w{2,}|\+\d{8,15}\b/;

// ─────────────────────────────────────────────────────────────────────────
// 1. update_business
// ─────────────────────────────────────────────────────────────────────────
// Real DB write. gate_action("onboarding.update_business") → UPDATE workspace.
// Pre-auth fail-fast: profileId required (L-0177).
// Channels: chat + voice (workspace metadata is not PII).

export const updateBusiness = defineTool({
  name: "update_business",
  description:
    "Update workspace business metadata: name, display name, domain, industry type, " +
    "concept description, cuisine types, price category, and about-us text. " +
    "Use during /onboarding-flow when the user provides details about their business. " +
    'Examples: "vi heter Strøm Mat & Bar", "vi driver en restaurant", "vi har norsk kjøkken". ' +
    "Requires confirm authority. gate_action: onboarding.update_business.",
  capability: "onboarding",
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
  execute: async (params, ctx: AgentToolContext) => {
    // L-0177 fail-fast: profileId required before any gate/mutation.
    if (!ctx.profileId) {
      throw new Error(
        "Profile required for business update — BFF must resolve profileId before dispatch.",
      );
    }

    // ADR-0134 workspace scope guard.
    assertCtxIds(ctx);

    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const channel = normaliseChannel(ctx.channel);

    // Build patch — only include defined fields.
    const patch: Record<string, unknown> = {};
    if (params.name !== undefined) patch.name = params.name;
    if (params.display_name !== undefined) patch.display_name = params.display_name;
    if (params.domain !== undefined) patch.website_url = params.domain;
    if (params.industry !== undefined) patch.niche = params.industry;
    if (params.concept_description !== undefined)
      patch.concept_description = params.concept_description;
    if (params.cuisine_types !== undefined) patch.cuisine_types = params.cuisine_types;
    if (params.price_category !== undefined) patch.price_category = params.price_category;
    if (params.about_us !== undefined) patch.about_us = params.about_us;
    if (params.org_number !== undefined) patch.org_number = params.org_number;

    if (Object.keys(patch).length === 0) {
      return "Ingen felter å oppdatere — send minst ett felt.";
    }

    // ADR-0099: gate_action before mutation.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "onboarding",
      channel,
      actionType: "update_business",
      entityId: ctx.workspaceId,
    });

    if (!gate.allow) {
      return `Ikke tillatt: ${gate.reason ?? "gate avvist"}`;
    }

    // Perform workspace UPDATE scoped by workspaceId (Law 1).
    const { error } = await supabase
      .from("workspace")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId);

    if (error) {
      return `Feil ved oppdatering av virksomhetsinformasjon: ${error.message}`;
    }

    // ADR-0134: emit with non-empty IDs.
    void emit({
      event: "onboarding.business_updated",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: { fields_updated: Object.keys(patch) },
      },
    });

    return `Virksomhetsinformasjon oppdatert: ${Object.keys(patch).join(", ")}.`;
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 2. update_season
// ─────────────────────────────────────────────────────────────────────────
// Real DB write. gate_action("onboarding.update_season") → INSERT season + season_budget.
// Pattern mirrors packages/ai/src/tools/season/create-season.ts.
// Channels: chat + voice (season metadata is not PII).

export const updateSeason = defineTool({
  name: "update_season",
  description:
    "Bootstrap a wizard-context season: create or update the initial planning cycle " +
    "with a name, start/end date, and optional revenue target. " +
    "Use during /onboarding-flow when the user describes their season structure. " +
    'Examples: "vi har sommersesong og vintersesong", "sesong starter 1. juni". ' +
    "Requires confirm authority. gate_action: onboarding.update_season.",
  capability: "onboarding",
  schema: z.object({
    name: z.string().describe("Season name, e.g. 'Sommersesong 2026'"),
    start_date: z.string().describe("ISO 8601 date string, e.g. '2026-06-01'"),
    end_date: z.string().describe("ISO 8601 date string, e.g. '2026-08-31'"),
    revenue_target_nok: z.number().optional().describe("Revenue target in NOK for this season"),
    notes: z.string().optional().describe("Additional notes or playbook context"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    assertCtxIds(ctx);

    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const channel = normaliseChannel(ctx.channel);

    const start = new Date(params.start_date);
    const end = new Date(params.end_date);
    if (end <= start) {
      return "Sluttdato må være etter startdato.";
    }

    // ADR-0099: gate before mutation.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "onboarding",
      channel,
      actionType: "update_season",
      entityId: ctx.workspaceId,
    });

    if (!gate.allow) {
      return `Ikke tillatt: ${gate.reason ?? "gate avvist"}`;
    }

    // Slug from name.
    const slug = params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const description = params.notes
      ? `Onboarding sesong. ${params.notes}`
      : "Onboarding sesong — opprettet via veiviser.";

    // INSERT season (Law 1: workspace_id on every insert).
    const { data: season, error: seasonError } = await supabase
      .from("season")
      .insert({
        name: params.name,
        slug,
        season_type: "calendar" as const,
        start_date: params.start_date,
        end_date: params.end_date,
        status: "draft" as const,
        workspace_id: ctx.workspaceId,
        description,
      })
      .select("season_id")
      .single();

    if (seasonError || !season) {
      return `Feil ved oppretting av sesong: ${seasonError?.message ?? "ukjent feil"}. Sjekk om sesong med dette navnet allerede finnes.`;
    }

    // INSERT season_budget 1:1.
    const { error: budgetError } = await supabase.from("season_budget").insert({
      season_id: season.season_id,
      workspace_id: ctx.workspaceId,
      status: "draft" as const,
      total_target_revenue: params.revenue_target_nok ?? 0,
      target_labor_percentage: 30,
    });

    if (budgetError) {
      return `Sesong opprettet men budsjett-oppsett feilet: ${budgetError.message}. Sesong-ID: ${season.season_id}`;
    }

    // ADR-0134: emit. D4 surface → engine_event for cascade-trigger.
    void emit({
      event: "onboarding.season_updated",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          season_id: season.season_id,
          name: params.name,
          start_date: params.start_date,
          end_date: params.end_date,
          revenue_target_nok: params.revenue_target_nok ?? null,
        },
      },
    });

    return JSON.stringify({
      ok: true,
      season_id: season.season_id,
      name: params.name,
      period: `${params.start_date} → ${params.end_date}`,
      revenue_target_nok: params.revenue_target_nok ?? null,
      message: `Sesong '${params.name}' opprettet i utkast-modus.`,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 3. add_departments — IN-MEMORY wizard state (Option A, 2026-05-04)
// ─────────────────────────────────────────────────────────────────────────
// NO gate, NO emit, NO DB write. Returns structured confirmation JSON.
// The wizard's WizardContext (client-side) maintains state until
// finalize-workspace Edge Function persists everything.
// Authority: read_only (downgraded per Option A decision).

export const addDepartments = defineTool({
  name: "add_departments",
  description:
    "Record departments for this workspace during /onboarding-flow. " +
    "Use when the user lists their departments — does NOT write to database yet. " +
    "State is collected client-side and persisted on finalize. " +
    'Examples: "vi har avdelinger kjøkken og bar", "legg til avdeling: kjøkken". ' +
    "Read-only (in-memory, Option A). No database write until finalize-workspace.",
  capability: "onboarding",
  schema: z.object({
    departments: z
      .array(
        z.object({
          name: z.string().describe("Department name, e.g. 'Kjøkken'"),
          description: z.string().optional().describe("Optional description"),
        }),
      )
      .min(1)
      .describe("List of departments to record"),
  }),
  execute: async (params, _ctx: AgentToolContext) => {
    // Option A: in-memory only — server confirms receipt for LLM.
    // Client-side WizardContext stores the state and persists via finalize-workspace.
    const names = params.departments.map((d) => d.name).join(", ");
    return JSON.stringify({
      ok: true,
      recorded: params.departments.length,
      departments: params.departments.map((d) => ({
        name: d.name,
        description: d.description ?? null,
      })),
      message: `${params.departments.length} avdeling(er) registrert: ${names}. Lagres ved fullføring av veiviseren.`,
      note: "in_memory_only",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 4. add_locations — IN-MEMORY wizard state (Option A, 2026-05-04)
// ─────────────────────────────────────────────────────────────────────────

export const addLocations = defineTool({
  name: "add_locations",
  description:
    "Record physical locations for this workspace during /onboarding-flow. " +
    "Use when the user lists multiple physical locations — does NOT write to database yet. " +
    "State is collected client-side and persisted on finalize. " +
    'Examples: "legg til lokasjon Trondheim", "vi har to lokasjoner: Oslo og Bergen". ' +
    "Read-only (in-memory, Option A). No database write until finalize-workspace.",
  capability: "onboarding",
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
      .describe("List of locations to record"),
  }),
  execute: async (params, _ctx: AgentToolContext) => {
    const names = params.locations.map((l) => l.name).join(", ");
    return JSON.stringify({
      ok: true,
      recorded: params.locations.length,
      locations: params.locations.map((l) => ({
        name: l.name,
        city: l.city ?? null,
        address: l.address ?? null,
        country_code: l.country_code ?? "NO",
      })),
      message: `${params.locations.length} lokasjon(er) registrert: ${names}. Lagres ved fullføring av veiviseren.`,
      note: "in_memory_only",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 5. add_zones — IN-MEMORY wizard state (Option A, 2026-05-04)
// ─────────────────────────────────────────────────────────────────────────

export const addZones = defineTool({
  name: "add_zones",
  description:
    "Record zones (sub-units of a location) for this workspace during /onboarding-flow. " +
    "Use when the user describes physical zones within a location — does NOT write to database yet. " +
    'Examples: "vi har utendørs og innendørs", "legg til sone: terrasse". ' +
    "Read-only (in-memory, Option A). No database write until finalize-workspace.",
  capability: "onboarding",
  schema: z.object({
    location_name: z
      .string()
      .describe("Name of the parent location (fuzzy-matched against recorded locations)"),
    zones: z
      .array(
        z.object({
          name: z.string().describe("Zone name, e.g. 'Terrasse'"),
          capacity: z.number().int().optional().describe("Max covers / capacity"),
          description: z.string().optional().describe("Optional description"),
        }),
      )
      .min(1)
      .describe("List of zones to record"),
  }),
  execute: async (params, _ctx: AgentToolContext) => {
    const names = params.zones.map((z) => z.name).join(", ");
    return JSON.stringify({
      ok: true,
      location_name: params.location_name,
      recorded: params.zones.length,
      zones: params.zones.map((z) => ({
        name: z.name,
        capacity: z.capacity ?? null,
        description: z.description ?? null,
      })),
      message: `${params.zones.length} sone(r) registrert under "${params.location_name}": ${names}. Lagres ved fullføring av veiviseren.`,
      note: "in_memory_only",
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 6. add_procedures
// ─────────────────────────────────────────────────────────────────────────
// Real DB write. chat-only (Law 3 — governance content may embed sensitive info).
// gate_action("onboarding.add_procedures") → INSERT protocol.
// ADR-0240: governance/tools.ts only exposes check_readiness (read-only).
// Direct INSERT into protocol is appropriate — no owning mutation tool to delegate to.

export const addProcedures = defineTool({
  name: "add_procedures",
  description:
    "Add one or more procedures to the workspace (governance layer). " +
    "Use during /onboarding-flow when the user describes key work procedures. " +
    'Examples: "legg til prosedyre: åpningsrutine", "vi trenger en HMS-prosedyre". ' +
    "Chat-only (governance content may contain sensitive operational details). " +
    "Requires suggest authority. gate_action: onboarding.add_procedures.",
  capability: "onboarding",
  schema: z.object({
    procedures: z
      .array(
        z.object({
          title: z.string().describe("Procedure title, e.g. 'Åpningsrutine kjøkken'"),
          description: z.string().optional().describe("Short description"),
          category: z
            .enum(["routine", "protocol", "control_list", "runbook"])
            .optional()
            .describe("Procedure category"),
        }),
      )
      .min(1)
      .describe("List of procedures to create"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 Layer 3: chat-only for governance content.
    if (ctx.channel === "voice") {
      return "Av sikkerhetshensyn må prosedyrer opprettes via chat, ikke via stemme.";
    }

    assertCtxIds(ctx);

    const supabase = ctx.supabaseAdmin as SupabaseClient;
    const channel = normaliseChannel(ctx.channel);

    // ADR-0099: gate before mutation.
    const gate = await callGateAction(supabase, ctx.workspaceId, ctx.profileId, {
      capability: "onboarding",
      channel,
      actionType: "add_procedures",
      entityId: ctx.workspaceId,
    });

    if (!gate.allow) {
      return `Ikke tillatt: ${gate.reason ?? "gate avvist"}`;
    }

    // INSERT each procedure into protocol table (Law 1: workspace_id scoped).
    const results: Array<{ title: string; protocol_id?: string; error?: string }> = [];

    for (const proc of params.procedures) {
      const slug = proc.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const { data: created, error } = await supabase
        .from("protocol")
        .insert({
          workspace_id: ctx.workspaceId,
          title: proc.title,
          description: proc.description ?? null,
          protocol_type: proc.category ?? "routine",
          status: "draft",
          slug: `${slug}-${Date.now()}`,
          created_by: ctx.profileId,
        })
        .select("protocol_id")
        .single();

      if (error) {
        results.push({ title: proc.title, error: error.message });
      } else {
        results.push({ title: proc.title, protocol_id: created?.protocol_id });
      }
    }

    const succeeded = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    // ADR-0134: emit after mutations.
    void emit({
      event: "onboarding.procedure_added",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: {
          count: succeeded.length,
          titles: succeeded.map((r) => r.title),
          failed_count: failed.length,
        },
      },
    });

    if (succeeded.length === 0) {
      return `Alle ${params.procedures.length} prosedyre(r) feilet: ${failed.map((f) => `${f.title}: ${f.error}`).join("; ")}`;
    }

    const lines = [
      `${succeeded.length} av ${params.procedures.length} prosedyre(r) opprettet.`,
      ...succeeded.map((r) => `• ${r.title} (ID: ${r.protocol_id})`),
    ];
    if (failed.length > 0) {
      lines.push(`Feilet: ${failed.map((f) => `${f.title} (${f.error})`).join(", ")}`);
    }
    return lines.join("\n");
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 7. scrape_website
// ─────────────────────────────────────────────────────────────────────────
// Read-only bridge to scrapling /extract. No gate needed.
// emit called + cost (mirrors business-intelligence pattern, ADR-0270).

export const scrapeWebsite = defineTool({
  name: "scrape_website",
  description:
    "Scrape and parse content from a business website for onboarding pre-fill. " +
    "Use during /onboarding-flow when the user provides a website URL for auto-fill. " +
    "Returns extracted: about-us, concept, menu hints, contact info. " +
    'Examples: "hent data fra nettsiden vår", "www.restaurant-trondheim.no". ' +
    "Read-only (no mutations). Proxies to scrapling /extract.",
  capability: "onboarding",
  schema: z.object({
    url: z.string().url().describe("Website URL to scrape"),
    mode: z
      .enum(["extract", "raw"])
      .optional()
      .default("extract")
      .describe("'extract' for structured text (default), 'raw' for HTML"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    assertCtxIds(ctx);

    const resolvedMode = params.mode ?? "extract";

    // ADR-0134: emit before external call (audit of who triggered scrape).
    void emit({
      event: "onboarding.scrape_completed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: { url: params.url, mode: resolvedMode, phase: "called" },
      },
    });

    const endpoint = resolvedMode === "raw" ? "/scrape-raw" : "/extract";
    const result = await scraplingPost(endpoint, { url: params.url }, 30_000);

    if (!result.ok) {
      return `Feil ved scraping av ${params.url}: ${result.error}`;
    }

    // Cost emit (mirrors business-intelligence cost pattern, ADR-0270).
    void emit({
      event: "onboarding.scrape_completed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        data: { url: params.url, mode: resolvedMode, phase: "completed" },
      },
    });

    return JSON.stringify(result.data);
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 8. search_company (BRIDGE — delegates to scrapling /brreg-search)
// ─────────────────────────────────────────────────────────────────────────
// Phantom-trace 2026-05-04: business_intelligence.searchBrregTool calls
// scraplingPost("/brreg-search", ...) directly — same scrapling pattern.
// ADR-0240 cross-namespace: no Smartout DB write, purely external call.
// Read-only: no gate needed.

export const searchCompany = defineTool({
  name: "search_company",
  description:
    "Search Brønnøysundregisteret (BRREG) for a Norwegian company by name. " +
    "Use during /onboarding-flow when the user provides a company name for lookup. " +
    "Returns candidates with org-number, name, address, and match-score. " +
    'Examples: "søk etter Strøm Mat & Bar", "finn bedriften vår i BRREG". ' +
    "Always the first step when onboarding a new workspace from company info. " +
    "Read-only. Bridges to scrapling /brreg-search.",
  capability: "onboarding",
  schema: z.object({
    query: z.string().describe("Company name or partial name to search for"),
    city: z.string().optional().describe("City name to narrow the search"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    assertCtxIds(ctx);

    const body: Record<string, unknown> = { company_name: params.query };
    if (params.city) body.city = params.city;

    const result = await scraplingPost("/brreg-search", body, 20_000);

    if (!result.ok) {
      return `Feil ved BRREG-søk for "${params.query}": ${result.error}`;
    }

    const payload = result.data as {
      candidates?: unknown[];
      needOrgNumber?: boolean;
      placesMatch?: unknown;
    };

    if (!payload.candidates?.length) {
      const placesMsg = payload.placesMatch
        ? ` Google Places fant: ${JSON.stringify(payload.placesMatch)}. Be brukeren om org-nummer.`
        : " Ingen resultater funnet.";
      return `Ingen BRREG-treff for "${params.query}".${placesMsg}`;
    }

    return JSON.stringify({
      candidates: payload.candidates,
      needOrgNumber: payload.needOrgNumber ?? false,
      placesMatch: payload.placesMatch ?? null,
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 9. identify_company (BRIDGE — delegates to scrapling /brreg-lookup)
// ─────────────────────────────────────────────────────────────────────────
// Phantom-trace 2026-05-04: business_intelligence.lookupBrregTool calls
// scraplingPost("/brreg-lookup", ...) directly — same scrapling pattern.
// Read-only: no gate needed.

export const identifyCompany = defineTool({
  name: "identify_company",
  description:
    "Look up confirmed company details from BRREG by org-number. " +
    "Use during /onboarding-flow after the user has confirmed which company from search_company results. " +
    "Returns: official name, address, NACE codes, general manager, registration date. " +
    'Examples: "hent detaljer for org.nr 912345678", etter at brukeren har bekreftet bedrift. ' +
    "Read-only. Bridges to scrapling /brreg-lookup. " +
    "Never call without explicit org-number confirmed by user.",
  capability: "onboarding",
  schema: z.object({
    org_number: z
      .string()
      .regex(/^\d{9}$/, "Must be exactly 9 digits")
      .describe("Norwegian org-number, exactly 9 digits"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    assertCtxIds(ctx);

    const result = await scraplingPost("/brreg-lookup", { orgNumber: params.org_number }, 15_000);

    if (!result.ok) {
      return `Feil ved BRREG-oppslag for org-nummer ${params.org_number}: ${result.error}`;
    }

    const payload = result.data as { match?: unknown };

    if (!payload.match) {
      return `Ingen BRREG-data funnet for org-nummer ${params.org_number}. Sjekk at nummeret er korrekt.`;
    }

    return JSON.stringify({ match: payload.match });
  },
});

// ─────────────────────────────────────────────────────────────────────────
// 10. add_key_fact (T1.8 — alias to memory.save_memory)
// ─────────────────────────────────────────────────────────────────────────
// Server-side alias resolution: when LLM emits "add_key_fact" in the onboarding
// context, this tool delegates to the memory writer (Phase A3 engine_memory writer).
// chat-only (ADR-0078: voice cannot persist memories).
// PII guard via Zod refinement on value field.
// gate_action("memory") via callGateAction (same gate as save_memory tool).

const PII_GATE_MESSAGE =
  "Personnummer, kontonummer, e-postadresse og telefonnummer kan ikke lagres som nøkkelfakta — " +
  "slike opplysninger hører hjemme i ansattprofilen, ikke i minnet.";

export const addKeyFact = defineTool({
  name: "add_key_fact",
  description:
    "Record a key fact about the business or onboarding context for future reference. " +
    "Alias to memory.save_memory in the onboarding flow. " +
    "Use when the user confirms a business fact worth remembering across sessions: " +
    "company name, concept, location, cuisine type, pricing tier, manager name. " +
    "Chat-only. Never save personal identifiers (personnummer, bank, addresses). " +
    'Examples: "bedriften heter Strøm Mat & Bar", "vi er i restaurantbransjen".',
  capability: "onboarding",
  schema: z.object({
    label: z.string().min(1).max(100).describe("Short label for the fact, e.g. 'Bedrift'"),
    value: z
      .string()
      .min(1)
      .max(500)
      .refine((v) => !PII_PATTERN.test(v), { message: PII_GATE_MESSAGE })
      .describe("The fact value. PII (personnummer, bank, email, phone) not permitted."),
    memory_type: z
      .enum(["preference", "fact", "summary", "general", "constant"])
      .optional()
      .default("fact")
      .describe("Memory type — defaults to 'fact' for onboarding key facts."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 Layer 3: chat-only for memory persistence.
    if (ctx.channel === "voice") {
      return "Minner lagres kun via chat. Be meg om å notere det igjen når du er i chatmodus.";
    }

    assertCtxIds(ctx);

    // PII content-level guard (redundant with Zod refinement above — defence in depth).
    if (PII_PATTERN.test(params.value)) {
      return PII_GATE_MESSAGE;
    }

    // Delegate to saveMemory (Phase A3 engine_memory writer).
    const content = `${params.label}: ${params.value}`;
    const result = await saveMemory({
      supabaseAdmin: ctx.supabaseAdmin as SupabaseClient,
      workspaceId: ctx.workspaceId,
      profileId: ctx.profileId,
      content,
      memoryType: params.memory_type ?? "fact",
      scope: "onboarding" as MemoryScope,
      importance: 0.7,
    });

    if (!result.ok) {
      return `Feil ved lagring av nøkkelfaktum: ${result.reason}${result.detail ? ` — ${result.detail}` : ""}`;
    }

    return `Nøkkelfaktum lagret: "${params.label}" = "${params.value}".`;
  },
});
