"use client";

/**
 * BindingerTab — auto-suggestion rules: which mal is proposed for each
 * employment category / wage group combination.
 *
 * Lifts the existing `ContractTemplateBindingsSettings` component (previously
 * living at /dashboard/settings#contract-templates) into this hub tab. The
 * component itself is untouched — only its surface heading changes via this
 * wrapper to "Auto-forslag", making the purpose clearer now that it lives
 * inside the Kontrakter hub rather than in Settings.
 */

import { Suspense, lazy } from "react";
import { useTranslation } from "@smartout/i18n";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy import to avoid shipping the matrix UI in the initial hub bundle.
const ContractTemplateBindingsSettings = lazy(() =>
  import("../../../settings/_components/contract-template-bindings-settings").then((m) => ({
    default: m.ContractTemplateBindingsSettings,
  })),
);

function BindingerLoadingSkeleton() {
  return (
    <div className="space-y-6 p-1">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="space-y-4 pt-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function BindingerTab() {
  const { t } = useTranslation("contracts");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-foreground text-xl">{t("bindinger.heading")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("bindinger.subtitle")}</p>
      </div>
      <Suspense fallback={<BindingerLoadingSkeleton />}>
        <ContractTemplateBindingsSettings />
      </Suspense>
    </div>
  );
}
