/**
 * page.tsx — /auth/login
 *
 * Email magic-link / OTP entry for accountants.
 * No Google OAuth in Phase 1 — accountant onboarding is high-trust.
 */
import { LoginForm } from "./_components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Logg inn</CardTitle>
          <p className="text-muted-foreground text-sm">
            Skriv inn e-postadressen din for å motta en engangskode.
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
