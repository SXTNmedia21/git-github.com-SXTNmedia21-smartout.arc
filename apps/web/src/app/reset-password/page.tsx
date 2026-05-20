"use client";

/**
 * Reset Password page — requests a password-reset email.
 *
 * This route is now SINGLE-MODE. The previous dual-mode implementation (request
 * email OR set new password based on URL hash) was split per council Q9=a in
 * docs/superpowers/specs/2026-04-20-auth-invitation-implementation-plan.md §4.2.
 * The update-password form lives at /update-password (commit 76d93688), and
 * the middleware force_password_reset gate routes there (commit 4bd734f6).
 *
 * Entry points here:
 *  - User clicks "Glemt passord?" on /login
 *  - User lands here directly from a bookmark
 *
 * Flow: email input → supabase.auth.resetPasswordForEmail with redirectTo
 * pointing at /update-password → success toast → user checks inbox.
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
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const supabase = createClient();
    // redirectTo points at the PKCE callback so the `?code=` exchange happens
    // server-side; callback then forwards to /update-password with a live
    // session cookie. Direct redirect to /update-password breaks under PKCE
    // (the page only inspects `#access_token`, never the `?code=` query).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password`,
    });

    setIsLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setMessage({
      type: "success",
      text: "Hvis kontoen finnes, har vi sendt en lenke for å tilbakestille passordet.",
    });

    // Emit auth password_reset_requested (registry:263). SHA-256 hash only — never raw email.
    // user_exists is conservatively false here: Supabase hides account existence client-side for
    // enumeration-safety, so we cannot determine it from this surface. Server-side enumeration
    // check (if added later) should emit a richer event from an Edge Function or Server Action.
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
              Glemt passord?
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Vi sender deg en lenke for å sette et nytt.
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
