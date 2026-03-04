import type { ClientTool } from "../types";

/**
 * Callbacks the onboarding tools invoke to update the UI.
 * Extracted from the useBotsson hook's BotssonActions interface.
 */
export type OnboardingActions = {
  getState: () => Record<string, unknown>;
  updateBusiness: (partial: Record<string, unknown>) => void;
  updateSeason: (partial: Record<string, unknown>) => void;
  addDepartments: (names: string[]) => void;
  addLocations: (locs: { name: string; type?: string }[]) => void;
  addZones: (locationName: string, zones: { name: string }[]) => void;
  addProcedures: (names: string[]) => void;
  triggerScrape: (
    url: string,
    orgNumber: string,
    companyName?: string,
    city?: string,
  ) => Promise<void>;
  advanceToNextSection: () => void;
  addKeyFact: (label: string, value: string) => void;
  saveMemory: (content: string, memoryType: string, expiresAt?: string) => Promise<void>;
};

/**
 * Creates the set of client tools used during onboarding.
 * These are registered with the voice provider so the agent can call them
 * to update the onboarding UI in real-time.
 *
 * @param actionsRef - A React ref containing the current OnboardingActions.
 *                     Using a ref ensures tools always call the latest callbacks.
 */
export function createOnboardingTools(actionsRef: {
  current: OnboardingActions | undefined;
}): ClientTool[] {
  return [
    {
      name: "getOnboardingState",
      description:
        "Get the current onboarding state: section, business, season, departments, scrape status.",
      parameters: [],
      implementation: () => {
        const state = actionsRef.current?.getState() ?? {};
        return JSON.stringify(state);
      },
    },
    {
      name: "updateBusiness",
      description:
        "Update business fields. Pass a JSON object with fields to update: name, orgNumber, website, email, phone, address, postalCode, city, industry, employeeCount.",
      parameters: [
        {
          name: "fields",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON object with business fields to update" },
          required: true,
        },
      ],
      implementation: (params) => {
        try {
          const fields = JSON.parse(String(params.fields ?? "{}")) as Record<string, unknown>;
          actionsRef.current?.updateBusiness(fields);
          return JSON.stringify({ success: true });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      },
    },
    {
      name: "updateSeason",
      description:
        "Update season fields. Pass a JSON object with fields: name, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD).",
      parameters: [
        {
          name: "fields",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON object with season fields to update" },
          required: true,
        },
      ],
      implementation: (params) => {
        try {
          const fields = JSON.parse(String(params.fields ?? "{}")) as Record<string, unknown>;
          actionsRef.current?.updateSeason(fields);
          return JSON.stringify({ success: true });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      },
    },
    {
      name: "addDepartments",
      description:
        'Add departments by name. Pass a JSON array of department name strings, e.g. ["Kjokken", "Bar", "Sal"].',
      parameters: [
        {
          name: "names",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON array of department name strings" },
          required: true,
        },
      ],
      implementation: (params) => {
        try {
          const names = JSON.parse(String(params.names ?? "[]")) as string[];
          actionsRef.current?.addDepartments(names);
          return JSON.stringify({ success: true, added: names });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      },
    },
    {
      name: "addLocations",
      description:
        'Add physical locations. Pass a JSON array of location objects with name and optional type ("main", "outdoor", "satellite", "other").',
      parameters: [
        {
          name: "locations",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "JSON array of location objects with name and optional type",
          },
          required: true,
        },
      ],
      implementation: (params) => {
        try {
          const locs = JSON.parse(String(params.locations ?? "[]")) as {
            name: string;
            type?: string;
          }[];
          actionsRef.current?.addLocations(locs);
          return JSON.stringify({ success: true, added: locs.length });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      },
    },
    {
      name: "addZones",
      description:
        "Add zones within a specific location. Pass the location name and a JSON array of zone objects.",
      parameters: [
        {
          name: "locationName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Name of the location to add zones to" },
          required: true,
        },
        {
          name: "zones",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON array of zone objects with name" },
          required: true,
        },
      ],
      implementation: (params) => {
        try {
          const locationName = String(params.locationName ?? "");
          const zones = JSON.parse(String(params.zones ?? "[]")) as { name: string }[];
          actionsRef.current?.addZones(locationName, zones);
          return JSON.stringify({
            success: true,
            location: locationName,
            zonesAdded: zones.length,
          });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      },
    },
    {
      name: "addProcedures",
      description: "Add or enable procedures by name. Pass a JSON array of procedure name strings.",
      parameters: [
        {
          name: "names",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "JSON array of procedure name strings" },
          required: true,
        },
      ],
      implementation: (params) => {
        try {
          const names = JSON.parse(String(params.names ?? "[]")) as string[];
          actionsRef.current?.addProcedures(names);
          return JSON.stringify({ success: true, added: names });
        } catch {
          return JSON.stringify({ success: false, error: "Invalid JSON" });
        }
      },
    },
    {
      name: "triggerScrape",
      description:
        "Trigger a scan of the business. Pass company name + city for auto-lookup, or a website URL, or org number, or any combination.",
      parameters: [
        {
          name: "url",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Website URL to scan" },
          required: false,
        },
        {
          name: "orgNumber",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Norwegian org number" },
          required: false,
        },
        {
          name: "companyName",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Business name to search for" },
          required: false,
        },
        {
          name: "city",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "City where the business is located" },
          required: false,
        },
      ],
      implementation: (params) => {
        const url = String(params.url ?? "");
        const orgNumber = String(params.orgNumber ?? "");
        const companyName = String(params.companyName ?? "");
        const city = String(params.city ?? "");
        actionsRef.current
          ?.triggerScrape(url, orgNumber, companyName || undefined, city || undefined)
          .catch(() => {});
        return JSON.stringify({ success: true, message: "Scan started" });
      },
    },
    {
      name: "advanceToNextSection",
      description:
        "Scroll the onboarding page to the next section. Call this when the user is ready to move on.",
      parameters: [],
      implementation: () => {
        actionsRef.current?.advanceToNextSection();
        return JSON.stringify({ success: true, message: "Scrolled to next section" });
      },
    },
    {
      name: "addKeyFact",
      description:
        "Add a key fact to the visual panel (top-left). Use this actively as you learn things: business name, city, industry, employees, season, departments.",
      parameters: [
        {
          name: "label",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: 'Short label, e.g. "Bedrift", "By", "Bransje"' },
          required: true,
        },
        {
          name: "value",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: 'The fact value, e.g. "Burger Bar", "Oslo"' },
          required: true,
        },
      ],
      implementation: (params) => {
        const label = String(params.label ?? "");
        const value = String(params.value ?? "");
        if (label && value) {
          actionsRef.current?.addKeyFact(label, value);
        }
        return JSON.stringify({ success: true, message: `Added: ${label}: ${value}` });
      },
    },
    {
      name: "saveMemory",
      description:
        'Save a memory about the user. RULES: (1) ALWAYS confirm with the user before saving. (2) Only save factual knowledge. Type "constant" for permanent facts, "temporal" for time-limited info.',
      parameters: [
        {
          name: "content",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "The memory content" },
          required: true,
        },
        {
          name: "memoryType",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: '"constant" (permanent) or "temporal" (expires)',
          },
          required: true,
        },
        {
          name: "expiresAt",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "ISO date (YYYY-MM-DD) when this memory expires.",
          },
          required: false,
        },
      ],
      implementation: (params) => {
        const content = String(params.content ?? "");
        const memoryType = String(params.memoryType ?? "constant");
        const expiresAt = params.expiresAt ? String(params.expiresAt) : undefined;
        actionsRef.current?.saveMemory(content, memoryType, expiresAt).catch(() => {});
        return JSON.stringify({ success: true, message: "Memory saved" });
      },
    },
  ];
}
