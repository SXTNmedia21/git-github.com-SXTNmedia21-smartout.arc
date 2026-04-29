"use client";

import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SelectEmployeeStep } from "./SelectEmployeeStep";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
};

export function EmployeePickerDrawer({ open, onOpenChange, workspaceId }: Props) {
  const router = useRouter();

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
            onChange={(profile) => {
              onOpenChange(false);
              router.push(`/dashboard/people/${profile.profile_id}?compose=open`);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
