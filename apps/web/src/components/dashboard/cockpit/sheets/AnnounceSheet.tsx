"use client";

// ============================================
// AnnounceSheet.tsx
// Wraps the existing QuickBroadcast composer in
// a right-side Sheet so operators can announce
// without leaving cockpit.
// ============================================

import { useTranslation } from "@smartout/i18n";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QuickBroadcast } from "@/components/dashboard/interactive/QuickBroadcast";

type AnnounceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
};

export function AnnounceSheet({ open, onOpenChange, profileId }: AnnounceSheetProps) {
  const { t } = useTranslation("dashboard");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("cockpit.announce_title")}</SheetTitle>
          <SheetDescription>{t("cockpit.announce_description")}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <QuickBroadcast profileId={profileId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
