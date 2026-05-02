/**
 * OrderTable.tsx — order list table (terminology: "ordre" not "faktura")
 *
 * Stub — implemented in M3.
 * Pattern: lift of invoice-table.tsx with Norwegian terminology.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OrderTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OrderTable</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
      </CardContent>
    </Card>
  );
}
