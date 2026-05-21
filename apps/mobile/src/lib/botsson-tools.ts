/**
 * Mobile client tools for Botsson agent.
 *
 * These tools run client-side in the mobile app and allow the AI agent
 * to perform UI actions: navigate screens, open sheets, show toasts,
 * trigger punch flow, or call the team leader.
 *
 * Prefix: "mobile_" to avoid collision with web tools.
 * Registered via Botsson provider session params.
 *
 * ADR-0378 R7 + ADR-0078: tool schemas and wire arguments MUST NOT carry PII.
 * `mobile_call_leader` resolves the leader phone locally (via `phoneResolver`)
 * and never includes a phone number in the published tool-call arguments.
 */

import { router } from "expo-router";
import { Linking, Alert } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Resolves the team leader's phone number client-side, without the phone
 * ever appearing on the voice wire.
 *
 * Injected at session-start by `use-botsson-voice-session.ts`.
 * Returns null when no leader or no phone is on file.
 */
export type LeaderPhoneResolver = () => Promise<string | null>;

export type MobileToolHandler = (params: Record<string, string>) => Promise<string>;

export type MobileToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  handler: MobileToolHandler;
};

/**
 * Navigate to a screen in the mobile app.
 * The agent calls this to direct the user to relevant content.
 */
const navigateTo: MobileToolDefinition = {
  name: "mobile_navigate_to",
  description: "Navigate to a screen in the mobile app",
  parameters: {
    route: {
      type: "string",
      description: "The Expo Router path to navigate to, e.g. /(app)/(shifts)/shift-123",
      required: true,
    },
  },
  handler: async (params) => {
    const route = params.route;
    if (!route) return "Error: route is required";
    router.push(route as never);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return `Navigated to ${route}`;
  },
};

/**
 * Open a bottom sheet (punch, deviation, HACCP).
 * Triggers a global event that the relevant sheet listens to.
 */
const openSheet: MobileToolDefinition = {
  name: "mobile_open_sheet",
  description: "Open a bottom sheet in the app (punch clock, deviation form, HACCP form)",
  parameters: {
    sheet: {
      type: "string",
      description: "Sheet to open: 'punch' | 'deviation' | 'haccp'",
      required: true,
    },
  },
  handler: async (params) => {
    const sheet = params.sheet;
    const routeMap: Record<string, string> = {
      punch: "/(app)/(shifts)/punch",
      deviation: "/(app)/(home)/deviation",
      haccp: "/(app)/(home)/haccp",
    };
    const route = routeMap[sheet];
    if (!route) return `Unknown sheet: ${sheet}. Valid options: punch, deviation, haccp`;
    router.push(route as never);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return `Opened ${sheet} sheet`;
  },
};

/**
 * Show a toast notification to the user.
 */
const showToast: MobileToolDefinition = {
  name: "mobile_show_toast",
  description: "Show a brief notification message to the user",
  parameters: {
    message: {
      type: "string",
      description: "The toast message to display",
      required: true,
    },
  },
  handler: async (params) => {
    const message = params.message;
    if (!message) return "Error: message is required";
    // React Native doesn't have a built-in toast — use Alert as fallback
    // In production, this would use a toast library or custom component
    Alert.alert("", message);
    return `Toast shown: ${message}`;
  },
};

/**
 * Start the punch in/out flow.
 */
const startPunch: MobileToolDefinition = {
  name: "mobile_start_punch",
  description: "Navigate to the punch clock to punch in or out",
  parameters: {},
  handler: async () => {
    router.push("/(app)/(shifts)/punch" as never);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    return "Opened punch clock";
  },
};

/**
 * Build the `mobile_call_leader` tool.
 *
 * ADR-0378 R7: phone number is NOT a tool parameter.
 * The agent passes `leader_name` only (for acknowledgement text). The phone is
 * resolved locally via `phoneResolver` so it never crosses the LiveKit
 * `botsson-tool-call` wire. Fail-fast: if the resolver returns null, the tool
 * returns an error string without opening the dialer.
 *
 * @param phoneResolver - Injected at session-start; resolves leader phone from
 *   local DB chain (team_member → team → profile → user_identity).
 */
