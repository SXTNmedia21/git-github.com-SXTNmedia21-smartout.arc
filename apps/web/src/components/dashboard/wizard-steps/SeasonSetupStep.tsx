"use client";

import { useState, useCallback, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

// ─── SeasonSetupStep ─────────────────────────────────────

export function SeasonSetupStep({ isDark }: { isDark: boolean }) {
  const workspace = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  // ── Query ──

  const { data: existingSeason } = useQuery({
    queryKey: ["seasons", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("season")
        .select("season_id, name, start_date, end_date, status")
        .eq("workspace_id", workspace.workspace_id)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // ── State ──

  const [name, setName] = useState("Sesong 2026");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // ── Save ──

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Sesongen trenger et navn");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Velg start- og sluttdato");
      return;
    }
    if (startDate >= endDate) {
      toast.error("Sluttdato må være etter startdato");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("season").insert({
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        status: "draft",
        workspace_id: workspace.workspace_id,
        created_by: profileId,
      });

      if (error) throw error;

      emit({
        trackingId: "season-created",
        action: "season_created",
        metadata: { name: name.trim() },
      });

      toast.success("Sesong opprettet");
      await queryClient.invalidateQueries({ queryKey: ["seasons", workspace.workspace_id] });
    } catch (err) {
      toast.error("Kunne ikke opprette sesong");
    } finally {
      setIsSaving(false);
    }
  }, [name, startDate, endDate, workspace.workspace_id, profileId, queryClient]);

  // ── Render: existing season ──

  if (existingSeason) {
    return (
      <div className="space-y-4">
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${
            isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
              {existingSeason.name}
            </p>
            <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
              {existingSeason.start_date} – {existingSeason.end_date}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
              isDark ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {existingSeason.status}
          </span>
        </div>
      </div>
    );
  }

  // ── Render: create form ──

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label
            htmlFor="season-name"
            className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
          >
            Sesongnavn
          </Label>
          <Input
            id="season-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sesong 2026"
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="season-start"
              className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              Startdato
            </Label>
            <Input
              id="season-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="season-end"
              className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
            >
              Sluttdato
            </Label>
            <Input
              id="season-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <p className={`text-xs leading-relaxed ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
        Sesongen setter rammen for budsjett og mål. Du kan konfigurere budsjett og faktorer etterpå
        fra Sesong-siden.
      </p>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
          isSaving
            ? "cursor-not-allowed opacity-50"
            : "bg-orange-500 text-white hover:bg-orange-600"
        }`}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Oppretter...
          </>
        ) : (
          "Opprett sesong"
        )}
      </button>
    </div>
  );
}
