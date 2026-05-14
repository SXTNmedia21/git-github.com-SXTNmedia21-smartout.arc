/**
 * capabilities-source.ts — CapabilitiesSource implementation.
 *
 * Reads from the existing capability registry (`packages/ai/src/capabilities/`)
 * and returns server-side capability tools eligible for a given channel + user.
 *
 * Design decisions:
 *  - Channel filtering is NOT applied here — that is the authority layer's job
 *    (ADR-0078). This source returns all capabilities across all channels.
 *  - Role filtering: optional static `minRoleConfig` map lets callers declare
 *    per-capability minimum-role requirements without touching `CapabilityDefinition`.
 *    Defaults to empty (everyone receives everything; authority enforces fine-grained
 *    access). This mirrors the `MinRoleConfig` pattern in `router/min-role.ts`.
 *  - Zod schema introspection: converts each tool's `z.ZodObject` schema into the
 *    `dynamicParameters` array expected by the LiveKit/Ultravox `ClientToolDefinition`
 *    shape. Non-object schemas (z.object({})) produce an empty parameters array.
 *  - Implementations wrap the tool's `execute` function into the `ClientToolImplementation`
 *    signature (params only, no AgentToolContext). Callers that need context must
 *    supply it via closure before passing to the harness. This matches the
 *    Phase 3 wiring plan where chat + voice consumers close over their context.
 *
 * Why a factory:
 *   - `minRoleConfig` injection makes the source unit-testable without mocking
 *     the registry (same rationale as `createSiteMapSource` accepting parsed JSON).
 *   - Production callers pass no config (empty map = full access, authority handles
 *     fine-grained filtering); tests inject a map to verify role filtering.
 */

import type { z } from "zod";
import { getAllCapabilities } from "../../capabilities/registry.js";
import { isRoleSufficient } from "../../router/min-role.js";
import type { ProfileRole } from "../../capabilities/types.js";
import type {
  CapabilitiesSource,
  Channel,
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolParameter,
  UserContext,
} from "../types.js";

/* ━━━ Role configuration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Per-capability minimum-role requirement.
 *
 * Key: capability name (matches `CapabilityDefinition.name`).
 * Value: the lowest role that may access this capability.
 *
 * Mirrors `MinRoleConfig` in `router/min-role.ts` but lives here so the
 * CapabilitiesSource can enforce it without coupling to the tool-selector.
 */
export type CapabilityMinRoleConfig = Record<string, ProfileRole>;

/* ━━━ Zod schema → dynamicParameters ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Maps a Zod type name to the JSON Schema `type` string used in
 * `ClientToolParameter.schema`. Unknown types fall back to `"string"`.
 */
function zodTypeNameToJsonType(
  typeName: string,
): "string" | "number" | "boolean" | "object" | "array" {
  switch (typeName) {
    case "ZodString":
    case "ZodEnum":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return "array";
    case "ZodObject":
      return "object";
    default:
      return "string";
  }
}

/**
 * Resolves the inner Zod field type, unwrapping `ZodOptional` and
 * `ZodNullable` wrappers one level deep.
 */
function resolveInnerType(field: z.ZodTypeAny): {
  typeDef: z.ZodTypeDef & { typeName: string };
  isOptional: boolean;
} {
  const typeName = (field._def as { typeName: string }).typeName;
  const optional = field.isOptional();

  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    const inner = (field._def as { innerType: z.ZodTypeAny }).innerType;
    return {
      typeDef: inner._def as z.ZodTypeDef & { typeName: string },
      isOptional: true,
    };
  }

  return { typeDef: field._def as z.ZodTypeDef & { typeName: string }, isOptional: optional };
}

/**
 * Builds the `schema` entry for a single `ClientToolParameter`.
 *
 * Matches the `ClientToolParameter.schema` union from harness/types.ts.
 * For `ZodEnum`, attaches the `enum` values array.
 * For other types, returns the minimal variant of the union.
 */
function buildParameterSchema(
  typeDef: z.ZodTypeDef & { typeName: string },
): ClientToolParameter["schema"] {
  const jsonType = zodTypeNameToJsonType(typeDef.typeName);

  if (typeDef.typeName === "ZodEnum") {
    const enumDef = typeDef as z.ZodTypeDef & { typeName: string; values: string[] };
    return { type: "string", enum: enumDef.values };
  }

  if (jsonType === "string") return { type: "string" };
  if (jsonType === "number") return { type: "number" };
  if (jsonType === "boolean") return { type: "boolean" };
  if (jsonType === "array") return { type: "array" };
  return { type: "object" };
}

