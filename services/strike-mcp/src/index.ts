#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadConfig, ConfigError } from "./config.js";
import { createLogger } from "./logger.js";
import { BubbleClient } from "./bubble/client.js";
import { listWorkspacesTool } from "./tools/list_workspaces.js";
import { inspectWorkspaceTool } from "./tools/inspect_workspace.js";
import { researchEntityTool } from "./tools/research_entity.js";
import { migrateWorkspaceTool } from "./tools/migrate_workspace.js";
import { migrateLocationsTool } from "./tools/migrate_locations.js";
import { planMigrationTool } from "./tools/plan_migration.js";
import { previewSqlTool } from "./tools/preview_sql.js";
import { verifyTargetEmptyTool } from "./tools/verify_target_empty.js";
import { bundleMigrationTool } from "./tools/bundle_migration.js";
import { SupabaseReadClient } from "./supabase/client.js";

const log = createLogger("server");

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    if (err instanceof ConfigError) {
      log.error("config error", { message: err.message });
      process.exit(1);
    }
    throw err;
  }

  const bubble = new BubbleClient(config);
  const supabase =
    config.supabaseUrl && config.supabaseAnonKey
      ? new SupabaseReadClient({
          url: config.supabaseUrl,
          anonKey: config.supabaseAnonKey,
        })
      : null;
  const ctx = {
    bubble,
    mappingsDir: config.mappingsDir,
    vaultBubbleShapesDir: config.vaultBubbleShapesDir,
    stagingDir: config.stagingDir,
    supabase,
  };

  const server = new Server(
    { name: "strike-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const tools = [
    listWorkspacesTool,
    inspectWorkspaceTool,
    researchEntityTool,
    migrateWorkspaceTool,
    migrateLocationsTool,
    planMigrationTool,
    previewSqlTool,
    verifyTargetEmptyTool,
    bundleMigrationTool,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
    const parsed = tool.inputSchema.parse(request.params.arguments ?? {});
    const result = await tool.execute(parsed as never, ctx);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info("server started", { tools: tools.length });
}

main().catch((err) => {
  log.error("fatal", { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