function buildCallLeader(phoneResolver: LeaderPhoneResolver): MobileToolDefinition {
  return {
    name: "mobile_call_leader",
    description:
      "Call the team leader via phone. No phone number in arguments — mobile resolves phone locally.",
    parameters: {
      leader_name: {
        type: "string",
        description: "Name of the leader (used in confirmation text only)",
      },
    },
    handler: async (params) => {
      // Resolve phone locally — never from tool params (ADR-0078 + ADR-0378 R7).
      const phone = await phoneResolver();
      if (!phone) {
        return "Ingen leder er tilgjengelig med telefonnummer. Bruk chat for å ta kontakt.";
      }
      const url = `tel:${phone}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) return "Kan ikke åpne telefon på denne enheten.";
      await Linking.openURL(url);
      return `Ringer ${params.leader_name ?? "leder"}.`;
    },
  };
}

// ── ClientToolDefinition wire shape ──────────────────────────────────────────

/**
 * ClientToolDefinition shape (matches packages/ai/src/harness/types.ts).
 * Duplicated locally to avoid cross-package dep mobile → @smartout/ai.
 * voice-agent's DataReceived handler validates { definitions: ClientToolDefinition[] }
 * and uses `temporaryTool.modelToolName` as the key for stub lookup.
 */
export type ClientToolDefinitionShape = {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: string;
      description: string;
      required?: boolean;
      schema:
        | { type: "string"; enum?: string[] }
        | { type: "number" }
        | { type: "boolean" }
        | { type: "object"; properties?: Record<string, unknown> }
        | { type: "array"; items?: unknown };
    }>;
    client: Record<string, never>;
  };
};

// ── Session-scoped tool bundle ────────────────────────────────────────────────

/**
 * Runtime context injected at session-start.
 *
 * `phoneResolver` is the only dependency today — it resolves the leader phone
 * locally so the wire never carries PII (ADR-0378 R7 + ADR-0078).
 */
export type MobileToolDeps = {
  phoneResolver: LeaderPhoneResolver;
};

/**
 * Session-scoped tool bundle.
 * Create once per voice session via `createMobileClientTools`.
 * Re-creating between sessions is safe — each bundle is independent.
 */
export type MobileToolBundle = {
  /** All tools, including `mobile_call_leader` with injected resolver. */
  tools: MobileToolDefinition[];
  /** Execute a tool by name. Returns error string if unknown. */
  executeTool: (toolName: string, params: Record<string, string>) => Promise<string>;
  /**
   * Wire definitions for `botsson-tools-register` registration.
   * No PII in schemas — `leader_phone` is absent from `mobile_call_leader`.
   */
  getDefinitionsForRegistration: () => ClientToolDefinitionShape[];
};

/**
 * Build the session-scoped mobile tool bundle.
 *
 * ADR-0378 R7: `phoneResolver` is injected here so `mobile_call_leader` can
 * resolve the leader phone locally without it ever appearing in tool params or
 * crossing the LiveKit `botsson-tool-call` wire.
 *
 * @example
 *   const { profileId } = await getProfileContext();
 *   const bundle = createMobileClientTools({
 *     phoneResolver: () => fetchLeaderPhone(profileId),
 *   });
 */
export function createMobileClientTools(deps: MobileToolDeps): MobileToolBundle {
  const tools: MobileToolDefinition[] = [
    navigateTo,
    openSheet,
    showToast,
    startPunch,
    buildCallLeader(deps.phoneResolver),
  ];

  return {
    tools,

    executeTool: async (toolName, params) => {
      const tool = tools.find((t) => t.name === toolName);
      if (!tool) return `Unknown mobile tool: ${toolName}`;
      return tool.handler(params);
    },

    getDefinitionsForRegistration: () =>
      tools.map((tool) => ({
        temporaryTool: {
          modelToolName: tool.name,
          description: tool.description,
          dynamicParameters: Object.entries(tool.parameters).map(([paramName, paramDef]) => ({
            name: paramName,
            location: "body",
            description: paramDef.description,
            required: paramDef.required === true,
            schema: {
              type: paramDef.type as "string" | "number" | "boolean" | "object" | "array",
            },
          })),
          client: {} as Record<string, never>,
        },
      })),
  };
}

// ── Legacy shims (deprecated) ─────────────────────────────────────────────────
// Callers that have not yet migrated to createMobileClientTools() can still
// import executeMobileTool / getToolDefinitionsForRegistration. The shim builds
// a bundle with a no-op resolver: `mobile_call_leader` will always return the
// "no phone" error until the call site injects a real resolver.

const _legacyBundle = createMobileClientTools({
  phoneResolver: async () => null,
});

/** @deprecated Use createMobileClientTools() with a real phoneResolver. */
export const MOBILE_CLIENT_TOOLS: MobileToolDefinition[] = _legacyBundle.tools;

/** @deprecated Use createMobileClientTools().executeTool() instead. */
export async function executeMobileTool(
  toolName: string,
  params: Record<string, string>,
): Promise<string> {
  return _legacyBundle.executeTool(toolName, params);
}

/** @deprecated Use createMobileClientTools().getDefinitionsForRegistration() instead. */
export function getToolDefinitionsForRegistration(): ClientToolDefinitionShape[] {
  return _legacyBundle.getDefinitionsForRegistration();
}
