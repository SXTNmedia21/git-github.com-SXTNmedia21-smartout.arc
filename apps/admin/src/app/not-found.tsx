/**
 * not-found.tsx — global 404
 *
 * Rendered for any unmatched route or when notFound() is called
 * (e.g., accountant has no grants for this workspace).
 */
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">Siden finnes ikke eller du har ikke tilgang.</p>
          <Button asChild variant="default">
            <Link href="/workspaces">Gå til ordrer</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
