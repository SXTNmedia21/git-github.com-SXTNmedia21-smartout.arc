"use client";

/**
 * hms-drift-tools-bridge.tsx — registers Botsson tools for /dashboard/hms/drift.
 *
 * Bridge calls useDriftInsights at the page level (admin only) and passes the
 * result down. Employee mode does not call the hook — passes null insights.
 *
 * ADR-0238: page does not own a domain chat surface.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useHmsDriftTools } from "./use-hms-drift-tools";
import type { DriftInsights } from "../../_hooks/use-drift-insights";

type HmsDriftToolsBridgeProps = {
  isAdminMode: boolean;
  date: string;
  loading: boolean;
  insights: DriftInsights | null;
};

export function HmsDriftToolsBridge(props: HmsDriftToolsBridgeProps) {
  const tools = useHmsDriftTools(props);
  useRegisterTools("hms-drift", tools);
  return null;
}
