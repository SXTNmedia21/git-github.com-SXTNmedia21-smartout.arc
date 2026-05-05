/**
 * page.tsx — /account
 *
 * Stub — implemented in M3.
 * Profile: name, email, signed-in companies, sign-out button.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Konto</h1>
      <Card>
        <CardHeader>
          <CardTitle>Konto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Stub — implemented in M3</p>
        </CardContent>
      </Card>
    </div>
  );
}
