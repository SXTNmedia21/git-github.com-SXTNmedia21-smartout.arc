"use client";

import { useState, useCallback, useContext, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { HelpTip } from "@/components/dashboard/wizard-steps/HelpTip";
import type { IndustryShiftTemplate } from "@/lib/industry/types";

// ─── Types ───────────────────────────────────────────────

type TemplateEntry = {
  id: string;
  departmentName: string;
  name: string;
  startTime: string;
  endTime: string;
  _suggested?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────

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

  // ── Queries ──

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

  // ── State ──

  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // ── Pre-fill from suggested templates or extracted patterns ──

  useEffect(() => {
    if (hasPreFilledRef.current) return;
    if (entries.length > 0) return;

    // Prefer extracted shift patterns, fall back to suggested templates
    const source = extractedShiftPatterns ?? suggestedTemplates;
    if (!source || source.length === 0) return;

    hasPreFilledRef.current = true;

    const deptNames = (departments ?? []).map((d) => d.name);
    const defaultDept = deptNames[0] ?? "";

    const mapped: TemplateEntry[] = source.map((s) => ({
      id: crypto.randomUUID(),
      departmentName: "department" in s && s.department ? s.department : defaultDept,
      name: "name" in s ? s.name : "",
      startTime: "startTime" in s ? s.startTime : "",
      endTime: "endTime" in s ? s.endTime : "",
      _suggested: true,
    })) as (TemplateEntry & { _suggested?: boolean })[];

    setEntries(mapped);
  }, [extractedShiftPatterns, suggestedTemplates, entries.length, departments]);

  // ── Derived ──

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

  // ── Handlers ──

  const handleAddEntry = useCallback((departmentName: string) => {
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        departmentName,
        name: "",
        startTime: "07:00",
        endTime: "15:00",
      },
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
      toast.error("Legg til minst én vaktmal med navn og tider");
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

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Departments with entries */}
      {(departments ?? []).map((dept, i) => {
        const deptEntries = entries.filter((e) => e.departmentName === dept.name);
        const existing = templatesByDept.get(dept.name) ?? [];

        return (
          <div key={dept.department_id || `dept-${i}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className={`text-sm font-semibold ${"text-muted-foreground"}`}>{dept.name}</h4>
                <HelpTip text="Legg til vaktmaler for denne avdelingen. Hver mal definerer en vakttype med start- og sluttid." />
              </div>
              <button
                onClick={() => handleAddEntry(dept.name)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${"bg-muted text-muted-foreground hover:bg-accent"}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Legg til vaktmal
              </button>
            </div>

            {/* Existing templates */}
            {existing.map((t) => (
              <div
                key={t.schedule_template_id}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${"bg-muted"}`}
              >
                <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
                <span className={`flex-1 truncate text-sm font-medium ${"text-muted-foreground"}`}>
                  {t.name}
                </span>
              </div>
            ))}

            {/* New entry rows */}
            {deptEntries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${"border-border bg-white"}`}
              >
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    placeholder="Morgenvakt"
                    value={entry.name}
                    onChange={(e) => handleUpdateEntry(entry.id, "name", e.target.value)}
                    className="h-8 text-sm"
                  />
                  {entry._suggested && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${"bg-brand-orange text-brand-orange"}`}
                    >
                      Foreslått
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className={`h-3.5 w-3.5 ${"text-muted-foreground"}`} />
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="07:00"
                    value={entry.startTime}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^\d:]/g, "");
                      if (v.length === 2 && !v.includes(":") && !entry.startTime.includes(":")) {
                        v += ":";
                      }
                      if (v.length <= 5) handleUpdateEntry(entry.id, "startTime", v);
                    }}
                    onBlur={(e) => {
                      const m = e.target.value.match(/^(\d{1,2}):?(\d{2})$/);
                      if (m) {
                        const h = Math.min(23, parseInt(m[1]!, 10));
                        const min = Math.min(59, parseInt(m[2]!, 10));
                        handleUpdateEntry(
                          entry.id,
                          "startTime",
                          `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
                        );
                      }
                    }}
                    className="h-8 w-20 text-center text-sm tabular-nums"
                  />
                  <span className={`text-xs ${"text-muted-foreground"}`}>–</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="15:00"
                    value={entry.endTime}
                    onChange={(e) => {
                      let v = e.target.value.replace(/[^\d:]/g, "");
                      if (v.length === 2 && !v.includes(":") && !entry.endTime.includes(":")) {
                        v += ":";
                      }
                      if (v.length <= 5) handleUpdateEntry(entry.id, "endTime", v);
                    }}
                    onBlur={(e) => {
                      const m = e.target.value.match(/^(\d{1,2}):?(\d{2})$/);
                      if (m) {
                        const h = Math.min(23, parseInt(m[1]!, 10));
                        const min = Math.min(59, parseInt(m[2]!, 10));
                        handleUpdateEntry(
                          entry.id,
                          "endTime",
                          `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
                        );
                      }
                    }}
                    className="h-8 w-20 text-center text-sm tabular-nums"
                  />
                </div>
                <button
                  onClick={() => handleRemoveEntry(entry.id)}
                  className={`rounded-md p-1.5 transition-colors ${"text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Save button */}
      {entries.length > 0 && (
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            isSaving
              ? "cursor-not-allowed opacity-50"
              : "bg-brand-orange hover:bg-brand-orange/90 text-white"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Oppretter...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Opprett maler ({entries.filter((e) => e.name.trim()).length})
            </>
          )}
        </button>
      )}
    </div>
  );
}
