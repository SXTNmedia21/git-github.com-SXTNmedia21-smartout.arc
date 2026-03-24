"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "checking" | "ok" | "error";

type ConnectionCheckResult = {
  status: ConnectionStatus;
  error: string | null;
};

export function useConnectionCheck(): ConnectionCheckResult {
  const [status, setStatus] = useState<ConnectionStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/smoke", {
          signal: AbortSignal.timeout(10000),
        });

        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const failedServices = body?.services
            ?.filter((s: { ok: boolean }) => !s.ok)
            ?.map((s: { name: string; error?: string }) => `${s.name}: ${s.error ?? "down"}`)
            ?.join(", ");
          setError(failedServices ?? `Server svarte med ${res.status}`);
          setStatus("error");
          return;
        }

        setStatus("ok");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kan ikke nå serveren");
        setStatus("error");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, error };
}
