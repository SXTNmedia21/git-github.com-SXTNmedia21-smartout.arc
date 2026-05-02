/**
 * page.tsx — /orders
 *
 * Stub — implemented in M3.
 * Order list lifted from platform-admin/billing/invoices pattern.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Ordrer</h1>
      <Card>
        <CardHeader>
          <CardTitle>Ordrer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
        </CardContent>
      </Card>
    </div>
  );
}
