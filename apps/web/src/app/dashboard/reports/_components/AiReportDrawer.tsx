// ============================================
// AiReportDrawer.tsx
// Wraps ReportsChatPanel in a shadcn Sheet drawer.
// Triggered by floating button in ReportsPageShell.
// ============================================

"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReportsChatPanel } from "./ReportsChatPanel";

type AiReportDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onReportData: (data: unknown) => void;
  onReportSaved: () => void;
};

export function AiReportDrawer({
  open,
  onOpenChange,
  workspaceId,
  onReportData,
  onReportSaved,
}: AiReportDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[420px] flex-col p-0 sm:max-w-[420px]">
        <SheetHeader className="sr-only">
          <SheetTitle>AI Rapportassistent</SheetTitle>
        </SheetHeader>
        <ReportsChatPanel
          workspaceId={workspaceId}
          onReportData={onReportData}
          onReportSaved={onReportSaved}
        />
      </SheetContent>
    </Sheet>
  );
}
