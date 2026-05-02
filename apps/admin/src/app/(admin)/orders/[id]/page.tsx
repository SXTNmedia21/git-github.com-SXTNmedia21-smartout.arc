/**
 * page.tsx — /orders/[id]
 *
 * Stub — implemented in M3.
 * Order detail: InvoiceDetail (read-only) + DispatchesList + PaymentsHistory.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Ordre</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ordre {id}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
        </CardContent>
      </Card>
    </div>
  );
}
