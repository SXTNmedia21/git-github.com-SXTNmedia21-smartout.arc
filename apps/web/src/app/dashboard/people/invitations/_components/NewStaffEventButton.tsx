"use client";

/**
 * NewStaffEventButton.tsx — Client island that owns the dialog open/close state.
 *
 * Receives the employee picker data from the server page via props and passes it
 * down to StaffEventDialog. This keeps the server page clean (no useState) while
 * still allowing the dialog to open on click.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { StaffEventDialog } from "./StaffEventDialog";
import type { EmployeePickerRow } from "../_actions/staff-event-actions";

export type NewStaffEventButtonProps = {
  employees: EmployeePickerRow[];
};

export function NewStaffEventButton({ employees }: NewStaffEventButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-orange hover:bg-brand-orange/90 ring-brand-orange/30 text-primary-foreground flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow-cta-lg)] ring-1 transition-[transform,box-shadow] hover:scale-[1.02] hover:shadow-[var(--shadow-cta-lg-hover)] active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Ny innkalling
      </button>

      <StaffEventDialog isOpen={open} onClose={() => setOpen(false)} employees={employees} />
    </>
  );
}
