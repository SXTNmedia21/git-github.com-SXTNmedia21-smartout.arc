"use client";

// OTP verification form shared by both the login page and workspace entry overlay.
// Renders 6 digit inputs with auto-advance, paste, keyboard navigation, resend
// countdown, and emits telemetry for each OTP lifecycle event.

import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@smartout/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
type OtpContext = "login" | "workspace_entry" | "recovery";

interface OtpVerificationFormProps {
  email: string;
  context: OtpContext;
  onVerified: () => void;
  workspaceId?: string;
  actorId?: string;
}

// GoTrue verifies an emailed code against a token of a SPECIFIC type. A login /
// workspace-entry code is an `email` token (signInWithOtp); a password-reset
// code is a `recovery` token (resetPasswordForEmail). Verifying a recovery
// token with type:"email" makes GoTrue answer `otp_expired` — its misleading
// generic for "no matching token of THIS type" — even though the token is live.
// So the verify type MUST track the flow that issued the code.
const VERIFY_TYPE: Record<OtpContext, "email" | "recovery"> = {
  login: "email",
  workspace_entry: "email",
  recovery: "recovery",
};

export function OtpVerificationForm({
  email,
  context,
  onVerified,
  workspaceId,
  actorId,
}: OtpVerificationFormProps) {
  const { t } = useTranslation("auth");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const startTimeRef = useRef(Date.now());
  const supabase = createClient();

  // Count down the resend timer, enabling the resend button when it reaches 0.
  useEffect(() => {
    if (resendCountdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const maskedEmail = maskEmail(email);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value)) return;

      const newDigits = [...digits];
      newDigits[index] = value.slice(-1);
      setDigits(newDigits);
      setError(null);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newDigits.every((d) => d) && newDigits.join("").length === 6) {
        verifyCode(newDigits.join(""));
      }
    },
    [digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === "ArrowRight" && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (pasted.length === 0) return;

      const newDigits = [...digits];
      for (let i = 0; i < pasted.length && i < 6; i++) {
        newDigits[i] = pasted[i]!;
      }
      setDigits(newDigits);

      const nextEmpty = newDigits.findIndex((d) => !d);
      inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

      if (pasted.length === 6) {
        verifyCode(pasted);
      }
    },
    [digits],
  );

  async function verifyCode(code: string) {
    setIsVerifying(true);
    setAttempts((a) => a + 1);
    const duration = Date.now() - startTimeRef.current;

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: VERIFY_TYPE[context],
    });

    if (verifyError) {
      setIsVerifying(false);
      const newAttempts = attempts + 1;

      if (newAttempts >= 5) {
        setError(t("otp.error.tooMany"));
        emit({
          event: "auth otp_failed",
          workspace_id:
            (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
          actor_id: nonEmpty(actorId ?? "anonymous", "actor_id"),
          properties: { data: { reason: "max_attempts" } },
        });
      } else if (verifyError.message.includes("expired")) {
        setError(t("otp.error.expired"));
        emit({
          event: "auth otp_failed",
          workspace_id:
            (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
          actor_id: nonEmpty(actorId ?? "anonymous", "actor_id"),
          properties: { data: { reason: "expired" } },
        });
      } else {
        setError(t("otp.error.invalid"));
        emit({
          event: "auth otp_failed",
          workspace_id:
            (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
          actor_id: nonEmpty(actorId ?? "anonymous", "actor_id"),
          properties: { data: { reason: "wrong_code" } },
        });
      }

      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      return;
    }

    emit({
      event: "auth otp_verified",
      workspace_id: (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
      actor_id: nonEmpty(actorId ?? "anonymous", "actor_id"),
      properties: { data: { attempts: attempts + 1, duration_ms: duration } },
    });

    setIsVerifying(false);
    onVerified();
  }

  async function handleResend() {
    setCanResend(false);
    setResendCountdown(60);
    setDigits(Array(6).fill(""));
    setError(null);
    setAttempts(0);
    startTimeRef.current = Date.now();

    // Re-issue a code through the SAME endpoint that minted the original, so the
    // resent token type matches what verifyCode() will check (VERIFY_TYPE):
    //   recovery → resetPasswordForEmail (recovery token)
    //   login / workspace_entry → signInWithOtp (email token)
    // No `emailRedirectTo`: we are a pure-code flow. Setting it would make GoTrue
    // also render a magic link in the email — a one-time link that a mail-client
    // / proxy prefetch could burn, killing the shared token before the user types
    // the code. Code-only emails carry nothing prefetchable.
    // (handleResend is a click handler in a client component — window is always
    // defined here, no SSR guard needed.)
    const { error: resendError } =
      context === "recovery"
        ? await supabase.auth.resetPasswordForEmail(email)
        : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });

    // Enumeration safety (supabase/auth#1547): with shouldCreateUser:false,
    // GoTrue returns "Signups not allowed for otp" (otp_disabled) for unknown
    // emails. Treat as success — never surface it (would leak existence).
    // Genuine send failures show a generic i18n message, not the raw string.
    const isEnumerationSignal =
      resendError?.code === "otp_disabled" ||
      /signups not allowed/i.test(resendError?.message ?? "");
    if (resendError && !isEnumerationSignal) {
      setError(t("login.error.otp_send"));
      return;
    }

    emit({
      event: "auth otp_sent",
      workspace_id: (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
      actor_id: nonEmpty(actorId ?? "anonymous", "actor_id"),
      properties: { data: { context } },
    });
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-muted-foreground text-sm">{t("otp.subtitle", { email: maskedEmail })}</p>

      <div
        role="group"
        aria-label={t("otp.ariaGroupLabel")}
        className="flex gap-2"
        onPaste={handlePaste}
      >
        {digits.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isVerifying || attempts >= 5}
            aria-label={t("otp.ariaDigit", { n: i + 1 })}
            className={cn(
              "h-13 w-11 rounded-lg border text-center text-lg",
              // Geist Mono for the digit inputs — consistent with design system data displays
              "bg-background text-foreground font-mono",
              "focus:ring-primary/30 focus:ring-2 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive",
              digit && !error && "border-primary/50",
            )}
            whileFocus={{ scale: 1.04 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          />
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-destructive text-sm"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {canResend ? (
        <button
          onClick={handleResend}
          className="text-muted-foreground hover:text-foreground text-sm underline"
        >
          {t("otp.resend")}
        </button>
      ) : (
        <p className="text-muted-foreground font-mono text-sm tabular-nums">
          {t("otp.resendCountdown", { seconds: resendCountdown })}
        </p>
      )}
    </div>
  );
}

// Masks an email address for display: pontus@smartout.ai → p***@s***.ai
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const dotIndex = domain.indexOf(".");
  if (dotIndex === -1) return email;
  const domainName = domain.slice(0, dotIndex);
  const tld = domain.slice(dotIndex);
  return `${local[0]}***@${domainName[0]}***${tld}`;
}
