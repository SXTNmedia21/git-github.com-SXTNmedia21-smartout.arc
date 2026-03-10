export type ServiceStatus = "active" | "planned";

export type ServiceDef = {
  name: string;
  key: string;
  description: string;
  port: number;
  healthPath: string;
  status: ServiceStatus;
  dockerContainer?: string;
  docsUrl?: string;
  envVarKeys: string[];
  relatedApiCategories: string[];
  relatedApiServices: string[];
};

export const SERVICE_REGISTRY: ServiceDef[] = [
  // --- Infrastructure ---
  {
    name: "Caddy",
    key: "caddy",
    description: "Reverse proxy and HTTPS gateway for all services",
    port: 80,
    healthPath: "/",
    status: "active",
    dockerContainer: "caddy",
    envVarKeys: [],
    relatedApiCategories: [],
    relatedApiServices: [],
  },
  {
    name: "Supabase",
    key: "supabase",
    description: "Database, Auth, Storage, Realtime, Edge Functions",
    port: 54321,
    healthPath: "/rest/v1/",
    status: "active",
    docsUrl: "https://supabase.com/docs",
    envVarKeys: ["supabase_url", "supabase_anon_key", "supabase_service_role"],
    relatedApiCategories: ["edge-function"],
    relatedApiServices: ["supabase"],
  },

  // --- Microservices ---
  {
    name: "Stage Engine",
    key: "stage-engine",
    description: "Hono-based mission and agent conversation engine",
    port: 5010,
    healthPath: "/health",
    status: "active",
    dockerContainer: "stage-engine",
    envVarKeys: ["stage_engine_url", "stage_engine_api_key"],
    relatedApiCategories: [],
    relatedApiServices: [],
  },
  {
    name: "Shift MCP",
    key: "shift-mcp",
    description: "MCP server for schedule and shift operations",
    port: 5011,
    healthPath: "/health",
    status: "active",
    dockerContainer: "shift-mcp",
    envVarKeys: [],
    relatedApiCategories: [],
    relatedApiServices: [],
  },
  {
    name: "Contract Service",
    key: "contract-service",
    description: "Fastify service for employment contracts and DocuSeal",
    port: 5012,
    healthPath: "/health",
    status: "active",
    dockerContainer: "contract-service",
    envVarKeys: ["docuseal", "docuseal_webhook_secret"],
    relatedApiCategories: ["contract-service"],
    relatedApiServices: ["contract-service"],
  },
  {
    name: "Scrapling Service",
    key: "scrapling",
    description: "Python web scraper for workspace intelligence gathering",
    port: 8000,
    healthPath: "/health",
    status: "active",
    dockerContainer: "scrapling",
    envVarKeys: [],
    relatedApiCategories: [],
    relatedApiServices: [],
  },

  // --- Planned ---
  {
    name: "Bubble MCP",
    key: "bubble-mcp",
    description: "MCP server for Bubble.io data migration and sync",
    port: 5014,
    healthPath: "/health",
    status: "planned",
    dockerContainer: "bubble-mcp",
    envVarKeys: [],
    relatedApiCategories: [],
    relatedApiServices: [],
  },
];
