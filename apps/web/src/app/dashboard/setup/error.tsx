"use client";

/**
 * /dashboard/setup error boundary.
 *
 * Catches render errors from the setup wizard (network, supabase, dynamic imports).
 * Does NOT catch errors inside Server Components — those bubble to the parent layout.
 *
 * Copy is specific: tells the user which page failed and what to do.
 */

import { useEffect } from "react";
import { Button } from "@smartout/ui";
import { AlertCircle } from "lucide-react";
import { useTranslation } from "@smartout/i18n";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SetupError({ error, reset }: ErrorProps) {
  const { t } = useTranslation("dashboard");

  useEffect(() => {
    console.error("[Setup] Wizard render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertCircle className="text-muted-foreground size-12" />
      <div className="max-w-md space-y-2">
        <h1 className="font-heading text-2xl">{t("setup.error.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("setup.error.body")}</p>
        {error.digest && (
          <p className="text-muted-foreground/50 font-mono text-xs">
            {t("setup.error.error_id", { digest: error.digest })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          {t("setup.error.back_to_dashboard")}
        </Button>
        <Button onClick={() => reset()}>{t("setup.error.retry")}</Button>
      </div>
    </div>
  );
}
