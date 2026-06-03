"use client";

/**
 * oversikt-tools-bridge.tsx — registers Botsson read tools for the OversiktCockpit
 * (admin default view) inside the harness tool-registry.
 *
 * Why a bridge:
 *  - OversiktCockpitClient is already a client component but tool registration
 *    must be isolated so the registry cleanup on unmount doesn't race with
 *    sibling renders.
 *  - Receives a serialized snapshot of cockpit data via props — never fetches
 *    independently (no duplicate queries).
 *
 * Tools registered (scope: "oversikt-cockpit"):
 *   getOversiktSnapshot  — returns a read-only summary of the current cockpit
 *                          state (pulse counts, action queue length, staffing).
 *                          Use when the user asks "hva skjer i dag?" or needs
 *                          an operational status overview.
 *   navigateToDomain     — pushes the router to a dashboard sub-route by slug.
 *                          Use when the user asks to go to vaktplan, oppgaver,
 *                          avstemming, or kommunikasjon.
 *
 * dataRef pattern (Phase 7.5 §1): definitions are stable (useMemo([], [])).
 * Implementations read live state via dataRef refreshed on every render.
 *
 * No write tools — oversikt is a read surface. All mutations live on the
 * sub-domain pages (oppgaver, vaktplan, etc.).
 *
 * ADR-0238: page does not own a domain chat surface. No <DomainChatOwnership>
 * needed here — Orb runs in interactive mode on the oversikt surface.
 *
 * ADR-0244: no financial mutation tools.
 */

import { useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { DesignOversikt } from "../to-design-shape";

// ---------------------------------------------------------------------------
// Route mapping — mirrors OversiktCockpit's ROUTE_MAP
// ---------------------------------------------------------------------------
const ROUTE_MAP: Record<string, string> = {
  vaktplan: "/dashboard/vaktplan",
  oppgaver: "/dashboard/oppgaver",
  avstemming: "/dashboard/avstemming",
  kommunikasjon: "/dashboard/kommunikasjon",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
type OversiktToolsBridgeProps = {
  workspaceId: string;
  actorId: string;
  designData: DesignOversikt;
};

// ---------------------------------------------------------------------------
// Hook: useOversiktTools
// ---------------------------------------------------------------------------
function useOversiktTools(input: {
  designData: DesignOversikt;
  navigate: (slug: string) => void;
}): ClientToolKit {
  // dataRef keeps implementations closure-free (Phase 7.5 §1)
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  // Stable definitions — never recreated
  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getOversiktSnapshot",
          description:
            "Returnerer et øyeblikksbilde av dagens operasjonelle status: bemanningsnivå, " +
            "ventende godkjenninger, uleste meldinger og kritiske handlinger. " +
            "Bruk når brukeren spør 'hva skjer i dag?', trenger en status-oppsummering, " +
            "eller vil vite om det finnes kritiske oppgaver akkurat nå.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateToDomain",
          description:
            "Navigerer til en underside i dashbordet basert på domenenavn. " +
            "Gyldige mål: 'vaktplan', 'oppgaver', 'avstemming', 'kommunikasjon'. " +
            "Bruk når brukeren eksplisitt ber om å gå til et bestemt område, f.eks. " +
            "'vis meg vaktplanen' eller 'ta meg til oppgaver'.",
          dynamicParameters: [
            {
              name: "slug",
              location: "PARAMETER_LOCATION_BODY" as const,
              description: "Domene-slug for destinasjonsruten.",
              schema: {
                type: "string",
                enum: ["vaktplan", "oppgaver", "avstemming", "kommunikasjon"],
                description: "Domene-slug for destinasjonsruten.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  // Stable implementations that read live data via dataRef
  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getOversiktSnapshot: () => {
        const { designData } = dataRef.current;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            snapshot: {
              onShift: designData.pulse.onShift,
              onShiftUnit: designData.pulse.onShiftUnit,
              mustResolve: designData.pulse.mustResolve,
              pendingApprovals: designData.pulse.pendingApprovals,
              unread: designData.pulse.unread,
              coveragePct: designData.pulse.coveragePct,
              gapCount: designData.gapCount,
              resolveCount: designData.resolveCount,
              actionQueueLength: designData.actions.length,
              staffSummary: designData.staffSummary,
              dateLabel: designData.dateLabel,
            },
          }),
        );
      },
      navigateToDomain: (params: Record<string, unknown>) => {
        const slug = String(params.slug ?? "");
        const path = ROUTE_MAP[slug];
        if (!path) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              error: `Ukjent domene-slug: "${slug}". Gyldige valg: ${Object.keys(ROUTE_MAP).join(", ")}.`,
            }),
          );
        }
        dataRef.current.navigate(slug);
        return Promise.resolve(JSON.stringify({ ok: true, navigatedTo: path }));
      },
    }),
    [],
  );

  return useMemo<ClientToolKit>(
    () => ({ definitions, implementations }),
    [definitions, implementations],
  );
}

// ---------------------------------------------------------------------------
// Bridge component
// ---------------------------------------------------------------------------
export function OversiktToolsBridge({
  workspaceId: _workspaceId,
  actorId: _actorId,
  designData,
}: OversiktToolsBridgeProps) {
  const router = useRouter();
  const navigate = useMemo(
    () => (slug: string) => {
      const path = ROUTE_MAP[slug] ?? `/dashboard/${slug}`;
      router.push(path);
    },
    [router],
  );

  const tools = useOversiktTools({ designData, navigate });
  useRegisterTools("oversikt-cockpit", tools);

  return null;
}
