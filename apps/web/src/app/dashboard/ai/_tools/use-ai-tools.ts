"use client";

/**
 * use-ai-tools.ts — Botsson tools for the /dashboard/ai surface.
 *
 * Three tools: 2 read, 1 nav.
 *   getAiOverview       — summary of what Mr. Botsson is and which sub-pages exist
 *   getAuthorityConfig  — current authority levels for all 8 capabilities
 *   navigateToConfig    — navigate to /dashboard/ai/config
 *
 * The page is a static index (Server Component) with no mutations.
 * Authority data lives in the parent hook useAuthorityConfig (client);
 * this hook receives it via props through the bridge so we never double-fetch.
 *
 * dataRef pattern (same as use-notifications-tools.ts / use-komm-tools.ts)
 * keeps definitions stable while reading live data on every invocation.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { AuthorityConfigMap, CapabilityName } from "../_hooks/use-authority-config";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type AiToolsInput = {
  /** Current authority config map from useAuthorityConfig. Null while loading. */
  authorityConfig: AuthorityConfigMap | null;
  /** Client-side navigation handler — e.g. router.push */
  navigate: (path: string) => void;
};

const CAPABILITY_LABELS: Record<CapabilityName, string> = {
  knowledge: "Kunnskap",
  schedule: "Vaktplan",
  training: "Opplæring",
  operations: "Drift",
  profile: "Profil",
  communication: "Kommunikasjon",
  memory: "Hukommelse",
  payroll: "Lønn",
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useAiTools(input: AiToolsInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getAiOverview",
          description:
            "Get an overview of Mr. Botsson and the AI configuration surface. Use when the user asks 'hva er Botsson?', 'hva kan AI-assistenten gjøre?', or navigates to /dashboard/ai.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getAuthorityConfig",
          description:
            "Get the current authority levels for all 8 Mr. Botsson capabilities (knowledge, schedule, training, operations, profile, communication, memory, payroll). Use when user asks 'hva kan Botsson gjøre?' or 'hvilke tillatelser har AI-en?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateToConfig",
          description:
            "Navigate to /dashboard/ai/config to open Mr. Botsson's authority configuration page. Use when user wants to change what Botsson is allowed to do.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getAiOverview: () => {
        return JSON.stringify({
          page: "/dashboard/ai",
          title: "Mr. Botsson",
          description: "AI-kollega for ansatte. Kontrolleres via autoritetsnivåer per kapabilitet.",
          subPages: [
            {
              path: "/dashboard/ai/config",
              label: "Konfigurasjon",
              description: "Kontroller autoritetsnivåer for Mr. Botssons kapabiliteter",
            },
          ],
          chatComingSoon: true,
        });
      },

      getAuthorityConfig: () => {
        const d = dataRef.current;

        if (!d.authorityConfig) {
          return JSON.stringify({
            ok: false,
            reason: "Authority config not yet loaded. Try again in a moment.",
          });
        }

        const capabilities = Object.entries(d.authorityConfig).map(([cap, level]) => ({
          capability: cap as CapabilityName,
          label: CAPABILITY_LABELS[cap as CapabilityName] ?? cap,
          level,
        }));

        return JSON.stringify({
          ok: true,
          capabilities,
          configPage: "/dashboard/ai/config",
        });
      },

      navigateToConfig: () => {
        const d = dataRef.current;
        d.navigate("/dashboard/ai/config");
        return JSON.stringify({ ok: true, navigatedTo: "/dashboard/ai/config" });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
