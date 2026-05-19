"use client";

/**
 * website-page-editor-tools-bridge.tsx — registers Botsson tools for /dashboard/website/pages/[pageId].
 *
 * Hosted inside SectionEditor so it captures live page title, sections, and save state.
 * Returns null. Tools are unregistered automatically on unmount (route change).
 *
 * ADR-0238: /dashboard/website/pages/[pageId] has no embedded domain chat surface.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 * PII safety: section content (may include spokesperson text) is never exposed via tools.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import {
  useWebsitePageEditorTools,
  type WebsitePageEditorToolInput,
} from "./use-website-page-editor-tools";

export function WebsitePageEditorToolsBridge(props: WebsitePageEditorToolInput) {
  const tools = useWebsitePageEditorTools(props);
  useRegisterTools("website-page-editor", tools);
  return null;
}