/**
 * Converts a `SmartoutTool`'s Zod schema (expected to be `z.ZodObject`) into
 * the `dynamicParameters` array for a `ClientToolDefinition`.
 *
 * If the schema is not a `ZodObject` (e.g. tools with `z.object({})` have no
 * required parameters), returns an empty array rather than throwing.
 */
function zodSchemaToDynamicParameters(schema: z.ZodTypeAny): ClientToolParameter[] {
  const typeName = (schema._def as { typeName: string }).typeName;
  if (typeName !== "ZodObject") {
    return [];
  }

  const objectDef = schema._def as {
    typeName: string;
    shape: () => Record<string, z.ZodTypeAny>;
  };

  const shape = objectDef.shape();
  const params: ClientToolParameter[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const { typeDef, isOptional } = resolveInnerType(fieldSchema);
    const paramSchema = buildParameterSchema(typeDef);

    // Prefer .describe() text from the outer field; fall back to the resolved
    // inner type's description (present when .describe() is called before .optional()).
    const outerDescription = (fieldSchema._def as { description?: string }).description;
    const innerDescription = (typeDef as { description?: string }).description;
    const description = outerDescription ?? innerDescription ?? "";

    params.push({
      name: fieldName,
      location: "PARAMETER_LOCATION_BODY",
      description,
      required: !isOptional,
      schema: paramSchema,
    });
  }

  return params;
}

/* ━━━ Implementation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

class CapabilitiesSourceImpl implements CapabilitiesSource {
  readonly #minRoleConfig: CapabilityMinRoleConfig;

  constructor(minRoleConfig: CapabilityMinRoleConfig) {
    this.#minRoleConfig = minRoleConfig;
  }

  async getToolsFor(
    _channel: Channel,
    userContext: UserContext,
  ): Promise<{
    definitions: ClientToolDefinition[];
    implementations: Record<string, ClientToolImplementation>;
  }> {
    // Channel is intentionally ignored here — authority layer applies channel
    // restrictions (ADR-0078). This source returns the full eligible set.
    const capabilities = getAllCapabilities();

    const definitions: ClientToolDefinition[] = [];
    const implementations: Record<string, ClientToolImplementation> = {};

    for (const capability of capabilities) {
      // Role gate: if a minimum role is configured for this capability,
      // skip the entire capability when the user's role is insufficient.
      const minRole = this.#minRoleConfig[capability.name];
      if (minRole !== undefined && !isRoleSufficient(userContext.role, minRole)) {
        continue;
      }

      for (const tool of capability.tools) {
        const dynamicParameters = zodSchemaToDynamicParameters(
          tool.schema as unknown as z.ZodTypeAny,
        );

        const definition: ClientToolDefinition = {
          temporaryTool: {
            modelToolName: tool.name,
            description: tool.description,
            dynamicParameters,
            client: {},
          },
        };

        definitions.push(definition);

        // Wrap execute into the ClientToolImplementation signature.
        // The execute function receives (params, ctx) but ClientToolImplementation
        // only passes params. Production callers close over their AgentToolContext
        // before calling the harness (Phase 3 wiring). For the harness layer, the
        // implementation returns a "not-yet-wired" notice if called without context.
        //
        // This is intentional: the CapabilitiesSource role is to build the tool
        // surface (definitions + implementations index) — actual execution context
        // is injected by the Phase 3 consumer adapter.
        const toolName = tool.name;
        // Phase 3 consumer adapters will replace these stubs with real wired
        // implementations that close over an AgentToolContext. The source only
        // registers the implementation index so the harness can build the bundle
        // shape; actual execution is a Phase 3 concern.
        implementations[toolName] = async (_params: Record<string, unknown>) => {
          return `Tool "${toolName}" requires agent context — wire via Phase 3 consumer adapter.`;
        };
      }
    }

    return { definitions, implementations };
  }
}

/* ━━━ Factory ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * Create a {@link CapabilitiesSource} that reads from the capability registry.
 *
 * @param minRoleConfig - Optional per-capability minimum role requirements.
 *   Key: capability name. Value: minimum ProfileRole (employee|manager|admin|owner).
 *   Defaults to empty map — all capabilities are available to all roles; the
 *   authority layer handles fine-grained access control.
 *
 * Usage (production — no role restrictions at this layer):
 * ```ts
 * const source = createCapabilitiesSource();
 * const { definitions, implementations } = await source.getToolsFor("chat", userCtx);
 * ```
 *
 * Usage (with static role gates):
 * ```ts
 * const source = createCapabilitiesSource({ business_intelligence: "admin" });
 * ```
 */
export function createCapabilitiesSource(
  minRoleConfig: CapabilityMinRoleConfig = {},
): CapabilitiesSource {
  return new CapabilitiesSourceImpl(minRoleConfig);
}
