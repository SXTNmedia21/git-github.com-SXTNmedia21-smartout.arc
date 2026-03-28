"use client";

import { useState, useCallback, useContext, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, CalendarRange } from "lucide-react";
import type { IndustrySeasonTemplate } from "@/lib/industry/types";
import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";
import { useSeasonTools } from "./tools/season-tools";

// ─── Helpers ───────────────────────────────────────────────

function suggestSeason(): { name: string; startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month <= 4)
    return { name: `V\u00e5rsesong ${year}`, startDate: `${year}-03-01`, endDate: `${year}-05-31` };
  if (month <= 8)
    return { name: `Sommersesong ${year}`, startDate: `${year}-06-01`, endDate: `${year}-08-31` };
  if (month <= 11)
    return {
      name: `H\u00f8stsesong ${year}`,
      startDate: `${year}-09-01`,
      endDate: `${year}-11-30`,
    };
  return {
    name: `Vintersesong ${year + 1}`,
    startDate: `${year}-12-01`,
    endDate: `${year + 1}-02-28`,
  };
}

function countSeasonDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}

// ─── SeasonSetupStep ───────────────────────────────────────

export function SeasonSetupStep({
  suggestedSeasons: _suggestedSeasons,
}: {
  suggestedSeasons?: IndustrySeasonTemplate[];
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

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

  const suggested = useMemo(() => suggestSeason(), []);
  const hasPrePopulatedRef = useRef(false);

  const [name, setName] = useState(suggested.name);
  const [startDate, setStartDate] = useState(suggested.startDate);
  const [endDate, setEndDate] = useState(suggested.endDate);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (hasPrePopulatedRef.current || !existingSeason) return;
    hasPrePopulatedRef.current = true;
    setName(existingSeason.name);
    if (existingSeason.start_date) setStartDate(existingSeason.start_date);
    if (existingSeason.end_date) setEndDate(existingSeason.end_date);
  }, [existingSeason]);

  const seasonDays = useMemo(
    () => (startDate && endDate ? countSeasonDays(startDate, endDate) : 0),
    [startDate, endDate],
  );

  const seasonWeeks = useMemo(() => Math.round(seasonDays / 7), [seasonDays]);

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
      toast.error("Sluttdato m\u00e5 v\u00e6re etter startdato");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-\u00e6\u00f8\u00e5]/g, "");

    try {
      if (existingSeason) {
        const { error } = await supabase
          .from("season")
          .update({ name: name.trim(), slug, start_date: startDate, end_date: endDate })
          .eq("season_id", existingSeason.season_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("season").insert({
          name: name.trim(),
          slug,
          start_date: startDate,
          end_date: endDate,
          status: "draft" as const,
          workspace_id: workspace.workspace_id,
          created_by: profileId,
        });
        if (error) throw error;
      }

      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { trackingId: existingSeason ? "season-updated" : "season-created" },
      });

      toast.success(existingSeason ? "Sesong oppdatert" : "Sesong opprettet");
      await queryClient.invalidateQueries({ queryKey: ["seasons", workspace.workspace_id] });
    } catch (err) {
      const pgErr = err as { message?: string };
      toast.error(pgErr.message ?? "Kunne ikke opprette sesong");
    } finally {
      setIsSaving(false);
    }
  }, [existingSeason, name, startDate, endDate, workspace.workspace_id, profileId, queryClient]);

  const seasonTools = useSeasonTools(
    name, startDate, endDate,
    setName, setStartDate, setEndDate,
    handleSave,
  );
  useRegisterTools("wizard-setup-season", seasonTools);

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="border-border bg-card flex items-start gap-4 rounded-2xl border p-6">
        <CalendarRange className="text-brand-orange mt-1 h-6 w-6 shrink-0" />
        <div className="space-y-2">
          <p className="text-muted-foreground text-base leading-relaxed">
            Sesonger styrer driften din. Hvert tidsrom har sine egne \u00e5pningstider,
            bemanningsm\u00e5l og budsjettrammer. Smartout bruker sesongene til \u00e5 planlegge
            vakter, beregne kostnader og justere rutinene automatisk.
          </p>
          <p className="text-muted-foreground text-sm">
            Opprett din f\u00f8rste sesong her. Du kan legge til budsjett, dagfaktorer og
            \u00e5pningstider per avdeling fra dashboardet etterp\u00e5.
          </p>
        </div>
      </div>

      {/* Existing banner */}
      {existingSeason && (
        <div className="border-success/30 bg-success/5 flex items-center gap-3 rounded-xl border px-4 py-3">
          <CheckCircle2 className="text-success h-5 w-5 shrink-0" />
          <p className="text-success text-sm font-medium">
            Sesong opprettet \u2014 juster navn og periode nedenfor.
          </p>
        </div>
      )}

      {/* Season name */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm font-bold">Sesongnavn</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sommersesong 2026"
          className="h-10 text-base"
        />
      </div>

      {/* Period */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm font-bold">Periode</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Fra</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Til</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
        {seasonDays > 0 && (
          <p className="text-muted-foreground text-sm">
            {seasonDays} dager ({seasonWeeks} uker)
          </p>
        )}
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
          isSaving
            ? "cursor-not-allowed opacity-50"
            : "bg-brand-orange hover:bg-brand-orange/90 text-white"
        }`}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {existingSeason ? "Oppdater sesong" : "Opprett sesong"}
      </button>
    </div>
  );
}
