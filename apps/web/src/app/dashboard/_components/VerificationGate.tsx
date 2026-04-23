"use client";

// Workspace verification gate — wraps dashboard content with a full-screen
// OTP overlay for users whose email hasn't been confirmed yet. Auto-sends the
// OTP on mount, then exits the sandbox lifecycle state on successful verification.
//
// This is NOT the onboarding activation path. It handles the security sandbox
// lifecycle: new workspaces start as 'sandbox' (migration 20260329200000) and
// transition to 'active' only after email ownership is confirmed. The onboarding
// flow (setup_guide_completed, onboarding_completed) is a separate concern.

import { useState, useEffect, useRef } from "react";
import { createClient } from "@smartout/supabase/client";
import { OtpVerificationForm } from "@/components/auth/OtpVerificationForm";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
interface VerificationGateProps {
  children: React.ReactNode;
  workspaceId: string;
  userEmail: string;
  actorId: string;
}

export function VerificationGate({
  children,
  workspaceId,
  userEmail,
  actorId,
}: VerificationGateProps) {
  const { t } = useTranslation("auth");
  // null = loading, true = verified, false = needs verification
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  // Ref instead of state — prevents re-triggering the effect when the flag flips,
  // and guards against React Strict Mode double-invoke sending the OTP twice.
  const otpSentRef = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    async function checkVerification() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const verified = user.email_confirmed_at != null;
      setIsVerified(verified);

      // Auto-send OTP on first unverified visit — guard via ref so it fires only once
      if (!verified && !otpSentRef.current) {
        otpSentRef.current = true;
        await supabase.auth.signInWithOtp({
          email: userEmail,
          options: { shouldCreateUser: false },
        });

        emit({
          event: "auth otp_sent",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(actorId, "actor_id"),
          properties: { data: { context: "workspace_entry" } },
        });
      }
    }

    void checkVerification();
    // Empty deps — intentionally run once on mount. supabase client and props
    // are stable for the lifetime of this component (dashboard entry check).
  }, []);

  async function handleVerified() {
    // Exit sandbox lifecycle state — email ownership is now confirmed.
    // This updates the security sandbox status (workspace_status enum),
    // NOT the onboarding completion flags (setup_guide_completed, onboarding_completed).
    const { error } = await supabase
      .from("workspace")
      .update({ status: "active" })
      .eq("workspace_id", workspaceId);

    if (error) {
      console.error("Failed to exit sandbox after OTP verification:", error);
    }

    setIsVerified(true);
  }

  // Still checking — render children without blocking so layout does not flash
  if (isVerified === null) return <>{children}</>;

  // Verified — render dashboard normally
  if (isVerified) return <>{children}</>;

  // Not yet verified — render dashboard behind a glassmorphism OTP overlay
  return (
    <>
      {children}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.3 }}
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 35,
              damping: 22,
              mass: 2.2,
            }}
            className="bg-card/80 w-full max-w-md rounded-2xl border border-white/[0.08] p-8 shadow-xl backdrop-blur-xl"
          >
            <h2 className="font-heading mb-2 text-center text-xl">{t("otp.title")}</h2>

            <OtpVerificationForm
              email={userEmail}
              context="workspace_entry"
              onVerified={handleVerified}
              workspaceId={workspaceId}
              actorId={actorId}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
