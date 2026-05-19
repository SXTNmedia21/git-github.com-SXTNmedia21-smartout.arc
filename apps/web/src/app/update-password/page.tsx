"use client";

/**
 * Update Password page — dedicated route for SETTING a new password.
 *
 * Split from /reset-password per Auth & Invitation P1 plan §4.2 / council Q9=a.
 * Rationale: two distinct user intents (request-link vs set-new-password) deserve
 * two distinct URLs. Middleware line 220 routes `force_password_reset` users here.
 *
 * Two entry paths — both handled by the same form:
 *  1. Supabase password recovery email — URL hash carries `#access_token=...&type=recovery`;
 *     Supabase client SDK auto-consumes the hash and fires a `PASSWORD_RECOVERY` auth event.
 *  2. Bubble-migrated users with `user_metadata.force_password_reset === true` — already
 *     authenticated via legacy bridge, middleware redirects them here until the flag clears.
 *
 * Safety: if neither path applies (no session AND no recovery hash on mount), we bounce
 * the user back to /reset-password so they can request a fresh link rather than sitting
 * on an unreachable form. Prevents the ghost-route class of bug documented in L-0089.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Info, CheckCircle2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthIconInput } from "@/components/auth/AuthIconInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [forceMigration, setForceMigration] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // Detect which entry path we're on. Supabase may consume the hash before our
  // effect runs, so we listen for PASSWORD_RECOVERY too. Bubble-migrated users
  // will already have a session with force_password_reset=true in metadata.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    const hasRecoveryHash = hash.includes("access_token") || hash.includes("type=recovery");

    const supabase = createClient();

    // Bootstrap: check for migration flag OR an active session that makes the form reachable.
    // If neither the hash nor a session grants us the right to be here, bounce to /reset-password
    // (L-0089 — a dead-end form is worse than a redirect).
    void supabase.auth.getUser().then(({ data }) => {
      const migrationFlag = data.user?.user_metadata?.force_password_reset === true;
      if (migrationFlag) {
        setForceMigration(true);
        setReady(true);
        return;
      }
      if (hasRecoveryHash || data.user) {
        setReady(true);
        return;
      }
      router.replace("/reset-password");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage({ type: "error", text: "Passordet må være minst 8 tegn." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passordene stemmer ikke overens." });
      return;
    }

    setIsLoading(true);

    const supabase = createClient();
    // Atomic update: rotate password AND clear the migration flag in one call.
    // The flag is how middleware knows to keep redirecting here; without clearing
    // it, the user would bounce right back after landing on /dashboard.
    const { data, error } = await supabase.auth.updateUser({
      password,
      data: { force_password_reset: false },
    });

    setIsLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setMessage({ type: "success", text: "Passordet er oppdatert! Sender deg videre..." });

    // Emit auth password_reset_completed (registry:275). User is authenticated at this point
    // so we have a real user_id. Context distinguishes forced migration from self-service.
    try {
      const userId = data.user?.id;
      if (userId) {
        void emit({
          event: "auth password_reset_completed",
          workspace_id: null,
          actor_id: nonEmpty(userId, "actor_id"),
          properties: {
            data: {
              user_id: userId,
              context: forceMigration ? "migration" : "self_service",
            },
          },
        });
      }
    } catch {
      // Non-fatal — telemetry must never block the redirect.
    }

    // 1.5s so the success toast is readable; then route to workspace selector.
    setTimeout(() => router.push("/select-workspace"), 1500);
  };

  return (
    <div className="bg-background relative flex min-h-[100dvh] overflow-hidden">
      <AuthBrandPanel variant="minimal" />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        {/* Mobile logo — panel collapses on <lg, logo steps in above the form. */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
          <Image src="/smartout-logo.png" alt="Smartout" width={120} height={42} priority />
        </div>

        <div className="w-full max-w-[400px]">
          {forceMigration && (
            <div
              className="border-info/20 bg-info/5 text-foreground animate-auth-in mb-5 flex gap-2.5 rounded-xl border px-4 py-3 text-[0.8125rem] leading-relaxed"
              style={{ animationDelay: "80ms" }}
            >
              <Info className="text-info mt-0.5 h-4 w-4 shrink-0" />
              <span>Vi har oppgradert plattformen. Sett et nytt passord for å fortsette.</span>
            </div>
          )}

          <div className="animate-auth-in mb-8" style={{ animationDelay: "120ms" }}>
            <h1 className="font-heading text-foreground text-[2rem] leading-[1.1] tracking-tight">
              Sett nytt passord
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Velg et nytt passord for kontoen din.
            </p>
          </div>

          {message && (
            <div
              className={
                "animate-auth-in mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm " +
                (message.type === "error"
                  ? "border-destructive/20 bg-destructive/5 text-destructive"
                  : "border-success/20 bg-success/5 text-success")
              }
            >
              {message.type === "error" ? (
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <form
            onSubmit={handleUpdatePassword}
            className="animate-auth-in space-y-4"
            style={{ animationDelay: "180ms" }}
            aria-busy={!ready}
          >
            <AuthIconInput
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 8 tegn"
              label="Nytt passord"
              icon={<Lock className="h-4 w-4" />}
              withPasswordToggle
              autoFocus
              disabled={!ready}
            />
            <AuthIconInput
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Skriv passordet igjen"
              label="Bekreft"
              icon={<Lock className="h-4 w-4" />}
              withPasswordToggle
              disabled={!ready}
            />

            <PasswordStrengthMeter password={password} />

            <button
              type="submit"
              disabled={isLoading || !ready}
              className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-cta-sm)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[var(--shadow-cta-md)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading
                ? "Oppdaterer..."
                : forceMigration
                  ? "Lagre og logg inn"
                  : "Oppdater passord"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="border-border/60 text-muted-foreground mt-8 border-t pt-5 text-center text-sm">
            Trenger du en ny lenke?{" "}
            <Link
              href="/reset-password"
              className="text-foreground hover:text-brand-orange font-medium transition-colors"
            >
              Be om ny tilbakestilling
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
