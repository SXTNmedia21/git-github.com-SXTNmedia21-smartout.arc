"use client";

import { useState, useCallback, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, CheckCircle2, Clock, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────

type TemplateEntry = {
  id: string;
  departmentName: string;
  name: string;
  startTime: string;
  endTime: string;
};

// ─── Helpers ─────────────────────────────────────────────

function getDayCategory(startTime: string): string {
  const hour = parseInt(startTime.split(":")[0], 10);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ─── ShiftTemplateSetupStep ──────────────────────────────

export function ShiftTemplateSetupStep({ isDark }: { isDark: boolean }) {
  const workspace = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  // ── Queries ──

  const { data: departments } = useQuery({
    queryKey: ["departments", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      return data ?? [];
    },
  });

  const { data: existingTemplates } = useQuery({
    queryKey: ["schedule-templates", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("schedule_template")
        .select("schedule_template_id, name, department")
        .eq("workspace_id", workspace.workspace_id);
      return data ?? [];
    },
  });

  // ── State ──

  const [entries, setEntries] = useState<TemplateEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
            workspace_id: workspace.workspace_id,
            created_by: profileId,
          })
          .select()
          .single();

        if (templateError) throw templateError;

        const { error: shiftError } = await supabase.from("schedule_template_shift").insert({
          template_id: template.schedule_template_id,
          start_time: entry.startTime,
          end_time: entry.endTime,
          day_category: getDayCategory(entry.startTime),
        });

        if (shiftError) throw shiftError;
      }

      emit({
        trackingId: "shift-template-created",
        action: "shift_template_created",
        metadata: { count: validEntries.length },
      });

      toast.success(
        `${validEntries.length} vaktmal${validEntries.length !== 1 ? "er" : ""} opprettet`,
      );
      setEntries([]);
      await queryClient.invalidateQueries({
        queryKey: ["schedule-templates", workspace.workspace_id],
      });
    } catch (err) {
      toast.error("Kunne ikke opprette vaktmaler");
    } finally {
      setIsSaving(false);
    }
  }, [entries, workspace.workspace_id, profileId, queryClient]);

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Departments with entries */}
      {(departments ?? []).map((dept) => {
        const deptEntries = entries.filter((e) => e.departmentName === dept.name);
        const existing = templatesByDept.get(dept.name) ?? [];

        return (
          <div key={dept.department_id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className={`text-sm font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                {dept.name}
              </h4>
              <button
                onClick={() => handleAddEntry(dept.name)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isDark
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Legg til vaktmal
              </button>
            </div>

            {/* Existing templates */}
            {existing.map((t) => (
              <div
                key={t.schedule_template_id}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
                  isDark ? "bg-zinc-900/40" : "bg-zinc-50"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span
                  className={`flex-1 truncate text-sm font-medium ${
                    isDark ? "text-zinc-300" : "text-zinc-700"
                  }`}
                >
                  {t.name}
                </span>
              </div>
            ))}

            {/* New entry rows */}
            {deptEntries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex-1">
                  <Input
                    placeholder="Morgenvakt"
                    value={entry.name}
                    onChange={(e) => handleUpdateEntry(entry.id, "name", e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className={`h-3.5 w-3.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                  <Input
                    type="time"
                    value={entry.startTime}
                    onChange={(e) => handleUpdateEntry(entry.id, "startTime", e.target.value)}
                    className="h-8 w-28 text-sm"
                  />
                  <span className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>–</span>
                  <Input
                    type="time"
                    value={entry.endTime}
                    onChange={(e) => handleUpdateEntry(entry.id, "endTime", e.target.value)}
                    className="h-8 w-28 text-sm"
                  />
                </div>
                <button
                  onClick={() => handleRemoveEntry(entry.id)}
                  className={`rounded-md p-1.5 transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  }`}
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
              : "bg-orange-500 text-white hover:bg-orange-600"
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
