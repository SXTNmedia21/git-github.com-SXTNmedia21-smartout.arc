"use client";

import { useState, useContext, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Pencil, Layers, Package, Plus, MoreVertical, Users, MapPin } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { EntityDetailLayout } from "../../_components/EntityDetailLayout";
import { EditLocationDialog } from "../../_components/EditLocationDialog";
import { CreateZoneDialog } from "../../_components/CreateZoneDialog";
import { EditZoneDialog } from "../../_components/EditZoneDialog";
import { CreateAssetDialog } from "../../_components/CreateAssetDialog";
import { EditAssetDialog } from "../../_components/EditAssetDialog";
import { LOCATION_TYPE_CONFIG } from "../../_components/constants";
import type { LocationRow, ZoneRow, AssetRow } from "../../_components/types";

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const { isDark, workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  const [location, setLocation] = useState<LocationRow | null>(null);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editLoc, setEditLoc] = useState(false);
  const [createZoneOpen, setCreateZoneOpen] = useState(false);
  const [editZone, setEditZone] = useState<ZoneRow | null>(null);
  const [createAssetOpen, setCreateAssetOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<AssetRow | null>(null);

  const fetchData = useCallback(async () => {
    if (!workspaceId || !params.id) return;
    setLoading(true);
    const supabase = createClient();

    const [locRes, zonesRes, assetsRes] = await Promise.all([
      supabase
        .from("location")
        .select("*")
        .eq("location_id", params.id)
        .eq("workspace_id", workspaceId)
        .single(),
      supabase
        .from("zone")
        .select("*")
        .eq("location_id", params.id)
        .eq("workspace_id", workspaceId)
        .order("sort_order"),
      supabase
        .from("asset")
        .select("*")
        .eq("location_id", params.id)
        .eq("workspace_id", workspaceId)
        .order("sort_order"),
    ]);

    if (locRes.data) setLocation(locRes.data as LocationRow);
    if (zonesRes.data) setZones(zonesRes.data as ZoneRow[]);
    if (assetsRes.data) setAssets(assetsRes.data as AssetRow[]);

    setLoading(false);
  }, [workspaceId, params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleZoneActive(zone: ZoneRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("zone")
      .update({ is_active: !zone.is_active })
      .eq("zone_id", zone.zone_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(zone.is_active ? `"${zone.name}" deactivated` : `"${zone.name}" reactivated`);
      await fetchData();
    }
  }

  async function toggleAssetActive(asset: AssetRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("asset")
      .update({ is_active: !asset.is_active })
      .eq("asset_id", asset.asset_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        asset.is_active ? `"${asset.name}" deactivated` : `"${asset.name}" reactivated`,
      );
      await fetchData();
    }
  }

  async function toggleLocActive() {
    if (!location) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("location")
      .update({ is_active: !location.is_active })
      .eq("location_id", location.location_id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        location.is_active ? `"${location.name}" deactivated` : `"${location.name}" reactivated`,
      );
      await fetchData();
    }
  }

  if (loading || !location) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-6 p-1">
        <div className="bg-muted h-8 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 w-72 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-96 animate-pulse rounded-lg" />
      </div>
    );
  }

  const fallback = LOCATION_TYPE_CONFIG["other"]!;
  const typeConfig = LOCATION_TYPE_CONFIG[location.location_type] ?? fallback;
  const TypeIcon = typeConfig.icon;

  const cardBase =
    "rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/70";

  return (
    <>
      <EntityDetailLayout
        breadcrumbs={[
          { label: "Organization", href: "/dashboard/organization" },
          { label: "Locations", href: "/dashboard/organization" },
          { label: location.name },
        ]}
        name={location.name}
        icon={
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${typeConfig.bg}`}
          >
            <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
          </div>
        }
        badges={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${typeConfig.bg} ${typeConfig.color}`}
            >
              {typeConfig.label}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase ${
                location.is_active
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${location.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
              />
              {location.is_active ? "Active" : "Inactive"}
            </span>
            {location.address && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                {location.address}
              </span>
            )}
          </>
        }
        actions={
          <button
            onClick={() => setEditLoc(true)}
            className="border-border bg-card text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        }
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="space-y-6">
                {location.description && (
                  <div className={cardBase}>
                    <h3 className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                      Description
                    </h3>
                    <p className="text-foreground text-sm">{location.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard
                    icon={<Layers className="h-4 w-4" />}
                    label="Zones"
                    value={zones.length}
                    isDark={isDark}
                  />
                  <StatCard
                    icon={<Package className="h-4 w-4" />}
                    label="Assets"
                    value={assets.length}
                    isDark={isDark}
                  />
                  {location.capacity !== null && (
                    <StatCard
                      icon={<Users className="h-4 w-4" />}
                      label="Capacity"
                      value={location.capacity!}
                      isDark={isDark}
                    />
                  )}
                </div>

                <div className={cardBase}>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Type
                      </span>
                      <p className="text-foreground mt-1">{typeConfig.label}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Slug
                      </span>
                      <p className="text-foreground mt-1 font-mono">{location.slug}</p>
                    </div>
                    {location.address && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Address
                        </span>
                        <p className="text-foreground mt-1">{location.address}</p>
                      </div>
                    )}
                    {location.floor && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Floor
                        </span>
                        <p className="text-foreground mt-1">{location.floor}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          },
          {
            value: "zones",
            label: "Zones",
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    {zones.length} {zones.length === 1 ? "zone" : "zones"} in this location
                  </p>
                  <button
                    onClick={() => setCreateZoneOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                  >
                    <Plus className="h-4 w-4" />
                    Add Zone
                  </button>
                </div>

                {zones.length === 0 ? (
                  <div className="border-border bg-muted flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
                    <Layers className="text-muted-foreground mb-4 h-8 w-8" />
                    <p className="text-muted-foreground text-sm font-medium">
                      No zones defined yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {zones.map((zone) => (
                      <div
                        key={zone.zone_id}
                        className="group border-border bg-card hover:border-border/70 flex items-center justify-between rounded-xl border p-4 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor: zone.color ?? (isDark ? "#52525b" : "#a1a1aa"),
                            }} // Nordic Split: Phase 2.5 candidate.
                          />
                          <div>
                            <span className="text-foreground text-sm font-bold">{zone.name}</span>
                            {zone.description && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {zone.description}
                              </p>
                            )}
                          </div>
                          {zone.capacity !== null && (
                            <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[9px] font-bold">
                              cap {zone.capacity}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${zone.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-muted-foreground hover:bg-accent rounded-md p-1 opacity-0 transition-all group-hover:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-border bg-card">
                              <DropdownMenuItem onClick={() => setEditZone(zone)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border" />
                              <DropdownMenuItem onClick={() => toggleZoneActive(zone)}>
                                {zone.is_active ? "Deactivate" : "Reactivate"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "assets",
            label: "Assets",
            content: (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    {assets.length} {assets.length === 1 ? "asset" : "assets"} in this location
                  </p>
                  <button
                    onClick={() => setCreateAssetOpen(true)}
                    className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                  >
                    <Plus className="h-4 w-4" />
                    Add Asset
                  </button>
                </div>

                {assets.length === 0 ? (
                  <div className="border-border bg-muted flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
                    <Package className="text-muted-foreground mb-4 h-8 w-8" />
                    <p className="text-muted-foreground text-sm font-medium">
                      No assets defined yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assets.map((asset) => (
                      <div
                        key={asset.asset_id}
                        className="group border-border bg-card hover:border-border/70 flex items-center justify-between rounded-xl border p-4 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <Package className="text-muted-foreground h-4 w-4" />
                          <div>
                            <span className="text-foreground text-sm font-bold">{asset.name}</span>
                            {asset.description && (
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {asset.description}
                              </p>
                            )}
                          </div>
                          <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase">
                            {asset.asset_type}
                          </span>
                          {asset.requires_training && (
                            <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                              Training
                            </span>
                          )}
                          {asset.requires_routine && (
                            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                              Routine
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${asset.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-muted-foreground hover:bg-accent rounded-md p-1 opacity-0 transition-all group-hover:opacity-100">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-border bg-card">
                              <DropdownMenuItem onClick={() => setEditAsset(asset)}>
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border" />
                              <DropdownMenuItem onClick={() => toggleAssetActive(asset)}>
                                {asset.is_active ? "Deactivate" : "Reactivate"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            value: "settings",
            label: "Settings",
            content: (
              <div className="space-y-6">
                <div className={cardBase}>
                  <h3 className="text-foreground mb-4 text-sm font-bold">Location Settings</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Name
                      </span>
                      <p className="text-foreground mt-1">{location.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                        Type
                      </span>
                      <p className="text-foreground mt-1">{typeConfig.label}</p>
                    </div>
                    {location.address && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Address
                        </span>
                        <p className="text-foreground mt-1">{location.address}</p>
                      </div>
                    )}
                    {location.capacity !== null && (
                      <div>
                        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                          Capacity
                        </span>
                        <p className="text-foreground mt-1">{location.capacity}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={() => setEditLoc(true)}
                      className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit Location
                    </button>
                    <button
                      onClick={toggleLocActive}
                      className="border-border bg-card text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
                    >
                      {location.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Dialogs */}
      {editLoc && (
        <EditLocationDialog
          location={location}
          isDark={isDark}
          open={editLoc}
          onOpenChange={setEditLoc}
          onSave={fetchData}
        />
      )}
      {createZoneOpen && (
        <CreateZoneDialog
          locationId={location.location_id}
          locationName={location.name}
          workspaceId={workspaceId}
          existingCount={zones.length}
          isDark={isDark}
          open={createZoneOpen}
          onOpenChange={setCreateZoneOpen}
          onSave={fetchData}
        />
      )}
      {editZone && (
        <EditZoneDialog
          zone={editZone}
          open={!!editZone}
          onOpenChange={(open) => {
            if (!open) setEditZone(null);
          }}
          onSave={fetchData}
        />
      )}
      {createAssetOpen && (
        <CreateAssetDialog
          locationId={location.location_id}
          locationName={location.name}
          workspaceId={workspaceId}
          existingCount={assets.length}
          isDark={isDark}
          open={createAssetOpen}
          onOpenChange={setCreateAssetOpen}
          onSave={fetchData}
        />
      )}
      {editAsset && (
        <EditAssetDialog
          asset={editAsset}
          isDark={isDark}
          open={!!editAsset}
          onOpenChange={(open) => {
            if (!open) setEditAsset(null);
          }}
          onSave={fetchData}
        />
      )}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  isDark: _isDark,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isDark: boolean;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {label}
        </span>
      </div>
      <span className="text-foreground text-2xl font-bold">{value}</span>
    </div>
  );
}
