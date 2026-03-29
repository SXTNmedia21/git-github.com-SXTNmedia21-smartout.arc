"use client";

/**
 * locations-tools.ts — Emma's tool kit for the ConfirmLocations step.
 *
 * Provides tools to add locations, add zones to a location, and get a
 * status summary. Mirrors addLocations/addZones from Botsson but uses
 * updateState() instead of direct callbacks.
 */

import { useMemo } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import { useSyncRef, useWizardToolKit } from "@/lib/wizard-tools/shared";
import type { OnboardingConfirmState } from "../../types-v2";
import type { LocationData } from "../../types";

export function useLocationsTools(
  state: OnboardingConfirmState,
  updateState: (patch: Partial<OnboardingConfirmState>) => void,
  next: () => void | Promise<void>,
  back: () => void,
): ClientToolKit {
  const stateRef = useSyncRef(state);
  const updateRef = useSyncRef(updateState);
  const nextRef = useSyncRef(next);
  const backRef = useSyncRef(back);

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "add_locations",
          description:
            'Add physical locations. Pass a JSON array of location objects with name and optional type ("main", "outdoor", "satellite", "other"). Example: [{"name": "Sjøbris Restaurant", "type": "main"}, {"name": "Uteserveringen", "type": "outdoor"}]',
          dynamicParameters: [
            {
              name: "locations",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "JSON array of location objects with name and optional type",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "add_zones",
          description:
            'Add zones within a specific location. Pass the location name and a JSON array of zone objects. Example: locationName="Sjøbris Restaurant", zones=[{"name": "Bar"}, {"name": "Spisesal"}]',
          dynamicParameters: [
            {
              name: "locationName",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "Name of the location to add zones to" },
              required: true,
            },
            {
              name: "zones",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: { type: "string", description: "JSON array of zone objects with name" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "get_locations_status",
          description: "Get a summary of all configured locations and their zones.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      add_locations: (params) => {
        const p = params as Record<string, string>;
        if (!p.locations) return "Error: locations is required.";

        let incoming: Array<{ name: string; type?: string }>;
        try {
          incoming = JSON.parse(p.locations) as Array<{ name: string; type?: string }>;
        } catch {
          return "Error: locations must be a valid JSON array.";
        }
        if (!Array.isArray(incoming) || incoming.length === 0) {
          return "Error: locations must be a non-empty array.";
        }

        const VALID_TYPES: LocationData["type"][] = ["main", "outdoor", "satellite", "other"];
        const current = stateRef.current.locations;
        const newLocs: LocationData[] = incoming.map((loc, i) => ({
          id: `loc-${Date.now()}-${current.length + i}`,
          name: loc.name.trim(),
          type: (VALID_TYPES.indexOf(loc.type as LocationData["type"]) !== -1
            ? loc.type
            : "other") as LocationData["type"],
          zones: [],
        }));

        updateRef.current({ locations: [...current, ...newLocs] });
        return `Added ${newLocs.length} location(s): ${newLocs.map((l) => l.name).join(", ")}.`;
      },

      add_zones: (params) => {
        const p = params as Record<string, string>;
        const locationName = p.locationName?.trim();
        if (!locationName) return "Error: locationName is required.";
        if (!p.zones) return "Error: zones is required.";

        let zones: Array<{ name: string }>;
        try {
          zones = JSON.parse(p.zones) as Array<{ name: string }>;
        } catch {
          return "Error: zones must be a valid JSON array.";
        }
        if (!Array.isArray(zones) || zones.length === 0) {
          return "Error: zones must be a non-empty array.";
        }

        const locations = stateRef.current.locations;
        const target = locations.find((l) => l.name.toLowerCase() === locationName.toLowerCase());
        if (!target) {
          return `Error: no location named "${locationName}". Use get_locations_status to see available locations.`;
        }

        const newZones = zones.map((z, i) => ({
          id: `zone-${Date.now()}-${target.zones.length + i}`,
          name: z.name.trim(),
        }));

        updateRef.current({
          locations: locations.map((loc) =>
            loc.id === target.id ? { ...loc, zones: [...loc.zones, ...newZones] } : loc,
          ),
        });
        return `Added ${newZones.length} zone(s) to "${target.name}": ${newZones.map((z) => z.name).join(", ")}.`;
      },

      get_locations_status: () => {
        const locs = stateRef.current.locations;
        if (locs.length === 0) return "No locations configured yet.";
        const lines = locs.map((loc) => {
          const zoneNames =
            loc.zones.length > 0
              ? ` | Zones: ${loc.zones.map((z) => z.name).join(", ")}`
              : " | No zones";
          return `• ${loc.name} (${loc.type})${zoneNames}`;
        });
        const totalZones = locs.reduce((sum, l) => sum + l.zones.length, 0);
        return `Locations: ${locs.length} total, ${totalZones} zone(s).\n${lines.join("\n")}`;
      },
    }),
    [],
  );

  return useWizardToolKit(definitions, implementations, nextRef, backRef);
}
