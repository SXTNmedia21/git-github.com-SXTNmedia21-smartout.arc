"use client";

// ============================================
// DailyNoteSheet.tsx
// Reads:
//   - department_session.signoff_notes (current column, not deprecated)
//   - department_session.handoff_notes (deprecated per ADR-0188, kept until
//     Phase 2 reader migration). Shows the latest value prefilled in the
//     textarea so operators still see continuity during the deprecation window.
// Writes (two paths):
//   A. Untargeted: upsert signoff_notes on department_session + INSERT
//      session_note(note_type='handoff'). No audience. Preserved from original.
//   B. Targeted: calls create-targeted-note-action (Server Action) when
//      audience is non-empty + notify_at is set. Gated by C4 authority for
//      cross-dept audience (ADR-0333).
//
// NEW in Track E (dagslinjen-quickadd):
//   - prefillTime prop: sets default notify_at to today + HH:MM if provided
//   - "Hvem ser dette?" collapsible section with audience picker
//   - "Når påminne?" collapsible section with datetime picker
//   - confirm modal for cross-dept gate (requires_confirm response)
//
// Emits `handoff submitted` per ADR-0134 when handoff content is persisted.
// Emits `comm.scheduled_note.created` (via Server Action) when targeted note saved.
// ============================================

import { useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Bell, Building2, ChevronDown, Clock, Users, UserCheck } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createTargetedNoteAction } from "@/app/dashboard/_actions/create-targeted-note-action";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DailyNoteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorDate: string;
  /**
   * Track C passes the clicked slot time (HH:MM) so notify_at defaults to
   * today at that time. If absent, defaults to now + 1 hour.
   */
  prefillTime?: string;
};

type DepartmentRow = { department_id: string; name: string };
type TeamRow = { team_id: string; name: string; department_id: string | null };
type ShiftRow = {
  schedule_shift_id: string;
  start_time: string;
  end_time: string;
  role: string;
  department_id: string | null;
};
type ProfileRow = {
  profile_id: string;
  display_name: string;
  department_id: string | null;
};
type SessionRow = {
  department_session_id: string;
  signoff_notes: string | null;
  handoff_notes: string | null;
};

type AudienceMode = "dept" | "team" | "shift" | "profiles" | null;

// ─── Helper: build default notify_at ──────────────────────────────────────────

