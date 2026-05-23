"use client";

/**
 * RoutineForm.tsx — Procedure Engine Phase 1 (Task 7)
 *
 * Shared Sheet form for creating a routine template.
 * Reusable: governance overview now, Sesjonsplanlegger / Botsson later.
 * Props inject context (preselected location, protocol, procedure).
 *
 * Pattern mirrors ProcedureBuilder.tsx:
 *   - shadcn Sheet + SheetTrigger / SheetContent
 *   - Plain React useState (no react-hook-form — consistent with existing forms)
 *   - useQuery (supabase client) for selects
 *   - useCreateRoutine() mutation (server action path)
 *   - Nordic Split tokens only: bg-background, text-foreground, text-muted-foreground,
 *     border-border, bg-muted, bg-primary, text-primary-foreground, etc.
 *   - Lucide icons only. No emojis.
 *
 * Fields:
 *   - name (text, required)
 *   - procedure (Select from active procedures)
 *   - protocol (derived from procedure selection — auto-populated)
 *   - trigger_type (scheduled | event)
 *   - trigger_times (0..N HH:MM entries — only shown for scheduled)
 *   - trigger_days (multi: mon|tue|wed|thu|fri|sat|sun — only for scheduled)
 *   - location (Select)
 *   - team_ids (multi-select, optional → empty = location-wide)
 *   - executor_type (human | ai | system | hybrid)
 *
 * Acceptance: admin fills form → routine row + location_id + routine_team rows exist.
 */

import { useState, useMemo } from "react";
import { Plus, Loader2, ClipboardList, MapPin, Clock, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCreateRoutine } from "../_hooks/use-routine-mutations";

const DAYS = [
  { value: "mon", label: "Man" },
  { value: "tue", label: "Tir" },
  { value: "wed", label: "Ons" },
  { value: "thu", label: "Tor" },
  { value: "fri", label: "Fre" },
  { value: "sat", label: "Lør" },
  { value: "sun", label: "Søn" },
] as const;

const EXECUTOR_LABELS: Record<string, string> = {
  human: "Menneske",
  ai: "AI",
  system: "System",
  hybrid: "Hybrid",
};

type TriggerType = "scheduled" | "event";
type ExecutorType = "human" | "ai" | "system" | "hybrid";

interface RoutineFormProps {
  /** Optional pre-selected location_id. */
  preselectedLocationId?: string;
  /** Optional pre-selected protocol_id. */
  preselectedProtocolId?: string;
  /** Custom trigger label. */
  triggerLabel?: string;
}

