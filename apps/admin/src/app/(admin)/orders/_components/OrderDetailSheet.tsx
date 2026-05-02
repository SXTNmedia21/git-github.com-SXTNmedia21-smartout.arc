/**
 * OrderDetailSheet.tsx — always-mounted Sheet, open derived from ?preview=
 *
 * Stub — implemented in M3.
 * Pattern: lift of invoice-detail-sheet.tsx (solves known Radix+Next race).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OrderDetailSheet() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OrderDetailSheet</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
      </CardContent>
    </Card>
  );
}
