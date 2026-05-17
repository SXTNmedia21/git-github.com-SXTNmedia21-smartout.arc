"use client";

/**
 * locations-tools-bridge.tsx — registers Botsson tools for the
 * /dashboard/organization/locations/[id] surface.
 *
 * Why a bridge:
 *  - Keeps LocationDetailPage clean from voice-tool registration concerns.
 *  - Returns null — renders nothing, only registers the tool kit.
 *  - useRegisterTools handles register/unregister automatically on mount/unmount.
 *
 * Data sourcing:
 *  - Receives live state from LocationDetailPage via props.
 *    No duplicate fetch — page already owns the Supabase queries.
 *
 * ADR-0151: workspace_id auth-derived in page; not passed here (read-only tools).
 * ADR-0238: page has no domain chat surface — Orb runs in interactive mode.
 * Scope: "organization-locations"
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { useLocationsTools } from "./use-locations-tools";
import type { LocationRow, ZoneRow, AssetRow } from "../../_components/types";

type LocationsToolsBridgeProps = {
  location: LocationRow | null;
  zones: ZoneRow[];
  assets: AssetRow[];
  loading: boolean;
};

export function LocationsToolsBridge({
  location,
  zones,
  assets,
  loading,
}: LocationsToolsBridgeProps) {
  const tools = useLocationsTools({ location, zones, assets, loading });
  useRegisterTools("organization-locations", tools);
  return null;
}
