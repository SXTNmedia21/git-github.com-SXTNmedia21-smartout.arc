"use client";

/**
 * error.tsx — global error boundary
 *
 * Catches unhandled errors in the route tree.
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Noe gikk galt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            En uventet feil oppstod. Prøv igjen eller kontakt support.
          </p>
          {error.digest && (
            <p className="text-muted-foreground font-mono text-xs">ID: {error.digest}</p>
          )}
          <Button onClick={reset} variant="default">
            Prøv igjen
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
