import type {
  ClientTool,
  ClientToolKit,
  ClientToolDefinition,
  ClientToolImplementation,
} from "../types";

/**
 * Builds a ClientToolKit from an array of ClientTool definitions.
 *
 * This converts the SDK's ClientTool format into the Ultravox-compatible
 * `{ definitions, implementations }` shape used by voice providers.
 */
export function buildToolKit(tools: ClientTool[]): ClientToolKit {
  const definitions: ClientToolDefinition[] = tools.map((tool) => ({
    temporaryTool: {
      modelToolName: tool.name,
      description: tool.description,
      dynamicParameters: tool.parameters,
      client: {},
    },
  }));

  const implementations: Record<string, ClientToolImplementation> = {};
  for (const tool of tools) {
    implementations[tool.name] = tool.implementation;
  }

  return { definitions, implementations };
}

/**
 * Creates a mutable tool registry that can register and look up tools.
 */
export function createToolRegistry() {
  const tools = new Map<string, ClientTool>();

  return {
    /** Register a single client tool */
    register(tool: ClientTool): void {
      tools.set(tool.name, tool);
    },

    /** Register multiple client tools at once */
    registerAll(toolList: ClientTool[]): void {
      for (const tool of toolList) {
        tools.set(tool.name, tool);
      }
    },

    /** Look up a tool by name */
    get(name: string): ClientTool | undefined {
      return tools.get(name);
    },

    /** Check if a tool is registered */
    has(name: string): boolean {
      return tools.has(name);
    },

    /** Get all registered tools */
    getAll(): ClientTool[] {
      return Array.from(tools.values());
    },

    /** Build a ClientToolKit from all registered tools */
    toToolKit(): ClientToolKit {
      return buildToolKit(Array.from(tools.values()));
    },

    /** Remove a tool by name */
    remove(name: string): boolean {
      return tools.delete(name);
    },

    /** Clear all registered tools */
    clear(): void {
      tools.clear();
    },
  };
}

export type ToolRegistry = ReturnType<typeof createToolRegistry>;
