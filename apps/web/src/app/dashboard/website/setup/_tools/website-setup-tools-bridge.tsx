"use client";

/**
 * website-setup-tools-bridge.tsx — registers Botsson tools for /dashboard/website/setup.
 *
 * Hosted inside SetupWizard so it captures live step, templateKey, name, and
 * available template state. Returns null.
 *
 * ADR-0238: /dashboard/website/setup has no embedded domain chat surface.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useWebsiteSetupTools, type WebsiteSetupToolInput } from "./use-website-setup-tools";

export function WebsiteSetupToolsBridge(props: WebsiteSetupToolInput) {
  const tools = useWebsiteSetupTools(props);
  useRegisterTools("website-setup", tools);
  return null;
}
