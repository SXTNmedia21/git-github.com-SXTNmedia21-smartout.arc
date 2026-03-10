// ---------------------------------------------------------------------------
// Service Contracts — defines the API surface per service with test configs
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type EndpointDef = {
  method: EndpointMethod;
  path: string;
  description: string;
  auth: "none" | "jwt" | "api-key" | "service-key" | "anon-key";
  testable: boolean;
  defaultBody?: Record<string, unknown>;
  category?: string;
};

export type ServiceContract = {
  serviceKey: string;
  endpoints: EndpointDef[];
};

// ---------------------------------------------------------------------------
// Caddy
// ---------------------------------------------------------------------------

const caddy: ServiceContract = {
  serviceKey: "caddy",
  endpoints: [
    {
      method: "GET",
      path: "/",
      description: "Root — returns redirect to HTTPS",
      auth: "none",
      testable: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase: ServiceContract = {
  serviceKey: "supabase",
  endpoints: [
    {
      method: "GET",
      path: "/rest/v1/",
      description: "REST API root — confirms PostgREST is alive",
      auth: "anon-key",
      testable: true,
    },
    {
      method: "GET",
      path: "/auth/v1/health",
      description: "Auth service health check",
      auth: "anon-key",
      testable: true,
    },
    {
      method: "GET",
      path: "/storage/v1/health",
      description: "Storage service health",
      auth: "none",
      testable: true,
    },
    {
      method: "GET",
      path: "/functions/v1/health-check",
      description: "Edge Functions health check",
      auth: "none",
      testable: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Stage Engine (14 endpoints)
// ---------------------------------------------------------------------------

const stageEngine: ServiceContract = {
  serviceKey: "stage-engine",
  endpoints: [
    {
      method: "GET",
      path: "/health",
      description: "Health check",
      auth: "none",
      testable: true,
    },
    // Sessions
    {
      method: "POST",
      path: "/sessions",
      description: "Start a new mission session",
      auth: "jwt",
      testable: false,
      category: "Sessions",
    },
    {
      method: "GET",
      path: "/sessions/:id",
      description: "Get session status and metadata",
      auth: "jwt",
      testable: false,
      category: "Sessions",
    },
    {
      method: "POST",
      path: "/sessions/:id/store",
      description: "Store data to session inbox",
      auth: "jwt",
      testable: false,
      category: "Sessions",
    },
    {
      method: "POST",
      path: "/sessions/:id/fetch",
      description: "Fetch session context or collected data",
      auth: "jwt",
      testable: false,
      category: "Sessions",
    },
    {
      method: "POST",
      path: "/sessions/:id/advance",
      description: "Advance session to next stage",
      auth: "jwt",
      testable: false,
      category: "Sessions",
    },
    {
      method: "POST",
      path: "/sessions/:id/abandon",
      description: "Abandon an active session",
      auth: "jwt",
      testable: false,
      category: "Sessions",
    },
    // Agent
    {
      method: "POST",
      path: "/agent/chat",
      description: "Free-form agent conversation (non-mission)",
      auth: "jwt",
      testable: false,
      category: "Agent",
    },
    // WebSocket
    {
      method: "GET",
      path: "/ws/:sessionId",
      description: "WebSocket for UI↔Agent bidirectional comms",
      auth: "jwt",
      testable: false,
      category: "WebSocket",
    },
    {
      method: "GET",
      path: "/guardian/ws",
      description: "WebSocket for dashboard monitoring and control",
      auth: "jwt",
      testable: false,
      category: "WebSocket",
    },
    // Adapters
    {
      method: "POST",
      path: "/adapters/ultravox/create-call",
      description: "Create Ultravox voice call with Stage Engine tools",
      auth: "api-key",
      testable: false,
      category: "Adapters",
    },
    {
      method: "POST",
      path: "/adapters/ultravox/store",
      description: "Ultravox tool wrapper for store (session_id in query)",
      auth: "jwt",
      testable: false,
      category: "Adapters",
    },
    {
      method: "POST",
      path: "/adapters/ultravox/fetch",
      description: "Ultravox tool wrapper for fetch (session_id in query)",
      auth: "jwt",
      testable: false,
      category: "Adapters",
    },
    {
      method: "POST",
      path: "/adapters/ultravox/advance",
      description: "Ultravox-specific advance with new-stage format",
      auth: "jwt",
      testable: false,
      category: "Adapters",
    },
  ],
};

// ---------------------------------------------------------------------------
// Shift MCP
// ---------------------------------------------------------------------------

const shiftMcp: ServiceContract = {
  serviceKey: "shift-mcp",
  endpoints: [
    {
      method: "GET",
      path: "/health",
      description: "Health check",
      auth: "none",
      testable: true,
    },
    {
      method: "POST",
      path: "/mcp",
      description:
        "MCP protocol handler — tools: create_shift, update_shift, list_shifts, get_shift, delete_shift",
      auth: "api-key",
      testable: false,
      category: "MCP",
    },
  ],
};

// ---------------------------------------------------------------------------
// Contract Service (15 endpoints)
// ---------------------------------------------------------------------------

const contractService: ServiceContract = {
  serviceKey: "contract-service",
  endpoints: [
    {
      method: "GET",
      path: "/health",
      description: "Health check",
      auth: "none",
      testable: true,
    },
    // Templates
    {
      method: "GET",
      path: "/templates",
      description: "List contract templates",
      auth: "service-key",
      testable: true,
      category: "Templates",
    },
    {
      method: "GET",
      path: "/templates/:id",
      description: "Get template by ID",
      auth: "service-key",
      testable: false,
      category: "Templates",
    },
    {
      method: "POST",
      path: "/templates",
      description: "Create contract template",
      auth: "service-key",
      testable: false,
      category: "Templates",
    },
    {
      method: "PUT",
      path: "/templates/:id",
      description: "Update an existing template",
      auth: "service-key",
      testable: false,
      category: "Templates",
    },
    {
      method: "DELETE",
      path: "/templates/:id",
      description: "Archive (soft delete) a template",
      auth: "service-key",
      testable: false,
      category: "Templates",
    },
    {
      method: "POST",
      path: "/templates/:id/sync",
      description: "Sync template to DocuSeal",
      auth: "service-key",
      testable: false,
      category: "Templates",
    },
    {
      method: "POST",
      path: "/templates/:id/preview",
      description: "Preview template with placeholder values",
      auth: "service-key",
      testable: false,
      category: "Templates",
    },
    // Contracts
    {
      method: "GET",
      path: "/contracts",
      description: "List contracts with filters",
      auth: "service-key",
      testable: true,
      category: "Contracts",
    },
    {
      method: "GET",
      path: "/contracts/:id",
      description: "Get contract by ID with event history",
      auth: "service-key",
      testable: false,
      category: "Contracts",
    },
    {
      method: "GET",
      path: "/contracts/:id/events",
      description: "Get contract event audit trail",
      auth: "service-key",
      testable: false,
      category: "Contracts",
    },
    {
      method: "POST",
      path: "/contracts",
      description: "Create contract from template",
      auth: "service-key",
      testable: false,
      category: "Contracts",
    },
    {
      method: "POST",
      path: "/contracts/:id/send",
      description: "Send contract for e-signing via DocuSeal",
      auth: "service-key",
      testable: false,
      category: "Contracts",
    },
    {
      method: "POST",
      path: "/contracts/:id/cancel",
      description: "Cancel a pending contract",
      auth: "service-key",
      testable: false,
      category: "Contracts",
    },
    // Webhooks
    {
      method: "POST",
      path: "/webhooks/docuseal",
      description: "DocuSeal webhook receiver (deprecated — use Next.js route)",
      auth: "none",
      testable: false,
      category: "Webhooks",
    },
  ],
};

// ---------------------------------------------------------------------------
// Scrapling (5 endpoints)
// ---------------------------------------------------------------------------

const scrapling: ServiceContract = {
  serviceKey: "scrapling",
  endpoints: [
    {
      method: "GET",
      path: "/health",
      description: "Health check",
      auth: "none",
      testable: true,
    },
    {
      method: "POST",
      path: "/extract",
      description: "Extract structured workspace data from a URL",
      auth: "none",
      testable: true,
      defaultBody: { url: "https://example.com" },
      category: "Scraping",
    },
    {
      method: "POST",
      path: "/scrape-raw",
      description: "Scrape raw HTML (title, text, images, files)",
      auth: "none",
      testable: true,
      defaultBody: { url: "https://example.com" },
      category: "Scraping",
    },
    {
      method: "POST",
      path: "/tripadvisor",
      description: "TripAdvisor scraper (not implemented — returns 501)",
      auth: "none",
      testable: false,
      category: "Scraping",
    },
  ],
};

// ---------------------------------------------------------------------------
// Bubble MCP (planned)
// ---------------------------------------------------------------------------

const bubbleMcp: ServiceContract = {
  serviceKey: "bubble-mcp",
  endpoints: [],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SERVICE_CONTRACTS: ServiceContract[] = [
  caddy,
  supabase,
  stageEngine,
  shiftMcp,
  contractService,
  scrapling,
  bubbleMcp,
];

export const CONTRACT_MAP = new Map(SERVICE_CONTRACTS.map((c) => [c.serviceKey, c]));
