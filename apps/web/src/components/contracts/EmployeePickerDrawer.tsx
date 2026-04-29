"use client";

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SelectEmployeeStep, type EmployeeProfile } from "./SelectEmployeeStep";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Called when user picks an employee. Parent should close this drawer
      (typically by setting open=false) and mount ContractDispatchDrawer
      with the picked profile. No navigation — flow stays on the hub. */
  onPick: (profile: EmployeeProfile) => void;
};

export function EmployeePickerDrawer({ open, onOpenChange, workspaceId, onPick }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="employee-picker-drawer"
        side="right"
        className="bg-background border-border/60 flex w-full flex-col gap-0 p-0 sm:max-w-[480px]"
      >
        <header className="border-border/60 border-b px-6 pt-6 pb-4">
          <SheetTitle className="font-heading text-foreground text-2xl leading-tight tracking-tight">
            Lag kontrakt
          </SheetTitle>
          <SheetDescription className="text-muted-foreground mt-1 text-sm">
            Velg hvem du vil sende kontrakt til.
          </SheetDescription>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <SelectEmployeeStep
            mode="single"
            workspaceId={workspaceId}
            selectedId={null}
            onChange={onPick}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
