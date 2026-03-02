// ============================================
// day-info-dialog.tsx
// Dialog for creating schedule_day_info entries.
// Supports note, event, alert categories with
// workspace / department / team scope selection.
// Connected to: use-day-info.ts (mutation)
// Connected to: day-context-menu.tsx (opens this dialog)
// ============================================
"use client";

import { useState } from "react";
import { CalendarDays, StickyNote, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { DayInfoCategory, DayInfoScopeType } from "../_hooks/use-day-info";
import { useCreateDayInfo } from "../_hooks/use-day-info";
import { useWeekRange } from "../_hooks/use-week-range";

// ── Props ───────────────────────────────────────────────────

type DayInfoDialogProps = {
  dateId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments?: { id: string; name: string }[];
  teams?: { id: string; name: string }[];
};

// ── Category pill button ────────────────────────────────────

function CategoryPill({
  label,
  value,
  selected,
  icon: Icon,
  onSelect,
}: {
  label: string;
  value: DayInfoCategory;
  selected: boolean;
  icon: React.ComponentType<{ className?: string }>;
  onSelect: (v: DayInfoCategory) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Scope pill button ───────────────────────────────────────

function ScopePill({
  label,
  value,
  selected,
  onSelect,
}: {
  label: string;
  value: DayInfoScopeType;
  selected: boolean;
  onSelect: (v: DayInfoScopeType) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {label}
    </button>
  );
}

// ── Dialog component ────────────────────────────────────────

export function DayInfoDialog({
  dateId,
  open,
  onOpenChange,
  departments = [],
  teams = [],
}: DayInfoDialogProps) {
  const { weekStart } = useWeekRange();
  const createDayInfo = useCreateDayInfo(weekStart);

  const [category, setCategory] = useState<DayInfoCategory>("note");
  const [scopeType, setScopeType] = useState<DayInfoScopeType>("workspace");
  const [scopeId, setScopeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function resetForm() {
    setCategory("note");
    setScopeType("workspace");
    setScopeId("");
    setTitle("");
    setContent("");
  }

  function handleSubmit() {
    if (!title.trim()) return;

    createDayInfo.mutate({
      date: dateId,
      title: title.trim(),
      content: content.trim() || null,
      scopeType,
      scopeId: scopeType === "workspace" ? null : scopeId || null,
      category,
      createdBy: null,
    });

    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetForm();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Legg til daginfo</DialogTitle>
          <DialogDescription>
            Opprett en hendelse, notat eller varsel for denne dagen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Category selector */}
          <div className="grid gap-2">
            <Label>Kategori</Label>
            <div className="flex gap-2">
              <CategoryPill
                label="Notat"
                value="note"
                selected={category === "note"}
                icon={StickyNote}
                onSelect={setCategory}
              />
              <CategoryPill
                label="Hendelse"
                value="event"
                selected={category === "event"}
                icon={CalendarDays}
                onSelect={setCategory}
              />
              <CategoryPill
                label="Varsel"
                value="alert"
                selected={category === "alert"}
                icon={AlertTriangle}
                onSelect={setCategory}
              />
            </div>
          </div>

          {/* Scope selector */}
          <div className="grid gap-2">
            <Label>Omfang</Label>
            <div className="flex gap-2">
              <ScopePill
                label="Alle"
                value="workspace"
                selected={scopeType === "workspace"}
                onSelect={(v) => {
                  setScopeType(v);
                  setScopeId("");
                }}
              />
              <ScopePill
                label="Avdeling"
                value="department"
                selected={scopeType === "department"}
                onSelect={(v) => {
                  setScopeType(v);
                  setScopeId("");
                }}
              />
              <ScopePill
                label="Team"
                value="team"
                selected={scopeType === "team"}
                onSelect={(v) => {
                  setScopeType(v);
                  setScopeId("");
                }}
              />
            </div>
          </div>

          {/* Department dropdown */}
          {scopeType === "department" && departments.length > 0 ? (
            <div className="grid gap-2">
              <Label>Avdeling</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg avdeling" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Team dropdown */}
          {scopeType === "team" && teams.length > 0 ? (
            <div className="grid gap-2">
              <Label>Team</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="day-info-title">Tittel</Label>
            <Input
              id="day-info-title"
              placeholder={
                category === "event"
                  ? "F.eks. Firmafest"
                  : category === "alert"
                    ? "F.eks. Strømbrudd planlagt"
                    : "F.eks. Husk vareleveranse"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Content */}
          <div className="grid gap-2">
            <Label htmlFor="day-info-content">Innhold (valgfritt)</Label>
            <Textarea
              id="day-info-content"
              placeholder="Legg til detaljer..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createDayInfo.isPending}>
            Opprett
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