export function RoutineForm({
  preselectedLocationId,
  preselectedProtocolId,
  triggerLabel = "Ny rutine",
}: RoutineFormProps) {
  const [open, setOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [protocolId, setProtocolId] = useState(preselectedProtocolId ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>("scheduled");
  const [triggerTimes, setTriggerTimes] = useState<string[]>([]);
  const [triggerDays, setTriggerDays] = useState<string[]>([]);
  const [locationId, setLocationId] = useState(preselectedLocationId ?? "");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [executorType, setExecutorType] = useState<ExecutorType>("human");

  // Temp state for time input
  const [timeInput, setTimeInput] = useState("08:00");

  const { workspace } = useWorkspace();
  const createRoutine = useCreateRoutine();

  // Fetch protocols (for procedure→protocol derivation and protocol select).
  const { data: protocols } = useQuery({
    queryKey: ["governance", "protocols", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .select("protocol_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Fetch procedures — if protocol is selected, filter by it.
  const { data: procedures } = useQuery({
    queryKey: ["governance", "procedures", workspace.workspace_id, protocolId],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("procedure")
        .select("procedure_id, name, protocol_id")
        .eq("is_active", true)
        .order("name");

      if (protocolId) {
        query = query.eq("protocol_id", protocolId);
      } else {
        // Need to scope to workspace via protocol join — use subquery approach.
        // Filter via protocols in this workspace by checking protocol_id in the list.
        const protocolIds = (protocols ?? []).map((p) => p.protocol_id);
        if (protocolIds.length > 0) {
          query = query.in("protocol_id", protocolIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && (!!protocolId || (protocols ?? []).length > 0),
  });

  // Fetch locations.
  const { data: locations } = useQuery({
    queryKey: ["locations", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("location")
        .select("location_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Fetch teams.
  const { data: teams } = useQuery({
    queryKey: ["teams", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team")
        .select("team_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Derive protocol from procedure when procedure changes.
  function handleProcedureChange(pid: string) {
    setProcedureId(pid);
    const proc = (procedures ?? []).find((p) => p.procedure_id === pid);
    // protocol_id is nullable in schema; only auto-select when present.
    // Orphan-procedure case: leave protocolId alone — user must pick manually.
    if (proc?.protocol_id && !preselectedProtocolId) {
      setProtocolId(proc.protocol_id);
    }
  }

  // Derive protocol label from protocols list.
  const selectedProtocolName = useMemo(() => {
    if (!protocolId) return null;
    return (protocols ?? []).find((p) => p.protocol_id === protocolId)?.name ?? null;
  }, [protocolId, protocols]);

  function addTime() {
    const trimmed = timeInput.trim();
    if (!trimmed || triggerTimes.includes(trimmed)) return;
    setTriggerTimes((prev) => [...prev, trimmed]);
  }

  function removeTime(t: string) {
    setTriggerTimes((prev) => prev.filter((x) => x !== t));
  }

  function toggleDay(day: string) {
    setTriggerDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function toggleTeam(tid: string) {
    setTeamIds((prev) => (prev.includes(tid) ? prev.filter((t) => t !== tid) : [...prev, tid]));
  }

  function resetForm() {
    setName("");
    setProcedureId("");
    setProtocolId(preselectedProtocolId ?? "");
    setTriggerType("scheduled");
    setTriggerTimes([]);
    setTriggerDays([]);
    setLocationId(preselectedLocationId ?? "");
    setTeamIds([]);
    setExecutorType("human");
    setTimeInput("08:00");
  }

  const canSubmit = name.trim().length > 0 && procedureId && protocolId && locationId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || createRoutine.isPending) return;

    createRoutine.mutate(
      {
        name: name.trim(),
        procedure_id: procedureId,
        protocol_id: protocolId,
        trigger_type: triggerType,
        trigger_times: triggerType === "scheduled" ? triggerTimes : [],
        trigger_days: triggerType === "scheduled" ? triggerDays : [],
        location_id: locationId,
        team_ids: teamIds,
        executor_type: executorType,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors"
        >
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </button>
      </SheetTrigger>

      <SheetContent className="w-[420px] overflow-y-auto sm:w-[560px]">
        <SheetHeader>
          <SheetTitle>Opprett ny rutine</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="routine-name">Navn</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Åpningsrutine kjøkken"
              required
            />
          </div>

          {/* Protocol — pre-filtered or free select */}
          <div className="space-y-2">
            <Label>Protokoll</Label>
            {preselectedProtocolId && selectedProtocolName ? (
              <p className="text-muted-foreground text-sm">{selectedProtocolName}</p>
            ) : (
              <Select value={protocolId} onValueChange={setProtocolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg protokoll…" />
                </SelectTrigger>
                <SelectContent>
                  {(protocols ?? []).map((p) => (
                    <SelectItem key={p.protocol_id} value={p.protocol_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Procedure */}
          <div className="space-y-2">
            <Label>Prosedyre</Label>
            <Select value={procedureId} onValueChange={handleProcedureChange}>
              <SelectTrigger>
                <SelectValue placeholder="Velg prosedyre…" />
              </SelectTrigger>
              <SelectContent>
                {(procedures ?? []).length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    {protocolId
                      ? "Ingen prosedyrer under denne protokollen"
                      : "Velg protokoll først"}
                  </SelectItem>
                ) : (
                  (procedures ?? []).map((p) => (
                    <SelectItem key={p.procedure_id} value={p.procedure_id}>
                      <span className="flex items-center gap-2">
                        <ClipboardList className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Trigger type */}
          <div className="space-y-2">
            <Label>Utløsertype</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Tidsbasert (cron/offset)</SelectItem>
                <SelectItem value="event">Hendelsesbasert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Trigger config — only for scheduled */}
          {triggerType === "scheduled" && (
            <div className="space-y-3">
              {/* Times */}
              <div className="space-y-2">
                <Label>Tidspunkter</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className="bg-background border-border focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTime}
                    className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Legg til
                  </button>
                </div>
                {triggerTimes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {triggerTimes.map((t) => (
                      <span
                        key={t}
                        className="bg-muted border-border flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTime(t)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Fjern ${t}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Days */}
              <div className="space-y-2">
                <Label>Dager</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const active = triggerDays.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {triggerDays.length === 0 && (
                  <p className="text-muted-foreground text-xs">Tom = alle dager.</p>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <Label>Lokasjon</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg lokasjon…" />
              </SelectTrigger>
              <SelectContent>
                {(locations ?? []).map((l) => (
                  <SelectItem key={l.location_id} value={l.location_id}>
                    <span className="flex items-center gap-2">
                      <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Teams — multi-select (optional) */}
          <div className="space-y-2">
            <Label>Team (valgfritt — tomt = hele lokasjonen)</Label>
            {(teams ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Ingen team i dette workspace.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(teams ?? []).map((t) => {
                  const selected = teamIds.includes(t.team_id);
                  return (
                    <button
                      key={t.team_id}
                      type="button"
                      onClick={() => toggleTeam(t.team_id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Executor type */}
          <div className="space-y-2">
            <Label>Utfører</Label>
            <Select value={executorType} onValueChange={(v) => setExecutorType(v as ExecutorType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXECUTOR_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Footer actions */}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={createRoutine.isPending || !canSubmit}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {createRoutine.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opprett rutine
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
