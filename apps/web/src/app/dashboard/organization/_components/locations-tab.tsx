import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Plus,
  MoreVertical,
  FileText,
  Users,
  Layers,
  Package,
  GripVertical,
  AlertTriangle,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationRow, ZoneRow, AssetRow, CountMap } from "./types";
import { toSlug } from "./types";
import { LOCATION_TYPE_CONFIG } from "./constants";
import { EditLocationDialog } from "./EditLocationDialog";
import { CreateZoneDialog } from "./CreateZoneDialog";
import { EditZoneDialog } from "./EditZoneDialog";
import { CreateAssetDialog } from "./CreateAssetDialog";
import { EditAssetDialog } from "./EditAssetDialog";

type LocationsTabProps = {
  locations: LocationRow[];
  zoneCounts: CountMap;
  assetCounts: CountMap;
  policyCounts: CountMap;
  zonesByLocation: Record<string, ZoneRow[]>;
  assetsByLocation: Record<string, AssetRow[]>;
  isDark: boolean;
  workspaceId: string;
  onRefresh: () => Promise<void>;
  loading: boolean;
};

export function LocationsTab({
  locations,
  zoneCounts,
  assetCounts,
  policyCounts,
  zonesByLocation,
  assetsByLocation,
  isDark,
  workspaceId,
  onRefresh,
  loading,
}: LocationsTabProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState("main");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit location state
  const [editLoc, setEditLoc] = useState<LocationRow | null>(null);

  // Expandable sections
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  // Zone CRUD state
  const [createZoneLocId, setCreateZoneLocId] = useState<string | null>(null);
  const [editZone, setEditZone] = useState<ZoneRow | null>(null);

  // Asset CRUD state
  const [createAssetLocId, setCreateAssetLocId] = useState<string | null>(null);
  const [editAsset, setEditAsset] = useState<AssetRow | null>(null);

  const cardBase =
    "rounded-2xl border border-border bg-card p-5 transition-all hover:border-border/70";

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50";

  const labelClass =
    "mb-1.5 block text-xs font-semibold tracking-wider uppercase text-muted-foreground";

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Location name is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error } = await supabase.from("location").insert({
      name: name.trim(),
      slug: toSlug(name),
      description: description.trim() || null,
      location_type: locationType as "main" | "outdoor" | "kitchen" | "event" | "storage" | "other",
      address: address.trim() || null,
      capacity: capacity ? parseInt(capacity, 10) : null,
      workspace_id: workspaceId,
      is_active: true,
      sort_order: locations.length,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Location "${name.trim()}" created`);
      setDialogOpen(false);
      resetForm();
      await onRefresh();
    }
    setSaving(false);
  }

  async function toggleActive(loc: LocationRow) {
    const supabase = createClient();
    const { error } = await supabase
      .from("location")
      .update({ is_active: !loc.is_active })
      .eq("location_id", loc.location_id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(loc.is_active ? `"${loc.name}" deactivated` : `"${loc.name}" reactivated`);
      await onRefresh();
    }
  }

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
      await onRefresh();
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
      await onRefresh();
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setLocationType("main");
    setAddress("");
    setCapacity("");
  }

  function toggleExpandedZones(locId: string) {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  }

  function toggleExpandedAssets(locId: string) {
    setExpandedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(locId)) next.delete(locId);
      else next.add(locId);
      return next;
    });
  }

  // Find location for create dialogs
  const createZoneLoc = createZoneLocId
    ? locations.find((l) => l.location_id === createZoneLocId)
    : null;
  const createAssetLoc = createAssetLocId
    ? locations.find((l) => l.location_id === createAssetLocId)
    : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-6 w-48 animate-pulse rounded" />
          <div className="bg-muted h-9 w-36 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cardBase} animate-pulse`}>
              <div className="bg-muted mb-3 h-4 w-32 rounded" />
              <div className="bg-muted/60 mb-2 h-3 w-48 rounded" />
              <div className="bg-muted/40 h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg font-bold">Locations</h2>
          <p className="text-muted-foreground text-xs">
            Physical spaces. Each location can have zones and assets.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          <Plus className="h-4 w-4" />
          Add Location
        </button>
      </div>

      {/* Card Grid */}
      {locations.length === 0 ? (
        <div className="border-border bg-muted flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
          <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <MapPin className="text-muted-foreground h-7 w-7" />
          </div>
          <h3 className="text-foreground mb-1 text-base font-bold">No locations yet</h3>
          <p className="text-muted-foreground mb-4 max-w-sm text-center text-sm">
            Locations represent physical spaces &mdash; from the main floor to outdoor areas and
            storage rooms.
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            <Plus className="h-4 w-4" />
            Add your first location
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc) => {
            const zones = zoneCounts[loc.location_id] ?? 0;
            const assets = assetCounts[loc.location_id] ?? 0;
            const policies = policyCounts[loc.location_id] ?? 0;
            const fallback = LOCATION_TYPE_CONFIG["other"]!;
            const typeConfig = LOCATION_TYPE_CONFIG[loc.location_type] ?? fallback;
            const TypeIcon = typeConfig.icon;
            const isZonesExpanded = expandedZones.has(loc.location_id);
            const isAssetsExpanded = expandedAssets.has(loc.location_id);
            const locZones = zonesByLocation[loc.location_id] ?? [];
            const locAssets = assetsByLocation[loc.location_id] ?? [];

            return (
              <div
                key={loc.location_id}
                className={`group relative cursor-pointer ${cardBase}`}
                onClick={() => router.push(`/dashboard/organization/locations/${loc.location_id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab opacity-0 transition-opacity group-hover:opacity-50" />
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${typeConfig.bg}`}
                    >
                      <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                    </div>
                    <div>
                      <h3 className="text-foreground text-sm font-bold">{loc.name}</h3>
                      <span
                        className={`text-[10px] font-bold tracking-wider uppercase ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:bg-accent rounded-md p-1 opacity-0 transition-all group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-border bg-card">
                      <DropdownMenuItem onClick={() => setEditLoc(loc)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuItem onClick={() => toggleActive(loc)}>
                        {loc.is_active ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {loc.address && <p className="text-muted-foreground mt-2 text-xs">{loc.address}</p>}
                {loc.description && (
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {loc.description}
                  </p>
                )}

                {/* Validation warning */}
                {loc.is_active && zones === 0 && (
                  <div
                    className={`mt-3 flex items-center gap-2 rounded-lg border p-2.5 ${
                      isDark ? "border-amber-500/10 bg-amber-500/5" : "border-amber-100 bg-amber-50"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-amber-400" : "text-amber-500"}`}
                    />
                    <span className={`text-xs ${isDark ? "text-amber-300/80" : "text-amber-700"}`}>
                      No zones defined — add service sections for scheduling
                    </span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {loc.capacity !== null && (
                    <div className="flex items-center gap-1.5">
                      <Users className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-xs font-medium">
                        Cap: {loc.capacity}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpandedZones(loc.location_id);
                    }}
                    className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                  >
                    <Layers className="text-muted-foreground h-3 w-3" />
                    <span className="text-muted-foreground text-xs font-medium">
                      {zones} {zones === 1 ? "zone" : "zones"}
                    </span>
                    <ChevronDown
                      className={`text-muted-foreground h-3 w-3 transition-transform ${isZonesExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpandedAssets(loc.location_id);
                    }}
                    className="flex items-center gap-1.5 transition-colors hover:opacity-80"
                  >
                    <Package className="text-muted-foreground h-3 w-3" />
                    <span className="text-muted-foreground text-xs font-medium">
                      {assets} {assets === 1 ? "asset" : "assets"}
                    </span>
                    <ChevronDown
                      className={`text-muted-foreground h-3 w-3 transition-transform ${isAssetsExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {policies > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-xs font-medium">
                        {policies} {policies === 1 ? "policy" : "policies"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Zone drill-down */}
                {isZonesExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="border-border bg-muted mt-3 space-y-1.5 rounded-lg border p-3"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <Layers className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Zones
                      </span>
                    </div>
                    {locZones.length === 0 ? (
                      <p className="text-muted-foreground text-xs italic">
                        No zones yet. Add zones to define service sections.
                      </p>
                    ) : (
                      locZones.map((zone) => (
                        <div
                          key={zone.zone_id}
                          className="group/zone flex items-center justify-between py-1"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: zone.color ?? (isDark ? "#52525b" : "#a1a1aa"),
                              }} // Nordic Split: Phase 2.5 candidate.
                            />
                            <span className="text-foreground text-xs font-medium">{zone.name}</span>
                            {zone.capacity !== null && (
                              <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[9px] font-bold">
                                cap {zone.capacity}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-1.5 w-1.5 rounded-full ${zone.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-muted-foreground hover:bg-accent rounded p-0.5 opacity-0 transition-all group-hover/zone:opacity-100">
                                  <MoreVertical className="h-3 w-3" />
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
                      ))
                    )}
                    <button
                      onClick={() => setCreateZoneLocId(loc.location_id)}
                      className="border-border text-muted-foreground hover:border-border hover:text-accent-foreground mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs font-medium transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add Zone
                    </button>
                  </div>
                )}

                {/* Asset drill-down */}
                {isAssetsExpanded && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="border-border bg-muted mt-3 space-y-1.5 rounded-lg border p-3"
                  >
                    <div className="mb-1 flex items-center gap-1.5">
                      <Package className="text-muted-foreground h-3 w-3" />
                      <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                        Assets
                      </span>
                    </div>
                    {locAssets.length === 0 ? (
                      <p className="text-muted-foreground text-xs italic">
                        No assets yet. Add equipment, safety items, or stations.
                      </p>
                    ) : (
                      locAssets.map((asset) => (
                        <div
                          key={asset.asset_id}
                          className="group/asset flex items-center justify-between py-1"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="text-muted-foreground h-2.5 w-2.5" />
                            <span className="text-foreground text-xs font-medium">
                              {asset.name}
                            </span>
                            <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase">
                              {asset.asset_type}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-1.5 w-1.5 rounded-full ${asset.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="text-muted-foreground hover:bg-accent rounded p-0.5 opacity-0 transition-all group-hover/asset:opacity-100">
                                  <MoreVertical className="h-3 w-3" />
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
                      ))
                    )}
                    <button
                      onClick={() => setCreateAssetLocId(loc.location_id)}
                      className="border-border text-muted-foreground hover:border-border hover:text-accent-foreground mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs font-medium transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add Asset
                    </button>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${loc.is_active ? "bg-emerald-500" : "bg-muted-foreground"}`}
                    />
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase ${
                        loc.is_active
                          ? isDark
                            ? "text-emerald-400"
                            : "text-emerald-600" // Nordic Split: Phase 2.5 candidate.
                          : "text-muted-foreground"
                      }`}
                    >
                      {loc.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {loc.floor && (
                    <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[10px] font-bold">
                      Floor {loc.floor}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Location Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Create a new physical space with zones and assets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Floor, Outdoor Terrace"
                className={inputClass}
                autoFocus
              />
            </div>

            <div>
              <label className={labelClass}>Location Type *</label>
              <select
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                {Object.entries(LOCATION_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this location used for?"
                rows={2}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Capacity</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Max people"
                  min={0}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              className="border-border bg-card text-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !name.trim()}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      {editLoc && (
        <EditLocationDialog
          location={editLoc}
          isDark={isDark}
          open={!!editLoc}
          onOpenChange={(open) => {
            if (!open) setEditLoc(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Create Zone Dialog */}
      {createZoneLoc && (
        <CreateZoneDialog
          locationId={createZoneLoc.location_id}
          locationName={createZoneLoc.name}
          workspaceId={workspaceId}
          existingCount={locZonesCount(createZoneLoc.location_id)}
          isDark={isDark}
          open={!!createZoneLocId}
          onOpenChange={(open) => {
            if (!open) setCreateZoneLocId(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Edit Zone Dialog */}
      {editZone && (
        <EditZoneDialog
          zone={editZone}
          open={!!editZone}
          onOpenChange={(open) => {
            if (!open) setEditZone(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Create Asset Dialog */}
      {createAssetLoc && (
        <CreateAssetDialog
          locationId={createAssetLoc.location_id}
          locationName={createAssetLoc.name}
          workspaceId={workspaceId}
          existingCount={locAssetsCount(createAssetLoc.location_id)}
          isDark={isDark}
          open={!!createAssetLocId}
          onOpenChange={(open) => {
            if (!open) setCreateAssetLocId(null);
          }}
          onSave={onRefresh}
        />
      )}

      {/* Edit Asset Dialog */}
      {editAsset && (
        <EditAssetDialog
          asset={editAsset}
          isDark={isDark}
          open={!!editAsset}
          onOpenChange={(open) => {
            if (!open) setEditAsset(null);
          }}
          onSave={onRefresh}
        />
      )}
    </div>
  );

  function locZonesCount(locId: string) {
    return (zonesByLocation[locId] ?? []).length;
  }

  function locAssetsCount(locId: string) {
    return (assetsByLocation[locId] ?? []).length;
  }
}
