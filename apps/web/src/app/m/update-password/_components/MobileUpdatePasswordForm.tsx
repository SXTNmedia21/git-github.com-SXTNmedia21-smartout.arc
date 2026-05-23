"use client";

/**
 * MobileUpdatePasswordForm — password-reset form rendered after server-side
 * token_hash verification at /m/update-password.
 *
 * This component is only mounted when the server page has already called
 * `supabase.auth.verifyOtp({ token_hash, type: "recovery" })` and the session
 * cookie is in place. The user simply sets a new password; no further auth
 * handshake is needed.
 *
 * Design mirrors /update-password (same auth-form shell, AuthBrandPanel,
 * PasswordStrengthMeter) per Nordic Split § auth surfaces.
 *
 * After a successful updateUser() the user is redirected to /select-workspace
 * so they can pick the right workspace — same post-reset destination as the
 * portal flow.
 */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, Info, CheckCircle2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthIconInput } from "@/components/auth/AuthIconInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

export function MobileUpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();

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
    // Rotate password and clear any forced-reset flag in one call.
    // The session was already established server-side by verifyOtp; this is
    // the authenticated write that GoTrue requires to accept the new password.
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

    // Emit telemetry — mirrors portal /update-password (registry event 275).
    // workspace_id is null because the user has not yet picked a workspace.
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
              // "self_service" = normal user-initiated reset (not a forced migration).
              // The mobile fallback path is user-initiated, so this is correct.
              context: "self_service",
            },
          },
        });
      }
    } catch {
      // Non-fatal — telemetry must never block the redirect.
    }

    // 1.5s so the success message is readable; then route to workspace selector.
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
            />

            <PasswordStrengthMeter password={password} />

            <button
              type="submit"
              disabled={isLoading}
              className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-cta-sm)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[var(--shadow-cta-md)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? "Oppdaterer..." : "Oppdater passord"}
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
