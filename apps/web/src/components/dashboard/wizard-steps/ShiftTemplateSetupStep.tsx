"use client";

import { useState, useCallback, useContext, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { useRegisterTools } from "@/app/walkAi/_components/tool-registry";
import { useShiftTemplateTools } from "./tools/shift-template-tools";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, CheckCircle2, Clock, Trash2 } from "lucide-react";
import type { IndustryShiftTemplate } from "@/lib/industry/types";

// ─── Types ───────────────────────────────────────────────

type TemplateEntry = {
  id: string;
  departmentName: string;
  name: string;
  startTime: string;
  endTime: string;
  suggested?: boolean;
};

type DayCategory = "morning" | "midday" | "afternoon" | "evening" | "night" | "weekend";

function getDayCategory(startTime: string): DayCategory {
  const hour = parseInt(startTime.split(":")[0] ?? "0", 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ─── ShiftTemplateSetupStep ──────────────────────────────

export function ShiftTemplateSetupStep({
  suggestedTemplates,
  extractedShiftPatterns,
  openingHours: _openingHours,
}: {
  suggestedTemplates?: IndustryShiftTemplate[];
  extractedShiftPatterns?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    department?: string;
    source: string;
  }>;
  openingHours?: string;
}) {
  const workspace = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const hasPreFilledRef = useRef(false);

  const { data: departments } = useQuery({
    queryKey: ["departments", workspace.workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace.workspace_id)
        .order("name");
      return data ?? [];
    },
  });

  const { data: existingTemplates } = useQuery({
    queryKey: ["schedule-templates", workspace.workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schedule_template")
        .select("schedule_template_id, name, department")
        .eq("workspace_id", workspace.workspace.workspace_id);
      return data ?? [];
    },
  });

  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill
  useEffect(() => {
    if (hasPreFilledRef.current) return;
    if (entries.length > 0) return;
    const source = extractedShiftPatterns ?? suggestedTemplates;
    if (!source || source.length === 0) return;
    hasPreFilledRef.current = true;
    const deptNames = (departments ?? []).map((d) => d.name);
    const defaultDept = deptNames[0] ?? "";
    setEntries(
      source.map((s) => ({
        id: crypto.randomUUID(),
        departmentName: "department" in s && s.department ? s.department : defaultDept,
        name: "name" in s ? s.name : "",
        startTime: "startTime" in s ? s.startTime : "",
        endTime: "endTime" in s ? s.endTime : "",
        suggested: true,
      })),
    );
  }, [extractedShiftPatterns, suggestedTemplates, entries.length, departments]);

  const templatesByDept = useMemo(() => {
    const map = new Map<string, typeof existingTemplates>();
    for (const t of existingTemplates ?? []) {
      const dept = t.department ?? "Ukjent";
      const list = map.get(dept) ?? [];
      list.push(t);
      map.set(dept, list);
    }
    return map;
  }, [existingTemplates]);

  const handleAddEntry = useCallback((departmentName: string) => {
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), departmentName, name: "", startTime: "07:00", endTime: "15:00" },
    ]);
  }, []);

  const handleUpdateEntry = useCallback(
    (
      id: string,
      field: keyof Pick<TemplateEntry, "name" | "startTime" | "endTime">,
      value: string,
    ) => {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    },
    [],
  );

  const handleRemoveEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    const validEntries = entries.filter((e) => e.name.trim() && e.startTime && e.endTime);
    if (validEntries.length === 0) {
      toast.error("Legg til minst \u00e9n vaktmal med navn og tider");
      return;
    }
    setIsSaving(true);
    const supabase = createClient();
    try {
      for (const entry of validEntries) {
        const { data: template, error: templateError } = await supabase
          .from("schedule_template")
          .insert({
            name: entry.name.trim(),
            department: entry.departmentName,
            workspace_id: workspace.workspace.workspace_id,
            created_by: profileId ?? "",
          })
          .select()
          .single();
        if (templateError) throw templateError;
        const { error: shiftError } = await supabase.from("schedule_template_shift").insert({
          template_id: template.schedule_template_id,
          start_time: entry.startTime,
          end_time: entry.endTime,
          day_category: getDayCategory(entry.startTime),
          role: "general",
        });
        if (shiftError) throw shiftError;
      }
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: { trackingId: "shift-template-created" },
      });
      toast.success(
        `${validEntries.length} vaktmal${validEntries.length !== 1 ? "er" : ""} opprettet`,
      );
      setEntries([]);
      await queryClient.invalidateQueries({
        queryKey: ["schedule-templates", workspace.workspace.workspace_id],
      });
    } catch {
      toast.error("Kunne ikke opprette vaktmaler");
    } finally {
      setIsSaving(false);
    }
  }, [entries, workspace.workspace.workspace_id, profileId, queryClient]);

  // Adapter that matches the tool hook signature (dept name + template fields)
  const handleAddTemplateEntry = useCallback(
    (departmentName: string, name: string, startTime: string, endTime: string) => {
      handleAddEntry(departmentName);
      // Update the last entry with name and times
      setEntries((prev) => {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        return prev.map((e, i) =>
          i === prev.length - 1 ? { ...last, name, startTime, endTime } : e,
        );
      });
    },
    [handleAddEntry],
  );

  const shiftTemplateTools = useShiftTemplateTools(
    entries,
    existingTemplates ?? [],
    departments ?? [],
    handleAddTemplateEntry,
  );
  useRegisterTools("wizard-setup-shift-templates", shiftTemplateTools);

  return (
    <div className="space-y-6">
      {(departments ?? []).map((dept) => {
        const deptEntries = entries.filter((e) => e.departmentName === dept.name);
        const existing = templatesByDept.get(dept.name) ?? [];

        return (
          <div key={dept.department_id} className="space-y-3">
            {/* Department header */}
            <div className="flex items-center justify-between">
              <h4 className="text-foreground text-sm font-semibold">{dept.name}</h4>
              <button
                type="button"
                onClick={() => handleAddEntry(dept.name)}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Legg til
              </button>
            </div>

            {/* Existing (saved) templates */}
            {existing.map((t) => (
              <div
                key={t.schedule_template_id}
                className="border-border bg-card/50 flex items-center gap-3 rounded-xl border px-4 py-3"
              >
                <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                <span className="text-foreground flex-1 text-sm font-medium">{t.name}</span>
              </div>
            ))}

            {/* New entries */}
            {deptEntries.map((entry) => (
              <div
                key={entry.id}
                className={`border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  entry.suggested ? "border-brand-orange/30" : ""
                }`}
              >
                <Input
                  placeholder="Vaktnavn"
                  value={entry.name}
                  onChange={(e) => handleUpdateEntry(entry.id, "name", e.target.value)}
                  className="h-8 flex-1 text-sm"
                />
                <div className="flex items-center gap-1.5">
                  <Clock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <Input
                    type="time"
                    value={entry.startTime}
                    onChange={(e) => handleUpdateEntry(entry.id, "startTime", e.target.value)}
                    className="h-8 w-24 text-center text-sm tabular-nums"
                  />
                  <span className="text-muted-foreground text-xs">\u2013</span>
                  <Input
                    type="time"
                    value={entry.endTime}
                    onChange={(e) => handleUpdateEntry(entry.id, "endTime", e.target.value)}
                    className="h-8 w-24 text-center text-sm tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEntry(entry.id)}
                  className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* Empty state per department */}
            {existing.length === 0 && deptEntries.length === 0 && (
              <button
                type="button"
                onClick={() => handleAddEntry(dept.name)}
                className="border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors"
              >
                <Plus className="h-4 w-4" />
                Legg til vaktmal for {dept.name}
              </button>
            )}
          </div>
        );
      })}

      {/* Save */}
      {entries.length > 0 && (
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
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isSaving
            ? "Oppretter..."
            : `Opprett ${entries.filter((e) => e.name.trim()).length} vaktmal${entries.filter((e) => e.name.trim()).length !== 1 ? "er" : ""}`}
        </button>
      )}
    </div>
  );
}
