"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-2xl font-bold">Noe gikk galt</h2>
      <p className="text-muted-foreground max-w-md">
        Vi beklager, en uventet feil oppstod. Prøv å laste siden på nytt.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-semibold transition-colors hover:opacity-90"
      >
        Prøv igjen
      </button>
    </div>
  );
}
