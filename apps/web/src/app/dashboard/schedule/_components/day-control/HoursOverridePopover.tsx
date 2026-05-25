// ============================================
// day-control/HoursOverridePopover.tsx
// Compact popover for creating, editing, or removing a date-specific hours override.
// Positioned absolutely below the opening hours display in OversiktTab.
// ============================================
"use client";

import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useHoursOverrides } from "../../_hooks/use-hours-overrides";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// UI Events:
// - action: upsertOverride (save button — creates or updates hours exception)
// - action: deleteOverride (remove button — deletes existing exception)
// - action: closePopover (cancel, click outside, or Escape)
// - action: toggleClosed (switch — marks day as closed)

type Props = {
  departmentId: string;
  dateId: string;
  onClose: () => void;
};

export function HoursOverridePopover({ departmentId, dateId, onClose }: Props) {
  const { isDark } = useContext(DashboardContext);
  const { override, isLoading, upsertOverride, deleteOverride } = useHoursOverrides(
    departmentId,
    dateId,
  );

  const [isClosed, setIsClosed] = useState(false);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [reason, setReason] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Seed form from existing override
  useEffect(() => {
    if (!override) return;
    setIsClosed(override.is_closed);
    setOpenTime(override.open_time?.substring(0, 5) ?? "08:00");
    setCloseTime(override.close_time?.substring(0, 5) ?? "22:00");
    setReason(override.reason ?? "");
  }, [override]);

  // Close on Escape or click outside
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [handleKeyDown, handleClickOutside]);

  const handleSave = () => {
    upsertOverride.mutate(
      {
        open_time: isClosed ? null : openTime,
        close_time: isClosed ? null : closeTime,
        is_closed: isClosed,
        reason: reason.trim() || null,
      },
      { onSuccess: onClose },
    );
  };

  const handleDelete = () => {
    if (!override) return;
    deleteOverride.mutate(override.id, { onSuccess: onClose });
  };

  const isSaving = upsertOverride.isPending || deleteOverride.isPending;

  return (
    <div
      ref={popoverRef}
      className={`animate-in fade-in slide-in-from-top-2 absolute top-full left-0 z-50 mt-1 w-72 rounded-xl border p-4 shadow-lg duration-150 ${
        isDark ? "border-border bg-muted/20 backdrop-blur-xl" : "border-border bg-card"
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-foreground text-xs font-bold">Apningstider unntak</span>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted rounded-lg p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Closed toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="hours-closed-toggle" className="text-[11px] font-semibold">
              Stengt hele dagen
            </Label>
            <Switch
              id="hours-closed-toggle"
              checked={isClosed}
              onCheckedChange={setIsClosed}
              disabled={isSaving}
            />
          </div>

          {/* Time inputs — hidden when closed */}
          {!isClosed ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="hours-open"
                  className="text-muted-foreground text-[10px] font-semibold"
                >
                  Apningstid
                </Label>
                <Input
                  id="hours-open"
                  type="time"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  disabled={isSaving}
                  className="h-8 text-[11px]"
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="hours-close"
                  className="text-muted-foreground text-[10px] font-semibold"
                >
                  Stengetid
                </Label>
                <Input
                  id="hours-close"
                  type="time"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  disabled={isSaving}
                  className="h-8 text-[11px]"
                />
              </div>
            </div>
          ) : null}

          {/* Reason */}
          <div className="space-y-1">
            <Label
              htmlFor="hours-reason"
              className="text-muted-foreground text-[10px] font-semibold"
            >
              Grunn
            </Label>
            <Input
              id="hours-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. Helligdag, Julebord..."
              disabled={isSaving}
              className="h-8 text-[11px]"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 flex-1 text-[11px] font-bold"
            >
              {upsertOverride.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Lagre
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="h-7 text-[11px]"
            >
              Avbryt
            </Button>
          </div>

          {override ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              disabled={isSaving}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive/70 h-7 w-full text-[11px] font-semibold"
            >
              {deleteOverride.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              Fjern unntak
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
