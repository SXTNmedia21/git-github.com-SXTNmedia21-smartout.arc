import { useState } from "react";
import {
  MapPin,
  Plus,
  MoreVertical,
  FileText,
  Building2,
  Sun,
  UtensilsCrossed,
  Calendar,
  Archive,
  Users,
  Layers,
  Package,
  GripVertical,
  AlertTriangle,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LocationRow, CountMap } from "./types";
import { toSlug } from "./types";

const LOCATION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  main: {
    label: "Main",
    icon: Building2,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  outdoor: {
    label: "Outdoor",
    icon: Sun,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  kitchen: {
    label: "Kitchen",
    icon: UtensilsCrossed,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  event: {
    label: "Event",
    icon: Calendar,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  storage: {
    label: "Storage",
    icon: Archive,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
  },
  other: {
    label: "Other",
    icon: MapPin,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
  },
};

type LocationsTabProps = {
  locations: LocationRow[];
  zoneCounts: CountMap;
  assetCounts: CountMap;
  policyCounts: CountMap;
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
  isDark,
  workspaceId,
  onRefresh,
  loading,
}: LocationsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState("main");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  const cardBase = `rounded-2xl border p-5 transition-all ${
    isDark
      ? "border-zinc-800/50 bg-zinc-950 hover:border-zinc-700/50"
      : "border-zinc-200 bg-white hover:border-zinc-300"
  }`;

  const inputClass = `w-full rounded-lg border px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-1 ${
    isDark
      ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-orange-500/50"
      : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500/50 focus:ring-orange-500/50"
  }`;

  const labelClass = `mb-1.5 block text-xs font-semibold tracking-wider uppercase ${
    isDark ? "text-zinc-400" : "text-zinc-500"
  }`;

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
      location_type: locationType,
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

  function resetForm() {
    setName("");
    setDescription("");
    setLocationType("main");
    setAddress("");
    setCapacity("");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div
            className={`h-6 w-48 animate-pulse rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
          />
          <div
            className={`h-9 w-36 animate-pulse rounded-lg ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${cardBase} animate-pulse`}>
              <div className={`mb-3 h-4 w-32 rounded ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              <div
                className={`mb-2 h-3 w-48 rounded ${isDark ? "bg-zinc-800/60" : "bg-zinc-200/60"}`}
              />
              <div className={`h-3 w-24 rounded ${isDark ? "bg-zinc-800/40" : "bg-zinc-200/40"}`} />
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
          <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
            Locations
          </h2>
          <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
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
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 ${
            isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          <div
            className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isDark ? "bg-zinc-800/50" : "bg-zinc-100"}`}
          >
            <MapPin className={`h-7 w-7 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
          </div>
          <h3 className={`mb-1 text-base font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
            No locations yet
          </h3>
          <p
            className={`mb-4 max-w-sm text-center text-sm ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
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
            const typeConfig =
              LOCATION_TYPE_CONFIG[loc.location_type] ?? LOCATION_TYPE_CONFIG.other;
            const TypeIcon = typeConfig.icon;

            return (
              <div key={loc.location_id} className={`group relative ${cardBase}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical
                      className={`h-4 w-4 cursor-grab opacity-0 transition-opacity group-hover:opacity-50 ${isDark ? "text-zinc-600" : "text-zinc-300"}`}
                    />
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${typeConfig.bg}`}
                    >
                      <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                    </div>
                    <div>
                      <h3
                        className={`text-sm font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
                      >
                        {loc.name}
                      </h3>
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
                        className={`rounded-md p-1 opacity-0 transition-all group-hover:opacity-100 ${
                          isDark
                            ? "text-zinc-500 hover:bg-zinc-800"
                            : "text-zinc-400 hover:bg-zinc-100"
                        }`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className={isDark ? "border-zinc-800 bg-zinc-900" : ""}
                    >
                      <DropdownMenuItem onClick={() => toggleActive(loc)}>
                        {loc.is_active ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {loc.address && (
                  <p className={`mt-2 text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    {loc.address}
                  </p>
                )}
                {loc.description && (
                  <p
                    className={`mt-1 line-clamp-2 text-xs ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                  >
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
                      <Users className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                      <span
                        className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        Cap: {loc.capacity}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Layers className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                    <span
                      className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {zones} {zones === 1 ? "zone" : "zones"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Package className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                    <span
                      className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      {assets} {assets === 1 ? "asset" : "assets"}
                    </span>
                  </div>

                  {policies > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileText
                        className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`}
                      />
                      <span
                        className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                      >
                        {policies} {policies === 1 ? "policy" : "policies"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${loc.is_active ? "bg-emerald-500" : "bg-zinc-500"}`}
                    />
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase ${
                        loc.is_active
                          ? isDark
                            ? "text-emerald-400"
                            : "text-emerald-600"
                          : isDark
                            ? "text-zinc-500"
                            : "text-zinc-400"
                      }`}
                    >
                      {loc.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {loc.floor && (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                        isDark
                          ? "border-zinc-800 bg-zinc-900 text-zinc-500"
                          : "border-zinc-200 bg-zinc-50 text-zinc-400"
                      }`}
                    >
                      Floor {loc.floor}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent
          className={
            isDark
              ? "border-zinc-800 bg-zinc-950 text-white"
              : "border-zinc-200 bg-white text-zinc-900"
          }
        >
          <DialogHeader>
            <DialogTitle>Add Location</DialogTitle>
            <DialogDescription className={isDark ? "text-zinc-400" : "text-zinc-500"}>
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
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                isDark
                  ? "border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
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
    </div>
  );
}