function buildDefaultNotifyAt(anchorDate: string, prefillTime?: string): string {
  if (prefillTime) {
    // anchorDate is YYYY-MM-DD, prefillTime is HH:MM
    return `${anchorDate}T${prefillTime}:00`;
  }
  // Default: now + 1 hour, rounded to next 5 min
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  // Format as local datetime-local string (YYYY-MM-DDTHH:MM)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function DailyNoteSheet({
  open,
  onOpenChange,
  anchorDate,
  prefillTime,
}: DailyNoteSheetProps) {
  const { t } = useTranslation("dashboard");
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  // ─── Untargeted note state (preserved from original) ──────────────────────
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [signoff, setSignoff] = useState("");
  const [handoff, setHandoff] = useState("");

  // ─── Targeted note state (new in Track E) ─────────────────────────────────
  const [audienceSectionOpen, setAudienceSectionOpen] = useState(false);
  const [notifySectionOpen, setNotifySectionOpen] = useState(false);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [notifyAt, setNotifyAt] = useState(() => buildDefaultNotifyAt(anchorDate, prefillTime));
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  // Confirm dialog for cross-dept gate response
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState("");
  // Flag: user clicked "Bekreft" in confirm dialog — we'll retry once
  const confirmPending = useRef(false);

  // ─── Queries ───────────────────────────────────────────────────────────────

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

  const { data: teams } = useQuery({
    queryKey: ["cockpit", "daily-note", "audience-teams", workspace.workspace_id],
    enabled: open && audienceMode === "team",
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<TeamRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team")
        .select("team_id, name, department_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as TeamRow[];
    },
  });

  const { data: shiftsForDate } = useQuery({
    queryKey: ["cockpit", "daily-note", "audience-shifts", workspace.workspace_id, anchorDate],
    enabled: open && audienceMode === "shift",
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<ShiftRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, start_time, end_time, role, department_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("shift_date", anchorDate)
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as ShiftRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["cockpit", "daily-note", "audience-profiles", workspace.workspace_id],
    enabled: open && audienceMode === "profiles",
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProfileRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, department_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });

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

  // ─── Effects ───────────────────────────────────────────────────────────────

  // Default to first department on load.
  useEffect(() => {
    if (open && !departmentId && departments && departments.length > 0) {
      setDepartmentId(departments[0]!.department_id);
    }
  }, [open, departmentId, departments]);

  // Sync form fields with whatever session exists for the selection.
  useEffect(() => {
    setSignoff(session?.signoff_notes ?? "");
    setHandoff(session?.handoff_notes ?? "");
  }, [session]);

  // Reset notify_at when prefillTime changes (new slot click).
  useEffect(() => {
    if (open) {
      setNotifyAt(buildDefaultNotifyAt(anchorDate, prefillTime));
    }
  }, [open, anchorDate, prefillTime]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const hasAudience =
    audienceMode !== null &&
    (selectedDeptIds.size > 0 ||
      selectedTeamIds.size > 0 ||
      selectedShiftIds.size > 0 ||
      selectedProfileIds.size > 0);

  const isTargeted = hasAudience && notifyAt.length > 0;

  // Build audience object from current selection mode + ids.
  function buildAudience() {
    if (!audienceMode) return null;
    return {
      dept_ids: audienceMode === "dept" ? [...selectedDeptIds] : undefined,
      team_ids: audienceMode === "team" ? [...selectedTeamIds] : undefined,
      shift_ids: audienceMode === "shift" ? [...selectedShiftIds] : undefined,
      profile_ids: audienceMode === "profiles" ? [...selectedProfileIds] : undefined,
    };
  }

  // Approximate recipient count for toast (dept/team/shift resolved at fanout).
  function approxRecipientCount(): number {
    switch (audienceMode) {
      case "dept":
        return selectedDeptIds.size;
      case "team":
        return selectedTeamIds.size;
      case "shift":
        return selectedShiftIds.size;
      case "profiles":
        return selectedProfileIds.size;
      default:
        return 0;
    }
  }

  // ─── Save mutation — untargeted path ──────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!departmentId) throw new Error("no department selected");
      const supabase = createClient();

      const upsertPayload = {
        workspace_id: workspace.workspace_id,
        department_id: departmentId,
        session_date: anchorDate,
        signoff_notes: signoff || null,
      };
      const { data: sessionRow, error: upsertError } = await supabase
        .from("department_session")
        .upsert(upsertPayload, {
          onConflict: "workspace_id,department_id,session_date",
        })
        .select("department_session_id")
        .single();
      if (upsertError) throw upsertError;
      const departmentSessionId = (sessionRow as { department_session_id: string })
        .department_session_id;

      const handoffContent = handoff.trim();
      if (handoffContent.length > 0) {
        if (!profileId) {
          throw new Error(
            "no profile context available for handoff submission (ADR-0134 requires non-null actor_id)",
          );
        }
        const { error: noteError } = await supabase.from("session_note").insert({
          workspace_id: workspace.workspace_id,
          department_session_id: departmentSessionId,
          note_type: "handoff",
          content: handoffContent,
          created_by: profileId,
        });
        if (noteError) throw noteError;

        void emit({
          event: "handoff submitted",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity: {
              entity_type: "department_session",
              entity_id: departmentSessionId,
            },
            data: { session_id: departmentSessionId },
          },
        });
      }

      return { department_session_id: departmentSessionId };
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

  // ─── Save mutation — targeted path ────────────────────────────────────────

  const targetedSaveMutation = useMutation({
    mutationFn: async () => {
      if (!departmentId) throw new Error("no department selected");

      // Validate
      const audience = buildAudience();
      if (!audience) {
        setAudienceError(t("cockpit.daily_note_audience_empty_error"));
        throw new Error("audience empty");
      }
      if (new Date(notifyAt) <= new Date()) {
        setNotifyError(t("cockpit.daily_note_notify_at_past_error"));
        throw new Error("notify_at in past");
      }

      setAudienceError(null);
      setNotifyError(null);

      // We need the session_id (department_session_id). Upsert first.
      const supabase = createClient();
      const { data: sessionRow, error: upsertError } = await supabase
        .from("department_session")
        .upsert(
          {
            workspace_id: workspace.workspace_id,
            department_id: departmentId,
            session_date: anchorDate,
          },
          { onConflict: "workspace_id,department_id,session_date" },
        )
        .select("department_session_id")
        .single();
      if (upsertError) throw upsertError;

      const departmentSessionId = (sessionRow as { department_session_id: string })
        .department_session_id;

      // ISO 8601 with timezone — convert local datetime-local value to ISO.
      const notifyAtIso = new Date(notifyAt).toISOString();

      const result = await createTargetedNoteAction({
        workspace_id: workspace.workspace_id,
        session_id: departmentSessionId,
        body: handoff.trim() || signoff.trim(),
        audience,
        notify_at: notifyAtIso,
        note_type: "targeted",
      });

      if (!result.ok && "requires_confirm" in result && result.requires_confirm) {
        // C4 gate returned confirm_required — surface AlertDialog
        setConfirmPrompt(result.prompt);
        setConfirmOpen(true);
        // Throw to prevent onSuccess running; confirm dialog will re-trigger
        throw new Error("confirm_required");
      }

      if (!result.ok && "error" in result) {
        throw new Error(result.error);
      } else if (!result.ok) {
        throw new Error(t("cockpit.daily_note_save_failed"));
      }

      return { note_id: result.note_id, sessionId: departmentSessionId };
    },
    onSuccess: (_data) => {
      const count = approxRecipientCount();
      const time = notifyAt.split("T")[1]?.slice(0, 5) ?? "";
      toast.success(t("cockpit.daily_note_targeted_saved", { count, time }));
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
    onError: (err: Error) => {
      if (err.message === "confirm_required") return; // handled by AlertDialog
      if (err.message === "audience empty" || err.message === "notify_at in past") return;
      console.error("[DailyNoteSheet] targeted save failed", err);
      if (err.message.includes("tverr-avdeling") || err.message.includes("cross-dept")) {
        toast.error(t("cockpit.daily_note_cross_dept_blocked"));
      } else {
        toast.error(t("cockpit.daily_note_save_failed"));
      }
    },
  });

  // ─── Handler: primary save button ─────────────────────────────────────────

  function handleSave() {
    if (isTargeted) {
      targetedSaveMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  }

  // ─── Handler: confirm cross-dept dialog ───────────────────────────────────

  function handleConfirmProceed() {
    setConfirmOpen(false);
    confirmPending.current = true;
    // Retry — the gate will fire again; if admin, it will allow.
    // The gate result at server side determines allow/deny — we can't skip it
    // client-side. So we retry the full action. If denied again, error surfaces.
    targetedSaveMutation.mutate();
  }

  // ─── Checkbox helpers ──────────────────────────────────────────────────────

  function toggleId(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  }

  // ─── Section animations (Nordic Split spring) ─────────────────────────────

  const sectionSpring = {
    type: "spring" as const,
    stiffness: motionTokens.spring.stiffness,
    damping: motionTokens.spring.damping,
    mass: motionTokens.spring.mass,
  };

  const isPending = saveMutation.isPending || targetedSaveMutation.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-md flex-col sm:max-w-lg"
          data-testid="daily-note-sheet"
        >
          <SheetHeader>
            <SheetTitle>{t("cockpit.daily_note_title")}</SheetTitle>
            <SheetDescription>{t("cockpit.daily_note_description")}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
            {/* Department selector */}
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

            {/* Signoff textarea */}
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

            {/* Handoff / body textarea */}
            <div className="space-y-1.5">
              <Label htmlFor="daily-note-handoff">{t("cockpit.daily_note_handoff_label")}</Label>
              <Textarea
                id="daily-note-handoff"
                placeholder={t("cockpit.daily_note_handoff_placeholder")}
                value={handoff}
                onChange={(e) => setHandoff(e.target.value)}
                rows={5}
                disabled={loadingSession}
                data-testid="note-body"
              />
            </div>

            {/* ── "Hvem ser dette?" collapsible ─────────────────────────── */}
            <div className="border-border overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setAudienceSectionOpen((v) => !v)}
                className="text-foreground hover:bg-muted/60 flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
                data-testid="audience-section-toggle"
              >
                <span className="flex items-center gap-2">
                  <Users className="text-muted-foreground h-4 w-4" />
                  {t("cockpit.daily_note_targeted_audience_section")}
                  {hasAudience && (
                    <span className="bg-primary text-primary-foreground inline-flex h-5 w-5 items-center justify-center rounded-full text-xs">
                      {approxRecipientCount()}
                    </span>
                  )}
                </span>
                <motion.div
                  animate={{ rotate: audienceSectionOpen ? 180 : 0 }}
                  transition={sectionSpring}
                >
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {audienceSectionOpen && (
                  <motion.div
                    key="audience-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                      height: "auto",
                      opacity: 1,
                      transition: {
                        ...sectionSpring,
                        opacity: { duration: motionTokens.enterMs / 1000 },
                      },
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      transition: { duration: motionTokens.exitMs / 1000 },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="border-border space-y-4 border-t px-4 py-4">
                      {/* Audience mode radio */}
                      <RadioGroup
                        value={audienceMode ?? ""}
                        onValueChange={(v) => {
                          setAudienceMode(v as AudienceMode);
                          setAudienceError(null);
                        }}
                        className="grid grid-cols-2 gap-2"
                      >
                        {(
                          [
                            {
                              value: "dept",
                              label: t("cockpit.daily_note_audience_radio_dept"),
                              icon: <Building2 className="h-4 w-4" />,
                            },
                            {
                              value: "team",
                              label: t("cockpit.daily_note_audience_radio_team"),
                              icon: <Users className="h-4 w-4" />,
                            },
                            {
                              value: "shift",
                              label: t("cockpit.daily_note_audience_radio_shift"),
                              icon: <Clock className="h-4 w-4" />,
                            },
                            {
                              value: "profiles",
                              label: t("cockpit.daily_note_audience_radio_profiles"),
                              icon: <UserCheck className="h-4 w-4" />,
                            },
                          ] as const
                        ).map(({ value, label, icon }) => (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                              audienceMode === value
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:bg-muted/60"
                            }`}
                          >
                            <RadioGroupItem value={value} className="sr-only" />
                            {icon}
                            {label}
                          </label>
                        ))}
                      </RadioGroup>

                      {/* Department multi-select */}
                      {audienceMode === "dept" && (
                        <div className="space-y-2">
                          {(departments ?? []).map((d) => (
                            <label
                              key={d.department_id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedDeptIds.has(d.department_id)}
                                onCheckedChange={() =>
                                  toggleId(selectedDeptIds, setSelectedDeptIds, d.department_id)
                                }
                              />
                              {d.name}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Team multi-select */}
                      {audienceMode === "team" && (
                        <div className="space-y-2">
                          {(teams ?? []).length === 0 && (
                            <p className="text-muted-foreground text-xs">
                              {t("cockpit.daily_note_audience_team_placeholder")}
                            </p>
                          )}
                          {(teams ?? []).map((tm) => (
                            <label
                              key={tm.team_id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedTeamIds.has(tm.team_id)}
                                onCheckedChange={() =>
                                  toggleId(selectedTeamIds, setSelectedTeamIds, tm.team_id)
                                }
                              />
                              {tm.name}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Shift multi-select */}
                      {audienceMode === "shift" && (
                        <div className="space-y-2">
                          {(shiftsForDate ?? []).length === 0 && (
                            <p className="text-muted-foreground text-xs">
                              {t("cockpit.daily_note_audience_shift_placeholder")}
                            </p>
                          )}
                          {(shiftsForDate ?? []).map((s) => (
                            <label
                              key={s.schedule_shift_id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedShiftIds.has(s.schedule_shift_id)}
                                onCheckedChange={() =>
                                  toggleId(
                                    selectedShiftIds,
                                    setSelectedShiftIds,
                                    s.schedule_shift_id,
                                  )
                                }
                              />
                              {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} {s.role}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Profile multi-select */}
                      {audienceMode === "profiles" && (
                        <div className="max-h-48 space-y-2 overflow-y-auto">
                          {(profiles ?? []).length === 0 && (
                            <p className="text-muted-foreground text-xs">
                              {t("cockpit.daily_note_audience_profiles_placeholder")}
                            </p>
                          )}
                          {(profiles ?? []).map((p) => (
                            <label
                              key={p.profile_id}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={selectedProfileIds.has(p.profile_id)}
                                onCheckedChange={() =>
                                  toggleId(selectedProfileIds, setSelectedProfileIds, p.profile_id)
                                }
                              />
                              {p.display_name}
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Audience validation error */}
                      {audienceError && (
                        <p className="text-destructive text-xs" data-testid="audience-error">
                          {audienceError}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── "Når påminne?" collapsible ────────────────────────────── */}
            <div className="border-border overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setNotifySectionOpen((v) => !v)}
                className="text-foreground hover:bg-muted/60 flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
                data-testid="notify-at-section-toggle"
              >
                <span className="flex items-center gap-2">
                  <Bell className="text-muted-foreground h-4 w-4" />
                  {t("cockpit.daily_note_targeted_notify_section")}
                  {notifySectionOpen && notifyAt && (
                    <span className="text-muted-foreground text-xs font-normal">
                      {notifyAt.split("T")[1]?.slice(0, 5)}
                    </span>
                  )}
                </span>
                <motion.div
                  animate={{ rotate: notifySectionOpen ? 180 : 0 }}
                  transition={sectionSpring}
                >
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {notifySectionOpen && (
                  <motion.div
                    key="notify-panel"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                      height: "auto",
                      opacity: 1,
                      transition: {
                        ...sectionSpring,
                        opacity: { duration: motionTokens.enterMs / 1000 },
                      },
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      transition: { duration: motionTokens.exitMs / 1000 },
                    }}
                    className="overflow-hidden"
                  >
                    <div className="border-border space-y-3 border-t px-4 py-4">
                      <Label htmlFor="daily-note-notify-at">
                        {t("cockpit.daily_note_notify_at_label")}
                      </Label>
                      {/* Native datetime-local input — works on all browsers without
                          a full calendar widget. Time rounded to 5-min intervals. */}
                      <input
                        id="daily-note-notify-at"
                        type="datetime-local"
                        value={notifyAt}
                        min={new Date().toISOString().slice(0, 16)}
                        step={300}
                        onChange={(e) => {
                          setNotifyAt(e.target.value);
                          setNotifyError(null);
                        }}
                        className="border-input focus-visible:ring-ring flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="notify-at-input"
                      />
                      {notifyError && (
                        <p className="text-destructive text-xs" data-testid="notify-at-error">
                          {notifyError}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Påminnelsen sendes ut innen ±5 min fra valgt tidspunkt (pg_cron-kadens).
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <SheetFooter className="mt-4">
            <Button type="button" onClick={handleSave} disabled={!departmentId || isPending}>
              {t("cockpit.daily_note_save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Cross-dept confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cockpit.daily_note_cross_dept_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPrompt || t("cockpit.daily_note_cross_dept_confirm_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("cockpit.daily_note_cross_dept_confirm_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmProceed}>
              {t("cockpit.daily_note_cross_dept_confirm_proceed")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
