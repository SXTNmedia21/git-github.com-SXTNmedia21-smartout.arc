"use client";

/**
 * hms-documents-tools-bridge.tsx — registers Botsson tools for
 * /dashboard/hms/documents.
 *
 * ADR-0238: page does not own a domain chat surface.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHmsDocumentsTools } from "./use-hms-documents-tools";
import type { DocumentSelection } from "../../_components/DocumentBrowser";

type HmsDocumentsToolsBridgeProps = {
  selection: DocumentSelection | null;
  clearSelection: () => void;
};

export function HmsDocumentsToolsBridge(props: HmsDocumentsToolsBridgeProps) {
  const tools = useHmsDocumentsTools(props);
  useRegisterTools("hms-documents", tools);
  return null;
}
