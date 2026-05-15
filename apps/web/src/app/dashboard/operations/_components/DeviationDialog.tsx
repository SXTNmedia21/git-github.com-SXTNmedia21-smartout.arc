"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";

type DeviationDialogProps = {
  workspaceId: string;
  profileId: string;
  /** Department list for the department Select. Defaults to [] when omitted (controlled-open path). */
  departments?: Array<{ id: string; name: string }>;
  /** When provided, dialog is controlled by the caller. No trigger button is rendered. */
  open?: boolean;
  /** Called when the dialog wants to close (user cancels or submit succeeds). */
  onOpenChange?: (open: boolean) => void;
  /** Prefill occurred_at (ISO datetime, e.g. "2026-05-15T14:00:00") from slot popover. */
  defaultOccurredAt?: string;
  /** Preselect this department when opened from slot popover. */
  defaultDepartmentId?: string;
};

const DOMAIN_OPTIONS = [
  { value: "safety", label: "Sikkerhet" },
  { value: "customer", label: "Kunde" },
  { value: "procedure", label: "Prosedyre" },
  { value: "system", label: "System" },
  { value: "material", label: "Materiale" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "low", label: "Lav" },
  { value: "medium", label: "Middels" },
  { value: "high", label: "Hoy" },
  { value: "critical", label: "Kritisk" },
] as const;

export function DeviationDialog({
  workspaceId,
  profileId,
  departments,
  open: controlledOpen,
  onOpenChange,
  defaultOccurredAt,
  defaultDepartmentId,
}: DeviationDialogProps) {
  const queryClient = useQueryClient();

  // Controlled vs uncontrolled: when caller supplies `open`, we delegate to them.
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const effectiveOpen = isControlled ? controlledOpen : internalOpen;
  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Resolve departments — controlled-open callers may omit the prop.
  const resolvedDepartments = departments ?? [];

  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState<string>("");
  const [severity, setSeverity] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>(defaultDepartmentId ?? "");
  const [description, setDescription] = useState("");

  const createDeviationMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("deviation").insert({
        workspace_id: workspaceId,
        department_id: departmentId || null,
        title: title.trim(),
        domain: domain as "safety" | "customer" | "procedure" | "system" | "material",
        severity: severity as "low" | "medium" | "high" | "critical",
        description: description.trim() || null,
        reported_by: profileId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      emit({
        event: "deviation reported",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: {
            entity_type: "department",
            entity_id: departmentId || workspaceId,
          },
          data: { domain, severity },
        },
      });
      toast.success("Avvik registrert");
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      handleOpenChange(false);
      setTitle("");
      setDomain("");
      setSeverity("");
      setDepartmentId(defaultDepartmentId ?? "");
      setDescription("");
    },
    onError: () => {
      toast.error("Kunne ikke registrere avvik");
    },
  });

  return (
    <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
      {/* Trigger button only rendered in uncontrolled mode (existing call sites). */}
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Registrer avvik
          </Button>
        </DialogTrigger>
      )}
      <DialogContent data-testid="deviation-dialog">
        <DialogHeader>
          <DialogTitle>
            {defaultOccurredAt ? `Nytt avvik kl ${defaultOccurredAt.slice(11, 16)}` : "Nytt avvik"}
          </DialogTitle>
          <DialogDescription>Registrer et avvik som oppsto under drift.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Tittel</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kort beskrivelse av avviket"
            />
          </div>

          <div className="grid gap-2">
            <Label>Domene</Label>
            <Select value={domain} onValueChange={setDomain}>
              <SelectTrigger>
                <SelectValue placeholder="Velg domene" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Alvorlighetsgrad</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Velg alvorlighetsgrad" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Avdeling</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Alle avdelinger" />
              </SelectTrigger>
              <SelectContent>
                {resolvedDepartments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Beskrivelse</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hva skjedde? Hva ble gjort?"
              rows={3}
            />
          </div>
        </div>

        <Button
          onClick={() => createDeviationMutation.mutate()}
          disabled={createDeviationMutation.isPending || !title.trim() || !domain || !severity}
        >
          {createDeviationMutation.isPending ? "Lagrer..." : "Registrer avvik"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
