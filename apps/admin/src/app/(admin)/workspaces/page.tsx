/**
 * page.tsx — /workspaces
 *
 * Stub — implemented in M3.
 * Lists all granted workspaces for the accountant.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkspacesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
        </CardContent>
      </Card>
    </div>
  );
}
