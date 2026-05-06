"use client";

/**
 * error.tsx — /workspaces/[id] section-level error boundary
 *
 * Catches fetch/render errors on the workspace detail page.
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function WorkspaceDetailError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kunne ikke laste workspace</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Det oppstod en feil under lasting av workspace-data.
        </p>
        <Button onClick={reset} variant="outline" size="sm">
          Prøv igjen
        </Button>
      </CardContent>
    </Card>
  );
}
