"use client";

/**
 * use-locations-tools.ts — Botsson tools for the /dashboard/organization/locations/[id] surface.
 *
 * Four tools — 2 read, 1 read/detail, 1 nav:
 *   listLocations        — all D1 locations with zone + asset + capacity summary
 *   getLocationDetail    — full detail for the currently-open location
 *   listLocationZones    — zones belonging to the open location (active + inactive)
 *   listLocationAssets   — assets belonging to the open location
 *
 * No write tools — creates/edits/toggles are owner-driven UI actions
 * (EditLocationDialog, CreateZoneDialog etc). Botsson reads and surfaces
 * data; the operator drives mutations.
 *
 * dataRef pattern: definitions stable via useMemo([], []), live state
 * read on every invocation. Same pattern as use-organization-tools.ts.
 *
 * ADR-0151: workspace_id resolved auth-side from DashboardContext — never body-supplied.
 * ADR-0238: page does not own a domain chat surface.
 * Cascade: location is a D1-Envelope entity — permanent structural unit.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { LocationRow, ZoneRow, AssetRow } from "../../_components/types";

/* ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const PARAMETER_LOCATION_BODY = "PARAMETER_LOCATION_BODY" as const;

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type LocationsToolInput = {
  /** The currently-open location detail (null while loading). */
  location: LocationRow | null;
  /** Zones belonging to the open location. */
  zones: ZoneRow[];
  /** Assets belonging to the open location. */
  assets: AssetRow[];
  /** Whether the location detail fetch is still in flight. */
  loading: boolean;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useLocationsTools(input: LocationsToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getLocationDetail",
          description:
            "Get full detail for the currently-open D1 location — name, type, address, capacity, active status, zone count, and asset count. Call first when the user asks anything about this location, like 'hva slags lokale er dette?', 'hva er adressen?', 'hvor mange soner finnes?', or 'er dette lokalet aktivt?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listLocationZones",
          description:
            "List all zones in the currently-open location — name, capacity, color, active status, and description. Use when the user asks 'hvilke soner finnes her?', 'vis alle soner', 'hva er kapasiteten per sone?', or wants a breakdown of spatial sub-areas.",
          dynamicParameters: [
            {
              name: "active_only",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "boolean",
                description:
                  "If true (default), return only active zones. Set false to include deactivated zones.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "listLocationAssets",
          description:
            "List all assets in the currently-open location — name, type, training and routine requirements, active status. Use when the user asks 'hvilke eiendeler finnes her?', 'vis utstyr', 'krever noe spesialopplæring?', or wants an inventory of this location.",
          dynamicParameters: [
            {
              name: "active_only",
              location: PARAMETER_LOCATION_BODY,
              schema: {
                type: "boolean",
                description:
                  "If true (default), return only active assets. Set false to include deactivated assets.",
              },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getLocationSummary",
          description:
            "Get a concise operational summary for the open location — total zone capacity, training-required asset count, routine-required asset count, and active vs. inactive breakdowns. Use when the user asks 'gi meg en oversikt', 'oppsummer dette lokalet', or needs a quick status read.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getLocationDetail: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (!d.location) {
          return Promise.resolve(
            JSON.stringify({ ok: false, reason: "Location not found or not loaded." }),
          );
        }
        const loc = d.location;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            location: {
              locationId: loc.location_id,
              name: loc.name,
              slug: loc.slug,
              locationType: loc.location_type,
              description: loc.description,
              address: loc.address,
              floor: loc.floor,
              capacity: loc.capacity,
              latitude: loc.latitude,
              longitude: loc.longitude,
              isActive: loc.is_active,
              zoneCount: d.zones.length,
              assetCount: d.assets.length,
            },
          }),
        );
      },

      listLocationZones: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const activeOnly = params.active_only !== false; // default true
        const list = activeOnly ? d.zones.filter((z) => z.is_active) : [...d.zones];
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: list.length,
            activeOnly,
            zones: list.map((z) => ({
              zoneId: z.zone_id,
              name: z.name,
              description: z.description,
              capacity: z.capacity,
              color: z.color,
              isActive: z.is_active,
              sortOrder: z.sort_order,
            })),
          }),
        );
      },

      listLocationAssets: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const activeOnly = params.active_only !== false; // default true
        const list = activeOnly ? d.assets.filter((a) => a.is_active) : [...d.assets];
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            count: list.length,
            activeOnly,
            assets: list.map((a) => ({
              assetId: a.asset_id,
              name: a.name,
              assetType: a.asset_type,
              description: a.description,
              requiresTraining: a.requires_training,
              requiresRoutine: a.requires_routine,
              isActive: a.is_active,
              sortOrder: a.sort_order,
            })),
          }),
        );
      },

      getLocationSummary: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (!d.location) {
          return Promise.resolve(
            JSON.stringify({ ok: false, reason: "Location not found or not loaded." }),
          );
        }
        const activeZones = d.zones.filter((z) => z.is_active);
        const totalZoneCapacity = activeZones.reduce((sum, z) => sum + (z.capacity ?? 0), 0);
        const trainingAssets = d.assets.filter((a) => a.is_active && a.requires_training);
        const routineAssets = d.assets.filter((a) => a.is_active && a.requires_routine);
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            locationName: d.location.name,
            isActive: d.location.is_active,
            zones: {
              total: d.zones.length,
              active: activeZones.length,
              inactive: d.zones.length - activeZones.length,
              totalCapacity: totalZoneCapacity,
            },
            assets: {
              total: d.assets.length,
              active: d.assets.filter((a) => a.is_active).length,
              inactive: d.assets.filter((a) => !a.is_active).length,
              requiresTraining: trainingAssets.length,
              requiresRoutine: routineAssets.length,
            },
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
