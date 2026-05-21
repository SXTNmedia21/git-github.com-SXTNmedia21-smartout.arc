"use client";

/**
 * Reset Password page — requests a password-reset email.
 *
 * SINGLE-MODE: this page only REQUESTS the email. Setting the new password
 * happens on /update-password (council Q9=a, split commit 76d93688).
 *
 * Flow (token_hash, robust SSR — ADR auth-token-hash 2026-05-21):
 *   email input → resetPasswordForEmail(email) → GoTrue sends the recovery
 *   email whose template links to /api/auth/callback?token_hash=…&type=recovery
 *   &next=/update-password. The user clicks it; the callback verifies the
 *   token_hash SERVER-SIDE (no PKCE code_verifier cookie required → works across
 *   email clients/devices) and lands them on /update-password with a live
 *   recovery session. We deliberately pass NO `redirectTo` here — the template
 *   owns the destination, and a redirectTo would re-introduce the fragile
 *   PKCE `?code=` link.
 *
 * Entry points:
 *  - "Glemt passord?" on /login
 *  - direct bookmark
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, Send, Info, CheckCircle2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { AuthIconInput } from "@/components/auth/AuthIconInput";

/**
 * Hash an email with SHA-256 for enumeration-safe telemetry.
 * Registry contract: registry.ts:AuthPasswordResetRequested.properties.data.email_hash
 * must be a hash — never the raw email. Used to dedupe/rate-limit.
 */
async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    // No `redirectTo`: the email template owns the destination via a
    // token_hash link to /api/auth/callback (see file header). redirectTo
    // would mint the fragile PKCE `?code=` link instead.
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    setIsLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setSent(true);
    setMessage({
      type: "success",
      text: "Hvis kontoen finnes, har vi sendt en lenke for å sette et nytt passord. Sjekk e-posten din.",
    });

    // Emit auth password_reset_requested (registry:263). SHA-256 hash only — never raw email.
    // user_exists is conservatively false: Supabase hides account existence client-side for
    // enumeration-safety, so we cannot determine it from this surface.
    try {
      const email_hash = await hashEmail(email);
      void emit({
        event: "auth password_reset_requested",
        workspace_id: null,
        actor_id: nonEmpty("", "actor_id"),
        properties: { data: { email_hash, user_exists: false } },
      });
    } catch {
      // Non-fatal — telemetry must not break the user flow.
    }
  };

  return (
    <div className="bg-background relative flex min-h-[100dvh] overflow-hidden">
      <AuthBrandPanel
        headline={
          <>
            Teamet ditt,
            <br />
            <span style={{ color: "var(--brand-orange-warm)" }}>klar</span> fra dag en.
          </>
        }
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
          <Image src="/smartout-logo.png" alt="Smartout" width={120} height={42} priority />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="animate-auth-in mb-8" style={{ animationDelay: "100ms" }}>
            <h1 className="font-heading text-foreground text-[2rem] leading-[1.1] tracking-tight">
              {sent ? "Sjekk e-posten" : "Glemt passord?"}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {sent
                ? "Klikk lenken i e-posten for å sette et nytt passord."
                : "Vi sender deg en lenke for å sette et nytt passord."}
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

          {sent ? (
            <div className="animate-auth-in space-y-4" style={{ animationDelay: "160ms" }}>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setMessage(null);
                }}
                className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Bruk en annen e-post
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleRequestReset}
              className="animate-auth-in space-y-4"
              style={{ animationDelay: "160ms" }}
            >
              <AuthIconInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="navn@bedrift.no"
                label="E-post"
                icon={<Mail className="h-4 w-4" />}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-brand-orange flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-cta-sm)] transition-[transform,box-shadow,filter] duration-200 hover:shadow-[var(--shadow-cta-md)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isLoading ? "Sender..." : "Send lenke"}
              </button>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbake til innlogging
              </Link>
            </form>
          )}

          <p className="border-border/60 text-muted-foreground mt-8 border-t pt-5 text-center text-sm">
            Husker du passordet?{" "}
            <Link
              href="/login"
              className="text-foreground hover:text-brand-orange font-medium transition-colors"
            >
              Tilbake til innlogging
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
