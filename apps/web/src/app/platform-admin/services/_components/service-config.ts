export type ServiceDef = {
  name: string;
  key: string;
  description: string;
  port: number;
  healthPath: string;
};

export const SERVICE_REGISTRY: ServiceDef[] = [
  {
    name: "Stage Engine",
    key: "stage-engine",
    description: "Hono-based mission and agent conversation engine",
    port: 3000,
    healthPath: "/health",
  },
  {
    name: "Shift MCP",
    key: "shift-mcp",
    description: "MCP server for schedule and shift operations",
    port: 3001,
    healthPath: "/health",
  },
  {
    name: "Contract Service",
    key: "contract-service",
    description: "Fastify service for employment contracts and DocuSeal",
    port: 3100,
    healthPath: "/health",
  },
];
