/**
 * page.tsx — /workspaces/[id]
 *
 * Stub — implemented in M3.
 * Per-workspace kartotek: fetches v_workspace_kartotek + recent orders.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkspaceDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
      <Card>
        <CardHeader>
          <CardTitle>Workspace {id}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
        </CardContent>
      </Card>
    </div>
  );
}
