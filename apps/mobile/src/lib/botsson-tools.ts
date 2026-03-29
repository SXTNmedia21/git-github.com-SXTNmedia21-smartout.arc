/**
 * Mobile client tools for Botsson agent.
 *
 * These tools run client-side in the mobile app and allow the AI agent
 * to perform UI actions: navigate screens, open sheets, show toasts,
 * trigger punch flow, or call the team leader.
 *
 * Prefix: "mobile_" to avoid collision with web tools.
 * Registered via Botsson provider session params.
 */

import { router } from "expo-router";
import { Linking, Alert } from "react-native";
import * as Haptics from "expo-haptics";

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
 * Call the team leader via phone dialer.
 */
const callLeader: MobileToolDefinition = {
  name: "mobile_call_leader",
  description: "Call the team leader via phone. Requires leader_phone parameter.",
  parameters: {
    leader_phone: {
      type: "string",
      description: "Phone number of the team leader (e.g. +4712345678)",
      required: true,
    },
    leader_name: {
      type: "string",
      description: "Name of the leader (for confirmation)",
    },
  },
  handler: async (params) => {
    const phone = params.leader_phone;
    if (!phone) return "Error: no leader phone number available";
    const url = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return "Cannot open phone dialer on this device";
    await Linking.openURL(url);
    return `Calling ${params.leader_name ?? "leader"} at ${phone}`;
  },
};

/** All mobile client tools, ready for registration */
export const MOBILE_CLIENT_TOOLS: MobileToolDefinition[] = [
  navigateTo,
  openSheet,
  showToast,
  startPunch,
  callLeader,
];

/**
 * Execute a mobile client tool by name.
 * Returns the tool result string, or an error message if not found.
 */
export async function executeMobileTool(
  toolName: string,
  params: Record<string, string>,
): Promise<string> {
  const tool = MOBILE_CLIENT_TOOLS.find((t) => t.name === toolName);
  if (!tool) return `Unknown mobile tool: ${toolName}`;
  return tool.handler(params);
}
