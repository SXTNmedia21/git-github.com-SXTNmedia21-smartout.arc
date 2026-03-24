"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// This catches errors that occur outside the root layout — including errors in
// layout.tsx itself. It must provide its own <html> and <body> tags since the
// root layout is unavailable at this point.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
    Sentry.captureException(error, {
      tags: { boundary: "global-error" },
    });
  }, [error]);

  return (
    <html lang="nb">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Noe gikk galt</h1>
        <p style={{ color: "#666", maxWidth: "400px", margin: "1rem auto" }}>{error.message}</p>
        {error.digest && (
          <p style={{ color: "#999", fontSize: "0.75rem" }}>Feilkode: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            border: "1px solid #ccc",
            borderRadius: "6px",
            cursor: "pointer",
            background: "white",
          }}
        >
          Prøv igjen
        </button>
      </body>
    </html>
  );
}
