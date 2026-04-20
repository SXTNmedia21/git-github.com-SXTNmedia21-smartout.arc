"use client";

// ============================================
// DailyNoteSheet.tsx
// Reads/writes department_session.signoff_notes
// and handoff_notes for the anchor date. Operators
// capture what happened (signoff) and what's next
// (handoff) in one place, per department.
// ============================================

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/lib/workspace-context";

type DailyNoteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorDate: string;
};

type DepartmentRow = { department_id: string; name: string };
type SessionRow = {
  department_session_id: string;
  signoff_notes: string | null;
  handoff_notes: string | null;
};

export function DailyNoteSheet({ open, onOpenChange, anchorDate }: DailyNoteSheetProps) {
  const { t } = useTranslation("dashboard");
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [signoff, setSignoff] = useState("");
  const [handoff, setHandoff] = useState("");

  // Load departments for the selector.
  const { data: departments } = useQuery({
    queryKey: ["cockpit", "daily-note", "departments", workspace.workspace_id],
    enabled: open,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DepartmentRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as DepartmentRow[];
    },
  });

  // Default to first department on load.
  useEffect(() => {
    if (open && !departmentId && departments && departments.length > 0) {
      setDepartmentId(departments[0]!.department_id);
    }
  }, [open, departmentId, departments]);

  // Load any existing session row for the (workspace, department, date).
  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: [
      "cockpit",
      "daily-note",
      "session",
      workspace.workspace_id,
      departmentId,
      anchorDate,
    ],
    enabled: open && !!departmentId,
    staleTime: 30_000,
    queryFn: async (): Promise<SessionRow | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("department_session")
        .select("department_session_id, signoff_notes, handoff_notes")
        .eq("workspace_id", workspace.workspace_id)
        .eq("department_id", departmentId!)
        .eq("session_date", anchorDate)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as SessionRow | null) ?? null;
    },
  });

  // Sync form fields with whatever session exists for the selection.
  useEffect(() => {
    setSignoff(session?.signoff_notes ?? "");
    setHandoff(session?.handoff_notes ?? "");
  }, [session]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!departmentId) throw new Error("no department selected");
      const supabase = createClient();
      const payload = {
        workspace_id: workspace.workspace_id,
        department_id: departmentId,
        session_date: anchorDate,
        signoff_notes: signoff || null,
        handoff_notes: handoff || null,
      };
      const { data, error } = await supabase
        .from("department_session")
        .upsert(payload, { onConflict: "workspace_id,department_id,session_date" })
        .select("department_session_id")
        .single();
      if (error) throw error;
      return data as { department_session_id: string };
    },
    onSuccess: () => {
      toast.success(t("cockpit.daily_note_saved"));
      void queryClient.invalidateQueries({
        queryKey: [
          "cockpit",
          "daily-note",
          "session",
          workspace.workspace_id,
          departmentId,
          anchorDate,
        ],
      });
      onOpenChange(false);
    },
    onError: (err) => {
      console.error("[DailyNoteSheet] save failed", err);
      toast.error(t("cockpit.daily_note_save_failed"));
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("cockpit.daily_note_title")}</SheetTitle>
          <SheetDescription>{t("cockpit.daily_note_description")}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {departments && departments.length > 1 && (
            <div className="space-y-1.5">
              <Label>{t("cockpit.daily_note_select_department")}</Label>
              <Select value={departmentId ?? undefined} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.department_id} value={d.department_id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="daily-note-signoff">{t("cockpit.daily_note_signoff_label")}</Label>
            <Textarea
              id="daily-note-signoff"
              placeholder={t("cockpit.daily_note_signoff_placeholder")}
              value={signoff}
              onChange={(e) => setSignoff(e.target.value)}
              rows={5}
              disabled={loadingSession}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="daily-note-handoff">{t("cockpit.daily_note_handoff_label")}</Label>
            <Textarea
              id="daily-note-handoff"
              placeholder={t("cockpit.daily_note_handoff_placeholder")}
              value={handoff}
              onChange={(e) => setHandoff(e.target.value)}
              rows={5}
              disabled={loadingSession}
            />
          </div>
        </div>

        <SheetFooter className="mt-4">
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={!departmentId || saveMutation.isPending}
          >
            {t("cockpit.daily_note_save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
